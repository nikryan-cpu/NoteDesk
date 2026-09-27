// The Ask window: one prompt box, several chat services, summoned by a global hotkey or a
// deep link. Its whole UI is a single renderer page talking to the engine over ask:* IPC; the
// engine and the conversation history keep working in main while this window is hidden, so
// tearing the view down after a while hidden costs nothing beyond the window itself.
import { app, BaseWindow, screen, shell, WebContentsView } from 'electron'
import { join } from 'node:path'
import type { QuickState } from '@shared/ipc'
import { isSafeExternal } from '@shared/services'
import { solidColor, themeTokens } from '@shared/themes'
import { attachContentContextMenu } from './contextmenu'
import { currentLocale } from './i18n'
import { getSettings } from './settings'
import { readJson, writeJson } from './store'

const IDLE_DESTROY_MS = 5 * 60_000
const DEFAULT_WIDTH = 980
const DEFAULT_HEIGHT = 720

interface AskWindowState {
  x?: number
  y?: number
  width: number
  height: number
}

export class QuickWindow {
  private win: BaseWindow | null = null
  private view: WebContentsView | null = null
  private pinned = false
  private idleTimer: NodeJS.Timeout | null = null
  private saveTimer: NodeJS.Timeout | null = null
  private hasSavedPosition = false

  constructor(
    private isDark: () => boolean,
    /** With a URL, opens it as a main-window tab; with none, just shows the main window. */
    private openInMain: (url?: string) => void,
  ) {}

  uiWebContents(): Electron.WebContents | null {
    return this.view?.webContents ?? null
  }

  toggle(): void {
    if (this.win && this.win.isVisible() && this.win.isFocused()) this.hide()
    else this.show()
  }

  show(): void {
    const firstCreate = !this.win
    if (!this.win) this.create()
    if (this.idleTimer) clearTimeout(this.idleTimer)
    const win = this.win!
    if (firstCreate && !this.hasSavedPosition) {
      const cursor = screen.getCursorScreenPoint()
      const area = screen.getDisplayNearestPoint(cursor).workArea
      const [w = DEFAULT_WIDTH, h = DEFAULT_HEIGHT] = win.getSize()
      win.setPosition(Math.round(area.x + (area.width - w) / 2), Math.round(area.y + (area.height - h) / 2))
    }
    win.show()
    win.focus()
    this.view?.webContents.focus()
  }

  hide(): void {
    if (!this.win) return
    this.win.hide()
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.destroy(), IDLE_DESTROY_MS)
  }

  destroy(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    this.saveState()
    const view = this.view
    this.view = null
    if (view && !view.webContents.isDestroyed()) view.webContents.close()
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  state(): QuickState {
    const s = getSettings()
    return { pinned: this.pinned, locale: currentLocale(), dark: this.isDark(), theme: s.theme, accent: s.accent }
  }

  action(a: 'init' | 'close' | 'pin' | 'openInMain' | 'show'): QuickState {
    if (a === 'show') this.show()
    if (a === 'close') this.hide()
    if (a === 'pin') {
      this.pinned = !this.pinned
      this.win?.setAlwaysOnTop(this.pinned, 'floating')
    }
    if (a === 'openInMain') {
      this.openInMain()
      this.hide()
    }
    return this.state()
  }

  restyle(): void {
    if (!this.win) return
    const bg = this.background()
    this.win.setBackgroundColor(bg)
    this.view?.setBackgroundColor(bg)
    this.view?.webContents.send('nd:quick-theme', this.state())
  }

  private background(): string {
    const s = getSettings()
    return solidColor(themeTokens(s.theme, this.isDark()).surface, this.isDark() ? '#18181b' : '#ffffff')
  }

  // -------------------------------------------------------------- persisted bounds

  private loadState(): AskWindowState {
    const s = readJson<Partial<AskWindowState>>('ask-window', {})
    const width = Math.max(560, Number(s.width) || DEFAULT_WIDTH)
    const height = Math.max(420, Number(s.height) || DEFAULT_HEIGHT)
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      const visible = screen.getAllDisplays().some((d) => {
        const a = d.workArea
        return s.x! + 100 > a.x && s.y! + 40 > a.y && s.x! < a.x + a.width - 100 && s.y! < a.y + a.height - 40
      })
      if (visible) return { x: s.x, y: s.y, width, height }
    }
    return { width, height }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveState(), 600)
  }

  private saveState(): void {
    if (!this.win || this.win.isDestroyed()) return
    const b = this.win.getBounds()
    writeJson('ask-window', () => ({ x: b.x, y: b.y, width: b.width, height: b.height }), 0)
  }

  // -------------------------------------------------------------- window

  private create(): void {
    const state = this.loadState()
    this.hasSavedPosition = typeof state.x === 'number'
    const bg = this.background()
    const win = new BaseWindow({
      ...state,
      minWidth: 560,
      minHeight: 420,
      show: false,
      frame: false,
      resizable: true,
      skipTaskbar: false,
      backgroundColor: bg,
      roundedCorners: true,
      title: 'NoteDesk',
    })
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/shell.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: getSettings().spellcheck,
      },
    })
    view.setBackgroundColor(bg)
    win.contentView.addChildView(view)

    const layout = () => {
      const [w = 0, h = 0] = win.getContentSize()
      view.setBounds({ x: 0, y: 0, width: w, height: h })
    }
    layout()
    win.on('resize', () => {
      layout()
      this.scheduleSave()
    })
    win.on('move', () => this.scheduleSave())
    win.on('closed', () => {
      this.win = null
      this.view = null
    })

    const wc = view.webContents
    wc.setWindowOpenHandler(({ url }) => {
      if (isSafeExternal(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    // This view only ever shows NoteDesk's own Ask page; anything trying to navigate it away
    // (a stray link click bubbling up) is refused, links open in the main window's tabs instead.
    wc.on('will-navigate', (e) => e.preventDefault())
    wc.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.code === 'Escape' && !input.control && !input.meta && !input.alt) {
        // Only close on a "bare" Escape with nothing focused, so it doesn't eat one meant to
        // close a menu or clear a selection inside the page.
        void wc.executeJavaScript('document.activeElement === document.body || !document.activeElement', true).then((idle) => {
          if (idle) this.hide()
        })
      }
    })
    attachContentContextMenu(wc, { openInNewTab: (url) => this.openInMain(url) })

    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!app.isPackaged && devUrl) void wc.loadURL(`${devUrl}/quick.html`)
    else void wc.loadFile(join(__dirname, '../renderer/quick.html'))

    this.win = win
    this.view = view
    this.pinned = false
  }
}
