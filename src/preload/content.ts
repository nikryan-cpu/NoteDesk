// Preload for Google pages. Exposes nothing to the page. It (1) aligns navigator.userAgentData
// with the Chrome identity before any page script runs and (2) watches for long Studio
// generations finishing so main can send a notification.
import { contextBridge, ipcRenderer } from 'electron'
import type { UaDataPatch } from '@shared/compat'
import { mainWorldPatch } from '@shared/mainworld'
import { watchGenerations } from './watcher'

try {
  const patch = ipcRenderer.sendSync('compat:get') as UaDataPatch | null
  if (patch) contextBridge.executeInMainWorld({ func: mainWorldPatch, args: [patch] })
} catch {
  /* page keeps the default identity */
}

if (/(^|\.)notebook(lm)?\.google(\.com)?$/.test(location.hostname)) {
  watchGenerations(() => ipcRenderer.send('content:generation-done'))
}
