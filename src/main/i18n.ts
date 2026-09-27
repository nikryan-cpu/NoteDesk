import { app } from 'electron'
import { translate, type I18nKey } from '@shared/i18n'
import { resolveLocale, type Locale } from '@shared/settings'
import { getSettings } from './settings'

export function currentLocale(): Locale {
  return resolveLocale(getSettings().locale, app.getLocale())
}

export function t(key: I18nKey, params?: Record<string, string | number>): string {
  return translate(currentLocale(), key, params)
}
