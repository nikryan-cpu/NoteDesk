// Services NoteDesk can host, and the rules deciding which URLs stay inside the app.
// Google moved Gemini Notebook twice in 2026 (notebooklm.google.com -> notebook.google.com ->
// notebook.google), so hosts are matched as a family instead of a single hard-coded origin.
// Besides Google's own apps, a few other chat services can be opened in tabs and in the Ask
// window; each one is signed into once, inside the same profile.

export type ServiceId = 'notebook' | 'gemini' | 'claude' | 'chatgpt' | 'deepseek' | 'qwen'

/** Services that answer prompts in the Ask window. */
export type ModelId = Exclude<ServiceId, 'notebook'>

export interface ServiceDef {
  id: ServiceId
  /** Product name as shown in the UI (not translated). */
  name: string
  /** Company that owns the trademark, for the disclaimer. */
  vendor: string
  /** URL opened for a fresh tab (for chat services: a new chat). */
  home: string
  /** Page to open when the service asks the user to sign in. */
  loginUrl: string
  /** Hosts that belong to the service (current and legacy). */
  hosts: string[]
  /** Extra hosts a top-level page may visit while signing in (Google's are always allowed). */
  authHosts: string[]
  /** Part of Google (signed in through the Google account itself). */
  google: boolean
}

export const SERVICES: Record<ServiceId, ServiceDef> = {
  notebook: {
    id: 'notebook',
    name: 'Gemini Notebook',
    vendor: 'Google LLC',
    home: 'https://notebook.google/',
    loginUrl: 'https://notebook.google/',
    hosts: ['notebook.google', 'notebook.google.com', 'notebooklm.google.com', 'notebooklm.google'],
    authHosts: [],
    google: true,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    vendor: 'Google LLC',
    home: 'https://gemini.google.com/app',
    loginUrl: 'https://gemini.google.com/app',
    hosts: ['gemini.google.com', 'gemini.google'],
    authHosts: [],
    google: true,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    vendor: 'Anthropic PBC',
    home: 'https://claude.ai/new',
    loginUrl: 'https://claude.ai/login',
    hosts: ['claude.ai'],
    authHosts: [],
    google: false,
  },
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    home: 'https://chatgpt.com/',
    loginUrl: 'https://chatgpt.com/auth/login',
    hosts: ['chatgpt.com'],
    authHosts: ['auth.openai.com', 'auth0.openai.com', 'login.microsoftonline.com', 'login.live.com', 'appleid.apple.com'],
    google: false,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    vendor: 'DeepSeek',
    home: 'https://chat.deepseek.com/',
    loginUrl: 'https://chat.deepseek.com/sign_in',
    hosts: ['chat.deepseek.com'],
    authHosts: [],
    google: false,
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen',
    vendor: 'Alibaba Cloud',
    home: 'https://chat.qwen.ai/',
    loginUrl: 'https://chat.qwen.ai/auth',
    hosts: ['chat.qwen.ai'],
    authHosts: [],
    google: false,
  },
}

export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[]

/** Order of models in pickers. */
export const MODEL_IDS: readonly ModelId[] = ['gemini', 'claude', 'chatgpt', 'deepseek', 'qwen']

/** Chat services other than Google's, which can be switched on and off in settings. */
export const EXTRA_MODEL_IDS: readonly ModelId[] = ['claude', 'chatgpt', 'deepseek', 'qwen']

export function isModelId(v: unknown): v is ModelId {
  return typeof v === 'string' && (MODEL_IDS as readonly string[]).includes(v)
}

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

/** Hosts of the non-Google chat services, including the pages they use for signing in. */
export function isServiceHost(host: string): boolean {
  host = host.toLowerCase()
  for (const id of SERVICE_IDS) {
    const def = SERVICES[id]
    if (def.google) continue
    if (def.hosts.some((h) => hostIs(host, h)) || def.authHosts.some((h) => hostIs(host, h))) return true
  }
  return false
}

/** Hosts NoteDesk treats as its own: Google and the chat services it hosts. */
export function isTrustedHost(host: string): boolean {
  return isGoogleHost(host) || isServiceHost(host)
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

/** Top-level navigation inside a content tab is allowed only for Google and the hosted services. */
export function isAllowedInApp(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  if (url.protocol === 'about:') return url.href === 'about:blank'
  if (url.protocol !== 'https:') return false
  return isTrustedHost(url.hostname)
}

/** Only http(s) and mailto links may be handed to the operating system. */
export function isSafeExternal(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:')
}

export type HistoryKind = 'notebook' | 'gemini-chat' | 'model-chat'

/** Path of one conversation on each chat service (used for history and for continuing chats). */
const CHAT_PATHS: Partial<Record<ServiceId, RegExp>> = {
  gemini: /^\/(?:u\/\d+\/)?(?:app|gem\/[\w-]+)\/[\w-]{6,}/,
  claude: /^\/chat\/[\w-]{8,}/,
  chatgpt: /^\/(?:g\/[\w-]+\/)?c\/[\w-]{8,}/,
  deepseek: /^\/a\/chat\/s\/[\w-]{6,}/,
  qwen: /^\/c\/[\w-]{6,}/,
}

/** True when the URL points at one specific conversation of a chat service. */
export function isChatUrl(raw: string, service?: ServiceId): boolean {
  const url = parseUrl(raw)
  const id = serviceForUrl(raw)
  if (!url || !id || (service && service !== id)) return false
  return CHAT_PATHS[id]?.test(url.pathname) ?? false
}

/** Recognises "things worth remembering" for the command palette's recent list. */
export function historyKindForUrl(raw: string): HistoryKind | null {
  const url = parseUrl(raw)
  if (!url) return null
  const service = serviceForUrl(raw)
  if (service === 'notebook' && /^\/notebook\/[\w-]{6,}/.test(url.pathname)) return 'notebook'
  if (!service || !isChatUrl(raw, service)) return null
  return service === 'gemini' ? 'gemini-chat' : 'model-chat'
}

/** Canonical key for de-duplicating history entries (drops query/hash). */
export function historyKey(raw: string): string {
  const url = parseUrl(raw)
  if (!url) return raw
  return `${url.hostname}${url.pathname}`.replace(/\/+$/, '')
}
