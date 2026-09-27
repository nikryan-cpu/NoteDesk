// IPC handlers for the shell UI. Only NoteDesk's own pages (shell + Quick Ask header) may call
// them; Google pages never get the shell preload, and senders are checked anyway.
import { app, dialog, ipcMain, Menu, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { InitState, InvokeChannel, InvokeMap } from '@shared/ipc'
import { PROFILE_COLORS, type Profile } from '@shared/settings'
import { isSafeExternal } from '@shared/services'
import { clearFinishedDownloads, downloadAction, listDownloads } from './downloads'
import { clearHistory, clearHistoryForProfile, listHistory, removeHistory } from './history'
import { currentLocale, t } from './i18n'
import { memoryReport } from './memory'
import { testProxy } from './proxy'
import { deletePrompt, listPrompts, savePrompt } from './prompts'
import type { QuickWindow } from './quick'
import { forgetSession, sessionFor } from './sessions'
import { getSettings, publicSettings, updateSettings } from './settings'
import { isHotkeyAvailable } from './shortcuts'
import { checkForUpdates, downloadOrInstall, updateStatus } from './updater'
import { systemSupportsMaterial, type MainWindow } from './window'

type Handler<K extends InvokeChannel> = (...args: Parameters<InvokeMap[K]>) => ReturnType<InvokeMap[K]> | Promise<ReturnType<InvokeMap[K]>>

export function registerIpc(mw: MainWindow, quick: QuickWindow): void {
  const trusted = (e: IpcMainInvokeEvent) => e.sender === mw.shell.webContents || e.sender === quick.headerWebContents()

  function handle<K extends InvokeChannel>(channel: K, fn: Handler<K>): void {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trusted(event)) throw new Error(`untrusted sender for ${channel}`)
      return fn(...(args as Parameters<InvokeMap[K]>))
    })
  }

  const tabs = mw.tabs
  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

  handle('app:init', (): InitState => ({
    settings: publicSettings(),
    tabs: tabs.snapshot(),
    downloads: listDownloads(),
    platform: process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux',
    version: app.getVersion(),
    locale: currentLocale(),
    systemDark: nativeTheme.shouldUseDarkColors,
    update: updateStatus(),
    focusMode: mw.focusMode,
    maximized: mw.win.isMaximized(),
    e2e: Boolean(process.env['NOTEDESK_E2E']),
    materialSupported: systemSupportsMaterial(),
  }))

  // ------------------------------------------------------------ tabs
  handle('tabs:create', (opts) => tabs.create({ ...opts, url: opts?.url ? str(opts.url) : undefined }).id)
  handle('tabs:activate', (id) => tabs.activate(str(id)))
  handle('tabs:close', (id) => tabs.close(str(id)))
  handle('tabs:reopen', () => tabs.reopenClosed())
  handle('tabs:sleep', (id) => void tabs.sleep(str(id)))
  handle('tabs:sleepInactive', () => tabs.sleepInactive())
  handle('tabs:reload', (id) => tabs.reload(str(id)))
  handle('tabs:navigate', (id, action) => tabs.navigate(str(id), action))
  handle('tabs:move', (id, toIndex) => tabs.move(str(id), Number(toIndex) || 0))
  handle('tabs:zoom', (id, dir) => tabs.zoom(str(id), dir === 1 || dir === -1 ? dir : 0))
  handle('tabs:mute', (id) => tabs.toggleMute(str(id)))
  handle('tabs:menu', (id) => {
    const tab = tabs.get(str(id))
    if (!tab) return
    const snapshot = tabs.snapshot()
    const index = snapshot.tabs.findIndex((x) => x.id === tab.id)
    const info = snapshot.tabs[index]!
    const isActive = snapshot.activeId === tab.id
    Menu.buildFromTemplate([
      { label: t('tabs.reload'), click: () => tabs.reload(tab.id) },
      { label: t('tabs.duplicate'), click: () => tabs.duplicate(tab.id) },
      ...(info.audible || info.muted ? [{ label: info.muted ? t('tabs.unmute') : t('tabs.mute'), click: () => tabs.toggleMute(tab.id) }] : []),
      { label: t('tabs.sleep'), enabled: !info.sleeping && !isActive, click: () => void tabs.sleep(tab.id) },
      { type: 'separator' },
      { label: t('tabs.copyLink'), click: () => tabs.copyLink(tab.id) },
      { label: t('tabs.openInBrowser'), click: () => tabs.openInBrowser(tab.id) },
      { type: 'separator' },
      { label: t('tabs.close'), click: () => tabs.close(tab.id) },
      {
        label: t('tabs.closeOthers'),
        enabled: snapshot.tabs.length > 1,
        click: () => tabs.closeMany(snapshot.tabs.filter((x) => x.id !== tab.id).map((x) => x.id)),
      },
      {
        label: t('tabs.closeRight'),
        enabled: index < snapshot.tabs.length - 1,
        click: () => tabs.closeMany(snapshot.tabs.slice(index + 1).map((x) => x.id)),
      },
    ]).popup()
  })

  // ------------------------------------------------------------ find
  handle('find:start', (text, forward, findNext) => {
    const wc = tabs.activeWebContents()
    const q = str(text, 500)
    if (!wc) return
    if (!q) wc.stopFindInPage('clearSelection')
    else wc.findInPage(q, { forward: forward !== false, findNext: Boolean(findNext) })
  })
  handle('find:stop', () => tabs.activeWebContents()?.stopFindInPage('clearSelection'))

  // ------------------------------------------------------------ settings & layout
  handle('settings:set', (patch) => {
    updateSettings(patch ?? {})
    return publicSettings()
  })
  handle('layout:set', (insets) => {
    const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0))
    const i = insets
    mw.setInsets({
      top: n(i.top, 400),
      left: n(i.left, 800),
      right: n(i.right, 400),
      bottom: n(i.bottom, 400),
      radius: n(i.radius, 40),
      titlebar: n(i.titlebar, 120) || undefined,
    })
  })
  handle('overlay:set', (open) => mw.setOverlay(Boolean(open)))
  handle('window:control', (action) => {
    if (action === 'minimize') mw.win.minimize()
    else if (action === 'maximize') {
      if (mw.win.isMaximized()) mw.win.unmaximize()
      else mw.win.maximize()
    } else if (action === 'close') mw.win.close()
    else if (action === 'focusMode') mw.toggleFocusMode()
  })

  // ------------------------------------------------------------ history & prompts
  handle('history:list', () => listHistory())
  handle('history:remove', (key) => removeHistory(str(key)))
  handle('history:clear', () => clearHistory())
  handle('prompts:list', () => listPrompts())
  handle('prompts:save', (p) => savePrompt(p))
  handle('prompts:delete', (id) => deletePrompt(str(id)))
  handle('prompts:insert', async (text) => {
    await mw.setOverlay(false)
    const wc = tabs.activeWebContents()
    if (!wc) return false
    wc.focus()
    await new Promise((r) => setTimeout(r, 60))
    await wc.insertText(str(text, 20000))
    return true
  })

  // ------------------------------------------------------------ profiles
  handle('profiles:create', (name, color) => {
    const s = getSettings()
    const profile: Profile = {
      id: `p${Date.now().toString(36)}`,
      name: str(name, 40).trim() || t('profiles.newName'),
      color: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color) : PROFILE_COLORS[s.profiles.length % PROFILE_COLORS.length]!,
    }
    updateSettings({ profiles: [...s.profiles, profile] })
    return profile
  })
  handle('profiles:update', (p) => {
    const s = getSettings()
    updateSettings({ profiles: s.profiles.map((x) => (x.id === p.id ? { ...x, name: str(p.name, 40).trim() || x.name, color: p.color } : x)) })
  })
  handle('profiles:delete', async (id) => {
    const s = getSettings()
    if (s.profiles.length <= 1 || !s.profiles.some((p) => p.id === id)) return
    tabs.closeProfileTabs(id)
    await clearProfileData(id)
    forgetSession(id)
    clearHistoryForProfile(id)
    const profiles = s.profiles.filter((p) => p.id !== id)
    updateSettings({ profiles, defaultProfileId: s.defaultProfileId === id ? profiles[0]!.id : s.defaultProfileId })
  })
  handle('profiles:clearData', async (id) => {
    await clearProfileData(str(id))
    for (const tab of tabs.all()) if (tab.profileId === id && tab.view) tabs.reload(tab.id)
  })

  // ------------------------------------------------------------ downloads, memory, network
  handle('downloads:action', (id, action) => downloadAction(str(id), action))
  handle('downloads:clear', () => clearFinishedDownloads())
  handle('memory:get', () => memoryReport(tabs, mw.shell.webContents.getOSProcessId()))
  handle('proxy:test', () => testProxy(sessionFor(getSettings().defaultProfileId)))
  handle('hotkey:check', (accel) => isHotkeyAvailable(str(accel, 60)))

  // ------------------------------------------------------------ app
  handle('app:openExternal', (url) => {
    if (isSafeExternal(str(url))) void shell.openExternal(str(url))
  })
  handle('app:pickFolder', async () => {
    const res = await dialog.showOpenDialog(mw.win, { properties: ['openDirectory', 'createDirectory'] })
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
  handle('app:checkUpdates', () => void checkForUpdates())
  handle('app:installUpdate', () => {
    mw.quitting = true
    downloadOrInstall()
  })
  handle('app:relaunch', () => {
    app.relaunch()
    mw.quitting = true
    app.quit()
  })
  handle('app:openDataDir', () => void shell.openPath(app.getPath('userData')))
  handle('app:clearAllData', async () => {
    for (const p of getSettings().profiles) await clearProfileData(p.id)
    for (const f of ['settings', 'session', 'history', 'prompts', 'window-state']) {
      rmSync(join(app.getPath('userData'), `${f}.json`), { force: true })
    }
    app.relaunch()
    mw.quitting = true
    app.exit(0)
  })

  handle('quick:action', (action) => quick.action(action))

  handle('menu:popup', (items) =>
    new Promise<string | null>((resolve) => {
      let picked: string | null = null
      const menu = Menu.buildFromTemplate(
        (Array.isArray(items) ? items : []).slice(0, 60).map((it) =>
          it.type === 'separator'
            ? { type: 'separator' as const }
            : {
                label: str(it.label, 200),
                sublabel: it.sublabel ? str(it.sublabel, 200) : undefined,
                type: it.type === 'checkbox' || it.type === 'radio' ? it.type : ('normal' as const),
                checked: Boolean(it.checked),
                enabled: it.enabled !== false,
                click: () => {
                  picked = str(it.id, 200)
                },
              },
        ),
      )
      menu.popup({ callback: () => setImmediate(() => resolve(picked)) })
    }),
  )

}

async function clearProfileData(profileId: string): Promise<void> {
  const ses = sessionFor(profileId)
  await ses.clearStorageData()
  await ses.clearCache()
  await ses.clearAuthCache()
}
