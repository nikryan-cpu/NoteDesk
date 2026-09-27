// @vitest-environment happy-dom
// The page runtime, installed the way the engine installs it: take the source string from
// runtimeScript() and run it with new Function(). That doubles as proof the installer really is
// self-contained - it has already gone through TS-to-JS compilation and been re-parsed once by
// the time any assertion below runs.
import { describe, expect, it, beforeEach } from 'vitest'
import { runtimeScript, HAS_RUNTIME_SCRIPT } from '../../src/main/ask/runtime'
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
