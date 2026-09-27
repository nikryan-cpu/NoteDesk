// Typed IPC contract between the shell UI (renderer) and the main process.
import type {
  AskAnswerUpdate,
  AskConversation,
  AskConversationSummary,
  AskInit,
  AskSendRequest,
  AskSendResult,
  ModelOptions,
  ModelStatus,
} from './ask'
import type { Locale, Profile, PublicSettings, Settings } from './settings'
import type { HistoryKind, ModelId, ServiceId } from './services'

export type OsPlatform = 'win32' | 'darwin' | 'linux'

export interface TabInfo {
  id: string
  profileId: string
  service: ServiceId | null
  url: string
  title: string
  favicon: string | null
  sleeping: boolean
  loading: boolean
  audible: boolean
  muted: boolean
  crashed: boolean
  error: { code: number; description: string } | null
  zoom: number
  canGoBack: boolean
  canGoForward: boolean
}

export interface TabsSnapshot {
  tabs: TabInfo[]
  activeId: string | null
}

export interface DownloadInfo {
  id: string
  filename: string
  url: string
  savePath: string
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  paused: boolean
  received: number
  total: number
  startedAt: number
}

export interface HistoryEntry {
  key: string
  url: string
  title: string
  kind: HistoryKind
  profileId: string
  lastVisited: number
  visits: number
}

export interface PromptSnippet {
  id: string
  title: string
  text: string
}

export interface MemoryReport {
  totalMB: number
  shellMB: number
  browserMB: number
  gpuMB: number
  otherMB: number
  tabs: { id: string; mb: number | null }[]
  sleepingTabs: number
}

/** Space the shell reserves around the web content, in CSS px of the shell. */
export interface LayoutInsets {
  top: number
  left: number
  right: number
  bottom: number
  radius: number
  /** Height of the draggable title bar; sizes the native caption buttons. */
  titlebar?: number
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; canInstall: boolean; url: string }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'ready'; version: string }
  | { state: 'none' }
  | { state: 'error'; message: string }

export type ShellCommand =
  | 'palette'
  | 'prompts'
  | 'settings'
  | 'downloads'
  | 'memory'
  | 'find'
  | 'shortcuts'
  | 'focus-mode'
  | 'toggle-sidebar'
  | 'onboarding'

export interface InitState {
  settings: PublicSettings
  tabs: TabsSnapshot
  downloads: DownloadInfo[]
  platform: OsPlatform
  version: string
  locale: Locale
  systemDark: boolean
  update: UpdateStatus
  focusMode: boolean
  maximized: boolean
  e2e: boolean
  materialSupported: boolean
}

export interface MenuItemSpec {
  id?: string
  label?: string
  type?: 'normal' | 'separator' | 'checkbox' | 'radio'
  checked?: boolean
  enabled?: boolean
  sublabel?: string
}

export interface QuickState {
  pinned: boolean
  locale: Locale
  dark: boolean
  theme: string
  /** Custom accent colour from settings, or '' for the theme's own. */
  accent: string
}

export interface ProxyTestResult {
  ok: boolean
  status?: number
  ms?: number
  error?: string
}

export type SettingsPatch = Partial<Omit<Settings, 'proxy' | 'version'>> & {
  proxy?: Partial<Omit<Settings['proxy'], 'passwordEnc'>> & { password?: string }
}

export interface InvokeMap {
  'app:init': () => InitState
  'tabs:create': (opts: { service?: ServiceId; url?: string; profileId?: string; activate?: boolean }) => string
  'tabs:activate': (id: string) => void
  'tabs:close': (id: string) => void
  'tabs:reopen': () => void
  'tabs:sleep': (id: string) => void
  'tabs:sleepInactive': () => number
  'tabs:reload': (id: string) => void
  'tabs:navigate': (id: string, action: 'back' | 'forward' | 'home') => void
  'tabs:move': (id: string, toIndex: number) => void
  'tabs:menu': (id: string) => void
  'tabs:zoom': (id: string, dir: 1 | -1 | 0) => void
  'tabs:mute': (id: string) => void
  'tabs:copyLink': (id: string) => void
  'tabs:openInBrowser': (id: string) => void
  'find:start': (text: string, forward: boolean, findNext: boolean) => void
  'find:stop': () => void
  'settings:set': (patch: SettingsPatch) => PublicSettings
  'layout:set': (insets: LayoutInsets) => void
  'overlay:set': (open: boolean) => string | null
  'window:control': (action: 'minimize' | 'maximize' | 'close' | 'focusMode') => void
  'history:list': () => HistoryEntry[]
  'history:remove': (key: string) => void
  'history:clear': () => void
  'prompts:list': () => PromptSnippet[]
  'prompts:save': (p: PromptSnippet) => PromptSnippet[]
  'prompts:delete': (id: string) => PromptSnippet[]
  'prompts:insert': (text: string) => boolean
  'profiles:create': (name: string, color: string) => Profile
  'profiles:update': (p: Profile) => void
  'profiles:delete': (id: string) => void
  'profiles:clearData': (id: string) => void
  'downloads:action': (id: string, action: 'open' | 'show' | 'cancel' | 'pause' | 'resume' | 'remove') => void
  'downloads:clear': () => void
  'memory:get': () => MemoryReport
  'proxy:test': () => ProxyTestResult
  'hotkey:check': (accelerator: string) => boolean
  /** Suspends in-app and global shortcuts while the settings page records a new hotkey. */
  'hotkey:recording': (on: boolean) => void
  'app:openExternal': (url: string) => void
  'app:pickFolder': () => string | null
  'app:checkUpdates': () => void
  'app:installUpdate': () => void
  'app:relaunch': () => void
  'app:openDataDir': () => void
  'app:clearAllData': () => void
  'quick:action': (action: 'init' | 'close' | 'pin' | 'openInMain' | 'show') => QuickState
  'menu:popup': (items: MenuItemSpec[]) => string | null

  // Ask window (multi-model chat)
  'ask:init': () => AskInit
  'ask:list': () => AskConversationSummary[]
  'ask:get': (conversationId: string) => AskConversation | null
  'ask:send': (req: AskSendRequest) => AskSendResult
  'ask:stop': (conversationId: string) => void
  'ask:retry': (conversationId: string, turnId: string, model: ModelId) => void
  'ask:setModels': (conversationId: string, models: ModelId[]) => void
  'ask:rename': (conversationId: string, title: string) => void
  'ask:pin': (conversationId: string, pinned: boolean) => void
  'ask:delete': (conversationId: string) => void
  /** Opens this conversation's chat on the service in a main-window tab. */
  'ask:openThread': (conversationId: string, model: ModelId) => void
  'ask:models': () => ModelStatus[]
  /** Loads the given (default: all enabled) services in the background and checks sign-in. */
  'ask:checkModels': (models?: ModelId[]) => ModelStatus[]
  /** Opens a visible window with the service's sign-in page. */
  'ask:login': (model: ModelId) => void
  /** Opens a visible window with the page the engine is on (to pass a captcha etc.). */
  'ask:showPage': (model: ModelId) => void
  /** Options for one model in a conversation (null: the defaults for new conversations). */
  'ask:setOptions': (conversationId: string | null, model: ModelId, options: ModelOptions) => void
  /** Saves an outline of the service's page (no chat text) to Downloads; returns the file path. */
  'ask:diagnose': (model: ModelId) => string | null
}

export interface EventMap {
  tabs: TabsSnapshot
  settings: PublicSettings
  downloads: DownloadInfo[]
  find: { matches: number; active: number }
  command: ShellCommand
  window: { maximized: boolean; focused: boolean; focusMode: boolean }
  update: UpdateStatus
  'system-theme': { dark: boolean }
  'quick-theme': QuickState
  'ask-answer': AskAnswerUpdate
  'ask-conversations': AskConversationSummary[]
  'ask-models': ModelStatus[]
}

export type InvokeChannel = keyof InvokeMap
export type EventChannel = keyof EventMap

export const INVOKE_CHANNELS: readonly InvokeChannel[] = [
  'app:init',
  'tabs:create',
  'tabs:activate',
  'tabs:close',
  'tabs:reopen',
  'tabs:sleep',
  'tabs:sleepInactive',
  'tabs:reload',
  'tabs:navigate',
  'tabs:move',
  'tabs:menu',
  'tabs:zoom',
  'tabs:mute',
  'tabs:copyLink',
  'tabs:openInBrowser',
  'find:start',
  'find:stop',
  'settings:set',
  'layout:set',
  'overlay:set',
  'window:control',
  'history:list',
  'history:remove',
  'history:clear',
  'prompts:list',
  'prompts:save',
  'prompts:delete',
  'prompts:insert',
  'profiles:create',
  'profiles:update',
  'profiles:delete',
  'profiles:clearData',
  'downloads:action',
  'downloads:clear',
  'memory:get',
  'proxy:test',
  'hotkey:check',
  'hotkey:recording',
  'app:openExternal',
  'app:pickFolder',
  'app:checkUpdates',
  'app:installUpdate',
  'app:relaunch',
  'app:openDataDir',
  'app:clearAllData',
  'quick:action',
  'menu:popup',
  'ask:init',
  'ask:list',
  'ask:get',
  'ask:send',
  'ask:stop',
  'ask:retry',
  'ask:setModels',
  'ask:rename',
  'ask:pin',
  'ask:delete',
  'ask:openThread',
  'ask:models',
  'ask:checkModels',
  'ask:login',
  'ask:showPage',
  'ask:setOptions',
  'ask:diagnose',
]

export const EVENT_CHANNELS: readonly EventChannel[] = [
  'tabs',
  'settings',
  'downloads',
  'find',
  'command',
  'window',
  'update',
  'system-theme',
  'quick-theme',
  'ask-answer',
  'ask-conversations',
  'ask-models',
]

/** API exposed on `window.nd` by the shell preload. */
export interface ShellApi {
  platform: OsPlatform
  invoke<K extends InvokeChannel>(channel: K, ...args: Parameters<InvokeMap[K]>): Promise<ReturnType<InvokeMap[K]>>
  on<K extends EventChannel>(channel: K, cb: (payload: EventMap[K]) => void): () => void
}
