import { translate, type I18nKey } from '@shared/i18n'
import { locale } from './state.svelte'

export function t(key: I18nKey, params?: Record<string, string | number>): string {
  return translate(locale(), key, params)
}

export function modKey(platform: string): string {
  return platform === 'darwin' ? '⌘' : 'Ctrl'
}
