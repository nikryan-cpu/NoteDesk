// @vitest-environment happy-dom
// DOM -> Markdown conversion, exercised the only way it is reachable from outside: install the
// runtime from a PageConfig and read probe().lastAnswer, same as the engine does.
import { describe, expect, it, beforeEach } from 'vitest'
import { runtimeScript } from '../../src/main/ask/runtime'
import type { PageConfig } from '../../src/main/ask/types'

function install(config: PageConfig): void {
  new Function(runtimeScript(config))()
}

const base: PageConfig = {
  composer: ['#never'],
  send: ['#never'],
  stop: ['#never'],
  assistant: ['.msg'],
  signedOut: ['#never'],
  signedIn: ['#never'],
  submitWith: 'enter',
}

function markdownFor(html: string, config: PageConfig = base): string {
  document.body.innerHTML = html
  install(config)
  return window.__ndAsk!.probe().lastAnswer
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.title = ''
})

describe('paragraphs, breaks and headings', () => {
  it('turns <p> into blocks separated by a blank line', () => {
    expect(markdownFor('<div class="msg"><p>First.</p><p>Second.</p></div>')).toBe('First.\n\nSecond.')
  })

  it('turns <br> into a line break inside a paragraph', () => {
    expect(markdownFor('<div class="msg"><p>Line one<br>Line two</p></div>')).toBe('Line one\nLine two')
  })

  it('converts h1 through h6', () => {
    const html =
      '<div class="msg"><h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6></div>'
    expect(markdownFor(html)).toBe('# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6')
  })
})

describe('inline formatting', () => {
  it('bold, italic and strikethrough', () => {
    const html = '<div class="msg"><p><strong>bold</strong>, <em>italic</em>, <del>gone</del></p></div>'
    expect(markdownFor(html)).toBe('**bold**, *italic*, ~~gone~~')
  })

  it('also recognises <b>/<i>/<s>', () => {
    expect(markdownFor('<div class="msg"><p><b>bold</b> <i>italic</i> <s>gone</s></p></div>')).toBe('**bold** *italic* ~~gone~~')
  })

  it('inline code', () => {
    expect(markdownFor('<div class="msg"><p>Run <code>npm test</code> first</p></div>')).toBe('Run `npm test` first')
  })

  it('links use absolute hrefs and skip javascript: links', () => {
    const html =
      '<div class="msg"><p><a href="/relative">rel</a>, ' +
      '<a href="https://example.com/x?y=1">abs</a>, ' +
      '<a href="javascript:alert(1)">bad</a></p></div>'
    const md = markdownFor(html)
    expect(md).toContain('[abs](https://example.com/x?y=1)')
    expect(md).toContain('bad')
    expect(md).not.toContain('javascript:')
    // the relative link is resolved against the page's own location
    expect(md).toMatch(/\[rel\]\(\S*\/relative\)/)
  })

  it('images become ![alt](src)', () => {
    expect(markdownFor('<div class="msg"><img src="https://example.com/a.png" alt="A cat"></div>')).toBe(
      '![A cat](https://example.com/a.png)',
    )
  })
})

describe('code blocks', () => {
  it('reads the language from a language-xxx class', () => {
    const html = '<div class="msg"><pre><code class="language-python">print(1)</code></pre></div>'
    expect(markdownFor(html)).toBe('```python\nprint(1)\n```')
  })

  it('reads the language from a lang-xxx class', () => {
    const html = '<div class="msg"><pre><code class="lang-rust">fn main() {}</code></pre></div>'
    expect(markdownFor(html)).toBe('```rust\nfn main() {}\n```')
  })

  it('reads the language from data-language', () => {
    const html = '<div class="msg"><pre data-language="go"><code>func main() {}</code></pre></div>'
    expect(markdownFor(html)).toBe('```go\nfunc main() {}\n```')
  })

  it('reads a header label next to <pre> and drops it (and a Copy code button) from the output', () => {
    const html =
      '<div class="msg"><div class="code-block">' +
      '<div class="code-header"><span>javascript</span><button>Copy code</button></div>' +
      '<pre><code>console.log(1)</code></pre>' +
      '</div></div>'
    expect(markdownFor(html)).toBe('```javascript\nconsole.log(1)\n```')
  })

  it('leaves a real introductory paragraph before <pre> alone', () => {
    const html = '<div class="msg"><p>Here is an example:</p><pre><code class="language-js">1</code></pre></div>'
    expect(markdownFor(html)).toBe('Here is an example:\n\n```js\n1\n```')
  })

  it('picks a longer fence when the code itself contains backticks', () => {
    const html = '<div class="msg"><pre><code>a ``` b</code></pre></div>'
    expect(markdownFor(html)).toBe('````\na ``` b\n````')
  })
})

describe('lists', () => {
  it('unordered and ordered lists', () => {
    expect(markdownFor('<div class="msg"><ul><li>a</li><li>b</li></ul></div>')).toBe('- a\n- b')
    expect(markdownFor('<div class="msg"><ol><li>a</li><li>b</li></ol></div>')).toBe('1. a\n2. b')
  })

  it('nests a sub-list under its item', () => {
    const html = '<div class="msg"><ul><li>a</li><li>b<ul><li>b1</li><li>b2</li></ul></li></ul></div>'
    expect(markdownFor(html)).toBe('- a\n- b\n  - b1\n  - b2')
  })

  it('renders task list checkboxes', () => {
    const html =
      '<div class="msg"><ul>' +
      '<li><input type="checkbox" checked>done</li>' +
      '<li><input type="checkbox">not done</li>' +
      '</ul></div>'
    expect(markdownFor(html)).toBe('- [x] done\n- [ ] not done')
  })
})

describe('blockquotes, hr and tables', () => {
  it('blockquote gets a > prefix on every line', () => {
    expect(markdownFor('<div class="msg"><blockquote><p>Quoted text.</p></blockquote></div>')).toBe('> Quoted text.')
  })

  it('hr becomes ---', () => {
    expect(markdownFor('<div class="msg"><p>a</p><hr><p>b</p></div>')).toBe('a\n\n---\n\nb')
  })

  it('renders a GFM table and escapes pipes in cells', () => {
    const html =
      '<div class="msg"><table><thead><tr><th>Name</th><th>Note</th></tr></thead>' +
      '<tbody><tr><td>a</td><td>x|y</td></tr><tr><td>b</td><td>z</td></tr></tbody></table></div>'
    expect(markdownFor(html)).toBe('| Name | Note |\n| --- | --- |\n| a | x\\|y |\n| b | z |')
  })

  it('treats the first row as the header when there is no <thead>', () => {
    const html = '<div class="msg"><table><tr><td>H1</td><td>H2</td></tr><tr><td>1</td><td>2</td></tr></table></div>'
    expect(markdownFor(html)).toBe('| H1 | H2 |\n| --- | --- |\n| 1 | 2 |')
  })
})

describe('math', () => {
  const katexInline =
    '<span class="katex"><span class="katex-mathml">' +
    '<math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x^2 + 1</annotation></semantics></math>' +
    '</span><span class="katex-html" aria-hidden="true">rendered garbage</span></span>'

  it('inline KaTeX becomes $...$, the rendered duplicate is dropped', () => {
    const html = `<div class="msg"><p>Energy is ${katexInline}, roughly.</p></div>`
    expect(markdownFor(html)).toBe('Energy is $x^2 + 1$, roughly.')
  })

  it('a .katex-display block becomes $$...$$', () => {
    const html =
      '<div class="msg"><div class="katex-display"><span class="katex"><span class="katex-mathml">' +
      '<math><semantics><mrow><mi>y</mi></mrow><annotation encoding="application/x-tex">y = mx + b</annotation></semantics></math>' +
      '</span><span class="katex-html" aria-hidden="true">rendered garbage</span></span></div></div>'
    expect(markdownFor(html)).toBe('$$y = mx + b$$')
  })
})

describe('whitespace and blank lines', () => {
  it('collapses runs of whitespace inside text', () => {
    expect(markdownFor('<div class="msg"><p>a   b\n\n  c</p></div>')).toBe('a b c')
  })

  it('never leaves more than two consecutive blank lines', () => {
    const html = '<div class="msg"><p>a</p><p></p><p></p><p></p><p></p><p>b</p></div>'
    expect(markdownFor(html)).not.toMatch(/\n{4,}/)
  })

  it('trims trailing spaces on each line and around the whole answer', () => {
    const html = '<div class="msg">  <p>a  </p>  </div>'
    const md = markdownFor(html)
    expect(md).toBe('a')
    for (const line of md.split('\n')) expect(line).toBe(line.replace(/\s+$/, ''))
  })
})

// One handcrafted fixture per site, resembling how each one actually marks up an answer today.
describe('site-shaped fixtures', () => {
  it('ChatGPT: .markdown with a code header ("javascript" + Copy code) and no duplicated label', () => {
    const html =
      '<div class="msg"><div class="markdown prose">' +
      '<p>Sure, here you go:</p>' +
      '<div class="code-block">' +
      '<div class="flex items-center justify-between"><span>javascript</span>' +
      '<button aria-label="Copy code">Copy code</button></div>' +
      '<pre><code class="!whitespace-pre language-javascript">console.log("hi")</code></pre>' +
      '</div></div></div>'
    const md = markdownFor(html, { ...base, answerBody: ['.markdown'] })
    expect(md).toBe('Sure, here you go:\n\n```javascript\nconsole.log("hi")\n```')
  })

  it('Claude: an answer with inline KaTeX and an action bar stripped via config.strip', () => {
    const html =
      '<div class="msg"><div class="font-claude-response">' +
      `<p>The result is ${katexInlineFixture()}.</p>` +
      '<div data-testid="action-bar"><button aria-label="Copy">Copy</button><button aria-label="Retry">Retry</button></div>' +
      '</div></div>'
    const md = markdownFor(html, { ...base, answerBody: ['.font-claude-response'], strip: ['[data-testid="action-bar"]'] })
    expect(md).toBe('The result is $E = mc^2$.')
  })

  it('DeepSeek: .ds-markdown with a table', () => {
    const html =
      '<div class="msg"><div class="ds-markdown">' +
      '<table><thead><tr><th>Model</th><th>Score</th></tr></thead>' +
      '<tbody><tr><td>a</td><td>1</td></tr></tbody></table>' +
      '</div></div>'
    const md = markdownFor(html, { ...base, answerBody: ['.ds-markdown'] })
    expect(md).toBe('| Model | Score |\n| --- | --- |\n| a | 1 |')
  })

  it('Gemini: message-content with a nested list', () => {
    const html =
      '<div class="msg"><message-content>' +
      '<p>Steps:</p>' +
      '<ol><li>First</li><li>Second<ul><li>detail</li></ul></li></ol>' +
      '</message-content></div>'
    const md = markdownFor(html, { ...base, answerBody: ['message-content'] })
    expect(md).toBe('Steps:\n\n1. First\n2. Second\n  - detail')
  })
})

// A streamed answer (this fixture's own fake-chat.html, and every real site) lands as many
// sibling text nodes and inline elements with no <p> wrapper at all - they must read as one
// paragraph, and only a real block element may start a new one.
describe('inline content without a <p> wrapper', () => {
  it('merges many adjacent text nodes into one paragraph', () => {
    document.body.innerHTML = '<div class="msg"></div>'
    const msg = document.querySelector('.msg')!
    for (const word of ['reply', 'to:', 'a', 'question', '(turn', '1)']) {
      msg.appendChild(document.createTextNode((msg.childNodes.length ? ' ' : '') + word))
    }
    install(base)
    expect(window.__ndAsk!.probe().lastAnswer).toBe('reply to: a question (turn 1)')
  })

  it('merges text nodes mixed with inline elements (strong, code) directly inside a div', () => {
    document.body.innerHTML = '<div class="msg"></div>'
    const msg = document.querySelector('.msg')!
    const strong = document.createElement('strong')
    strong.textContent = 'gemini'
    msg.appendChild(strong)
    msg.appendChild(document.createTextNode(' says '))
    const code = document.createElement('code')
    code.textContent = 'ok'
    msg.appendChild(code)
    msg.appendChild(document.createTextNode(' now'))
    install(base)
    expect(window.__ndAsk!.probe().lastAnswer).toBe('**gemini** says `ok` now')
  })

  it('matches the fake fixture exact streamed shape: <strong>, bare text words, <ul>, <pre>', () => {
    document.body.innerHTML = '<div class="msg"><div class="body"></div></div>'
    const body = document.querySelector('.body')!

    const strong = document.createElement('strong')
    strong.textContent = 'gemini'
    body.appendChild(strong)
    for (const word of ['reply', 'to:', 'a', 'question', '(turn', '1)']) {
      body.appendChild(document.createTextNode(' ' + word))
    }
    const ul = document.createElement('ul')
    const li1 = document.createElement('li')
    li1.textContent = 'item one'
    const li2 = document.createElement('li')
    li2.textContent = 'item two'
    ul.appendChild(li1)
    ul.appendChild(li2)
    body.appendChild(ul)
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-js'
    code.textContent = 'console.log(1)'
    pre.appendChild(code)
    body.appendChild(pre)

    install({ ...base, answerBody: ['.body'] })
    expect(window.__ndAsk!.probe().lastAnswer).toBe(
      '**gemini** reply to: a question (turn 1)\n\n- item one\n- item two\n\n```js\nconsole.log(1)\n```',
    )
  })
})

function katexInlineFixture(): string {
  return (
    '<span class="katex"><span class="katex-mathml">' +
    '<math><semantics><mrow><mi>E</mi></mrow><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math>' +
    '</span><span class="katex-html" aria-hidden="true">rendered garbage</span></span>'
  )
}
