// @vitest-environment happy-dom
// The page runtime, installed the way the engine installs it: take the source string from
// runtimeScript() and run it with new Function(). That doubles as proof the installer really is
// self-contained - it has already gone through TS-to-JS compilation and been re-parsed once by
// the time any assertion below runs.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { runtimeScript, HAS_RUNTIME_SCRIPT, toggleScript, variantScript, OUTLINE_SCRIPT } from '../../src/main/ask/runtime'
import type { PageConfig } from '../../src/main/ask/types'

function install(config: PageConfig): void {
  new Function(runtimeScript(config))()
}

const base: PageConfig = {
  composer: ['#nope'],
  send: ['#nope'],
  stop: ['#nope'],
  assistant: ['.msg'],
  signedOut: ['#nope'],
  signedIn: ['#nope'],
  submitWith: 'enter',
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.title = ''
  delete (window as { __ndAsk?: unknown }).__ndAsk
  // an <iframe src="https://challenges.cloudflare.com/..."> below is only ever there for its
  // src attribute to match a selector - happy-dom would otherwise really try to fetch it
  const happyDOM = (window as unknown as { happyDOM?: { settings: { navigation: { disableChildFrameNavigation: boolean } } } }).happyDOM
  if (happyDOM) happyDOM.settings.navigation.disableChildFrameNavigation = true
})

describe('installation', () => {
  it('installs window.__ndAsk with all five methods', () => {
    install(base)
    // eslint-disable-next-line no-eval
    expect(eval(HAS_RUNTIME_SCRIPT)).toBe(true)
    const rt = window.__ndAsk!
    expect(typeof rt.probe).toBe('function')
    expect(typeof rt.focusComposer).toBe('function')
    expect(typeof rt.clickSend).toBe('function')
    expect(typeof rt.clickStop).toBe('function')
    expect(typeof rt.composerText).toBe('function')
  })

  it('reinstalling replaces the previous instance and picks up the new config/DOM', () => {
    document.body.innerHTML = '<div class="msg">v1</div>'
    install(base)
    const first = window.__ndAsk
    document.body.innerHTML = '<div class="msg">v2</div>'
    install(base)
    const second = window.__ndAsk
    expect(second).not.toBe(first)
    expect(second!.probe().lastAnswer).toBe('v2')
  })
})

describe('probe: signed in / out', () => {
  const cfg: PageConfig = { ...base, signedIn: ['#account'], signedOut: ['#login-form'] }

  it('true when a signedIn marker is present', () => {
    document.body.innerHTML = '<div id="account"></div>'
    install(cfg)
    expect(window.__ndAsk!.probe().signedIn).toBe(true)
  })

  it('false when a signedOut marker is present', () => {
    document.body.innerHTML = '<div id="login-form"></div>'
    install(cfg)
    expect(window.__ndAsk!.probe().signedIn).toBe(false)
  })

  it('null when neither marker is present', () => {
    document.body.innerHTML = '<div id="something-else"></div>'
    install(cfg)
    expect(window.__ndAsk!.probe().signedIn).toBe(null)
  })
})

describe('probe: challenge pages', () => {
  it('a "Just a moment" title is a challenge', () => {
    document.title = 'Just a moment...'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(true)
  })

  it('#challenge-form is a challenge', () => {
    document.body.innerHTML = '<div id="challenge-form"></div>'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(true)
  })

  it('a visible Cloudflare iframe is a challenge', () => {
    document.body.innerHTML = '<iframe src="https://challenges.cloudflare.com/cdn-cgi/x"></iframe>'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(true)
  })

  it('a hidden Cloudflare iframe is not a challenge', () => {
    document.body.innerHTML = '<iframe style="display:none" src="https://challenges.cloudflare.com/cdn-cgi/x"></iframe>'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(false)
  })

  it('an invisible turnstile badge is ignored, a visible one is a challenge', () => {
    document.body.innerHTML = '<div class="cf-turnstile" style="display:none"></div>'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(false)
    document.querySelector('.cf-turnstile')!.removeAttribute('style')
    expect(window.__ndAsk!.probe().challenge).toBe(true)
  })

  it('a generic "verify you are human" page is a challenge', () => {
    document.body.innerHTML = '<p>Please verify you are human before continuing.</p>'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(true)
  })

  it('an ordinary page is not a challenge', () => {
    document.body.innerHTML = '<div class="msg">hello</div>'
    install(base)
    expect(window.__ndAsk!.probe().challenge).toBe(false)
  })
})

describe('probe: composer', () => {
  it('matches the first usable selector', () => {
    document.body.innerHTML = '<textarea id="a"></textarea>'
    install({ ...base, composer: ['#missing', '#a'] })
    expect(window.__ndAsk!.probe().composer).toBe(true)
  })

  it('skips a disabled or readonly field even if it matches', () => {
    document.body.innerHTML = '<textarea id="a" disabled></textarea>'
    install({ ...base, composer: ['#a'] })
    expect(window.__ndAsk!.probe().composer).toBe(false)
  })

  it('skips a hidden field even if it matches', () => {
    document.body.innerHTML = '<textarea id="a" style="display:none"></textarea>'
    install({ ...base, composer: ['#a'] })
    expect(window.__ndAsk!.probe().composer).toBe(false)
  })

  it('a contenteditable="false" element does not count as a composer', () => {
    document.body.innerHTML = '<div id="a" contenteditable="false"></div>'
    install({ ...base, composer: ['#a'] })
    expect(window.__ndAsk!.probe().composer).toBe(false)
  })

  it('falls back to a generic textarea/contenteditable when no configured selector matches', () => {
    document.body.innerHTML = '<textarea id="mystery-box"></textarea>'
    install(base)
    expect(window.__ndAsk!.probe().composer).toBe(true)
  })

  it('the generic fallback prefers the largest usable field in the lower half of the page', () => {
    document.body.innerHTML =
      '<textarea id="top"></textarea><textarea id="bottom-small"></textarea><textarea id="bottom-big"></textarea>'
    document.documentElement.getBoundingClientRect = () => rect(0, 0, 1000, 800)
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    const top = document.getElementById('top') as HTMLTextAreaElement
    const small = document.getElementById('bottom-small') as HTMLTextAreaElement
    const big = document.getElementById('bottom-big') as HTMLTextAreaElement
    top.getBoundingClientRect = () => rect(0, 0, 500, 500) // large, but upper half
    small.getBoundingClientRect = () => rect(0, 700, 100, 40) // lower half, small
    big.getBoundingClientRect = () => rect(0, 700, 300, 60) // lower half, largest
    install(base)
    expect(window.__ndAsk!.focusComposer()).toBe(true)
    expect(big.value).toBe('')
    expect(top.value).toBe('')
    expect(small.value).toBe('')
  })
})

describe('probe: generating', () => {
  it('true only while a stop selector match is visible', () => {
    document.body.innerHTML = '<button id="stop" style="display:none">Stop</button>'
    install({ ...base, stop: ['#stop'] })
    expect(window.__ndAsk!.probe().generating).toBe(false)
    document.getElementById('stop')!.removeAttribute('style')
    expect(window.__ndAsk!.probe().generating).toBe(true)
  })
})

describe('probe: answerCount / lastAnswer', () => {
  it('counts from the first assistant selector that yields any matches', () => {
    document.body.innerHTML = '<div class="fallback">only this matches</div>'
    install({ ...base, assistant: ['.msg', '.fallback'] })
    const probe = window.__ndAsk!.probe()
    expect(probe.answerCount).toBe(1)
    expect(probe.lastAnswer).toBe('only this matches')
  })

  it('lastAnswer is the newest (last) match, answerCount is the total', () => {
    document.body.innerHTML = '<div class="msg">one</div><div class="msg">two</div><div class="msg">three</div>'
    install(base)
    const probe = window.__ndAsk!.probe()
    expect(probe.answerCount).toBe(3)
    expect(probe.lastAnswer).toBe('three')
  })

  it('is empty with no assistant messages yet', () => {
    document.body.innerHTML = ''
    install(base)
    const probe = window.__ndAsk!.probe()
    expect(probe.answerCount).toBe(0)
    expect(probe.lastAnswer).toBe('')
  })
})

describe('probe: notice', () => {
  it('prefers the adapter-configured notices selector', () => {
    document.body.innerHTML = '<div id="banner">You have reached your usage limit for today.</div><div role="alert">busy elsewhere</div>'
    install({ ...base, notices: ['#banner'] })
    expect(window.__ndAsk!.probe().notice).toBe('You have reached your usage limit for today.')
  })

  it('falls back to a generic [role="alert"] banner when no adapter selector matches', () => {
    document.body.innerHTML = '<div role="alert">Too many requests, please slow down.</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe('Too many requests, please slow down.')
  })

  it('ignores wording that only lives inside an assistant message', () => {
    document.body.innerHTML = '<div class="msg" role="alert">There is a limit to how fast light can travel.</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe(null)
  })

  it('ignores an invisible notice', () => {
    document.body.innerHTML = '<div role="alert" style="display:none">You have reached your limit.</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe(null)
  })

  it('an aria-live=polite region only counts once its text looks like an error', () => {
    document.body.innerHTML = '<div aria-live="polite">Message sent</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe(null)

    document.body.innerHTML = '<div aria-live="polite">You have hit your rate limit.</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe('You have hit your rate limit.')
  })

  it('finds a toast container by class name', () => {
    document.body.innerHTML = '<div class="Toastify__toast">The server is busy. Please try again later.</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe('The server is busy. Please try again later.')
  })

  it('only trusts an [class*="error"] element next to the composer or the newest answer', () => {
    document.body.innerHTML =
      '<header class="error-boundary">unrelated page chrome mentioning a quota exceeded somewhere far away</header>' +
      '<main><div class="composer-bar"><textarea id="prompt"></textarea></div></main>'
    install({ ...base, composer: ['#prompt'] })
    expect(window.__ndAsk!.probe().notice).toBe(null)
  })

  it('trusts an [class*="error"] element that sits with the composer', () => {
    document.body.innerHTML =
      '<div id="app"><div class="send-error">Too many requests, please wait a moment.</div><div class="composer-bar"><textarea id="prompt"></textarea></div></div>'
    install({ ...base, composer: ['#prompt'] })
    expect(window.__ndAsk!.probe().notice).toBe('Too many requests, please wait a moment.')
  })

  it('is null when nothing on the page looks like a notice', () => {
    document.body.innerHTML = '<div class="msg">hello there</div>'
    install(base)
    expect(window.__ndAsk!.probe().notice).toBe(null)
  })
})

describe('focusComposer', () => {
  it('clears a textarea and returns true', () => {
    document.body.innerHTML = '<textarea id="prompt">leftover text</textarea>'
    install({ ...base, composer: ['#prompt'] })
    expect(window.__ndAsk!.focusComposer()).toBe(true)
    const field = document.getElementById('prompt') as HTMLTextAreaElement
    expect(field.value).toBe('')
    expect(document.activeElement).toBe(field)
  })

  it('clears a contenteditable field and returns true', () => {
    document.body.innerHTML = '<div id="ce" contenteditable="true">leftover text</div>'
    install({ ...base, composer: ['#ce'] })
    expect(window.__ndAsk!.focusComposer()).toBe(true)
    expect(document.getElementById('ce')!.textContent).toBe('')
  })

  it('returns false when there is no composer at all', () => {
    document.body.innerHTML = '<div>nothing usable here</div>'
    install(base)
    expect(window.__ndAsk!.focusComposer()).toBe(false)
  })
})

describe('clickSend / clickStop / composerText', () => {
  it('clickSend clicks the first visible, enabled match', () => {
    document.body.innerHTML = '<button id="disabled-one" disabled>Send</button><button id="real">Send</button>'
    let clicked = ''
    document.getElementById('real')!.addEventListener('click', () => { clicked = 'real' })
    install({ ...base, send: ['#disabled-one', '#real'] })
    expect(window.__ndAsk!.clickSend()).toBe(true)
    expect(clicked).toBe('real')
  })

  it('clickSend returns false when nothing matches', () => {
    install({ ...base, send: ['#missing'] })
    expect(window.__ndAsk!.clickSend()).toBe(false)
  })

  it('clickStop clicks a visible stop button', () => {
    document.body.innerHTML = '<button id="stop">Stop</button>'
    let clicked = false
    document.getElementById('stop')!.addEventListener('click', () => { clicked = true })
    install({ ...base, stop: ['#stop'] })
    expect(window.__ndAsk!.clickStop()).toBe(true)
    expect(clicked).toBe(true)
  })

  it('composerText reads a textarea value and a contenteditable innerText', () => {
    document.body.innerHTML = '<textarea id="a">hello</textarea>'
    install({ ...base, composer: ['#a'] })
    expect(window.__ndAsk!.composerText()).toBe('hello')

    document.body.innerHTML = '<div id="b" contenteditable="true">world</div>'
    install({ ...base, composer: ['#b'] })
    expect(window.__ndAsk!.composerText()).toBe('world')
  })

  it('composerText is empty with no composer', () => {
    install(base)
    expect(window.__ndAsk!.composerText()).toBe('')
  })
})

describe('setToggle: button', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('clicks an unpressed button and reports ok', async () => {
    document.body.innerHTML = '<button id="think" aria-pressed="false">Thinking</button>'
    const btn = document.getElementById('think')!
    btn.addEventListener('click', () => btn.setAttribute('aria-pressed', 'true'))
    install({ ...base, thinking: { button: ['#think'] } })
    const result = await window.__ndAsk!.setToggle('thinking', true)
    expect(result).toBe('ok')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('does not click when already in the desired state', async () => {
    document.body.innerHTML = '<button id="think" aria-pressed="true">Thinking</button>'
    let clicked = false
    document.getElementById('think')!.addEventListener('click', () => {
      clicked = true
    })
    install({ ...base, thinking: { button: ['#think'] } })
    const result = await window.__ndAsk!.setToggle('thinking', true)
    expect(result).toBe('unchanged')
    expect(clicked).toBe(false)
  })

  it('returns missing when the button is not on the page', async () => {
    install({ ...base, thinking: { button: ['#nope-here'] } })
    expect(await window.__ndAsk!.setToggle('thinking', true)).toBe('missing')
  })

  it('returns missing for an option the page has no config for at all', async () => {
    install(base)
    expect(await window.__ndAsk!.setToggle('search', true)).toBe('missing')
  })

  it('reads aria-checked and a class token ("active"), not just aria-pressed', async () => {
    document.body.innerHTML = '<button id="a" aria-checked="true">A</button><button id="b" class="btn is-active">B</button>'
    install({ ...base, thinking: { button: ['#a'] } })
    expect(await window.__ndAsk!.setToggle('thinking', true)).toBe('unchanged')
    install({ ...base, thinking: { button: ['#b'] } })
    expect(await window.__ndAsk!.setToggle('thinking', true)).toBe('unchanged')
  })

  it('a class token "button" is not mistaken for "on"', async () => {
    document.body.innerHTML = '<button id="c" class="icon-button">C</button>'
    let clicked = false
    document.getElementById('c')!.addEventListener('click', () => {
      clicked = true
    })
    install({ ...base, thinking: { button: ['#c'] } })
    const result = await window.__ndAsk!.setToggle('thinking', true)
    expect(result).toBe('ok')
    expect(clicked).toBe(true)
  })

  it('DeepSeek-style: several broad candidates, itemText picks the one whose own text matches', async () => {
    document.body.innerHTML = '<div role="button" id="a">Search</div><div role="button" id="b">DeepThink</div>'
    let clicked = ''
    document.getElementById('a')!.addEventListener('click', () => {
      clicked = 'a'
    })
    const deepThink = document.getElementById('b')!
    deepThink.addEventListener('click', () => {
      clicked = 'b'
      deepThink.className = 'active'
    })
    install({ ...base, thinking: { button: ['div[role="button"]'], itemText: ['DeepThink'] } })
    const result = await window.__ndAsk!.setToggle('thinking', true)
    expect(result).toBe('ok')
    expect(clicked).toBe('b')
  })
})

describe('setToggle: menu', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function toggleMenuConfig() {
    return { menu: ['#tools'], item: ['.tools-menu [role="menuitemcheckbox"]'], itemText: ['Web search'] }
  }

  function buildToolsMenu(checked: boolean): void {
    document.body.innerHTML =
      '<button id="tools" type="button">Tools</button>' +
      '<div class="tools-menu" hidden><div role="menuitemcheckbox" aria-checked="' + String(checked) + '">Web search</div></div>'
    const menu = document.querySelector('.tools-menu') as HTMLElement
    const item = document.querySelector('[role="menuitemcheckbox"]') as HTMLElement
    document.getElementById('tools')!.addEventListener('click', () => {
      menu.hidden = !menu.hidden
    })
    item.addEventListener('click', () => {
      item.setAttribute('aria-checked', item.getAttribute('aria-checked') !== 'true' ? 'true' : 'false')
    })
    document.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') menu.hidden = true
    })
  }

  it('opens the menu, clicks the matching item, then closes the menu', async () => {
    buildToolsMenu(false)
    install({ ...base, search: toggleMenuConfig() })
    const result = await window.__ndAsk!.setToggle('search', true)
    expect(result).toBe('ok')
    expect(document.querySelector('[role="menuitemcheckbox"]')!.getAttribute('aria-checked')).toBe('true')
    expect((document.querySelector('.tools-menu') as HTMLElement).hidden).toBe(true)
  })

  it('an already-checked item is left alone, but the menu still closes', async () => {
    buildToolsMenu(true)
    install({ ...base, search: toggleMenuConfig() })
    const result = await window.__ndAsk!.setToggle('search', true)
    expect(result).toBe('unchanged')
    expect((document.querySelector('.tools-menu') as HTMLElement).hidden).toBe(true)
  })

  it('reads a nested input[type=checkbox] inside the item when the item itself has no aria state', async () => {
    document.body.innerHTML =
      '<button id="tools" type="button">Tools</button>' +
      '<div class="tools-menu" hidden><label role="menuitemcheckbox"><input type="checkbox"> Web search</label></div>'
    const menu = document.querySelector('.tools-menu') as HTMLElement
    document.getElementById('tools')!.addEventListener('click', () => {
      menu.hidden = !menu.hidden
    })
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    document.querySelector('[role="menuitemcheckbox"]')!.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked
    })
    install({ ...base, search: toggleMenuConfig() })
    const result = await window.__ndAsk!.setToggle('search', true)
    expect(result).toBe('ok')
    expect(checkbox.checked).toBe(true)
  })

  it('returns missing (and still closes) when no item matches itemText', async () => {
    document.body.innerHTML =
      '<button id="tools" type="button">Tools</button>' +
      '<div class="tools-menu" hidden><div role="menuitemcheckbox" aria-checked="false">Something else</div></div>'
    const menu = document.querySelector('.tools-menu') as HTMLElement
    document.getElementById('tools')!.addEventListener('click', () => {
      menu.hidden = !menu.hidden
    })
    document.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') menu.hidden = true
    })
    install({ ...base, search: toggleMenuConfig() })
    vi.useFakeTimers()
    const pending = window.__ndAsk!.setToggle('search', true)
    await vi.runAllTimersAsync()
    expect(await pending).toBe('missing')
    expect(menu.hidden).toBe(true)
  })

  it('returns missing when the menu button itself is not there', async () => {
    install({ ...base, search: toggleMenuConfig() })
    expect(await window.__ndAsk!.setToggle('search', true)).toBe('missing')
  })
})

describe('selectVariant', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function buildModelMenu(): { clicked: string[] } {
    document.body.innerHTML =
      '<button id="model" type="button">Fast ▾</button>' +
      '<div class="model-menu" hidden>' +
      '<div role="menuitem">Pro</div>' +
      '<div role="menuitem">Pro Max (experimental, show more models)</div>' +
      '<div role="menuitem">Fast</div>' +
      '</div>'
    const menuBtn = document.getElementById('model')!
    const menu = document.querySelector('.model-menu') as HTMLElement
    const clicked: string[] = []
    menuBtn.addEventListener('click', () => {
      menu.hidden = !menu.hidden
    })
    menu.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[role="menuitem"]')
      if (!target) return
      clicked.push(target.textContent || '')
      menu.hidden = true
    })
    document.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') menu.hidden = true
    })
    return { clicked }
  }

  it('clicks the item matching, preferring the shortest match over a longer "show more" entry', async () => {
    const { clicked } = buildModelMenu()
    install({ ...base, variant: { menu: ['#model'], item: ['.model-menu [role="menuitem"]'] } })
    const result = await window.__ndAsk!.selectVariant(['Pro'])
    expect(result).toBe('ok')
    expect(clicked).toEqual(['Pro'])
  })

  it('matches case-insensitively', async () => {
    const { clicked } = buildModelMenu()
    install({ ...base, variant: { menu: ['#model'], item: ['.model-menu [role="menuitem"]'] } })
    const result = await window.__ndAsk!.selectVariant(['fast'])
    expect(result).toBe('ok')
    expect(clicked).toEqual(['Fast'])
  })

  it('returns missing and closes the menu when nothing matches', async () => {
    buildModelMenu()
    install({ ...base, variant: { menu: ['#model'], item: ['.model-menu [role="menuitem"]'] } })
    vi.useFakeTimers()
    const pending = window.__ndAsk!.selectVariant(['Ultra'])
    await vi.runAllTimersAsync()
    expect(await pending).toBe('missing')
    vi.useRealTimers()
    expect((document.querySelector('.model-menu') as HTMLElement).hidden).toBe(true)
  })

  it('returns missing when the picker button is not there', async () => {
    install({ ...base, variant: { menu: ['#nope'], item: ['.x'] } })
    expect(await window.__ndAsk!.selectVariant(['Pro'])).toBe('missing')
  })

  it('returns missing when the page has no variant config', async () => {
    install(base)
    expect(await window.__ndAsk!.selectVariant(['Pro'])).toBe('missing')
  })
})

describe('outline', () => {
  it('first line is the title and the origin+pathname, without query or hash', () => {
    document.title = 'My Chat Page'
    install(base)
    const firstLine = window.__ndAsk!.outline().split('\n')[0]!
    expect(firstLine).toContain('My Chat Page')
    expect(firstLine).toContain(location.origin + location.pathname)
    expect(firstLine).not.toContain('?')
    expect(firstLine).not.toContain('#')
  })

  it('lists landmarks and controls with their attributes, and hides assistant/user/composer text', () => {
    document.body.innerHTML =
      '<header><nav aria-label="Main"><a href="/x">Link text</a></nav></header>' +
      '<main>' +
      '<div class="msg assistant"><div class="body">SECRET ANSWER must never appear' +
      '<button class="copy-btn">Copy SECRET ANSWER label</button></div></div>' +
      '<div class="msg user">SECRET QUESTION must never appear</div>' +
      '<textarea id="prompt">SECRET DRAFT must never appear</textarea>' +
      '<button id="think" aria-pressed="true">Thinking</button>' +
      '</main>'
    install({ ...base, assistant: ['.msg.assistant'], composer: ['#prompt'] })
    const out = window.__ndAsk!.outline()
    expect(out).not.toContain('SECRET ANSWER')
    expect(out).not.toContain('SECRET QUESTION')
    expect(out).not.toContain('SECRET DRAFT')
    expect(out).toContain('[text hidden]')
    expect(out).toContain('main')
    expect(out).toContain('nav')
    expect(out).toContain('aria-label="Main"')
    expect(out).toContain('aria-pressed="true"')
    expect(out).toContain('#think')
  })

  it('never prints an input value', () => {
    document.body.innerHTML = '<input id="secretfield" type="text">'
    ;(document.getElementById('secretfield') as HTMLInputElement).value = 'topsecret123'
    install(base)
    expect(window.__ndAsk!.outline()).not.toContain('topsecret123')
  })

  it('is wrapped in a try/catch and never throws', () => {
    document.body.innerHTML = '<div class="msg">hi</div>'
    install(base)
    expect(() => window.__ndAsk!.outline()).not.toThrow()
  })
})

describe('script builders', () => {
  it('toggleScript resolves through the installed runtime', async () => {
    document.body.innerHTML = '<button id="think" aria-pressed="false"></button>'
    document.getElementById('think')!.addEventListener('click', () => {
      document.getElementById('think')!.setAttribute('aria-pressed', 'true')
    })
    install({ ...base, thinking: { button: ['#think'] } })
    const result = await new Function('return (' + toggleScript('thinking', true) + ')')()
    expect(result).toBe('ok')
  })

  it('toggleScript falls back to missing with no runtime installed', () => {
    const result = new Function('return (' + toggleScript('search', true) + ')')()
    expect(result).toBe('missing')
  })

  it('variantScript resolves through the installed runtime', async () => {
    document.body.innerHTML = '<button id="model">Fast</button><div class="model-menu"><div role="menuitem">Pro</div></div>'
    install({ ...base, variant: { menu: ['#model'], item: ['.model-menu [role="menuitem"]'] } })
    const result = await new Function('return (' + variantScript(['Pro']) + ')')()
    expect(result).toBe('ok')
  })

  it('variantScript falls back to missing with no runtime installed', () => {
    const result = new Function('return (' + variantScript(['Pro']) + ')')()
    expect(result).toBe('missing')
  })

  it('OUTLINE_SCRIPT evaluates to the outline string through the installed runtime', () => {
    document.body.innerHTML = '<button>Send</button>'
    install(base)
    // eslint-disable-next-line no-eval
    const result = eval(OUTLINE_SCRIPT)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('OUTLINE_SCRIPT falls back to an empty string with no runtime installed', () => {
    // eslint-disable-next-line no-eval
    expect(eval(OUTLINE_SCRIPT)).toBe('')
  })
})

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this
    },
  } as DOMRect
}
