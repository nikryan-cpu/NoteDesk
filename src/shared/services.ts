// Google services NoteDesk can host, and the rules deciding which URLs stay inside the app.
// Google moved Gemini Notebook twice in 2026 (notebooklm.google.com -> notebook.google.com ->
// notebook.google), so hosts are matched as a family instead of a single hard-coded origin.

export type ServiceId = 'notebook' | 'gemini'

export interface ServiceDef {
  id: ServiceId
  /** URL opened for a fresh tab. */
  home: string
  /** Hosts that belong to the service (current and legacy). */
  hosts: string[]
}

export const SERVICES: Record<ServiceId, ServiceDef> = {
  notebook: {
    id: 'notebook',
    home: 'https://notebook.google/',
    hosts: ['notebook.google', 'notebook.google.com', 'notebooklm.google.com', 'notebooklm.google'],
  },
  gemini: {
    id: 'gemini',
    home: 'https://gemini.google.com/app',
    hosts: ['gemini.google.com', 'gemini.google'],
  },
}

export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[]

export function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain)
}

/** google.com, google.ru, google.co.uk, google.com.br … (used by the sign-in cookie hops). */
const GOOGLE_CCTLD = /^(?:[a-z0-9-]+\.)*google\.(?:[a-z]{2,3}|com?\.[a-z]{2})$/

export function isGoogleHost(host: string): boolean {
  host = host.toLowerCase()
  return (
    GOOGLE_CCTLD.test(host) ||
    host.endsWith('.google') || // notebook.google, gemini.google (Google's own TLD)
    hostIs(host, 'gstatic.com') ||
    hostIs(host, 'googleusercontent.com') ||
    hostIs(host, 'googleapis.com') ||
    hostIs(host, 'googlevideo.com') ||
    hostIs(host, 'ggpht.com') ||
    host === 'accounts.youtube.com' // sign-in sets YouTube cookies on the way back
  )
}

export function serviceForUrl(raw: string): ServiceId | null {
  const url = parseUrl(raw)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  for (const id of SERVICE_IDS) {
    if (SERVICES[id].hosts.some((h) => host === h)) return id
  }
  return null
}

/** Pages that must open as a real popup window (sign-in, Drive/Photos pickers, OAuth consent). */
export function isAuthOrPickerUrl(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  const host = url.hostname.toLowerCase()
  if (host.startsWith('accounts.google.')) return true
  if (host === 'accounts.youtube.com') return true
  if (host === 'docs.google.com' && url.pathname.startsWith('/picker')) return true
  if (host === 'drive.google.com' && url.pathname.startsWith('/picker')) return true
  if (host === 'photos.google.com' && url.pathname.includes('picker')) return true
  if (url.pathname.startsWith('/o/oauth2')) return true
  return false
}

/** Top-level navigation inside a content tab is allowed only for Google hosts. */
export function isAllowedInApp(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  if (url.protocol === 'about:') return url.href === 'about:blank'
  if (url.protocol !== 'https:') return false
  return isGoogleHost(url.hostname)
}

/** Only http(s) and mailto links may be handed to the operating system. */
export function isSafeExternal(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:')
}

export type HistoryKind = 'notebook' | 'gemini-chat'

/** Recognises "things worth remembering" for the command palette's recent list. */
export function historyKindForUrl(raw: string): HistoryKind | null {
  const url = parseUrl(raw)
  if (!url) return null
  const service = serviceForUrl(raw)
  if (service === 'notebook' && /^\/notebook\/[\w-]{6,}/.test(url.pathname)) return 'notebook'
  if (service === 'gemini' && /^\/(?:u\/\d+\/)?(?:app|gem\/[\w-]+)\/[\w-]{6,}/.test(url.pathname)) return 'gemini-chat'
  return null
}

/** Canonical key for de-duplicating history entries (drops query/hash). */
export function historyKey(raw: string): string {
  const url = parseUrl(raw)
  if (!url) return raw
  return `${url.hostname}${url.pathname}`.replace(/\/+$/, '')
}
