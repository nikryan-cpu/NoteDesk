// Event channel from main to the shell UI. Decoupled from window.ts to avoid import cycles.
import type { WebContents } from 'electron'
import type { EventChannel, EventMap } from '@shared/ipc'

let target: WebContents | null = null

export function setShellTarget(wc: WebContents | null): void {
  target = wc
}

export function shellWebContents(): WebContents | null {
  return target && !target.isDestroyed() ? target : null
}

export function emit<K extends EventChannel>(channel: K, payload: EventMap[K]): void {
  const wc = shellWebContents()
  if (wc) wc.send(`nd:${channel}`, payload)
}
