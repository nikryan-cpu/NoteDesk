// Tab manager: each tab is a WebContentsView hosting a Google web app. Background tabs are put
// to sleep (their renderer is destroyed) to keep memory low and are recreated on demand.
import { BrowserWindow, WebContentsView, clipboard, shell, type Rectangle, type WebContents } from 'electron'
import type { TabInfo, TabsSnapshot } from '@shared/ipc'
import {
  SERVICES,
  isAllowedInApp,
  isAuthOrPickerUrl,
  isSafeExternal,
  isTrustedHost,
  parseUrl,
  serviceForUrl,
  type ServiceId,
} from '@shared/services'
import { nextZoom, pickTabsToSleep } from '@shared/sleep'
import { cleanTitle } from '@shared/text'
import { emit } from './bus'
import { attachContentContextMenu } from './contextmenu'
import { recordVisit, updateTitle } from './history'
import { sessionFor } from './sessions'
import { getSettings } from './settings'
import { handleShortcut } from './shortcuts'
import { readJson, writeJson } from './store'

interface Tab {
  id: string
  profileId: string
  url: string
  title: string
  favicon: string | null
  view: WebContentsView | null
  lastActive: number
  loading: boolean
  audible: boolean
  muted: boolean
  crashed: boolean
  error: { code: number; description: string } | null
  zoom: number
}

export interface TabHost {
  attach(view: WebContentsView): void
  detach(view: WebContentsView): void
  contentBounds(): Rectangle
  contentRadius(): number
  contentBackground(): string
  parentWindow(): Electron.BaseWindow | null
  isShown(): boolean
}

interface SavedTab {
  url: string
  title: string
  profileId: string
  favicon: string | null
}

let seq = 0
const newId = () => `t${Date.now().toString(36)}${(++seq).toString(36)}`

/** True for a chat service's sign-in host (e.g. auth.openai.com), so its popups stay in-app. */
function isServiceAuthHost(raw: string): boolean {
  const host = parseUrl(raw)?.hostname.toLowerCase()
  if (!host) return false
  return Object.values(SERVICES).some((def) => !def.google && def.authHosts.some((h) => host === h || host.endsWith(`.${h}`)))
}

export class TabManager {
  private tabs: Tab[] = []
  private activeId: string | null = null
  private closed: SavedTab[] = []
  private emitScheduled = false
  private attached: WebContentsView | null = null
  private sleepTimer: NodeJS.Timeout
  private hiddenSince: number | null = null

  constructor(private host: TabHost) {
    this.sleepTimer = setInterval(() => this.sleepSweep(), 30_000)
  }

  // ---------------------------------------------------------------- queries

  snapshot(): TabsSnapshot {
    return { tabs: this.tabs.map((t) => this.info(t)), activeId: this.activeId }
  }

  private info(t: Tab): TabInfo {
    const wc = t.view?.webContents
    const alive = wc && !wc.isDestroyed()
    return {
      id: t.id,
      profileId: t.profileId,
      service: serviceForUrl(t.url),
      url: t.url,
      title: t.title,
      favicon: t.favicon,
      sleeping: !t.view,
      loading: t.loading,
      audible: t.audible,
      muted: t.muted,
      crashed: t.crashed,
      zoom: t.zoom,
      canGoBack: alive ? wc.navigationHistory.canGoBack() : false,
      canGoForward: alive ? wc.navigationHistory.canGoForward() : false,
      error: t.error,
    }
  }

  get(id: string | null | undefined): Tab | undefined {
    return id ? this.tabs.find((t) => t.id === id) : undefined
  }

  active(): Tab | undefined {
    return this.get(this.activeId)
  }

  activeWebContents(): WebContents | null {
    const wc = this.active()?.view?.webContents
    return wc && !wc.isDestroyed() ? wc : null
  }

  byWebContents(wc: WebContents): Tab | undefined {
    return this.tabs.find((t) => t.view?.webContents === wc)
  }

  count(): number {
    return this.tabs.length
  }

  all(): readonly Tab[] {
    return this.tabs
  }

  // ---------------------------------------------------------------- lifecycle

  create(opts: { service?: ServiceId; url?: string; profileId?: string; activate?: boolean; index?: number; sleeping?: boolean; title?: string; favicon?: string | null }): Tab {
    const s = getSettings()
    const profileId = s.profiles.some((p) => p.id === opts.profileId) ? opts.profileId! : s.defaultProfileId
    let url = opts.url && isAllowedInApp(opts.url) ? opts.url : SERVICES[opts.service ?? s.defaultService].home
    if (url === 'about:blank') url = SERVICES[s.defaultService].home
    const tab: Tab = {
      id: newId(),
      profileId,
      url,
      title: opts.title ?? '',
      favicon: opts.favicon ?? null,
      view: null,
      lastActive: Date.now(),
      loading: false,
      audible: false,
      muted: false,
      crashed: false,
      error: null,
      zoom: 1,
    }
    const index = opts.index ?? (this.activeId ? this.tabs.findIndex((t) => t.id === this.activeId) + 1 : this.tabs.length)
    this.tabs.splice(Math.max(0, Math.min(index, this.tabs.length)), 0, tab)
    if (!opts.sleeping && opts.activate === false) this.wake(tab)
    if (opts.activate !== false) this.activate(tab.id)
    this.changed()
    return tab
  }

  activate(id: string): void {
    const tab = this.get(id)
    if (!tab) return
    const prev = this.active()
    if (prev && prev !== tab) prev.lastActive = Date.now()
    this.activeId = id
    tab.lastActive = Date.now()
    if (!tab.view) this.wake(tab)
    this.syncAttachment()
    const wc = tab.view?.webContents
    if (wc && !wc.isDestroyed() && this.host.isShown()) wc.focus()
    this.changed()
  }

  close(id: string): void {
    const i = this.tabs.findIndex((t) => t.id === id)
    if (i < 0) return
    const [tab] = this.tabs.splice(i, 1)
    if (!tab) return
    this.closed.push({ url: tab.url, title: tab.title, profileId: tab.profileId, favicon: tab.favicon })
    if (this.closed.length > 25) this.closed.shift()
    this.destroyView(tab)
    if (this.activeId === id) {
      const next = this.tabs[i] ?? this.tabs[i - 1]
      this.activeId = null
      if (next) this.activate(next.id)
      else this.syncAttachment()
    }
    this.changed()
  }

  closeMany(ids: string[]): void {
    for (const id of ids) this.close(id)
  }

  reopenClosed(): void {
    const last = this.closed.pop()
    if (last) this.create({ url: last.url, profileId: last.profileId, title: last.title, favicon: last.favicon })
  }

  move(id: string, toIndex: number): void {
    const i = this.tabs.findIndex((t) => t.id === id)
    if (i < 0) return
    const [tab] = this.tabs.splice(i, 1)
    this.tabs.splice(Math.max(0, Math.min(toIndex, this.tabs.length)), 0, tab!)
    this.changed()
  }

  cycle(dir: 1 | -1): void {
    if (this.tabs.length < 2) return
    const i = this.tabs.findIndex((t) => t.id === this.activeId)
    const next = this.tabs[(i + dir + this.tabs.length) % this.tabs.length]
    if (next) this.activate(next.id)
  }

  selectIndex(n: number): void {
    const tab = n === 9 ? this.tabs[this.tabs.length - 1] : this.tabs[n - 1]
    if (tab) this.activate(tab.id)
  }

  duplicate(id: string): void {
    const tab = this.get(id)
    if (tab) this.create({ url: tab.url, profileId: tab.profileId, index: this.tabs.indexOf(tab) + 1 })
  }

  closeProfileTabs(profileId: string): void {
    this.closeMany(this.tabs.filter((t) => t.profileId === profileId).map((t) => t.id))
  }

  // ---------------------------------------------------------------- sleep / wake

  sleep(id: string): boolean {
    const tab = this.get(id)
    if (!tab?.view) return false
    this.destroyView(tab)
    tab.loading = false
    tab.audible = false
    if (this.activeId === id) this.syncAttachment()
    this.changed()
    return true
  }

  sleepInactive(): number {
    let n = 0
    for (const t of this.tabs) if (t.id !== this.activeId && !t.audible && t.view && this.sleep(t.id)) n++
    return n
  }

  sleepAll(): number {
    let n = 0
    for (const t of this.tabs) if (!t.audible && t.view && this.sleep(t.id)) n++
    return n
  }

  /** Called when the window is shown/hidden, for deep sleep while in the tray. */
  setShown(shown: boolean): void {
    this.hiddenSince = shown ? null : Date.now()
    if (shown) {
      const tab = this.active()
      if (tab && !tab.view) this.activate(tab.id)
    }
  }

  private sleepSweep(): void {
    const s = getSettings()
    const now = Date.now()
    if (this.hiddenSince && s.deepSleepMinutes > 0 && now - this.hiddenSince >= s.deepSleepMinutes * 60_000) {
      this.sleepAll()
      return
    }
    const ids = pickTabsToSleep(
      this.tabs.map((t) => ({ id: t.id, awake: !!t.view, active: t.id === this.activeId, audible: t.audible, lastActive: t.lastActive })),
      now,
      s.sleepAfterMinutes * 60_000,
    )
    for (const id of ids) this.sleep(id)
  }

  private wake(tab: Tab): void {
    if (tab.view) return
    tab.crashed = false
    tab.error = null
    const view = new WebContentsView({
      webPreferences: {
        session: sessionFor(tab.profileId),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        // Runs the (Node-less, sandboxed) compat preload in iframes too, so embedded Google
        // frames report the same browser identity as the page around them.
        nodeIntegrationInSubFrames: true,
        spellcheck: getSettings().spellcheck,
        backgroundThrottling: true,
        navigateOnDragDrop: false,
        safeDialogs: true,
      },
    })
    view.setBackgroundColor(this.host.contentBackground())
    view.setBorderRadius(this.host.contentRadius())
    tab.view = view
    this.wire(tab, view.webContents)
    tab.loading = true
    // E2E runs never touch Google: tabs stay blank so tests are fast and offline.
    const target = process.env['NOTEDESK_E2E'] ? 'about:blank' : tab.url
    void view.webContents.loadURL(target).catch(() => {
      /* failures surface through did-fail-load */
    })
  }

  private destroyView(tab: Tab): void {
    const view = tab.view
    if (!view) return
    tab.view = null
    if (this.attached === view) {
      this.host.detach(view)
      this.attached = null
    }
    const wc = view.webContents
    if (!wc.isDestroyed()) wc.close({ waitForBeforeUnload: false })
  }

  /** Ensures exactly the active, healthy view is attached to the window. */
  syncAttachment(): void {
    const tab = this.active()
    const want = tab && tab.view && !tab.crashed && !tab.error ? tab.view : null
    if (this.attached && this.attached !== want) {
      this.host.detach(this.attached)
      this.attached = null
    }
    if (want && this.attached !== want) {
      want.setBounds(this.host.contentBounds())
      this.host.attach(want)
      this.attached = want
    }
    if (want) want.setBounds(this.host.contentBounds())
  }

  attachedView(): WebContentsView | null {
    return this.attached
  }

  relayout(): void {
    if (this.attached) {
      this.attached.setBounds(this.host.contentBounds())
      this.attached.setBorderRadius(this.host.contentRadius())
    }
  }

  restyle(): void {
    const bg = this.host.contentBackground()
    const radius = this.host.contentRadius()
    for (const t of this.tabs) {
      t.view?.setBackgroundColor(bg)
      t.view?.setBorderRadius(radius)
    }
  }

  // ---------------------------------------------------------------- per-tab actions

  reload(id: string): void {
    const tab = this.get(id)
    if (!tab) return
    if (tab.crashed || !tab.view) {
      this.destroyView(tab)
      tab.crashed = false
      tab.error = null
      this.wake(tab)
      this.syncAttachment()
    } else {
      tab.error = null
      tab.view.webContents.reload()
    }
    this.changed()
  }

  navigate(id: string, action: 'back' | 'forward' | 'home'): void {
    const tab = this.get(id)
    const wc = tab?.view?.webContents
    if (!tab || !wc || wc.isDestroyed()) return
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
    else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
    else if (action === 'home') void wc.loadURL(SERVICES[serviceForUrl(tab.url) ?? getSettings().defaultService].home)
  }

  zoom(id: string, dir: 1 | -1 | 0): void {
    const tab = this.get(id)
    const wc = tab?.view?.webContents
    if (!tab || !wc || wc.isDestroyed()) return
    const z = nextZoom(wc.getZoomFactor(), dir)
    wc.setZoomFactor(z)
    // Chromium zoom is per-site within a session: mirror it onto sibling tabs.
    const host = parseUrl(tab.url)?.hostname
    for (const t of this.tabs) if (t.profileId === tab.profileId && parseUrl(t.url)?.hostname === host) t.zoom = z
    this.changed()
  }

  toggleMute(id: string): void {
    const tab = this.get(id)
    const wc = tab?.view?.webContents
    if (!tab || !wc || wc.isDestroyed()) return
    tab.muted = !wc.isAudioMuted()
    wc.setAudioMuted(tab.muted)
    this.changed()
  }

  copyLink(id: string): void {
    const tab = this.get(id)
    if (tab) clipboard.writeText(tab.url)
  }

  openInBrowser(id: string): void {
    const tab = this.get(id)
    if (tab && isSafeExternal(tab.url)) void shell.openExternal(tab.url)
  }

  // ---------------------------------------------------------------- persistence

  save(): void {
    if (!getSettings().restoreSession) return writeJson('session', () => ({ tabs: [], activeIndex: 0 }))
    writeJson('session', () => ({
      tabs: this.tabs.map<SavedTab>((t) => ({ url: t.url, title: t.title, profileId: t.profileId, favicon: t.favicon })),
      activeIndex: Math.max(0, this.tabs.findIndex((t) => t.id === this.activeId)),
    }), 1000)
  }

  restore(): void {
    const s = getSettings()
    const saved = readJson<{ tabs?: SavedTab[]; activeIndex?: number }>('session', {})
    const list = s.restoreSession && Array.isArray(saved.tabs) ? saved.tabs.filter((t) => t && isAllowedInApp(t.url)) : []
    if (list.length === 0) {
      this.create({ service: s.defaultService })
      return
    }
    const activeIndex = Math.min(Math.max(0, saved.activeIndex ?? 0), list.length - 1)
    list.forEach((t, i) => {
      this.create({ url: t.url, profileId: t.profileId, title: t.title, favicon: t.favicon, activate: false, sleeping: true, index: i })
    })
    const active = this.tabs[activeIndex]
    if (active) this.activate(active.id)
  }

  dispose(): void {
    clearInterval(this.sleepTimer)
  }

  // ---------------------------------------------------------------- events

  changed(): void {
    if (this.emitScheduled) return
    this.emitScheduled = true
    setImmediate(() => {
      this.emitScheduled = false
      emit('tabs', this.snapshot())
      this.save()
    })
  }

  private wire(tab: Tab, wc: WebContents): void {
    const alive = () => tab.view?.webContents === wc

    wc.on('page-title-updated', (_e, title) => {
      if (!alive()) return
      tab.title = cleanTitle(title)
      updateTitle(tab.url, title)
      this.changed()
    })
    wc.on('page-favicon-updated', (_e, favicons) => {
      if (!alive()) return
      const icon = favicons.find((f) => f.startsWith('https://')) ?? null
      if (icon !== tab.favicon) {
        tab.favicon = icon
        this.changed()
      }
    })
    wc.on('did-start-loading', () => {
      if (!alive()) return
      tab.loading = true
      this.changed()
    })
    wc.on('did-stop-loading', () => {
      if (!alive()) return
      tab.loading = false
      this.changed()
    })
    const onNavigate = (url: string) => {
      // about:blank (E2E runs, blank popups) must not replace the tab's real address.
      if (!alive() || url === 'about:blank') return
      tab.url = url
      tab.zoom = wc.getZoomFactor()
      recordVisit(url, tab.title, tab.profileId)
      this.changed()
    }
    wc.on('did-navigate', (_e, url) => {
      if (tab.error && alive()) {
        tab.error = null
        this.syncAttachment()
      }
      onNavigate(url)
    })
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) onNavigate(url)
    })
    wc.on('did-fail-load', (_e, code, description, validatedURL, isMainFrame) => {
      // -3 = ERR_ABORTED (navigation replaced), not a real failure.
      if (!alive() || !isMainFrame || code === -3) return
      tab.error = { code, description }
      tab.loading = false
      if (validatedURL && isAllowedInApp(validatedURL)) tab.url = validatedURL
      this.syncAttachment()
      this.changed()
    })
    wc.on('audio-state-changed', (e) => {
      if (!alive()) return
      tab.audible = e.audible
      this.changed()
    })
    wc.on('render-process-gone', (_e, details) => {
      if (!alive() || details.reason === 'clean-exit') return
      tab.crashed = true
      tab.loading = false
      this.syncAttachment()
      this.changed()
    })
    wc.on('zoom-changed', (_e, direction) => {
      if (alive()) this.zoom(tab.id, direction === 'in' ? 1 : -1)
    })
    wc.on('found-in-page', (_e, result) => {
      if (alive() && tab.id === this.activeId) emit('find', { matches: result.matches, active: result.activeMatchOrdinal })
    })
    wc.on('before-input-event', (event, input) => {
      if (handleShortcut(input, 'content')) event.preventDefault()
    })

    wc.on('will-navigate', (event) => {
      if (!isAllowedInApp(event.url)) {
        event.preventDefault()
        if (isSafeExternal(event.url)) void shell.openExternal(event.url)
      }
    })
    wc.on('will-redirect', (event) => {
      if (event.isMainFrame && !isAllowedInApp(event.url)) {
        event.preventDefault()
        if (isSafeExternal(event.url)) void shell.openExternal(event.url)
      }
    })

    wc.setWindowOpenHandler(({ url, disposition }) => this.handleWindowOpen(tab, url, disposition))
    wc.on('did-create-window', (child) => this.configurePopup(child))
    attachContentContextMenu(wc, {
      openInNewTab: (url) => this.create({ url, profileId: tab.profileId, index: this.tabs.indexOf(tab) + 1 }),
    })
  }

  private handleWindowOpen(tab: Tab, url: string, disposition: string): Electron.WindowOpenHandlerResponse {
    const parsed = parseUrl(url)
    if (url === 'about:blank' || isAuthOrPickerUrl(url) || isServiceAuthHost(url)) {
      const parent = this.host.parentWindow()
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 560,
          height: 720,
          parent: parent ?? undefined,
          autoHideMenuBar: true,
          backgroundColor: this.host.contentBackground(),
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: true },
        },
      }
    }
    if (parsed && serviceForUrl(url)) {
      this.create({ url, profileId: tab.profileId, activate: disposition !== 'background-tab', index: this.tabs.indexOf(tab) + 1 })
      return { action: 'deny' }
    }
    if (parsed && isSafeExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  }

  private configurePopup(child: BrowserWindow): void {
    child.setMenu(null)
    const wc = child.webContents
    wc.on('will-navigate', (event) => {
      if (!isAllowedInApp(event.url) && event.url !== 'about:blank') {
        event.preventDefault()
        if (isSafeExternal(event.url)) void shell.openExternal(event.url)
      }
    })
    wc.setWindowOpenHandler(({ url }) => {
      if (isAuthOrPickerUrl(url) || isServiceAuthHost(url) || url === 'about:blank') return { action: 'allow' }
      if (isSafeExternal(url) && !isTrustedHost(parseUrl(url)?.hostname ?? '')) void shell.openExternal(url)
      return { action: 'deny' }
    })
    attachContentContextMenu(wc, {})
  }
}
