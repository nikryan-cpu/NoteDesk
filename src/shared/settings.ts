import type { CompatPreset } from './compat'
import { EXTRA_MODEL_IDS, isModelId, type ModelId, type ServiceId } from './services'
import { THEME_IDS, type ThemeId } from './themes'

export type Locale = 'en' | 'ru'
export type LocalePref = 'auto' | Locale
export type ColorMode = 'system' | 'light' | 'dark'
export type TabLayout = 'top' | 'vertical'
export type Density = 'compact' | 'comfortable'
export type ProxyMode = 'system' | 'direct' | 'custom'
export type ProxyScheme = 'http' | 'socks5'

export interface Profile {
  id: string
  name: string
  color: string
}

export interface ProxySettings {
  mode: ProxyMode
  scheme: ProxyScheme
  host: string
  port: number
  username: string
  /** Encrypted with Electron safeStorage (base64); never sent to the renderer. */
  passwordEnc: string
  /** Route only Google domains through the proxy (PAC), everything else direct. */
  googleOnly: boolean
}

export interface Settings {
  version: number
  locale: LocalePref
  theme: ThemeId
  colorMode: ColorMode
  /** Hex colour, or '' to use the theme's accent. */
  accent: string
  density: Density
  tabLayout: TabLayout
  sidebarCollapsed: boolean
  /** Floating content card with a gap and rounded corners (Arc-style) vs flush edges. */
  floatingContent: boolean
  reduceMotion: boolean

  defaultService: ServiceId
  restoreSession: boolean
  closeToTray: boolean
  launchAtLogin: boolean
  startMinimized: boolean

  /** Minutes before an inactive tab is put to sleep; 0 disables. */
  sleepAfterMinutes: number
  /** Minutes hidden in the tray before every tab sleeps; 0 disables. */
  deepSleepMinutes: number
  hardwareAcceleration: boolean

  hotkeys: { toggleWindow: string; quickAsk: string }
  /** Chat services besides Google's that show up in menus and the Ask window. */
  enabledModels: ModelId[]
  /** Models preselected for a new conversation in the Ask window. */
  askModels: ModelId[]

  spellcheck: boolean
  spellcheckLanguages: string[]

  downloadsDir: string
  askWhereToSave: boolean

  notifyGenerationDone: boolean
  proxy: ProxySettings
  compatPreset: CompatPreset
  autoUpdate: boolean

  profiles: Profile[]
  defaultProfileId: string

  onboarded: boolean
  lastSeenVersion: string
}

export const PROFILE_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6', '#84cc16']

export const SETTINGS_VERSION = 2

/** Hotkey defaults before 1.2 (Ctrl+Alt+Space clashes with other desktop chat apps). */
const LEGACY_HOTKEYS = { toggleWindow: 'CommandOrControl+Shift+Space', quickAsk: 'CommandOrControl+Alt+Space' }

export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    locale: 'auto',
    theme: 'minimal',
    colorMode: 'system',
    accent: '',
    density: 'comfortable',
    tabLayout: 'top',
    sidebarCollapsed: false,
    floatingContent: true,
    reduceMotion: false,

    defaultService: 'notebook',
    restoreSession: true,
    closeToTray: true,
    launchAtLogin: false,
    startMinimized: false,

    sleepAfterMinutes: 10,
    deepSleepMinutes: 30,
    hardwareAcceleration: true,

    hotkeys: { toggleWindow: 'CommandOrControl+Shift+Alt+Space', quickAsk: 'CommandOrControl+Shift+Space' },
    enabledModels: [...EXTRA_MODEL_IDS],
    askModels: ['gemini'],

    spellcheck: true,
    spellcheckLanguages: ['ru', 'en-US'],

    downloadsDir: '',
    askWhereToSave: false,

    notifyGenerationDone: true,
    proxy: { mode: 'system', scheme: 'socks5', host: '127.0.0.1', port: 1080, username: '', passwordEnc: '', googleOnly: true },
    compatPreset: 'chrome',
    autoUpdate: true,

    profiles: [{ id: 'default', name: 'Personal', color: PROFILE_COLORS[0]! }],
    defaultProfileId: 'default',

    onboarded: false,
    lastSeenVersion: '',
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

const str = (v: unknown, fallback: string, max = 500): string => (typeof v === 'string' ? v.slice(0, max) : fallback)
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

const HEX = /^#[0-9a-f]{6}$/i

const unique = <T>(list: T[]): T[] => [...new Set(list)]

/** Settings saved before version 2 with untouched hotkeys move to the new defaults. */
function migrateHotkeys(version: unknown, hotkeys: Settings['hotkeys']): Settings['hotkeys'] {
  const legacy = typeof version !== 'number' || version < 2
  if (legacy && hotkeys.toggleWindow === LEGACY_HOTKEYS.toggleWindow && hotkeys.quickAsk === LEGACY_HOTKEYS.quickAsk) {
    return defaultSettings().hotkeys
  }
  return hotkeys
}

function sanitizeAskModels(input: unknown[], fallback: ModelId[]): ModelId[] {
  const list = unique(input.filter(isModelId)).slice(0, 4)
  return list.length ? list : fallback
}

/**
 * Merges untrusted/partial input (a settings file from an older version, or a renderer patch)
 * onto defaults, validating every field. Unknown keys are dropped.
 */
export function sanitizeSettings(input: unknown, base: Settings = defaultSettings()): Settings {
  const d = base
  if (!isObj(input)) return structuredClone(d)
  const i = input
  const proxyIn = isObj(i.proxy) ? i.proxy : {}
  const hk = isObj(i.hotkeys) ? i.hotkeys : {}

  let profiles = d.profiles
  if (Array.isArray(i.profiles)) {
    const seen = new Set<string>()
    profiles = i.profiles
      .filter(isObj)
      .map((p) => ({
        id: str(p.id, '', 40).replace(/[^\w-]/g, ''),
        name: str(p.name, 'Profile', 40).trim() || 'Profile',
        color: HEX.test(String(p.color)) ? String(p.color) : PROFILE_COLORS[0]!,
      }))
      .filter((p) => p.id && !seen.has(p.id) && seen.add(p.id))
      .slice(0, 12)
    if (profiles.length === 0) profiles = defaultSettings().profiles
  }
  const defaultProfileId = profiles.some((p) => p.id === i.defaultProfileId)
    ? String(i.defaultProfileId)
    : profiles[0]!.id

  return {
    version: SETTINGS_VERSION,
    locale: oneOf(i.locale, ['auto', 'en', 'ru'] as const, d.locale),
    theme: oneOf(i.theme, THEME_IDS, d.theme),
    colorMode: oneOf(i.colorMode, ['system', 'light', 'dark'] as const, d.colorMode),
    accent: i.accent === '' ? '' : HEX.test(String(i.accent)) ? String(i.accent) : d.accent,
    density: oneOf(i.density, ['compact', 'comfortable'] as const, d.density),
    tabLayout: oneOf(i.tabLayout, ['top', 'vertical'] as const, d.tabLayout),
    sidebarCollapsed: bool(i.sidebarCollapsed, d.sidebarCollapsed),
    floatingContent: bool(i.floatingContent, d.floatingContent),
    reduceMotion: bool(i.reduceMotion, d.reduceMotion),

    defaultService: oneOf(i.defaultService, ['notebook', 'gemini', 'claude', 'chatgpt', 'deepseek', 'qwen'] as const, d.defaultService),
    restoreSession: bool(i.restoreSession, d.restoreSession),
    closeToTray: bool(i.closeToTray, d.closeToTray),
    launchAtLogin: bool(i.launchAtLogin, d.launchAtLogin),
    startMinimized: bool(i.startMinimized, d.startMinimized),

    sleepAfterMinutes: clampInt(i.sleepAfterMinutes, 0, 240, d.sleepAfterMinutes),
    deepSleepMinutes: clampInt(i.deepSleepMinutes, 0, 480, d.deepSleepMinutes),
    hardwareAcceleration: bool(i.hardwareAcceleration, d.hardwareAcceleration),

    hotkeys: migrateHotkeys(i.version, {
      toggleWindow: str(hk.toggleWindow, d.hotkeys.toggleWindow, 60),
      quickAsk: str(hk.quickAsk, d.hotkeys.quickAsk, 60),
    }),
    enabledModels: Array.isArray(i.enabledModels)
      ? unique(i.enabledModels.filter((m): m is ModelId => isModelId(m) && m !== 'gemini'))
      : d.enabledModels,
    askModels: Array.isArray(i.askModels) ? sanitizeAskModels(i.askModels, d.askModels) : d.askModels,

    spellcheck: bool(i.spellcheck, d.spellcheck),
    spellcheckLanguages: Array.isArray(i.spellcheckLanguages)
      ? i.spellcheckLanguages.filter((l): l is string => typeof l === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(l)).slice(0, 6)
      : d.spellcheckLanguages,

    downloadsDir: str(i.downloadsDir, d.downloadsDir, 1000),
    askWhereToSave: bool(i.askWhereToSave, d.askWhereToSave),

    notifyGenerationDone: bool(i.notifyGenerationDone, d.notifyGenerationDone),
    proxy: {
      mode: oneOf(proxyIn.mode, ['system', 'direct', 'custom'] as const, d.proxy.mode),
      scheme: oneOf(proxyIn.scheme, ['http', 'socks5'] as const, d.proxy.scheme),
      host: str(proxyIn.host, d.proxy.host, 255).trim(),
      port: clampInt(proxyIn.port, 1, 65535, d.proxy.port),
      username: str(proxyIn.username, d.proxy.username, 255),
      passwordEnc: str(proxyIn.passwordEnc, d.proxy.passwordEnc, 4000),
      googleOnly: bool(proxyIn.googleOnly, d.proxy.googleOnly),
    },
    compatPreset: oneOf(i.compatPreset, ['chrome', 'firefox', 'electron'] as const, d.compatPreset),
    autoUpdate: bool(i.autoUpdate, d.autoUpdate),

    profiles,
    defaultProfileId,

    onboarded: bool(i.onboarded, d.onboarded),
    lastSeenVersion: str(i.lastSeenVersion, d.lastSeenVersion, 40),
  }
}

/** Settings as the renderer sees them: secrets replaced by a flag. */
export type PublicSettings = Omit<Settings, 'proxy'> & {
  proxy: Omit<ProxySettings, 'passwordEnc'> & { hasPassword: boolean }
}

export function toPublic(s: Settings): PublicSettings {
  const { passwordEnc, ...proxy } = s.proxy
  return { ...s, proxy: { ...proxy, hasPassword: passwordEnc.length > 0 } }
}

export function resolveLocale(pref: LocalePref, systemLocale: string): Locale {
  if (pref !== 'auto') return pref
  return /^(ru|be|uk|kk)\b/i.test(systemLocale) ? 'ru' : 'en'
}
