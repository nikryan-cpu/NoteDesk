// Per-app proxy: lets people route NoteDesk (or only its Google traffic) through their own
// HTTP/SOCKS5 proxy without a system-wide VPN. Chromium has no SOCKS5 username/password
// support, so credentials apply to HTTP proxies only.
import { app, session, type Session } from 'electron'
import type { ProxyTestResult } from '@shared/ipc'
import { electronProxyConfig } from '@shared/proxy'
import { SERVICES } from '@shared/services'
import { decryptSecret, getSettings } from './settings'

export async function applyProxy(ses: Session): Promise<void> {
  const cfg = electronProxyConfig(getSettings().proxy)
  try {
    await ses.setProxy(cfg)
    await ses.closeAllConnections()
  } catch (err) {
    console.error('[proxy] setProxy failed', err)
  }
}

export async function applyProxyEverywhere(sessions: Session[]): Promise<void> {
  await Promise.all([...sessions, session.defaultSession].map((s) => applyProxy(s)))
}

export function initProxyAuth(): void {
  app.on('login', (event, _wc, _details, authInfo, callback) => {
    if (!authInfo.isProxy) return
    const p = getSettings().proxy
    if (p.mode !== 'custom' || !p.username) return
    event.preventDefault()
    callback(p.username, decryptSecret(p.passwordEnc))
  })
}

export async function testProxy(ses: Session): Promise<ProxyTestResult> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await ses.fetch(SERVICES.notebook.home, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
      cache: 'no-store',
    })
    return { ok: res.status < 500, status: res.status, ms: Date.now() - started }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}
