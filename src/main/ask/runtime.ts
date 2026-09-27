// The page runtime: installed into each chat service's page inside an isolated JS world, where
// it reads the DOM (composer, send/stop buttons, assistant messages) and converts answers to
// Markdown. engine.ts drives it through webContents.executeJavaScriptInIsolatedWorld, so the
// installer below is shipped as a source string (Function.prototype.toString()) and re-parsed
// on the page. That means installRuntime must not reach outside its own body: no imports, no
// module-scope references, every helper declared inside it.
import type { PageConfig, PageProbe, PageRuntime } from './types'

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
