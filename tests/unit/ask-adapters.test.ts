// @vitest-environment happy-dom
// Real-site adapters: URL recognition and that every selector at least parses as CSS.
// adapterFor()'s NOTEDESK_E2E branch needs a real Electron `app` (for app.getAppPath()) and is
// only exercised end-to-end inside Electron itself - it is not reachable from plain Vitest.
import { describe, expect, it } from 'vitest'
import { ADAPTERS } from '../../src/main/ask/adapters'
import { MODEL_IDS } from '@shared/services'
import type { ModelId } from '@shared/services'
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

const SELECTOR_KEYS: (keyof PageConfig)[] = ['composer', 'send', 'stop', 'assistant', 'answerBody', 'signedOut', 'signedIn', 'strip']

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
