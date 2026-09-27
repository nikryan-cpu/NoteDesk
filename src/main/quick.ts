// Quick Ask: a compact always-on-top window with Gemini (or Notebook) summoned by a global
// hotkey. Created on demand; destroyed after a few minutes hidden so it costs no memory idle.
import { BaseWindow, screen, shell, WebContentsView } from 'electron'
import { join } from 'node:path'
import type { QuickState } from '@shared/ipc'
import { SERVICES, isAllowedInApp, isSafeExternal } from '@shared/services'
import { solidColor, themeTokens } from '@shared/themes'
import { attachContentContextMenu } from './contextmenu'
import { currentLocale } from './i18n'
import { sessionFor } from './sessions'
import { getSettings } from './settings'

const HEADER = 38
const IDLE_DESTROY_MS = 5 * 60_000

export class QuickWindow {
  private win: BaseWindow | null = null
  private header: WebContentsView | null = null
  private content: WebContentsView | null = null
  private pinned = false
  private idleTimer: NodeJS.Timeout | null = null

  constructor(
    private isDark: () => boolean,
    private openInMain: (url: string) => void,
  ) {}

  headerWebContents(): Electron.WebContents | null {
    return this.header?.webContents ?? null
  }

  toggle(): void {
    if (this.win && this.win.isVisible() && this.win.isFocused()) this.hide()
    else this.show()
  }

  show(): void {
    if (!this.win) this.create()
    if (this.idleTimer) clearTimeout(this.idleTimer)
    const win = this.win!
    const cursor = screen.getCursorScreenPoint()
    const area = screen.getDisplayNearestPoint(cursor).workArea
    const [w = 440] = win.getSize()
    win.setPosition(Math.round(area.x + (area.width - w) / 2), Math.round(area.y + area.height * 0.12))
    win.show()
    win.focus()
    this.content?.webContents.focus()
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
    const content = this.content
    const header = this.header
    this.content = null
    this.header = null
    if (content && !content.webContents.isDestroyed()) content.webContents.close()
    if (header && !header.webContents.isDestroyed()) header.webContents.close()
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  state(): QuickState {
    const s = getSettings()
    return { pinned: this.pinned, locale: currentLocale(), dark: this.isDark(), theme: s.theme }
  }

  action(a: 'init' | 'close' | 'pin' | 'openInMain' | 'show'): QuickState {
    if (a === 'show') this.show()
    if (a === 'close') this.hide()
    if (a === 'pin') {
      this.pinned = !this.pinned
      this.win?.setAlwaysOnTop(true, this.pinned ? 'floating' : 'normal')
    }
    if (a === 'openInMain') {
      const url = this.content?.webContents.getURL()
      if (url && isAllowedInApp(url)) this.openInMain(url)
      this.hide()
    }
    return this.state()
  }

  restyle(): void {
    if (!this.win) return
    const bg = this.background()
    this.win.setBackgroundColor(bg)
    this.header?.setBackgroundColor(bg)
    this.content?.setBackgroundColor(bg)
    this.header?.webContents.send('nd:quick-theme', this.state())
  }

  private background(): string {
    const s = getSettings()
    return solidColor(themeTokens(s.theme, this.isDark()).surface, this.isDark() ? '#18181b' : '#ffffff')
  }

  private create(): void {
    const s = getSettings()
    const bg = this.background()
    const win = new BaseWindow({
      width: 440,
      height: 640,
      minWidth: 340,
      minHeight: 420,
      show: false,
      frame: false,
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: bg,
      roundedCorners: true,
      title: 'NoteDesk Quick Ask',
    })
    const header = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/shell.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    })
    header.setBackgroundColor(bg)
    const content = new WebContentsView({
      webPreferences: {
        session: sessionFor(s.defaultProfileId),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: s.spellcheck,
      },
    })
    content.setBackgroundColor(bg)
    win.contentView.addChildView(header)
    win.contentView.addChildView(content)

    const layout = () => {
      const [w = 0, h = 0] = win.getContentSize()
      header.setBounds({ x: 0, y: 0, width: w, height: HEADER })
      content.setBounds({ x: 0, y: HEADER, width: w, height: Math.max(0, h - HEADER) })
    }
    layout()
    win.on('resize', layout)
    win.on('blur', () => {
      if (!this.pinned) this.hide()
    })
    win.on('closed', () => {
      this.win = null
      this.header = null
      this.content = null
    })

    const wc = content.webContents
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedInApp(url)) this.openInMain(url)
      else if (isSafeExternal(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (e) => {
      if (!isAllowedInApp(e.url)) {
        e.preventDefault()
        if (isSafeExternal(e.url)) void shell.openExternal(e.url)
      }
    })
    wc.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.code === 'Escape' && !input.control && !input.meta && !input.alt) {
        // Hide on Escape only when nothing inside the page has focus, so menus still close normally.
        void wc.executeJavaScript('document.activeElement === document.body || !document.activeElement', true).then((idle) => {
          if (idle) this.hide()
        })
      }
    })
    attachContentContextMenu(wc, { openInNewTab: (url) => this.openInMain(url) })

    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) void header.webContents.loadURL(`${devUrl}/quick.html`)
    else void header.webContents.loadFile(join(__dirname, '../renderer/quick.html'))
    void wc.loadURL(process.env['NOTEDESK_E2E'] ? 'about:blank' : SERVICES[s.quickAskService].home)

    this.win = win
    this.header = header
    this.content = content
    this.pinned = false
  }
}
