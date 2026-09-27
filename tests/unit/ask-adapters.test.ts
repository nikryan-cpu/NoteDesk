// @vitest-environment happy-dom
// Real-site adapters: URL recognition and that every selector at least parses as CSS.
// adapterFor()'s NOTEDESK_E2E branch needs a real Electron `app` (for app.getAppPath()) and is
// only exercised end-to-end inside Electron itself - it is not reachable from plain Vitest.
import { describe, expect, it } from 'vitest'
import { ADAPTERS } from '../../src/main/ask/adapters'
import { MODEL_IDS } from '@shared/services'
import type { ModelId } from '@shared/services'
import { capabilitiesOf } from '../../src/main/ask/types'
import type { PageConfig } from '../../src/main/ask/types'

describe('ADAPTERS', () => {
  it('has one adapter per model id, with a matching id field', () => {
    for (const id of MODEL_IDS) {
      expect(ADAPTERS[id]).toBeDefined()
      expect(ADAPTERS[id].id).toBe(id)
    }
  })

  it('newChatUrl matches the known service entry point for each site', () => {
    expect(ADAPTERS.gemini.newChatUrl).toBe('https://gemini.google.com/app')
    expect(ADAPTERS.claude.newChatUrl).toBe('https://claude.ai/new')
    expect(ADAPTERS.chatgpt.newChatUrl).toBe('https://chatgpt.com/')
    expect(ADAPTERS.deepseek.newChatUrl).toBe('https://chat.deepseek.com/')
    expect(ADAPTERS.qwen.newChatUrl).toBe('https://chat.qwen.ai/')
  })

  it('every adapter declares a submitWith', () => {
    for (const id of MODEL_IDS) {
      expect(['enter', 'button']).toContain(ADAPTERS[id].page.submitWith)
    }
  })
})

describe('isThreadUrl', () => {
  it('gemini: a chat path under /app is a thread, the bare app URL is not', () => {
    expect(ADAPTERS.gemini.isThreadUrl('https://gemini.google.com/app/abcdef123456')).toBe(true)
    expect(ADAPTERS.gemini.isThreadUrl('https://gemini.google.com/app')).toBe(false)
    expect(ADAPTERS.gemini.isThreadUrl('https://claude.ai/chat/abcdefgh')).toBe(false)
  })

  it('claude: /chat/<id>', () => {
    expect(ADAPTERS.claude.isThreadUrl('https://claude.ai/chat/abcdefgh')).toBe(true)
    expect(ADAPTERS.claude.isThreadUrl('https://claude.ai/new')).toBe(false)
  })

  it('chatgpt: /c/<id>', () => {
    expect(ADAPTERS.chatgpt.isThreadUrl('https://chatgpt.com/c/abcdefgh')).toBe(true)
    expect(ADAPTERS.chatgpt.isThreadUrl('https://chatgpt.com/')).toBe(false)
  })

  it('deepseek: /a/chat/s/<id>', () => {
    expect(ADAPTERS.deepseek.isThreadUrl('https://chat.deepseek.com/a/chat/s/abcdef')).toBe(true)
    expect(ADAPTERS.deepseek.isThreadUrl('https://chat.deepseek.com/')).toBe(false)
  })

  it('qwen: /c/<id>', () => {
    expect(ADAPTERS.qwen.isThreadUrl('https://chat.qwen.ai/c/abcdef')).toBe(true)
    expect(ADAPTERS.qwen.isThreadUrl('https://chat.qwen.ai/')).toBe(false)
  })

  it('never crosses sites', () => {
    expect(ADAPTERS.claude.isThreadUrl('https://chatgpt.com/c/abcdefgh')).toBe(false)
    expect(ADAPTERS.chatgpt.isThreadUrl('https://claude.ai/chat/abcdefgh')).toBe(false)
  })
})

describe('isLoginUrl', () => {
  it('gemini signs in through accounts.google.com', () => {
    expect(ADAPTERS.gemini.isLoginUrl('https://accounts.google.com/ServiceLogin?service=gemini')).toBe(true)
    expect(ADAPTERS.gemini.isLoginUrl('https://gemini.google.com/app')).toBe(false)
  })

  it('claude: /login', () => {
    expect(ADAPTERS.claude.isLoginUrl('https://claude.ai/login')).toBe(true)
    expect(ADAPTERS.claude.isLoginUrl('https://claude.ai/new')).toBe(false)
  })

  it('chatgpt: /auth/* on chatgpt.com, or auth.openai.com', () => {
    expect(ADAPTERS.chatgpt.isLoginUrl('https://chatgpt.com/auth/login')).toBe(true)
    expect(ADAPTERS.chatgpt.isLoginUrl('https://auth.openai.com/u/login')).toBe(true)
    expect(ADAPTERS.chatgpt.isLoginUrl('https://chatgpt.com/')).toBe(false)
  })

  it('deepseek: /sign_in', () => {
    expect(ADAPTERS.deepseek.isLoginUrl('https://chat.deepseek.com/sign_in')).toBe(true)
    expect(ADAPTERS.deepseek.isLoginUrl('https://chat.deepseek.com/')).toBe(false)
  })

  it('qwen: /auth', () => {
    expect(ADAPTERS.qwen.isLoginUrl('https://chat.qwen.ai/auth')).toBe(true)
    expect(ADAPTERS.qwen.isLoginUrl('https://chat.qwen.ai/')).toBe(false)
  })

  it('an unparsable URL is never a login page', () => {
    for (const id of MODEL_IDS) {
      expect(ADAPTERS[id].isLoginUrl('not a url')).toBe(false)
    }
  })
})

// A literal tuple (not `(keyof PageConfig)[]`) so `page[key]` below narrows to the string[]
// fields only - thinking/search/variant are checked separately, they are not selector lists.
const SELECTOR_KEYS = ['composer', 'send', 'stop', 'assistant', 'answerBody', 'signedOut', 'signedIn', 'strip'] as const

describe('every selector is valid CSS', () => {
  for (const id of MODEL_IDS as readonly ModelId[]) {
    it(`${id}: every selector list parses (or is skippable, e.g. :has in an engine without it)`, () => {
      const page = ADAPTERS[id].page
      for (const key of SELECTOR_KEYS) {
        const list = page[key]
        if (!list) continue
        expect(list.length).toBeGreaterThan(0)
        for (const selector of list) {
          expect(typeof selector).toBe('string')
          expect(selector.length).toBeGreaterThan(0)
          try {
            document.querySelectorAll(selector)
          } catch (e) {
            // an unsupported selector must fail closed, not throw, when the real runtime
            // evaluates it - safeQueryAll in runtime.ts covers that; here we only rule out
            // selectors that are simply invalid CSS everywhere
            if (!/:has\(/i.test(selector)) throw e
          }
        }
      }
    })
  }
})

function checkSelectorList(list: string[]): void {
  expect(list.length).toBeGreaterThan(0)
  for (const selector of list) {
    expect(typeof selector).toBe('string')
    expect(selector.length).toBeGreaterThan(0)
    try {
      document.querySelectorAll(selector)
    } catch (e) {
      if (!/:has\(/i.test(selector)) throw e
    }
  }
}

describe('thinking / search / variant selectors are valid CSS', () => {
  for (const id of MODEL_IDS as readonly ModelId[]) {
    it(`${id}: every configured toggle/variant selector list parses`, () => {
      const page: PageConfig = ADAPTERS[id].page
      if (page.thinking?.button) checkSelectorList(page.thinking.button)
      if (page.thinking?.menu) checkSelectorList(page.thinking.menu)
      if (page.thinking?.item) checkSelectorList(page.thinking.item)
      if (page.search?.button) checkSelectorList(page.search.button)
      if (page.search?.menu) checkSelectorList(page.search.menu)
      if (page.search?.item) checkSelectorList(page.search.item)
      if (page.variant) {
        checkSelectorList(page.variant.menu)
        checkSelectorList(page.variant.item)
      }
    })
  }
})

describe('variants', () => {
  it('every adapter exposes a variants array (empty when the service has no usable picker)', () => {
    for (const id of MODEL_IDS) {
      expect(Array.isArray(ADAPTERS[id].variants)).toBe(true)
    }
  })

  it('every variant has a non-empty id, label and match list', () => {
    for (const id of MODEL_IDS) {
      for (const v of ADAPTERS[id].variants) {
        expect(v.id.length).toBeGreaterThan(0)
        expect(v.label.length).toBeGreaterThan(0)
        expect(v.match.length).toBeGreaterThan(0)
        for (const m of v.match) expect(m.length).toBeGreaterThan(0)
      }
    }
  })

  it('variant ids are unique within an adapter', () => {
    for (const id of MODEL_IDS) {
      const ids = ADAPTERS[id].variants.map((v) => v.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('deepseek has no variant picker in this chat UI', () => {
    expect(ADAPTERS.deepseek.variants).toEqual([])
  })
})

describe('capabilitiesOf', () => {
  it('mirrors each adapter\'s variants, thinking and search', () => {
    for (const id of MODEL_IDS) {
      const adapter = ADAPTERS[id]
      const caps = capabilitiesOf(adapter)
      expect(caps.variants).toEqual(adapter.variants.map((v) => ({ id: v.id, label: v.label })))
      expect(caps.thinking).toBe(Boolean(adapter.page.thinking))
      expect(caps.search).toBe(Boolean(adapter.page.search))
    }
  })

  it('gemini has no search toggle of its own and thinking is a variant, not a switch', () => {
    const caps = capabilitiesOf(ADAPTERS.gemini)
    expect(caps.search).toBe(false)
    expect(caps.thinking).toBe(false)
  })
})
