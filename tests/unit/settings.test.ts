import { describe, expect, it } from 'vitest'
import { defaultSettings, resolveLocale, sanitizeSettings, toPublic, type Settings } from '@shared/settings'

describe('sanitizeSettings', () => {
  it('falls back to a fresh copy of the defaults for non-object input', () => {
    const a = sanitizeSettings(null)
    const b = sanitizeSettings(undefined)
    const c = sanitizeSettings('nope')
    const d = sanitizeSettings(42)
    const e = sanitizeSettings([])
    expect(a).toEqual(defaultSettings())
    expect(b).toEqual(defaultSettings())
    expect(c).toEqual(defaultSettings())
    expect(d).toEqual(defaultSettings())
    expect(e).toEqual(defaultSettings())
    expect(a).not.toBe(defaultSettings())
    expect(a).not.toBe(b)
  })

  it('drops unknown keys', () => {
    const result = sanitizeSettings({ foo: 'bar', theme: 'nord' }) as unknown as Record<string, unknown>
    expect(result['foo']).toBeUndefined()
    expect(result['theme']).toBe('nord')
  })

  it('falls back to the base value for invalid enums', () => {
    const result = sanitizeSettings({ locale: 'xx', theme: 'nonexistent', colorMode: 'purple' })
    const d = defaultSettings()
    expect(result.locale).toBe(d.locale)
    expect(result.theme).toBe(d.theme)
    expect(result.colorMode).toBe(d.colorMode)
  })

  it('clamps numeric fields to their ranges', () => {
    const low = sanitizeSettings({ sleepAfterMinutes: -5, proxy: { port: 0 } })
    const high = sanitizeSettings({ sleepAfterMinutes: 5000, proxy: { port: 999999 } })
    expect(low.sleepAfterMinutes).toBe(0)
    expect(low.proxy.port).toBe(1)
    expect(high.sleepAfterMinutes).toBe(240)
    expect(high.proxy.port).toBe(65535)
  })

  it('allows an empty accent and rejects an invalid hex', () => {
    const base: Settings = { ...defaultSettings(), accent: '#123abc' }
    expect(sanitizeSettings({ accent: '' }, base).accent).toBe('')
    expect(sanitizeSettings({ accent: '#ABCDEF' }, base).accent).toBe('#ABCDEF')
    expect(sanitizeSettings({ accent: 'not-a-color' }, base).accent).toBe('#123abc')
  })

  it('strips unsafe characters from profile ids and drops duplicates', () => {
    const result = sanitizeSettings({
      profiles: [
        { id: 'a b!@#1', name: 'One', color: '#6366f1' },
        { id: 'a!b!1', name: 'Dup', color: '#ec4899' },
      ],
    })
    expect(result.profiles).toHaveLength(1)
    expect(result.profiles[0]!.id).toBe('ab1')
    expect(result.profiles[0]!.name).toBe('One')
  })

  it('caps profiles at 12', () => {
    const profiles = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#6366f1' }))
    const result = sanitizeSettings({ profiles })
    expect(result.profiles).toHaveLength(12)
  })

  it('falls back to the default profile when the list is empty', () => {
    const result = sanitizeSettings({ profiles: [] })
    expect(result.profiles).toEqual(defaultSettings().profiles)
  })

  it('falls back defaultProfileId to the first profile when unmatched', () => {
    const result = sanitizeSettings({
      profiles: [{ id: 'work', name: 'Work', color: '#6366f1' }],
      defaultProfileId: 'missing',
    })
    expect(result.defaultProfileId).toBe('work')
  })

  it('filters spellcheck languages by pattern and caps the list', () => {
    const result = sanitizeSettings({
      spellcheckLanguages: ['ru', 'en-US', 'invalid_lang', 'X', 'toolonglang', 'de', 'fr', 'it'],
    })
    expect(result.spellcheckLanguages).toEqual(['ru', 'en-US', 'de', 'fr', 'it'])
    expect(result.spellcheckLanguages).not.toContain('invalid_lang')
    expect(result.spellcheckLanguages).not.toContain('X')
    expect(result.spellcheckLanguages).not.toContain('toolonglang')
    expect(result.spellcheckLanguages.length).toBeLessThanOrEqual(6)
  })

  it('uses the base argument as a fallback for missing fields (patch semantics)', () => {
    const base: Settings = { ...defaultSettings(), density: 'compact', tabLayout: 'vertical' }
    const result = sanitizeSettings({ theme: 'nord' }, base)
    expect(result.theme).toBe('nord')
    expect(result.density).toBe('compact')
    expect(result.tabLayout).toBe('vertical')
  })

  it('sanitizes proxy fields', () => {
    const result = sanitizeSettings({
      proxy: { mode: 'bogus', scheme: 'bogus', host: '  127.0.0.1  ', port: -1, googleOnly: 'nope' },
    })
    const d = defaultSettings()
    expect(result.proxy.mode).toBe(d.proxy.mode)
    expect(result.proxy.scheme).toBe(d.proxy.scheme)
    expect(result.proxy.host).toBe('127.0.0.1')
    expect(result.proxy.port).toBe(1)
    expect(result.proxy.googleOnly).toBe(d.proxy.googleOnly)
  })
})

describe('enabledModels sanitize', () => {
  it('drops invalid ids and never allows gemini', () => {
    const result = sanitizeSettings({ enabledModels: ['claude', 'gemini', 'bogus', 'chatgpt'] })
    expect(result.enabledModels).toEqual(['claude', 'chatgpt'])
  })

  it('dedupes', () => {
    const result = sanitizeSettings({ enabledModels: ['claude', 'claude', 'qwen'] })
    expect(result.enabledModels).toEqual(['claude', 'qwen'])
  })

  it('falls back to the base value for non-array input', () => {
    const base: Settings = { ...defaultSettings(), enabledModels: ['deepseek'] }
    expect(sanitizeSettings({ enabledModels: 'nope' }, base).enabledModels).toEqual(['deepseek'])
  })
})

describe('askModels sanitize', () => {
  it('drops invalid ids and caps the list at 4', () => {
    const result = sanitizeSettings({ askModels: ['gemini', 'claude', 'chatgpt', 'deepseek', 'qwen', 'bogus'] })
    expect(result.askModels).toEqual(['gemini', 'claude', 'chatgpt', 'deepseek'])
  })

  it('dedupes', () => {
    const result = sanitizeSettings({ askModels: ['gemini', 'gemini', 'claude'] })
    expect(result.askModels).toEqual(['gemini', 'claude'])
  })

  it('never ends up empty, falling back to the base value', () => {
    const base: Settings = { ...defaultSettings(), askModels: ['claude'] }
    expect(sanitizeSettings({ askModels: [] }, base).askModels).toEqual(['claude'])
    expect(sanitizeSettings({ askModels: ['bogus', 42, null] }, base).askModels).toEqual(['claude'])
  })
})

describe('toPublic', () => {
  it('never exposes passwordEnc and reports hasPassword correctly', () => {
    const withPassword: Settings = { ...defaultSettings(), proxy: { ...defaultSettings().proxy, passwordEnc: 'xyz' } }
    const pub = toPublic(withPassword)
    expect((pub.proxy as unknown as Record<string, unknown>)['passwordEnc']).toBeUndefined()
    expect(pub.proxy.hasPassword).toBe(true)

    const noPassword = toPublic(defaultSettings())
    expect(noPassword.proxy.hasPassword).toBe(false)
  })
})

describe('resolveLocale', () => {
  it('maps auto to ru for Russian and related system locales', () => {
    expect(resolveLocale('auto', 'ru-RU')).toBe('ru')
    expect(resolveLocale('auto', 'be-BY')).toBe('ru')
    expect(resolveLocale('auto', 'uk-UA')).toBe('ru')
    expect(resolveLocale('auto', 'kk-KZ')).toBe('ru')
  })

  it('maps auto to en for everything else', () => {
    expect(resolveLocale('auto', 'en-US')).toBe('en')
    expect(resolveLocale('auto', 'fr-FR')).toBe('en')
    expect(resolveLocale('auto', 'ruby')).toBe('en')
  })

  it('lets an explicit preference win over the system locale', () => {
    expect(resolveLocale('en', 'ru-RU')).toBe('en')
    expect(resolveLocale('ru', 'en-US')).toBe('ru')
  })
})
