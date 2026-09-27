// Main window: a BaseWindow holding the shell UI view (full size, underneath) and the active
// tab's view (on top, inside the content rectangle the shell reserves).
import { app, BaseWindow, nativeTheme, screen, shell, WebContentsView, type Rectangle } from 'electron'
import { join } from 'node:path'
import type { LayoutInsets } from '@shared/ipc'
import { isSafeExternal } from '@shared/services'
import { isEffectivelyDark, solidColor, themeTokens, THEMES } from '@shared/themes'
import { emit, setShellTarget } from './bus'
import { resourcePath } from './paths'
import { getSettings } from './settings'
import { handleShortcut } from './shortcuts'
import { readJson, writeJson } from './store'
import { TabManager, type TabHost } from './tabs'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const TRANSPARENT = '#00000000'

export function systemSupportsMaterial(): boolean {
  if (process.platform === 'darwin') return true
  if (process.platform !== 'win32') return false
  const build = Number(process.getSystemVersion().split('.')[2] ?? 0)
  return build >= 22621
}

export function isDarkNow(): boolean {
  const s = getSettings()
  const dark = s.colorMode === 'dark' || (s.colorMode === 'system' && nativeTheme.shouldUseDarkColors)
  return isEffectivelyDark(s.theme, dark)
}

export class MainWindow implements TabHost {
  readonly win: BaseWindow
  readonly shell: WebContentsView
  readonly tabs: TabManager
  private insets: LayoutInsets = { top: 44, left: 0, right: 0, bottom: 0, radius: 0 }
  private titlebarHeight = 40
  private overlay = false
  focusMode = false
  quitting = false
  private saveTimer: NodeJS.Timeout | null = null
  private onFirstHide: (() => void) | null = null

  constructor(opts: { startHidden: boolean; onFirstHideToTray?: () => void }) {
    this.onFirstHide = opts.onFirstHideToTray ?? null
    const state = this.loadState()
    const isMac = process.platform === 'darwin'

    this.win = new BaseWindow({
      ...state,
      minWidth: 640,
      minHeight: 460,
      show: false,
      title: 'NoteDesk',
      backgroundColor: this.windowBackground(),
      titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
      trafficLightPosition: isMac ? { x: 14, y: 13 } : undefined,
      titleBarOverlay: isMac ? undefined : this.overlayOptions(),
      icon: process.platform === 'linux' ? resourcePath('icon.png') : undefined,
    })
    if (state.maximized) this.win.maximize()

    this.shell = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/shell.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        backgroundThrottling: true,
      },
    })
    this.win.contentView.addChildView(this.shell)
    setShellTarget(this.shell.webContents)
    this.tabs = new TabManager(this)
    this.applyTheme()
    this.wireShell(opts.startHidden)
    this.wireWindow()
    this.layout()
  }

  // ---------------------------------------------------------------- TabHost

  attach(view: WebContentsView): void {
    // While an overlay (palette/settings) is open, new views go underneath the shell.
    if (this.overlay) this.win.contentView.addChildView(view, 0)
    else this.win.contentView.addChildView(view)
  }

  detach(view: WebContentsView): void {
    this.win.contentView.removeChildView(view)
  }

  contentBounds(): Rectangle {
    const [w = 0, h = 0] = this.win.getContentSize()
    if (this.focusMode) return { x: 0, y: 0, width: w, height: h }
    const i = this.insets
    return {
      x: Math.round(i.left),
      y: Math.round(i.top),
      width: Math.max(0, Math.round(w - i.left - i.right)),
      height: Math.max(0, Math.round(h - i.top - i.bottom)),
    }
  }

  contentRadius(): number {
    return this.focusMode ? 0 : Math.round(this.insets.radius)
  }

  contentBackground(): string {
    const tokens = themeTokens(getSettings().theme, isDarkNow())
    return solidColor(tokens.surface, isDarkNow() ? '#18181b' : '#ffffff')
  }

  parentWindow(): BaseWindow | null {
    return this.win
  }

  isShown(): boolean {
    return this.win.isVisible() && !this.win.isMinimized()
  }

  // ---------------------------------------------------------------- layout

  setInsets(insets: LayoutInsets): void {
    this.insets = insets
    if (insets.titlebar && insets.titlebar !== this.titlebarHeight) {
      this.titlebarHeight = insets.titlebar
      this.applyOverlay()
    }
    this.layout()
    this.tabs.relayout()
  }

  layout(): void {
    const [w = 0, h = 0] = this.win.getContentSize()
    this.shell.setBounds({ x: 0, y: 0, width: w, height: h })
    this.tabs.relayout()
  }

  async setOverlay(open: boolean): Promise<string | null> {
    if (open === this.overlay) return null
    this.overlay = open
    const view = this.tabs.attachedView()
    if (open) {
      let snapshot: string | null = null
      if (view && !view.webContents.isDestroyed()) {
        try {
          const img = await view.webContents.capturePage()
          const size = img.getSize()
          const scaled = size.width > 900 ? img.resize({ width: Math.round(size.width / 2), quality: 'good' }) : img
          snapshot = `data:image/jpeg;base64,${scaled.toJPEG(70).toString('base64')}`
        } catch {
          snapshot = null
        }
      }
      if (this.overlay) this.win.contentView.addChildView(this.shell)
      this.shell.webContents.focus()
      return snapshot
    }
    if (view) {
      this.win.contentView.addChildView(view)
      view.webContents.focus()
    }
    return null
  }

  isOverlayOpen(): boolean {
    return this.overlay
  }

  toggleFocusMode(): void {
    this.setFocusMode(!this.focusMode)
  }

  setFocusMode(on: boolean): void {
    this.focusMode = on
    this.win.setFullScreen(on)
    this.layout()
    this.emitWindowState()
  }

  // ---------------------------------------------------------------- theme

  private windowBackground(): string {
    const s = getSettings()
    const def = THEMES[s.theme]
    if (this.materialFor(def.material) !== 'none') return TRANSPARENT
    return solidColor(themeTokens(s.theme, isDarkNow()).bg, isDarkNow() ? '#0e0e10' : '#eeeef1')
  }

  private materialFor(m: (typeof THEMES)[keyof typeof THEMES]['material']): 'none' | 'mica' | 'acrylic' | 'vibrancy' {
    if (!systemSupportsMaterial()) return 'none'
    if (process.platform === 'darwin') return m.mac ? 'vibrancy' : 'none'
    return m.win
  }

  private overlayOptions(): Electron.TitleBarOverlay {
    const tokens = themeTokens(getSettings().theme, isDarkNow())
    return {
      color: TRANSPARENT,
      symbolColor: solidColor(tokens.text, isDarkNow() ? '#ffffff' : '#111111'),
      height: this.titlebarHeight,
    }
  }

  private applyOverlay(): void {
    if (process.platform === 'darwin') return
    try {
      this.win.setTitleBarOverlay(this.overlayOptions())
    } catch {
      /* not available on this platform */
    }
  }

  applyTheme(): void {
    const s = getSettings()
    nativeTheme.themeSource = s.colorMode
    const def = THEMES[s.theme]
    const material = this.materialFor(def.material)
    if (process.platform === 'win32' && systemSupportsMaterial()) {
      this.win.setBackgroundMaterial(material === 'mica' || material === 'acrylic' ? material : 'none')
    }
    if (process.platform === 'darwin') {
      this.win.setVibrancy(material === 'vibrancy' && def.material.mac ? def.material.mac : null)
    }
    const bg = this.windowBackground()
    this.win.setBackgroundColor(bg)
    this.shell.setBackgroundColor(bg === TRANSPARENT ? TRANSPARENT : bg)
    this.applyOverlay()
    this.tabs.restyle()
  }

  // ---------------------------------------------------------------- visibility

  show(): void {
    if (this.win.isMinimized()) this.win.restore()
    this.win.show()
    this.win.focus()
    this.tabs.activeWebContents()?.focus()
    this.tabs.setShown(true)
  }

  hide(): void {
    this.win.hide()
    this.tabs.setShown(false)
  }

  toggle(): void {
    if (this.win.isVisible() && this.win.isFocused() && !this.win.isMinimized()) this.hide()
    else this.show()
  }

  emitWindowState(): void {
    emit('window', { maximized: this.win.isMaximized(), focused: this.win.isFocused(), focusMode: this.focusMode })
  }

  // ---------------------------------------------------------------- wiring

  private wireShell(startHidden: boolean): void {
    const wc = this.shell.webContents
    wc.on('before-input-event', (event, input) => {
      if (handleShortcut(input, 'shell')) event.preventDefault()
    })
    wc.setWindowOpenHandler(({ url }) => {
      if (isSafeExternal(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (e) => e.preventDefault())
    wc.once('did-finish-load', () => {
      if (!startHidden) this.show()
    })
    wc.on('render-process-gone', () => {
      if (!this.quitting) this.loadShell()
    })
    this.loadShell()
  }

  private loadShell(): void {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!app.isPackaged && devUrl) void this.shell.webContents.loadURL(`${devUrl}/index.html`)
    else void this.shell.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  private wireWindow(): void {
    const w = this.win
    w.on('resize', () => {
      this.layout()
      this.scheduleSave()
    })
    w.on('move', () => this.scheduleSave())
    w.on('maximize', () => this.emitWindowState())
    w.on('unmaximize', () => this.emitWindowState())
    w.on('focus', () => this.emitWindowState())
    w.on('blur', () => this.emitWindowState())
    w.on('show', () => this.tabs.setShown(true))
    w.on('hide', () => this.tabs.setShown(false))
    w.on('leave-full-screen', () => {
      if (this.focusMode) {
        this.focusMode = false
        this.layout()
        this.emitWindowState()
      }
    })
    w.on('close', (e) => {
      this.saveState()
      if (!this.quitting && getSettings().closeToTray) {
        e.preventDefault()
        this.hide()
        if (this.onFirstHide) {
          this.onFirstHide()
          this.onFirstHide = null
        }
      }
    })
  }

  // ---------------------------------------------------------------- persisted bounds

  private loadState(): WindowState {
    const def: WindowState = { width: 1280, height: 820, maximized: false }
    const s = readJson<WindowState>('window-state', def)
    const width = Math.max(640, Number(s.width) || def.width)
    const height = Math.max(460, Number(s.height) || def.height)
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      const visible = screen.getAllDisplays().some((d) => {
        const a = d.workArea
        return s.x! + 100 > a.x && s.y! + 40 > a.y && s.x! < a.x + a.width - 100 && s.y! < a.y + a.height - 40
      })
      if (visible) return { x: s.x, y: s.y, width, height, maximized: !!s.maximized }
    }
    return { width, height, maximized: !!s.maximized }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveState(), 800)
  }

  private saveState(): void {
    if (this.win.isDestroyed() || this.focusMode) return
    const maximized = this.win.isMaximized()
    const b = maximized ? this.win.getNormalBounds() : this.win.getBounds()
    writeJson('window-state', () => ({ x: b.x, y: b.y, width: b.width, height: b.height, maximized }), 0)
  }
}
