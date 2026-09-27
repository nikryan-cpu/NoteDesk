import { describe, expect, it } from 'vitest'
import { dictionaryKeys, translate, type I18nKey } from '@shared/i18n'
import { en } from '@shared/i18n/en'
import { ru } from '@shared/i18n/ru'
import type { Locale } from '@shared/settings'

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()
}

describe('en/ru dictionaries', () => {
  it('have exactly the same key set', () => {
    expect(dictionaryKeys('ru').sort()).toEqual(dictionaryKeys('en').sort())
  })

  it('have no empty strings', () => {
    for (const [key, value] of Object.entries(en)) expect(value.trim(), key).not.toBe('')
    for (const [key, value] of Object.entries(ru)) expect(value.trim(), key).not.toBe('')
  })

  it('use the same placeholders in en and ru for every key', () => {
    for (const key of Object.keys(en) as I18nKey[]) {
      expect(placeholders(ru[key]), key).toEqual(placeholders(en[key]))
    }
  })
})

describe('translate', () => {
  it('substitutes params', () => {
    expect(translate('en', 'common.minutes', { n: 5 })).toBe('5 min')
    expect(translate('ru', 'common.minutes', { n: 5 })).toBe('5 мин')
  })

  it('substitutes multiple params', () => {
    expect(translate('en', 'find.count', { a: 1, b: 3 })).toBe('1 of 3')
  })

  it('falls back to English for an unknown locale', () => {
    expect(translate('fr' as Locale, 'app.name')).toBe(en['app.name'])
  })

  it('falls back to the key itself when missing everywhere', () => {
    expect(translate('en', 'no.such.key' as I18nKey)).toBe('no.such.key')
  })
})
