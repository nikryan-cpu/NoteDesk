import { contextBridge, ipcRenderer } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type EventChannel, type InvokeChannel, type OsPlatform, type ShellApi } from '@shared/ipc'

const invokable = new Set<string>(INVOKE_CHANNELS)
const events = new Set<string>(EVENT_CHANNELS)

const platform: OsPlatform = process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux'

const api: ShellApi = {
  platform,
  invoke(channel: InvokeChannel, ...args: unknown[]) {
    if (!invokable.has(channel)) return Promise.reject(new Error(`unknown channel ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel: EventChannel, cb: (payload: never) => void) {
    if (!events.has(channel)) return () => {}
    const listener = (_e: Electron.IpcRendererEvent, payload: never) => cb(payload)
    ipcRenderer.on(`nd:${channel}`, listener)
    return () => ipcRenderer.removeListener(`nd:${channel}`, listener)
  },
} as ShellApi

contextBridge.exposeInMainWorld('nd', api)
