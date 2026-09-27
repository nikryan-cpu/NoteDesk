// Answers arrive as Markdown; this turns them into sanitized, nicely presented HTML. Math
// notation gets no special treatment (no KaTeX) - it just renders as plain text, looking like
// code when the model itself wraps it in backticks.
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'span',
  'div',
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class']

/** Wraps every fenced code block in a small header (language + copy button), in the trusted, already-sanitized DOM. */
function addCodeHeaders(html: string, copyLabel: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(doc.querySelectorAll('pre'))
  blocks.forEach((pre, i) => {
    const code = pre.querySelector('code')
    const lang = /language-(\S+)/.exec(code?.className ?? '')?.[1] ?? ''

    const wrapper = doc.createElement('div')
    wrapper.className = 'code-block'
    const header = doc.createElement('div')
    header.className = 'code-block-header'
    const label = doc.createElement('span')
    label.className = 'code-lang'
    label.textContent = lang
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'copy-code-btn'
    btn.setAttribute('data-copy-target', String(i))
    btn.textContent = copyLabel
    header.append(label, btn)

    pre.setAttribute('data-copy-source', String(i))
    pre.before(wrapper)
    wrapper.append(header, pre)
  })
  return doc.body.innerHTML
}

/** Markdown source to sanitized, display-ready HTML. `copyLabel` seeds each code block's copy button. */
export function renderMarkdown(source: string, copyLabel = 'Copy'): string {
  if (!source.trim()) return ''
  const raw = marked.parse(source) as string
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button', 'object', 'embed', 'svg'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  })
  return addCodeHeaders(clean, copyLabel)
}
