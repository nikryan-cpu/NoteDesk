import { describe, expect, it } from 'vitest'
import {
  historyKey,
  historyKindForUrl,
  isAllowedInApp,
  isAuthOrPickerUrl,
  isGoogleHost,
  isSafeExternal,
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

  it('returns null for unrelated or unparsable urls', () => {
    expect(serviceForUrl('https://example.com')).toBeNull()
    expect(serviceForUrl('not a url')).toBeNull()
  })
})

describe('isAuthOrPickerUrl', () => {
  it('recognizes sign-in hosts', () => {
    expect(isAuthOrPickerUrl('https://accounts.google.com/signin')).toBe(true)
    expect(isAuthOrPickerUrl('https://accounts.google.ru/signin')).toBe(true)
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

describe('historyKindForUrl', () => {
  it('recognizes notebook ids', () => {
    expect(historyKindForUrl('https://notebook.google/notebook/abcdef123456')).toBe('notebook')
  })

  it('recognizes gemini chat urls', () => {
    expect(historyKindForUrl('https://gemini.google.com/app/abcdef123456')).toBe('gemini-chat')
    expect(historyKindForUrl('https://gemini.google.com/u/1/app/abcdef123456')).toBe('gemini-chat')
    expect(historyKindForUrl('https://gemini.google.com/gem/coding-partner/abcdef123456')).toBe('gemini-chat')
  })

  it('returns null for a plain /app with no id', () => {
    expect(historyKindForUrl('https://gemini.google.com/app')).toBeNull()
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
