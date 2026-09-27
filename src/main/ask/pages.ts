// Visible windows for the Ask engine. The engine drives each service's chat inside a hidden,
// offscreen page; these two windows are the escape hatch a human sometimes has to reach through
// by hand — signing in, or clicking through a captcha or a consent screen the hidden page hit.
import { BrowserWindow, type Session } from 'electron'
import { SERVICES, isAllowedInApp, type ModelId } from '@shared/services'
import { t } from '../i18n'

const open = new Map<ModelId, BrowserWindow>()

function isAllowedNav(url: string): boolean {
  if (isAllowedInApp(url)) return true
  return Boolean(process.env['NOTEDESK_E2E']) && url.startsWith('file:')
}

function focusOrCreate(model: ModelId, title: string, session: Session, url: string, onClosed: () => void): BrowserWindow {
  const existing = open.get(model)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return existing
  }
  const win = new BrowserWindow({
    width: 520,
    height: 720,
    title,
    autoHideMenuBar: true,
    webPreferences: { session, sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  const wc = win.webContents
  wc.on('will-navigate', (e) => {
    if (!isAllowedNav(e.url)) e.preventDefault()
  })
  wc.setWindowOpenHandler(({ url: target }) => {
    // Google's own sign-in hops (2FA, "choose an account"…) need to open as real popups.
    if (isAllowedNav(target) || /^https:\/\/accounts\.google\./.test(target)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { session, sandbox: true, contextIsolation: true } },
      }
    }
    return { action: 'deny' }
  })
  win.on('closed', () => {
    open.delete(model)
    onClosed()
  })
  void win.loadURL(url)
  open.set(model, win)
  return win
}

export function openLogin(model: ModelId, session: Session, url: string, onClosed: () => void): void {
  focusOrCreate(model, t('askLogin.title', { name: SERVICES[model].name }), session, url, onClosed)
}

export function showPage(model: ModelId, session: Session, url: string, onClosed: () => void): void {
  focusOrCreate(model, t('askShowPage.title', { name: SERVICES[model].name }), session, url, onClosed)
}

export function closeAll(): void {
  for (const win of open.values()) if (!win.isDestroyed()) win.destroy()
  open.clear()
}
