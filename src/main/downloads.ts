// Native download handling: Audio/Video Overview exports, source files, images.
import { app, BaseWindow, Notification, shell, type DownloadItem, type Session } from 'electron'
import { existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { DownloadInfo } from '@shared/ipc'
import { emit } from './bus'
import { t } from './i18n'
import { getSettings } from './settings'

interface Entry {
  info: DownloadInfo
  item: DownloadItem | null
}

const entries = new Map<string, Entry>()
let seq = 0
let emitTimer: NodeJS.Timeout | null = null
const attached = new WeakSet<Session>()

function scheduleEmit(): void {
  if (emitTimer) return
  emitTimer = setTimeout(() => {
    emitTimer = null
    emit('downloads', listDownloads())
  }, 150)
}

export function listDownloads(): DownloadInfo[] {
  return [...entries.values()].map((e) => ({ ...e.info })).sort((a, b) => b.startedAt - a.startedAt)
}

export function downloadsDir(): string {
  const custom = getSettings().downloadsDir
  return custom && existsSync(custom) ? custom : app.getPath('downloads')
}

function uniquePath(dir: string, name: string): string {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = join(dir, name)
  for (let i = 1; existsSync(candidate) && i < 1000; i++) candidate = join(dir, `${stem} (${i})${ext}`)
  return candidate
}

function safeName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  return cleaned || 'download'
}

export function attachDownloads(ses: Session): void {
  if (attached.has(ses)) return
  attached.add(ses)
  ses.on('will-download', (_event, item) => {
    const id = `d${++seq}`
    if (!getSettings().askWhereToSave) item.setSavePath(uniquePath(downloadsDir(), safeName(item.getFilename())))
    const info: DownloadInfo = {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      savePath: item.getSavePath(),
      state: 'progressing',
      paused: false,
      received: 0,
      total: item.getTotalBytes(),
      startedAt: Date.now(),
    }
    const entry: Entry = { info, item }
    entries.set(id, entry)
    scheduleEmit()

    item.on('updated', (_e, state) => {
      info.state = state === 'interrupted' ? 'interrupted' : 'progressing'
      info.paused = item.isPaused()
      info.received = item.getReceivedBytes()
      info.total = item.getTotalBytes()
      info.savePath = item.getSavePath()
      info.filename = basename(info.savePath) || info.filename
      scheduleEmit()
    })
    item.once('done', (_e, state) => {
      info.state = state
      info.received = item.getReceivedBytes()
      info.savePath = item.getSavePath()
      info.filename = basename(info.savePath) || info.filename
      entry.item = null
      scheduleEmit()
      const focused = BaseWindow.getFocusedWindow() !== null
      if (state === 'completed' && !focused && Notification.isSupported()) {
        const n = new Notification({ title: t('downloads.doneTitle'), body: info.filename, silent: true })
        n.on('click', () => shell.showItemInFolder(info.savePath))
        n.show()
      }
    })
  })
}

export function downloadAction(id: string, action: 'open' | 'show' | 'cancel' | 'pause' | 'resume' | 'remove'): void {
  const entry = entries.get(id)
  if (!entry) return
  const { info, item } = entry
  switch (action) {
    case 'open':
      if (info.state === 'completed') void shell.openPath(info.savePath)
      break
    case 'show':
      if (existsSync(info.savePath)) shell.showItemInFolder(info.savePath)
      break
    case 'cancel':
      item?.cancel()
      break
    case 'pause':
      item?.pause()
      break
    case 'resume':
      if (item?.canResume()) item.resume()
      break
    case 'remove':
      if (info.state !== 'progressing') entries.delete(id)
      break
  }
  scheduleEmit()
}

export function clearFinishedDownloads(): void {
  for (const [id, e] of entries) if (e.info.state !== 'progressing') entries.delete(id)
  scheduleEmit()
}
