// Applies the browser-identity preset (see @shared/compat) to Electron.
import { app, ipcMain, type Session } from 'electron'
import { buildCompatProfile, rewriteHeaders, type CompatPreset, type CompatProfile } from '@shared/compat'
import { isGoogleHost, parseUrl } from '@shared/services'

let profile: CompatProfile

function platform(): 'win32' | 'darwin' | 'linux' {
  return process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux'
}

export function currentCompat(): CompatProfile {
  return profile
}

/** Must run before `app.ready` so every session, worker and network request inherits the UA. */
export function initCompat(preset: CompatPreset): void {
  profile = buildCompatProfile(preset, platform(), process.versions.chrome, process.arch)
  if (profile.userAgent && preset === 'chrome') app.userAgentFallback = profile.userAgent

  // Content preloads fetch the main-world patch synchronously before any page script runs.
  ipcMain.on('compat:get', (event) => {
    event.returnValue = profile.uaData
  })
}

const hooked = new WeakSet<Session>()

/** Preset changes take effect after a restart (the UA fallback is fixed before app.ready). */
export function applyCompatToSession(ses: Session): void {
  // The Chrome preset is covered by app.userAgentFallback (client hints stay intact, verified
  // on Electron 44); Firefox needs an explicit session UA.
  if (profile.preset === 'firefox' && profile.userAgent) ses.setUserAgent(profile.userAgent)
  if (hooked.has(ses)) return
  hooked.add(ses)
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (details, callback) => {
    const host = parseUrl(details.url)?.hostname
    if (host && isGoogleHost(host)) rewriteHeaders(details.requestHeaders, profile)
    callback({ requestHeaders: details.requestHeaders })
  })
}
