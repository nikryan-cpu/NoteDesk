// One persistent Electron session (cookie jar) per NoteDesk profile = per Google account.
import { session, type Session } from 'electron'
import { join } from 'node:path'
import { isTrustedHost, parseUrl } from '@shared/services'
import { applyCompatToSession } from './compat'
import { attachDownloads } from './downloads'
import { applyProxy } from './proxy'
import { getSettings } from './settings'

const configured = new Map<string, Session>()

export function partitionFor(profileId: string): string {
  return `persist:profile-${profileId}`
}

const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'clipboard-sanitized-write',
  'clipboard-read',
  'fullscreen',
  'media',
  'storage-access',
  'top-level-storage-access',
  'speaker-selection',
])

function originIsTrusted(url: string | undefined): boolean {
  const host = url ? parseUrl(url)?.hostname : undefined
  return !!host && isTrustedHost(host)
}

export function contentPreloadPath(): string {
  return join(__dirname, '../preload/content.js')
}

export function sessionFor(profileId: string): Session {
  const existing = configured.get(profileId)
  if (existing) return existing
  const ses = session.fromPartition(partitionFor(profileId))
  configured.set(profileId, ses)

  applyCompatToSession(ses)
  ses.registerPreloadScript({ type: 'frame', id: 'notedesk-content', filePath: contentPreloadPath() })

  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (!originIsTrusted(details.requestingUrl)) return callback(false)
    if (permission === 'media') {
      // Microphone for voice input (Gemini, Claude, ChatGPT, ...); never the camera or screen.
      const types = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
      return callback(types.length > 0 && types.every((t) => t === 'audio'))
    }
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return originIsTrusted(requestingOrigin) && ALLOWED_PERMISSIONS.has(permission)
  })
  ses.setDevicePermissionHandler(() => false)
  ses.setDisplayMediaRequestHandler((_req, callback) => callback({}))

  const s = getSettings()
  if (process.platform !== 'darwin') ses.setSpellCheckerLanguages(filterSpellLanguages(ses, s.spellcheckLanguages))
  ses.setSpellCheckerEnabled(s.spellcheck)

  attachDownloads(ses)
  void applyProxy(ses)
  return ses
}

export function allSessions(): Session[] {
  return [...configured.values()]
}

export function forgetSession(profileId: string): void {
  configured.delete(profileId)
}

function filterSpellLanguages(ses: Session, wanted: string[]): string[] {
  const available = new Set(ses.availableSpellCheckerLanguages)
  const langs = wanted.filter((l) => available.has(l))
  return langs.length ? langs : available.has('en-US') ? ['en-US'] : []
}

export function applySpellcheck(): void {
  const s = getSettings()
  for (const ses of configured.values()) {
    ses.setSpellCheckerEnabled(s.spellcheck)
    if (process.platform !== 'darwin') ses.setSpellCheckerLanguages(filterSpellLanguages(ses, s.spellcheckLanguages))
  }
}
