// Auto-update from GitHub Releases (electron-updater). Unsigned macOS builds can't self-update,
// and neither can .deb installs, so those only get a "new version available" link.
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '@shared/ipc'
import { emit } from './bus'
import { getSettings } from './settings'

const { autoUpdater } = electronUpdater
const RELEASES = 'https://github.com/nikryan-cpu/NoteDesk/releases/latest'

let status: UpdateStatus = { state: 'idle' }
let started = false

function set(s: UpdateStatus): void {
  status = s
  emit('update', s)
}

export function updateStatus(): UpdateStatus {
  return status
}

function canSelfInstall(): boolean {
  if (process.platform === 'darwin') return false
  if (process.platform === 'linux') return Boolean(process.env['APPIMAGE'])
  return true
}

export function initUpdater(): void {
  if (!app.isPackaged || started) return
  started = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ state: 'none' }))
  autoUpdater.on('error', (err) => set({ state: 'error', message: err?.message ?? String(err) }))
  autoUpdater.on('update-available', (info) => {
    const install = canSelfInstall()
    set({ state: 'available', version: info.version, canInstall: install, url: RELEASES })
    if (install && getSettings().autoUpdate) void autoUpdater.downloadUpdate().catch(() => {})
  })
  autoUpdater.on('download-progress', (p) => {
    const version = status.state === 'available' || status.state === 'downloading' ? status.version : ''
    set({ state: 'downloading', percent: Math.round(p.percent), version })
  })
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))

  setTimeout(() => void checkForUpdates(), 20_000)
  setInterval(() => void checkForUpdates(), 6 * 60 * 60_000)
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    set({ state: 'none' })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    set({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export function downloadOrInstall(): void {
  if (status.state === 'ready') {
    autoUpdater.quitAndInstall(false, true)
    return
  }
  if (status.state === 'available' && status.canInstall) void autoUpdater.downloadUpdate().catch(() => {})
}
