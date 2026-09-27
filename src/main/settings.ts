import { safeStorage } from 'electron'
import type { SettingsPatch } from '@shared/ipc'
import { defaultSettings, sanitizeSettings, toPublic, type PublicSettings, type Settings } from '@shared/settings'
import { readJson, writeJson } from './store'

type Listener = (next: Settings, prev: Settings) => void

let current: Settings = defaultSettings()
const listeners = new Set<Listener>()

export function loadSettings(): Settings {
  current = sanitizeSettings(readJson<unknown>('settings', null))
  return current
}

export function getSettings(): Settings {
  return current
}

export function publicSettings(): PublicSettings {
  return toPublic(current)
}

export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function persist(): void {
  writeJson('settings', () => current)
}

export function updateSettings(patch: SettingsPatch): Settings {
  const prev = current
  const { proxy: proxyPatch, ...rest } = patch
  const merged: Record<string, unknown> = { ...prev, ...rest }
  if (proxyPatch) {
    const { password, ...proxyRest } = proxyPatch
    const proxy = { ...prev.proxy, ...proxyRest }
    if (password !== undefined) proxy.passwordEnc = encryptSecret(password)
    merged.proxy = proxy
  }
  if (patch.hotkeys) merged.hotkeys = { ...prev.hotkeys, ...patch.hotkeys }
  current = sanitizeSettings(merged, prev)
  persist()
  for (const fn of listeners) {
    try {
      fn(current, prev)
    } catch (err) {
      console.error('[settings] listener failed', err)
    }
  }
  return current
}

export function encryptSecret(plain: string): string {
  if (!plain) return ''
  if (!safeStorage.isEncryptionAvailable()) return 'plain:' + Buffer.from(plain, 'utf8').toString('base64')
  return safeStorage.encryptString(plain).toString('base64')
}

export function decryptSecret(enc: string): string {
  if (!enc) return ''
  try {
    if (enc.startsWith('plain:')) return Buffer.from(enc.slice(6), 'base64').toString('utf8')
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return ''
  }
}
