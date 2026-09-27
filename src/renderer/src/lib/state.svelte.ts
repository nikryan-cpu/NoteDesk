import type { DownloadInfo, OsPlatform, SettingsPatch, TabInfo, UpdateStatus } from '@shared/ipc'
import { resolveLocale, type Locale, type PublicSettings } from '@shared/settings'
import { isEffectivelyDark } from '@shared/themes'

export type OverlayKind = 'palette' | 'prompts' | 'settings' | 'downloads' | 'memory' | 'shortcuts' | 'onboarding'

export const nd = window.nd

export const ui = $state({
  ready: false,
  settings: null as unknown as PublicSettings,
  tabs: [] as TabInfo[],
  activeId: null as string | null,
  downloads: [] as DownloadInfo[],
  platform: 'win32' as OsPlatform,
  version: '',
  systemDark: false,
  update: { state: 'idle' } as UpdateStatus,
  focusMode: false,
  maximized: false,
  focused: true,
  e2e: false,
  materialSupported: false,
  overlay: null as OverlayKind | null,
  settingsSection: 'appearance',
  snapshot: null as string | null,
  findOpen: false,
  find: { matches: 0, active: 0 },
  online: navigator.onLine,
})

export function locale(): Locale {
  return resolveLocale(ui.settings?.locale ?? 'auto', navigator.language)
}

export function isDark(): boolean {
  const s = ui.settings
  if (!s) return ui.systemDark
  const dark = s.colorMode === 'dark' || (s.colorMode === 'system' && ui.systemDark)
  return isEffectivelyDark(s.theme, dark)
}

export function activeTab(): TabInfo | undefined {
  return ui.tabs.find((t) => t.id === ui.activeId)
}

export async function init(): Promise<void> {
  const s = await nd.invoke('app:init')
  ui.settings = s.settings
  ui.tabs = s.tabs.tabs
  ui.activeId = s.tabs.activeId
  ui.downloads = s.downloads
  ui.platform = s.platform
  ui.version = s.version
  ui.systemDark = s.systemDark
  ui.update = s.update
  ui.focusMode = s.focusMode
  ui.maximized = s.maximized
  ui.e2e = s.e2e
  ui.materialSupported = s.materialSupported

  nd.on('tabs', (snap) => {
    ui.tabs = snap.tabs
    ui.activeId = snap.activeId
  })
  nd.on('settings', (next) => (ui.settings = next))
  nd.on('downloads', (list) => (ui.downloads = list))
  nd.on('find', (f) => (ui.find = f))
  nd.on('update', (u) => (ui.update = u))
  nd.on('system-theme', ({ dark }) => (ui.systemDark = dark))
  nd.on('window', (w) => {
    ui.maximized = w.maximized
    ui.focused = w.focused
    ui.focusMode = w.focusMode
  })
  addEventListener('online', () => (ui.online = true))
  addEventListener('offline', () => (ui.online = false))
  ui.ready = true
}

let overlayBusy: Promise<unknown> = Promise.resolve()

export function openOverlay(kind: OverlayKind): void {
  if (ui.overlay === kind) return closeOverlay()
  const wasOpen = ui.overlay !== null
  ui.overlay = kind
  if (!wasOpen) {
    overlayBusy = overlayBusy.then(async () => {
      const shot = await nd.invoke('overlay:set', true)
      if (ui.overlay) ui.snapshot = shot
    })
  }
}

export function closeOverlay(): void {
  if (ui.overlay === null) return
  ui.overlay = null
  ui.snapshot = null
  overlayBusy = overlayBusy.then(() => nd.invoke('overlay:set', false))
}

export function openSettings(section = 'appearance'): void {
  ui.settingsSection = section
  if (ui.overlay !== 'settings') openOverlay('settings')
}

export function setSettings(patch: SettingsPatch): void {
  // Optimistic update so toggles feel instant; main returns the sanitized result.
  const { proxy, ...rest } = patch
  Object.assign(ui.settings, rest)
  if (proxy) {
    const { password: _pw, ...p } = proxy
    Object.assign(ui.settings.proxy, p)
  }
  void nd.invoke('settings:set', patch).then((s) => (ui.settings = s))
}
