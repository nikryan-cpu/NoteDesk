// The page runtime: installed into each chat service's page inside an isolated JS world, where
// it reads the DOM (composer, send/stop buttons, assistant messages) and converts answers to
// Markdown. engine.ts drives it through webContents.executeJavaScriptInIsolatedWorld, so the
// installer below is shipped as a source string (Function.prototype.toString()) and re-parsed
// on the page. That means installRuntime must not reach outside its own body: no imports, no
// module-scope references, every helper declared inside it.
import type { PageConfig, PageProbe, PageRuntime, ToggleConfig } from './types'

declare global {
  interface Window {
    __ndAsk?: PageRuntime
  }
}

/**
 * Builds window.__ndAsk from a PageConfig. This function is never called directly from
 * NoteDesk's own process — only its source is used, via runtimeScript() below. Keep it
 * self-contained: nothing it references may live outside this function body.
 */
export function installRuntime(config: PageConfig): void {
  const BLOCK_TAGS: Record<string, boolean> = {
    p: true,
    div: true,
    section: true,
    article: true,
    main: true,
    header: true,
    footer: true,
    ul: true,
    ol: true,
    li: true,
    blockquote: true,
    pre: true,
    table: true,
    h1: true,
    h2: true,
    h3: true,
    h4: true,
    h5: true,
    h6: true,
    figure: true,
    form: true,
    hr: true,
  }

  // Elements that flow with the surrounding text instead of starting their own paragraph -
  // a streamed answer often lands as many of these (and bare text nodes) as direct siblings,
  // with no <p> wrapper at all, and they must all read as one paragraph.
  const INLINE_TAGS: Record<string, boolean> = {
    strong: true,
    b: true,
    em: true,
    i: true,
    del: true,
    s: true,
    strike: true,
    code: true,
    a: true,
    img: true,
    br: true,
    span: true,
    sub: true,
    sup: true,
    u: true,
    mark: true,
    small: true,
    abbr: true,
    kbd: true,
    cite: true,
    q: true,
    time: true,
    label: true,
    input: true,
    wbr: true,
  }

  // Header elements next to a <pre> that were used only to label its language (or that hold
  // just a copy button) - renderCodeBlock reads them, but they must not also show up as a
  // stray paragraph above the fence. Populated fresh for each answer, see markCodeHeaders.
  let consumedHeaders: Element[] = []

  // --- small DOM helpers, all defensive since page markup and selector support vary ---

  function safeQueryAll(root: ParentNode, selector: string): Element[] {
    try {
      const list = root.querySelectorAll(selector)
      const out: Element[] = []
      for (let i = 0; i < list.length; i++) out.push(list[i])
      return out
    } catch (e) {
      return []
    }
  }

  function safeQueryFirst(root: ParentNode, selectors: string[]): Element | null {
    for (let i = 0; i < selectors.length; i++) {
      try {
        const el = root.querySelector(selectors[i])
        if (el) return el
      } catch (e) {
        // unsupported selector (e.g. :has in an older engine) - try the next one
      }
    }
    return null
  }

  function safeMatches(el: Element, selector: string): boolean {
    try {
      return el.matches(selector)
    } catch (e) {
      return false
    }
  }

  function matchesAny(el: Element, selectors: string[]): boolean {
    for (let i = 0; i < selectors.length; i++) {
      if (safeMatches(el, selectors[i])) return true
    }
    return false
  }

  function existsAny(selectors: string[]): boolean {
    for (let i = 0; i < selectors.length; i++) {
      if (safeQueryAll(document, selectors[i]).length > 0) return true
    }
    return false
  }

  function firstUsable(selectors: string[], predicate: (el: Element) => boolean): Element | null {
    for (let i = 0; i < selectors.length; i++) {
      const els = safeQueryAll(document, selectors[i])
      for (let j = 0; j < els.length; j++) {
        if (predicate(els[j])) return els[j]
      }
    }
    return null
  }

  function anyVisible(selectors: string[]): boolean {
    for (let i = 0; i < selectors.length; i++) {
      const els = safeQueryAll(document, selectors[i])
      for (let j = 0; j < els.length; j++) {
        if (visible(els[j])) return true
      }
    }
    return false
  }

  // --- visibility: real pages get a strict check, happy-dom (no layout engine) gets a loose one ---

  function hasLayout(): boolean {
    try {
      const rect = document.documentElement.getBoundingClientRect()
      return rect.width > 0 || rect.height > 0
    } catch (e) {
      return false
    }
  }

  function isStyleHidden(el: Element): boolean {
    let node: Element | null = el
    let first = true
    while (node) {
      if (node.hasAttribute && node.hasAttribute('hidden')) return true
      let style: CSSStyleDeclaration | null = null
      try {
        style = window.getComputedStyle(node)
      } catch (e) {
        style = null
      }
      if (style) {
        if (style.display === 'none') return true
        if (style.visibility === 'hidden' || style.visibility === 'collapse') return true
        if (first) {
          const opacity = parseFloat(style.opacity || '1')
          if (!isNaN(opacity) && opacity === 0) return true
        }
      }
      node = node.parentElement
      first = false
    }
    return false
  }

  function visible(el: Element | null): boolean {
    if (!el) return false
    if (isStyleHidden(el)) return false
    const field = el as { disabled?: boolean }
    if (field.disabled) return false
    if (!hasLayout()) return true
    const withCheck = el as { checkVisibility?: () => boolean }
    if (typeof withCheck.checkVisibility === 'function') {
      try {
        return withCheck.checkVisibility()
      } catch (e) {
        // fall through to the rect check below
      }
    }
    try {
      return el.getClientRects().length > 0
    } catch (e) {
      return true
    }
  }

  function isClickable(el: Element): boolean {
    if (!visible(el)) return false
    const field = el as { disabled?: boolean }
    if (field.disabled) return false
    if (el.getAttribute('aria-disabled') === 'true') return false
    return true
  }

  // --- composer: config selectors first, then a generic fallback for pages we don't know ---

  function isComposerUsable(el: Element): boolean {
    if (!visible(el)) return false
    const tag = el.tagName.toLowerCase()
    if (tag === 'textarea' || tag === 'input') {
      const field = el as HTMLTextAreaElement | HTMLInputElement
      if (field.disabled || field.readOnly) return false
      return true
    }
    const editable = el.getAttribute('contenteditable')
    if (editable !== null && editable.toLowerCase() !== 'false') {
      if (el.getAttribute('aria-disabled') === 'true') return false
      return true
    }
    return false
  }

  function findGenericComposer(): Element | null {
    const candidates: Element[] = []
    const textareas = safeQueryAll(document, 'textarea')
    for (let i = 0; i < textareas.length; i++) candidates.push(textareas[i])
    const editables = safeQueryAll(document, '[contenteditable="true"]')
    for (let i = 0; i < editables.length; i++) candidates.push(editables[i])

    const layout = hasLayout()
    const vh = window.innerHeight || document.documentElement.clientHeight || 0
    let best: Element | null = null
    let bestArea = -1
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i]
      if (!isComposerUsable(el)) continue
      if (!layout || vh === 0) {
        if (!best) best = el
        continue
      }
      const rect = el.getBoundingClientRect()
      if (rect.top < vh / 2) continue
      const area = rect.width * rect.height
      if (area > bestArea) {
        bestArea = area
        best = el
      }
    }
    return best
  }

  function locateComposer(): Element | null {
    return firstUsable(config.composer, isComposerUsable) || findGenericComposer()
  }

  // --- challenge / captcha interstitials ---

  function detectChallenge(): boolean {
    const title = (document.title || '').toLowerCase()
    if (title.indexOf('just a moment') !== -1) return true
    if (safeQueryAll(document, '#challenge-form').length > 0) return true
    if (safeQueryAll(document, '#cf-challenge-running').length > 0) return true

    const cfFrames = safeQueryAll(document, 'iframe[src*="challenges.cloudflare.com"]')
    for (let i = 0; i < cfFrames.length; i++) {
      if (visible(cfFrames[i])) return true
    }
    // a solved / invisible turnstile widget renders with no size - only a widget actually
    // asking the user something has one, so `visible()` alone tells the two apart
    const turnstiles = safeQueryAll(document, '.cf-turnstile, [class*="turnstile" i], [id*="turnstile" i]')
    for (let i = 0; i < turnstiles.length; i++) {
      if (visible(turnstiles[i])) return true
    }
    const bodyText = document.body ? document.body.innerText || document.body.textContent || '' : ''
    if (bodyText.length < 400 && /verify you are human|checking your browser before accessing|please stand by/i.test(bodyText)) {
      return true
    }
    return false
  }

  // --- signed in / out ---

  function computeSignedIn(): boolean | null {
    if (existsAny(config.signedIn)) return true
    if (existsAny(config.signedOut)) return false
    return null
  }

  // --- assistant messages ---

  function findAssistantMessages(): Element[] {
    for (let i = 0; i < config.assistant.length; i++) {
      const els = safeQueryAll(document, config.assistant[i])
      if (els.length > 0) return els
    }
    return []
  }

  // --- math: KaTeX wraps the source TeX in an accessible <annotation>; MathJax's tex2jax
  // output does the same. The rendered half is aria-hidden and gets dropped by shouldSkip. ---

  function isMathRoot(el: Element): boolean {
    const tag = el.tagName.toLowerCase()
    if (tag === 'math' || tag === 'mjx-container') return true
    return !!(el.classList && (el.classList.contains('katex-display') || el.classList.contains('katex')))
  }

  function findTex(container: Element): string | null {
    let ann: Element | null = null
    try {
      ann = container.querySelector('annotation[encoding="application/x-tex"]')
    } catch (e) {
      ann = null
    }
    if (ann) return ann.textContent || ''
    let script: Element | null = null
    try {
      script = container.querySelector('script[type="math/tex"]')
    } catch (e) {
      script = null
    }
    if (script) return script.textContent || ''
    return null
  }

  function mathMarkdown(el: Element): string | null {
    if (!isMathRoot(el)) return null
    const tex = findTex(el)
    if (tex === null) return null
    const cleaned = tex.replace(/\s+/g, ' ').trim()
    let display = !!(el.classList && el.classList.contains('katex-display'))
    const attrDisplay = el.getAttribute('display')
    if (attrDisplay === 'true' || attrDisplay === 'block') display = true
    if (!display) {
      try {
        if (el.closest('.katex-display, mjx-container[display="true"]')) display = true
      } catch (e) {
        // ignore
      }
    }
    return display ? '$$' + cleaned + '$$' : '$' + cleaned + '$'
  }

  // --- DOM -> Markdown ---

  function isConsumedHeader(el: Element): boolean {
    for (let i = 0; i < consumedHeaders.length; i++) {
      if (consumedHeaders[i] === el) return true
    }
    return false
  }

  function shouldSkipElement(el: Element): boolean {
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return true
    if (tag === 'button' || tag === 'svg') return true
    if (el.getAttribute('aria-hidden') === 'true') return true
    if (isConsumedHeader(el)) return true
    if (matchesAny(el, config.strip || [])) return true
    return false
  }

  function containsBlockChild(el: Element): boolean {
    const kids = el.children
    for (let i = 0; i < kids.length; i++) {
      const tag = kids[i].tagName.toLowerCase()
      if (BLOCK_TAGS[tag]) return true
      if (kids[i].classList && kids[i].classList.contains('katex-display')) return true
    }
    return false
  }

  // A streamed answer is often just text nodes and inline tags (strong, code, a, a bare
  // <span>...) landing directly as siblings with no <p> around them at all - those must flow
  // together into one paragraph. Only a real block element starts a new one.
  function isInlineNode(node: Node): boolean {
    if (node.nodeType === 3) return true
    if (node.nodeType !== 1) return false
    const el = node as Element
    if (isMathRoot(el)) return true
    const tag = el.tagName.toLowerCase()
    if (INLINE_TAGS[tag]) return true
    if (BLOCK_TAGS[tag]) return false
    // an unfamiliar tag (custom element, site-specific wrapper): treat it as part of the
    // running paragraph unless it is itself built from block-level pieces
    return !containsBlockChild(el)
  }

  function tidyInline(s: string): string {
    return s
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim()
  }

  function absolutizeUrl(href: string): string {
    try {
      return new URL(href, document.baseURI || location.href).href
    } catch (e) {
      return href
    }
  }

  function wrapInline(text: string, marker: string): string {
    if (!text) return ''
    const leadingMatch = /^\s*/.exec(text)
    const trailingMatch = /\s*$/.exec(text)
    const leading = leadingMatch ? leadingMatch[0] : ''
    const trailing = trailingMatch ? trailingMatch[0] : ''
    const core = text.slice(leading.length, text.length - trailing.length)
    if (!core) return text
    return leading + marker + core + marker + trailing
  }

  function wrapCode(raw: string): string {
    const t = raw.replace(/\n+/g, ' ').trim()
    if (!t) return ''
    let fence = '`'
    while (t.indexOf(fence) !== -1) fence += '`'
    const pad = fence.length > 1 ? ' ' : ''
    return fence + pad + t + pad + fence
  }

  function renderLink(el: Element): string {
    const hrefRaw = el.getAttribute('href') || ''
    const text = renderInline(el) || hrefRaw
    if (!hrefRaw || hrefRaw.trim().toLowerCase().indexOf('javascript:') === 0) return text
    return '[' + text + '](' + absolutizeUrl(hrefRaw) + ')'
  }

  function imageMd(el: Element): string {
    const src = el.getAttribute('src') || ''
    const alt = el.getAttribute('alt') || ''
    if (!src) return alt
    return '![' + alt + '](' + absolutizeUrl(src) + ')'
  }

  function extractLangLabel(container: Element): string {
    const text = (container.textContent || '').trim()
    if (!text) return ''
    const cleaned = text.replace(/copy code|copy to clipboard|copy/gi, '').trim()
    if (!cleaned) return ''
    if (/^[a-zA-Z][a-zA-Z0-9+#._-]{0,19}$/.test(cleaned)) return cleaned.toLowerCase()
    return ''
  }

  function classLanguage(target: Element | null): string {
    if (!target || !target.classList) return ''
    for (let i = 0; i < target.classList.length; i++) {
      const m = /^(?:language|lang)-([a-z0-9+#._-]+)$/i.exec(target.classList[i])
      if (m) return m[1].toLowerCase()
    }
    return ''
  }

  function detectLanguage(pre: Element, codeEl: Element | null): string {
    const lang = classLanguage(codeEl) || classLanguage(pre)
    if (lang) return lang
    const dataLang =
      (codeEl && (codeEl.getAttribute('data-language') || codeEl.getAttribute('data-lang'))) ||
      pre.getAttribute('data-language') ||
      pre.getAttribute('data-lang') ||
      ''
    if (dataLang) return dataLang.toLowerCase()

    // Only a header genuinely right before the <pre> counts - not just "some element that
    // happens to be the first child of a big shared container", which could be anything.
    const header = pre.previousElementSibling
    return header ? extractLangLabel(header) : ''
  }

  function renderCodeBlock(pre: Element): string {
    let codeEl: Element | null = null
    try {
      codeEl = pre.querySelector('code')
    } catch (e) {
      codeEl = null
    }
    const source = codeEl || pre
    let text = (source.textContent || '').replace(/\r\n/g, '\n')
    text = text.replace(/^\n+/, '').replace(/\s+$/, '')
    const lang = detectLanguage(pre, codeEl)
    let fence = '```'
    while (text.indexOf(fence) !== -1) fence += '`'
    return fence + lang + '\n' + text + '\n' + fence
  }

  function directCheckbox(li: Element): HTMLInputElement | null {
    const kids = li.children
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i]
      const tag = k.tagName.toLowerCase()
      if (tag === 'input' && (k.getAttribute('type') || '').toLowerCase() === 'checkbox') {
        return k as HTMLInputElement
      }
      if (tag === 'label') {
        let inner: Element | null = null
        try {
          inner = k.querySelector('input[type="checkbox"]')
        } catch (e) {
          inner = null
        }
        if (inner) return inner as HTMLInputElement
      }
    }
    return null
  }

  function renderLabelInline(label: Element): string {
    const parts: string[] = []
    const kids = label.childNodes
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i]
      if (c.nodeType === 1 && (c as Element).tagName.toLowerCase() === 'input') continue
      parts.push(renderInlineNode(c))
    }
    return parts.join('')
  }

  function renderListItem(li: Element, ordered: boolean, depth: number, idx: number): string {
    const indent = '  '.repeat(depth)
    const marker = ordered ? idx + '. ' : '- '
    const checkbox = directCheckbox(li)
    const prefix = checkbox ? (checkbox.checked ? '[x] ' : '[ ] ') : ''
    const inlineParts: string[] = []
    const nestedBlocks: string[] = []
    const kids = li.childNodes
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i]
      if (c.nodeType === 1) {
        const ce = c as Element
        const tag = ce.tagName.toLowerCase()
        if (tag === 'ul' || tag === 'ol') {
          const nested = renderList(ce, tag === 'ol', depth + 1)
          if (nested) nestedBlocks.push(nested)
          continue
        }
        if (checkbox && ce === checkbox) continue
        if (tag === 'label' && checkbox && ce.contains(checkbox)) {
          inlineParts.push(renderLabelInline(ce))
          continue
        }
      }
      inlineParts.push(renderInlineNode(c))
    }
    const text = tidyInline(inlineParts.join(''))
    const lines = [indent + marker + prefix + text]
    for (let i = 0; i < nestedBlocks.length; i++) lines.push(nestedBlocks[i])
    return lines.join('\n')
  }

  function renderList(list: Element, ordered: boolean, depth: number): string {
    const items: string[] = []
    const kids = list.children
    let idx = 1
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].tagName.toLowerCase() !== 'li') continue
      items.push(renderListItem(kids[i], ordered, depth, idx))
      idx++
    }
    return items.join('\n')
  }

  function renderBlockquote(el: Element): string {
    const inner = renderBlock(el)
    if (!inner) return ''
    const lines = inner.split('\n')
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
      out.push(lines[i].length ? '> ' + lines[i] : '>')
    }
    return out.join('\n')
  }

  function cellText(cell: Element): string {
    const s = renderInline(cell)
    return s.replace(/\|/g, '\\|').replace(/\n+/g, '<br>')
  }

  // th/td via .children rather than HTMLTableRowElement.cells, and ancestor walk rather than
  // .tHead - the specialised table DOM interfaces are not reliably implemented everywhere.
  function rowCells(row: Element): Element[] {
    const out: Element[] = []
    const kids = row.children
    for (let i = 0; i < kids.length; i++) {
      const tag = kids[i].tagName.toLowerCase()
      if (tag === 'td' || tag === 'th') out.push(kids[i])
    }
    return out
  }

  function rowIsHeader(row: Element, table: Element, cells: Element[]): boolean {
    if (cells.length > 0) {
      let allTh = true
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].tagName.toLowerCase() !== 'th') {
          allTh = false
          break
        }
      }
      if (allTh) return true
    }
    let node: Element | null = row.parentElement
    while (node && node !== table) {
      if (node.tagName.toLowerCase() === 'thead') return true
      node = node.parentElement
    }
    return false
  }

  function renderTable(tableEl: Element): string {
    const rows = safeQueryAll(tableEl, 'tr')
    if (rows.length === 0) return ''

    let headerRowCount = 0
    for (let i = 0; i < rows.length; i++) {
      if (!rowIsHeader(rows[i], tableEl, rowCells(rows[i]))) break
      headerRowCount = i + 1
    }
    if (headerRowCount === 0) headerRowCount = 1

    const headerCells = rowCells(rows[headerRowCount - 1])
    const colCount = headerCells.length || rowCells(rows[0]).length
    if (colCount === 0) return ''

    const headerTexts: string[] = []
    for (let c = 0; c < colCount; c++) {
      headerTexts.push(headerCells[c] ? cellText(headerCells[c]) : '')
    }
    const lines: string[] = []
    lines.push('| ' + headerTexts.join(' | ') + ' |')
    lines.push('| ' + headerTexts.map(() => '---').join(' | ') + ' |')
    for (let r = headerRowCount; r < rows.length; r++) {
      const cells = rowCells(rows[r])
      const rowTexts: string[] = []
      for (let c = 0; c < colCount; c++) {
        rowTexts.push(cells[c] ? cellText(cells[c]) : '')
      }
      lines.push('| ' + rowTexts.join(' | ') + ' |')
    }
    return lines.join('\n')
  }

  function renderInlineNode(node: Node): string {
    if (node.nodeType === 3) return (node.textContent || '').replace(/\s+/g, ' ')
    if (node.nodeType !== 1) return ''
    const el = node as Element
    if (shouldSkipElement(el)) return ''
    const math = mathMarkdown(el)
    if (math !== null) return math

    const tag = el.tagName.toLowerCase()
    if (tag === 'br') return '\n'
    if (tag === 'strong' || tag === 'b') return wrapInline(renderInline(el), '**')
    if (tag === 'em' || tag === 'i') return wrapInline(renderInline(el), '*')
    if (tag === 'del' || tag === 's' || tag === 'strike') return wrapInline(renderInline(el), '~~')
    if (tag === 'code') return wrapCode(el.textContent || '')
    if (tag === 'a') return renderLink(el)
    if (tag === 'img') return imageMd(el)
    if (tag === 'input') {
      const type = (el.getAttribute('type') || '').toLowerCase()
      if (type === 'checkbox') return (el as HTMLInputElement).checked ? '[x]' : '[ ]'
      return ''
    }
    if (tag === 'p' || tag === 'div') {
      const inner = renderInline(el)
      return inner ? inner + '\n' : ''
    }
    return renderInline(el)
  }

  function joinInlineNodes(nodes: Node[]): string {
    const parts: string[] = []
    for (let i = 0; i < nodes.length; i++) parts.push(renderInlineNode(nodes[i]))
    return tidyInline(parts.join(''))
  }

  function renderInline(el: Node): string {
    const kids: Node[] = []
    const list = el.childNodes
    for (let i = 0; i < list.length; i++) kids.push(list[i])
    return joinInlineNodes(kids)
  }

  // Only ever reached for a node isInlineNode() already said no to, so it is always a real
  // block element (a bare text node never lands here).
  function renderBlockChild(node: Node): string | null {
    if (node.nodeType !== 1) return null
    const el = node as Element
    if (shouldSkipElement(el)) return null
    const math = mathMarkdown(el)
    if (math !== null) return math

    const tag = el.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag.slice(1), 10)
      const text = renderInline(el)
      return text ? '#'.repeat(level) + ' ' + text : null
    }
    if (tag === 'hr') return '---'
    if (tag === 'ul') return renderList(el, false, 0) || null
    if (tag === 'ol') return renderList(el, true, 0) || null
    if (tag === 'blockquote') return renderBlockquote(el) || null
    if (tag === 'pre') return renderCodeBlock(el)
    if (tag === 'table') return renderTable(el) || null
    if (tag === 'p' || tag === 'li') {
      const text = renderInline(el)
      return text || null
    }
    if (containsBlockChild(el)) return renderBlock(el) || null
    const text = renderInline(el)
    return text || null
  }

  // Consecutive inline children (text nodes, <strong>/<code>/<a>/... - anything isInlineNode
  // accepts) are buffered and rendered as one paragraph; a real block element flushes that
  // buffer first and then renders as its own block.
  function renderBlock(root: Node): string {
    const parts: string[] = []
    let buffer: Node[] = []

    function flush(): void {
      if (buffer.length === 0) return
      const text = joinInlineNodes(buffer)
      if (text) parts.push(text)
      buffer = []
    }

    const kids = root.childNodes
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i]
      if (isInlineNode(node)) {
        buffer.push(node)
        continue
      }
      flush()
      const s = renderBlockChild(node)
      if (s) parts.push(s)
    }
    flush()
    return parts.join('\n\n')
  }

  function finalizeMarkdown(md: string): string {
    return md
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
  }

  // A code block's header is either a language badge ("javascript") or just a copy button -
  // either way it is chrome, not content, once it has done its job of naming the language.
  function markCodeHeaders(root: Element): void {
    consumedHeaders = []
    const pres = safeQueryAll(root, 'pre')
    if (root.tagName.toLowerCase() === 'pre' && pres.indexOf(root) === -1) pres.push(root)
    for (let i = 0; i < pres.length; i++) {
      const pre = pres[i]
      const header = pre.previousElementSibling
      if (!header || isConsumedHeader(header)) continue
      const label = extractLangLabel(header)
      const chromeOnly = !label && renderInline(header).trim() === ''
      if (label || chromeOnly) consumedHeaders.push(header)
    }
  }

  function renderAnswer(assistantEl: Element): string {
    const target = safeQueryFirst(assistantEl, config.answerBody || []) || assistantEl
    markCodeHeaders(target)
    return finalizeMarkdown(renderBlock(target))
  }

  // --- composer editing ---

  function clearField(field: HTMLTextAreaElement | HTMLInputElement): void {
    const proto = field.tagName.toLowerCase() === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    if (desc && desc.set) desc.set.call(field, '')
    else field.value = ''
    field.dispatchEvent(new Event('input', { bubbles: true }))
    try {
      field.setSelectionRange(0, 0)
    } catch (e) {
      // some input types (e.g. email, number) reject setSelectionRange - fine to skip
    }
  }

  function clearEditable(el: HTMLElement): void {
    const sel = window.getSelection ? window.getSelection() : null
    if (sel) {
      try {
        const range = document.createRange()
        range.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(range)
      } catch (e) {
        // ignore, we still clear via textContent below
      }
    }
    let deleted = false
    if (typeof document.execCommand === 'function') {
      try {
        deleted = document.execCommand('delete')
      } catch (e) {
        deleted = false
      }
    }
    if (!deleted || (el.textContent && el.textContent.length > 0)) el.textContent = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
    try {
      const collapsed = document.createRange()
      collapsed.selectNodeContents(el)
      collapsed.collapse(true)
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(collapsed)
      }
    } catch (e) {
      // ignore, the field is already cleared
    }
  }

  // --- reading on/off state: aria-*, data-state, or a class token, plus a checkbox/switch
  // nested inside the element (a menu item is often just a row wrapping the real control) ---

  function textOf(el: Element): string {
    return (el.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function elementMatchesText(el: Element, needles?: string[]): boolean {
    if (!needles || needles.length === 0) return true
    const text = textOf(el).toLowerCase()
    for (let i = 0; i < needles.length; i++) {
      if (text.indexOf(needles[i].toLowerCase()) !== -1) return true
    }
    return false
  }

  // "on" is a substring of plenty of ordinary words (button, content...) so it only counts as
  // a whole class token; active/selected/checked are specific enough to match as a substring
  // (is-active, btn--checked...).
  function classSaysOn(el: Element): boolean {
    const tokens = (el.getAttribute('class') || '').split(/\s+/)
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].toLowerCase()
      if (!t) continue
      if (t === 'on') return true
      if (t.indexOf('active') !== -1 || t.indexOf('selected') !== -1 || t.indexOf('checked') !== -1) return true
    }
    return false
  }

  function hasStateAttrs(el: Element): boolean {
    return el.hasAttribute('aria-pressed') || el.hasAttribute('aria-checked') || el.hasAttribute('aria-selected') || el.hasAttribute('data-state')
  }

  function readOwnState(el: Element): boolean {
    const pressed = el.getAttribute('aria-pressed')
    if (pressed === 'true') return true
    if (pressed === 'false') return false
    const checked = el.getAttribute('aria-checked')
    if (checked === 'true') return true
    if (checked === 'false') return false
    const selected = el.getAttribute('aria-selected')
    if (selected === 'true') return true
    if (selected === 'false') return false
    const state = (el.getAttribute('data-state') || '').toLowerCase()
    if (state === 'on' || state === 'checked' || state === 'active') return true
    if (state === 'off' || state === 'unchecked' || state === 'inactive') return false
    return classSaysOn(el)
  }

  function findNestedToggle(el: Element): Element | null {
    return safeQueryFirst(el, ['input[type="checkbox"]', '[role="switch"]', '[role="menuitemcheckbox"]', '[role="checkbox"]'])
  }

  function readState(el: Element): boolean {
    if (hasStateAttrs(el) || classSaysOn(el)) return readOwnState(el)
    const nested = findNestedToggle(el)
    if (!nested) return false
    if (nested.tagName.toLowerCase() === 'input') return !!(nested as HTMLInputElement).checked
    return readOwnState(nested)
  }

  // --- small async helpers for menus: opening one is never instant on a real page ---

  function waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function waitForVisible(selectors: string[], timeoutMs: number): Promise<Element[]> {
    return new Promise((resolve) => {
      const start = Date.now()
      function check(): void {
        const found: Element[] = []
        for (let i = 0; i < selectors.length; i++) {
          const els = safeQueryAll(document, selectors[i])
          for (let j = 0; j < els.length; j++) {
            if (visible(els[j])) found.push(els[j])
          }
        }
        if (found.length > 0 || Date.now() - start >= timeoutMs) {
          resolve(found)
          return
        }
        setTimeout(check, 50)
      }
      check()
    })
  }

  function dispatchEscape(): void {
    const targets: (Document | Element)[] = []
    const active = document.activeElement
    if (active && active !== document.body) targets.push(active)
    targets.push(document)
    for (let i = 0; i < targets.length; i++) {
      try {
        targets[i].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
      } catch (e) {
        // some engines are picky about constructing KeyboardEvent - not worth failing over
      }
    }
  }

  async function closeMenu(menuBtn: Element, itemSelectors: string[]): Promise<void> {
    dispatchEscape()
    await waitMs(50)
    if (itemSelectors.length && anyVisible(itemSelectors)) {
      try {
        ;(menuBtn as HTMLElement).click()
      } catch (e) {
        // ignore - best effort cleanup only
      }
      await waitMs(50)
    }
  }

  // --- setToggle: a direct button, or a menu with an item to find and click ---

  function findButtonCandidate(selectors: string[], itemText?: string[]): Element | null {
    const candidates: Element[] = []
    for (let i = 0; i < selectors.length; i++) {
      const els = safeQueryAll(document, selectors[i])
      for (let j = 0; j < els.length; j++) {
        if (isClickable(els[j])) candidates.push(els[j])
      }
    }
    // when several broad selectors all match (a site with no stable id for the toggle), the
    // one whose own text names the option is the one we want
    if (itemText && itemText.length) {
      for (let i = 0; i < candidates.length; i++) {
        if (elementMatchesText(candidates[i], itemText)) return candidates[i]
      }
    }
    return candidates.length ? candidates[0] : null
  }

  function findItemByText(items: Element[], itemText?: string[]): Element | null {
    if (!itemText || itemText.length === 0) return items.length ? items[0] : null
    for (let i = 0; i < items.length; i++) {
      if (elementMatchesText(items[i], itemText)) return items[i]
    }
    return null
  }

  async function setToggleButton(cfg: ToggleConfig, on: boolean): Promise<'ok' | 'unchanged' | 'missing'> {
    const selectors = cfg.button || []
    const btn = findButtonCandidate(selectors, cfg.itemText)
    if (!btn) return 'missing'
    if (readState(btn) === on) return 'unchanged'
    ;(btn as HTMLElement).click()
    await waitMs(150)
    // re-read: the button may have been replaced by the click (a re-render, a new element)
    const after = findButtonCandidate(selectors, cfg.itemText)
    return after ? 'ok' : 'missing'
  }

  async function setToggleMenu(cfg: ToggleConfig, on: boolean): Promise<'ok' | 'unchanged' | 'missing'> {
    const menuSelectors = cfg.menu || []
    const itemSelectors = cfg.item || []
    const menuBtn = firstUsable(menuSelectors, isClickable)
    if (!menuBtn) return 'missing'
    ;(menuBtn as HTMLElement).click()
    const items = await waitForVisible(itemSelectors, 1500)
    if (items.length === 0) {
      await closeMenu(menuBtn, itemSelectors)
      return 'missing'
    }
    const target = findItemByText(items, cfg.itemText)
    if (!target) {
      await closeMenu(menuBtn, itemSelectors)
      return 'missing'
    }
    const result: 'ok' | 'unchanged' = readState(target) === on ? 'unchanged' : 'ok'
    if (result === 'ok') {
      ;(target as HTMLElement).click()
      await waitMs(150)
    }
    await closeMenu(menuBtn, itemSelectors)
    return result
  }

  async function setToggle(kind: 'thinking' | 'search', on: boolean): Promise<'ok' | 'unchanged' | 'missing'> {
    try {
      const cfg = config[kind]
      if (!cfg) return 'missing'
      if (cfg.button && cfg.button.length) return await setToggleButton(cfg, on)
      if (cfg.menu && cfg.menu.length) return await setToggleMenu(cfg, on)
      return 'missing'
    } catch (e) {
      return 'missing'
    }
  }

  // --- selectVariant: open the model picker, click the entry that best matches ---

  function bestVariantMatch(items: Element[], match: string[]): Element | null {
    let best: Element | null = null
    let bestLen = Infinity
    for (let i = 0; i < items.length; i++) {
      if (!elementMatchesText(items[i], match)) continue
      const len = textOf(items[i]).length
      if (len < bestLen) {
        bestLen = len
        best = items[i]
      }
    }
    return best
  }

  async function selectVariant(match: string[]): Promise<'ok' | 'missing'> {
    try {
      const variant = config.variant
      if (!variant) return 'missing'
      const menuBtn = firstUsable(variant.menu, isClickable)
      if (!menuBtn) return 'missing'
      ;(menuBtn as HTMLElement).click()
      const items = await waitForVisible(variant.item, 1500)
      const target = items.length ? bestVariantMatch(items, match) : null
      if (!target) {
        await closeMenu(menuBtn, variant.item)
        return 'missing'
      }
      ;(target as HTMLElement).click()
      await waitMs(200)
      return 'ok'
    } catch (e) {
      return 'missing'
    }
  }

  // --- outline: a diagnostics snapshot of the page, with chat content always left out ---

  function collectOutlineSelectors(): string[] {
    const out: string[] = []
    function add(list?: string[]): void {
      if (!list) return
      for (let i = 0; i < list.length; i++) out.push(list[i])
    }
    add(config.composer)
    add(config.send)
    add(config.stop)
    add(config.assistant)
    add(config.answerBody)
    add(config.signedOut)
    add(config.signedIn)
    add(config.strip)
    if (config.thinking) {
      add(config.thinking.button)
      add(config.thinking.menu)
      add(config.thinking.item)
    }
    if (config.search) {
      add(config.search.button)
      add(config.search.menu)
      add(config.search.item)
    }
    if (config.variant) {
      add(config.variant.menu)
      add(config.variant.item)
    }
    return out
  }

  // No PageConfig field names the user's own messages - only the assistant's - so this is a
  // heuristic over the common naming (ChatGPT's data-message-author-role="user", a ".msg.user"
  // class and the like). Best effort: it only ever widens what gets hidden, never narrows it.
  function looksLikeUserMessage(el: Element): boolean {
    const role = (el.getAttribute('data-message-author-role') || el.getAttribute('data-author-role') || '').toLowerCase()
    if (role === 'user' || role === 'human') return true
    const cls = (el.getAttribute('class') || '').toLowerCase()
    return /\b(user|human)\b/.test(cls) && /(msg|message|bubble|turn|question|prompt)/.test(cls)
  }

  function isSensitiveRoot(el: Element): boolean {
    if (matchesAny(el, config.assistant)) return true
    if (matchesAny(el, config.composer)) return true
    if (looksLikeUserMessage(el)) return true
    return false
  }

  function isSkippedSubtree(tag: string): boolean {
    return tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template' || tag === 'svg'
  }

  function isOutlineLandmark(el: Element, outlineSelectors: string[]): boolean {
    const tag = el.tagName.toLowerCase()
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (tag === 'main' || tag === 'nav' || tag === 'header' || tag === 'footer' || tag === 'form' || tag === 'dialog') return true
    if (el.hasAttribute('role')) return true
    const editable = el.getAttribute('contenteditable')
    if (editable !== null && editable.toLowerCase() !== 'false') return true
    if (el.hasAttribute('aria-label')) return true
    if (el.hasAttribute('data-testid')) return true
    return matchesAny(el, outlineSelectors)
  }

  // Own text is only ever shown for things a user clicks by their label (buttons, links, menu
  // entries) - never for a landmark like <main> or <form>, which would just dump page copy.
  function shortOwnText(el: Element, hidden: boolean): string {
    const tag = el.tagName.toLowerCase()
    const role = el.getAttribute('role') || ''
    const wantsText =
      tag === 'button' || tag === 'a' || role === 'menuitem' || role === 'menuitemcheckbox' || role === 'menuitemradio' || role === 'option' || role === 'tab'
    if (!wantsText) return ''
    if (hidden) return '[text hidden]'
    const t = textOf(el)
    return t.length > 40 ? t.slice(0, 40) + '…' : t
  }

  function describeElement(el: Element, hidden: boolean): string {
    const tag = el.tagName.toLowerCase()
    let out = tag
    if (el.id) out += '#' + el.id
    const classTokens = (el.getAttribute('class') || '')
      .trim()
      .split(/\s+/)
      .filter((c) => !!c)
      .slice(0, 4)
    if (classTokens.length) out += '.' + classTokens.join('.')

    const attrs: string[] = []
    function pushAttr(name: string): void {
      const v = el.getAttribute(name)
      if (v !== null) attrs.push(name + '=' + JSON.stringify(v))
    }
    pushAttr('role')
    pushAttr('aria-label')
    pushAttr('aria-pressed')
    pushAttr('aria-checked')
    pushAttr('aria-selected')
    pushAttr('aria-expanded')
    pushAttr('data-state')
    pushAttr('data-testid')
    pushAttr('placeholder')
    pushAttr('type')
    const field = el as { disabled?: boolean }
    if (field.disabled) attrs.push('disabled')
    if (attrs.length) out += ' [' + attrs.join(' ') + ']'

    const text = shortOwnText(el, hidden)
    if (text) out += ' text=' + JSON.stringify(text)
    return out
  }

  function outline(): string {
    try {
      const outlineSelectors = collectOutlineSelectors()
      const lines: string[] = []
      lines.push((document.title || '(untitled)') + ' — ' + location.origin + location.pathname)

      const maxLines = 2500
      const maxDepth = 40
      let printed = 0
      let truncated = false

      function walk(el: Element, depth: number, printDepth: number, hidden: boolean): void {
        if (truncated || depth > maxDepth) return
        const tag = el.tagName.toLowerCase()
        if (isSkippedSubtree(tag)) return
        const nowHidden = hidden || isSensitiveRoot(el)
        const qualifies = isOutlineLandmark(el, outlineSelectors)
        let nextPrintDepth = printDepth
        if (qualifies) {
          if (printed >= maxLines) {
            truncated = true
            return
          }
          lines.push('  '.repeat(printDepth) + describeElement(el, nowHidden))
          printed++
          nextPrintDepth = printDepth + 1
        }
        const kids = el.children
        for (let i = 0; i < kids.length; i++) {
          if (truncated) break
          walk(kids[i], depth + 1, nextPrintDepth, nowHidden)
        }
      }

      if (document.body) walk(document.body, 0, 0, false)
      if (truncated) lines.push('… (truncated)')
      return lines.join('\n')
    } catch (e) {
      return ''
    }
  }

  // --- notices: a visible error / limit / "busy" message, but never wording lifted out of a
  // chat message (an answer that happens to discuss "limits" must not be mistaken for one) ---

  const NOTICE_TEXT_RE =
    /limit|usage cap|quota|too many requests|rate limit|try again later|try again in|reached|exceeded|capacity|busy|overloaded|something went wrong|network error|лимит|превышен|слишком много|попробуйте позже|服务器繁忙|请稍后|频繁|上限/i

  function elementText(el: Element): string {
    return (el.textContent || '').replace(/\s+/g, ' ').trim()
  }

  // Same idea as isSensitiveRoot below, reused here so a banner nested inside a message (or the
  // composer's own placeholder) never counts as a notice.
  function isInsideMessage(el: Element): boolean {
    let node: Element | null = el
    while (node) {
      if (matchesAny(node, config.assistant)) return true
      if (matchesAny(node, config.composer)) return true
      if (looksLikeUserMessage(node)) return true
      node = node.parentElement
    }
    return false
  }

  // The lowest element both `a` and `b` sit under - used to tell "next to the composer" apart
  // from "anywhere at all on the page", without needing to know a site's own layout.
  function commonAncestor(a: Element, b: Element): Element | null {
    const chain: Element[] = []
    let node: Element | null = a
    while (node) {
      chain.push(node)
      node = node.parentElement
    }
    node = b
    while (node) {
      if (chain.indexOf(node) !== -1) return node
      node = node.parentElement
    }
    return null
  }

  function isNear(el: Element, other: Element | null): boolean {
    if (!other) return false
    const nca = commonAncestor(el, other)
    return !!nca && nca !== document.body && nca !== document.documentElement
  }

  function findFirstNotice(selectors: string[], requireWording: boolean): string | null {
    for (let i = 0; i < selectors.length; i++) {
      const els = safeQueryAll(document, selectors[i])
      for (let j = 0; j < els.length; j++) {
        const el = els[j]
        if (!visible(el) || isInsideMessage(el)) continue
        const text = elementText(el)
        if (!text) continue
        if (requireWording && !NOTICE_TEXT_RE.test(text)) continue
        return text
      }
    }
    return null
  }

  // "error" shows up in class names for all sorts of unrelated chrome, so this one is only
  // trusted when it sits next to the composer or right after the newest answer.
  function findErrorClassNotice(): string | null {
    const els = safeQueryAll(document, '[class*="error" i]')
    if (els.length === 0) return null
    const composerEl = locateComposer()
    const assistantEls = findAssistantMessages()
    const lastAnswerEl = assistantEls.length ? assistantEls[assistantEls.length - 1] : null
    const scoped = !!(composerEl || lastAnswerEl)
    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      if (!visible(el) || isInsideMessage(el)) continue
      if (scoped && !isNear(el, composerEl) && !isNear(el, lastAnswerEl)) continue
      const text = elementText(el)
      if (!text || !NOTICE_TEXT_RE.test(text)) continue
      return text
    }
    return null
  }

  function findNotice(): string | null {
    const found =
      findFirstNotice(config.notices || [], true) ||
      findFirstNotice(['[role="alert"]'], true) ||
      findFirstNotice(['[aria-live="assertive"]', '[aria-live="polite"]'], true) ||
      findFirstNotice(['[class*="toast" i]', '[data-sonner-toast]'], true) ||
      findErrorClassNotice()
    return found ? found.slice(0, 300) : null
  }

  // --- the API exposed as window.__ndAsk ---

  function probe(): PageProbe {
    const challenge = detectChallenge()
    const signedIn = computeSignedIn()
    const composerEl = locateComposer()
    const generating = anyVisible(config.stop)
    const assistantEls = findAssistantMessages()
    const lastEl = assistantEls.length ? assistantEls[assistantEls.length - 1] : null
    return {
      url: location.href,
      challenge,
      signedIn,
      composer: !!composerEl,
      generating,
      answerCount: assistantEls.length,
      lastAnswer: lastEl ? renderAnswer(lastEl) : '',
      notice: findNotice(),
    }
  }

  function focusComposer(): boolean {
    const el = locateComposer()
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    if (tag === 'textarea' || tag === 'input') {
      const field = el as HTMLTextAreaElement | HTMLInputElement
      field.focus()
      clearField(field)
      return true
    }
    const editable = el as HTMLElement
    editable.focus()
    clearEditable(editable)
    return true
  }

  function clickSend(): boolean {
    const el = firstUsable(config.send, isClickable)
    if (!el) return false
    const btn = el as HTMLElement
    btn.click()
    return true
  }

  function clickStop(): boolean {
    const el = firstUsable(config.stop, visible)
    if (!el) return false
    const btn = el as HTMLElement
    btn.click()
    return true
  }

  function composerText(): string {
    const el = locateComposer()
    if (!el) return ''
    const tag = el.tagName.toLowerCase()
    if (tag === 'textarea' || tag === 'input') return (el as HTMLTextAreaElement).value || ''
    const editable = el as HTMLElement
    return editable.innerText != null ? editable.innerText : editable.textContent || ''
  }

  const runtime: PageRuntime = {
    probe,
    focusComposer,
    clickSend,
    clickStop,
    composerText,
    setToggle,
    selectVariant,
    outline,
  }
  // Plain reassignment: nothing above registers a listener or timer outside a single call,
  // so there is no old state to tear down - the previous instance is just dropped.
  window.__ndAsk = runtime
}

/** Source to hand to executeJavaScriptInIsolatedWorld: installs the runtime, then evaluates to true. */
export function runtimeScript(config: PageConfig): string {
  return `(${installRuntime.toString()})(${JSON.stringify(config)}); true`
}

export const PROBE_SCRIPT = 'window.__ndAsk ? window.__ndAsk.probe() : null'
export const FOCUS_SCRIPT = 'window.__ndAsk ? window.__ndAsk.focusComposer() : false'
export const SEND_SCRIPT = 'window.__ndAsk ? window.__ndAsk.clickSend() : false'
export const STOP_SCRIPT = 'window.__ndAsk ? window.__ndAsk.clickStop() : false'
export const COMPOSER_TEXT_SCRIPT = "window.__ndAsk ? window.__ndAsk.composerText() : ''"
export const HAS_RUNTIME_SCRIPT = "typeof window.__ndAsk === 'object'"

/** Source for setToggle('thinking' | 'search', on): the engine passes the result straight through. */
export function toggleScript(kind: 'thinking' | 'search', on: boolean): string {
  return `window.__ndAsk ? window.__ndAsk.setToggle(${JSON.stringify(kind)}, ${on}) : 'missing'`
}

/** Source for selectVariant(match). */
export function variantScript(match: string[]): string {
  return `window.__ndAsk ? window.__ndAsk.selectVariant(${JSON.stringify(match)}) : 'missing'`
}

export const OUTLINE_SCRIPT = "window.__ndAsk ? window.__ndAsk.outline() : ''"
