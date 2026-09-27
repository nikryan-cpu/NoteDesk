import type { Locale } from '../settings'
import { en, type I18nKey } from './en'
import { ru } from './ru'

export type { I18nKey }

const DICTS: Record<Locale, Record<I18nKey, string>> = { en, ru }

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', ru: 'Русский' }

export function translate(locale: Locale, key: I18nKey, params?: Record<string, string | number>): string {
  let s = DICTS[locale]?.[key] ?? en[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export function dictionaryKeys(locale: Locale): string[] {
  return Object.keys(DICTS[locale])
}
