import { Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { t } from './i18n'

export interface TrayActions {
  toggle(): void
  isVisible(): boolean
  newTab(service: 'notebook' | 'gemini'): void
  quickAsk(): void
  sleepAll(): void
  settings(): void
  quit(): void
}

let tray: Tray | null = null
let actions: TrayActions | null = null

function iconPath(): string {
  const dir = join(__dirname, '../../resources')
  if (process.platform === 'darwin') return join(dir, 'trayTemplate.png')
  if (process.platform === 'win32') return join(dir, 'tray.ico')
  return join(dir, 'tray.png')
}

export function createTray(a: TrayActions): Tray {
  actions = a
  const image = nativeImage.createFromPath(iconPath())
  if (process.platform === 'darwin') image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip(t('tray.tooltip'))
  tray.on('click', () => a.toggle())
  rebuildTrayMenu()
  return tray
}

export function rebuildTrayMenu(): void {
  if (!tray || !actions) return
  const a = actions
  tray.setToolTip(t('tray.tooltip'))
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: a.isVisible() ? t('tray.hide') : t('tray.show'), click: () => a.toggle() },
      { type: 'separator' },
      { label: t('tabs.newNotebook'), click: () => a.newTab('notebook') },
      { label: t('tabs.newGemini'), click: () => a.newTab('gemini') },
      { label: t('tray.quickAsk'), click: () => a.quickAsk() },
      { type: 'separator' },
      { label: t('tray.sleepAll'), click: () => a.sleepAll() },
      { label: t('tray.settings'), click: () => a.settings() },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => a.quit() },
    ]),
  )
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
