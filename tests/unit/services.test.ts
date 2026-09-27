import { describe, expect, it } from 'vitest'
import {
  historyKey,
  historyKindForUrl,
  isAllowedInApp,
  isAuthOrPickerUrl,
  isChatUrl,
  isGoogleHost,
  isSafeExternal,
  isServiceHost,
  isTrustedHost,
  serviceForUrl,
} from '@shared/services'

describe('isGoogleHost', () => {
  it('accepts Google ccTLDs and country domains', () => {
    expect(isGoogleHost('google.com')).toBe(true)
    expect(isGoogleHost('google.ru')).toBe(true)
    expect(isGoogleHost('google.co.uk')).toBe(true)
    expect(isGoogleHost('google.com.br')).toBe(true)
  })

  it('accepts hosts on the .google TLD', () => {
    expect(isGoogleHost('notebook.google')).toBe(true)
    expect(isGoogleHost('gemini.google.com')).toBe(true)
  })

  it('accepts Google static/media hosts', () => {
    expect(isGoogleHost('fonts.gstatic.com')).toBe(true)
    expect(isGoogleHost('accounts.youtube.com')).toBe(true)
  })

  it('rejects lookalike and unrelated hosts', () => {
    expect(isGoogleHost('evil-google.com')).toBe(false)
    expect(isGoogleHost('google.com.evil.io')).toBe(false)
    expect(isGoogleHost('notgoogle.com')).toBe(false)
    expect(isGoogleHost('youtube.com')).toBe(false)
  })
})

describe('serviceForUrl', () => {
  it('resolves current and legacy Notebook hosts', () => {
    expect(serviceForUrl('https://notebook.google/notebook/abc')).toBe('notebook')
    expect(serviceForUrl('https://notebook.google.com/notebook/abc')).toBe('notebook')
    expect(serviceForUrl('https://notebooklm.google.com/notebook/abc')).toBe('notebook')
  })

  it('resolves Gemini', () => {
    expect(serviceForUrl('https://gemini.google.com/app')).toBe('gemini')
  })

  it('resolves the other chat services', () => {
    expect(serviceForUrl('https://claude.ai/new')).toBe('claude')
    expect(serviceForUrl('https://chatgpt.com/')).toBe('chatgpt')
    expect(serviceForUrl('https://chat.deepseek.com/')).toBe('deepseek')
    expect(serviceForUrl('https://chat.qwen.ai/')).toBe('qwen')
  })

  it('returns null for unrelated or unparsable urls', () => {
    expect(serviceForUrl('https://example.com')).toBeNull()
    expect(serviceForUrl('not a url')).toBeNull()
  })
})

describe('isServiceHost', () => {
  it('accepts the chat services and their auth hosts', () => {
    expect(isServiceHost('claude.ai')).toBe(true)
    expect(isServiceHost('chatgpt.com')).toBe(true)
    expect(isServiceHost('auth.openai.com')).toBe(true)
    expect(isServiceHost('chat.deepseek.com')).toBe(true)
    expect(isServiceHost('chat.qwen.ai')).toBe(true)
  })

  it('rejects Google hosts (handled separately by isGoogleHost)', () => {
    expect(isServiceHost('gemini.google.com')).toBe(false)
    expect(isServiceHost('notebook.google')).toBe(false)
  })

  it('rejects lookalike hosts', () => {
    expect(isServiceHost('claude.ai.evil.com')).toBe(false)
    expect(isServiceHost('notclaude.ai')).toBe(false)
    expect(isServiceHost('chatgpt.com.example.org')).toBe(false)
    expect(isServiceHost('evilchatgpt.com')).toBe(false)
  })
})

describe('isTrustedHost', () => {
  it('accepts Google and the chat services', () => {
    expect(isTrustedHost('gemini.google.com')).toBe(true)
    expect(isTrustedHost('claude.ai')).toBe(true)
    expect(isTrustedHost('chatgpt.com')).toBe(true)
    expect(isTrustedHost('chat.deepseek.com')).toBe(true)
    expect(isTrustedHost('chat.qwen.ai')).toBe(true)
  })

  it('rejects lookalikes and unrelated hosts', () => {
    expect(isTrustedHost('claude.ai.evil.com')).toBe(false)
    expect(isTrustedHost('notclaude.ai')).toBe(false)
    expect(isTrustedHost('chatgpt.com.example.org')).toBe(false)
    expect(isTrustedHost('example.com')).toBe(false)
  })
})

describe('isAuthOrPickerUrl', () => {
  it('recognizes sign-in hosts', () => {
    expect(isAuthOrPickerUrl('https://accounts.google.com/signin')).toBe(true)
    expect(isAuthOrPickerUrl('https://accounts.google.ru/signin')).toBe(true)
  })

  it('does not trust lookalike sign-in hosts', () => {
    expect(isAuthOrPickerUrl('https://accounts.google.evil.com/signin')).toBe(false)
    expect(isAuthOrPickerUrl('https://accounts.google.com.evil.io/signin')).toBe(false)
  })

  it('recognizes drive/docs pickers', () => {
    expect(isAuthOrPickerUrl('https://docs.google.com/picker?x=1')).toBe(true)
    expect(isAuthOrPickerUrl('https://drive.google.com/picker?x=1')).toBe(true)
  })

  it('recognizes the oauth2 path', () => {
    expect(isAuthOrPickerUrl('https://accounts.google.com/o/oauth2/auth')).toBe(true)
  })

  it('does not flag regular docs pages', () => {
    expect(isAuthOrPickerUrl('https://docs.google.com/document/d/abc')).toBe(false)
  })
})

describe('isAllowedInApp', () => {
  it('allows https Google urls', () => {
    expect(isAllowedInApp('https://notebook.google/notebook/abc')).toBe(true)
  })

  it('rejects http', () => {
    expect(isAllowedInApp('http://notebook.google/notebook/abc')).toBe(false)
  })

  it('allows about:blank only', () => {
    expect(isAllowedInApp('about:blank')).toBe(true)
    expect(isAllowedInApp('about:config')).toBe(false)
  })

  it('rejects non-Google hosts', () => {
    expect(isAllowedInApp('https://example.com')).toBe(false)
  })

  it('rejects javascript: urls', () => {
    expect(isAllowedInApp('javascript:alert(1)')).toBe(false)
  })

  it('allows the other chat services and their auth hosts', () => {
    expect(isAllowedInApp('https://claude.ai/new')).toBe(true)
    expect(isAllowedInApp('https://chatgpt.com/')).toBe(true)
    expect(isAllowedInApp('https://auth.openai.com/authorize')).toBe(true)
    expect(isAllowedInApp('https://chat.deepseek.com/')).toBe(true)
    expect(isAllowedInApp('https://chat.qwen.ai/')).toBe(true)
  })

  it('rejects lookalike chat-service hosts', () => {
    expect(isAllowedInApp('https://claude.ai.evil.com')).toBe(false)
    expect(isAllowedInApp('https://notclaude.ai')).toBe(false)
    expect(isAllowedInApp('https://chatgpt.com.example.org')).toBe(false)
  })
})

describe('isSafeExternal', () => {
  it('allows http, https and mailto', () => {
    expect(isSafeExternal('https://example.com')).toBe(true)
    expect(isSafeExternal('http://example.com')).toBe(true)
    expect(isSafeExternal('mailto:someone@example.com')).toBe(true)
  })

  it('rejects other schemes', () => {
    expect(isSafeExternal('file:///etc/passwd')).toBe(false)
    expect(isSafeExternal('javascript:alert(1)')).toBe(false)
    expect(isSafeExternal('notedesk://open')).toBe(false)
  })
})

describe('isChatUrl', () => {
  it('recognizes one conversation per chat service', () => {
    expect(isChatUrl('https://claude.ai/chat/0b6c4e2a-1f7e-4c1a-9f7e-2d3c4b5a6f70')).toBe(true)
    expect(isChatUrl('https://chatgpt.com/c/68a1b2c3-d4e5-8000-9abc-def012345678')).toBe(true)
    expect(isChatUrl('https://chat.deepseek.com/a/chat/s/1a2b3c4d-5e6f')).toBe(true)
    expect(isChatUrl('https://chat.qwen.ai/c/9f8e7d6c-5b4a')).toBe(true)
    expect(isChatUrl('https://gemini.google.com/app/abcdef123456')).toBe(true)
  })

  it('rejects a service home with no conversation id', () => {
    expect(isChatUrl('https://claude.ai/new')).toBe(false)
    expect(isChatUrl('https://chatgpt.com/')).toBe(false)
  })

  it('checks against a specific service when given one', () => {
    expect(isChatUrl('https://claude.ai/chat/0b6c4e2a-1f7e-4c1a-9f7e-2d3c4b5a6f70', 'claude')).toBe(true)
    expect(isChatUrl('https://claude.ai/chat/0b6c4e2a-1f7e-4c1a-9f7e-2d3c4b5a6f70', 'chatgpt')).toBe(false)
  })
})

describe('historyKindForUrl', () => {
  it('recognizes notebook ids', () => {
    expect(historyKindForUrl('https://notebook.google/notebook/abcdef123456')).toBe('notebook')
  })

  it('recognizes gemini chat urls', () => {
    expect(historyKindForUrl('https://gemini.google.com/app/abcdef123456')).toBe('gemini-chat')
    expect(historyKindForUrl('https://gemini.google.com/u/1/app/abcdef123456')).toBe('gemini-chat')
    expect(historyKindForUrl('https://gemini.google.com/gem/coding-partner/abcdef123456')).toBe('gemini-chat')
  })

  it('recognizes model-chat urls for the other chat services', () => {
    expect(historyKindForUrl('https://claude.ai/chat/0b6c4e2a-1f7e-4c1a-9f7e-2d3c4b5a6f70')).toBe('model-chat')
    expect(historyKindForUrl('https://chatgpt.com/c/68a1b2c3-d4e5-8000-9abc-def012345678')).toBe('model-chat')
    expect(historyKindForUrl('https://chat.deepseek.com/a/chat/s/1a2b3c4d-5e6f')).toBe('model-chat')
    expect(historyKindForUrl('https://chat.qwen.ai/c/9f8e7d6c-5b4a')).toBe('model-chat')
  })

  it('returns null for a plain /app with no id', () => {
    expect(historyKindForUrl('https://gemini.google.com/app')).toBeNull()
  })

  it('returns null for a chat-service home with no conversation id', () => {
    expect(historyKindForUrl('https://claude.ai/new')).toBeNull()
    expect(historyKindForUrl('https://chatgpt.com/')).toBeNull()
  })

  it('returns null for unrelated urls', () => {
    expect(historyKindForUrl('https://example.com/app/abcdef123456')).toBeNull()
  })
})

describe('historyKey', () => {
  it('drops query, hash and a trailing slash', () => {
    expect(historyKey('https://notebook.google/notebook/abc?x=1#frag')).toBe('notebook.google/notebook/abc')
    expect(historyKey('https://notebook.google/notebook/abc/')).toBe('notebook.google/notebook/abc')
    expect(historyKey('https://notebook.google/notebook/abc')).toBe('notebook.google/notebook/abc')
  })
})
