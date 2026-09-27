// Proxy configuration helpers (pure, unit-tested).
import type { ProxySettings } from './settings'

/** Domains routed through the proxy in "Google only" mode. */
export const PROXIED_SUFFIXES = [
  '.google',
  'google.com',
  'gstatic.com',
  'googleapis.com',
  'googleusercontent.com',
  'googlevideo.com',
  'ggpht.com',
  'youtube.com',
  'ytimg.com',
  'withgoogle.com',
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
]

export function proxyToken(p: Pick<ProxySettings, 'scheme' | 'host' | 'port'>): string {
  // PAC keyword: SOCKS5 host:port | PROXY host:port
  return `${p.scheme === 'socks5' ? 'SOCKS5' : 'PROXY'} ${p.host}:${p.port}`
}

export function isValidProxyHost(host: string): boolean {
  return /^[a-z0-9.-]{1,253}$/i.test(host) || /^\[[0-9a-f:]+\]$/i.test(host)
}

/** PAC script that proxies Google traffic (incl. country domains like google.ru) only. */
export function buildPac(p: Pick<ProxySettings, 'scheme' | 'host' | 'port'>): string {
  const token = proxyToken(p)
  const suffixes = JSON.stringify(PROXIED_SUFFIXES)
  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  var s = ${suffixes};
  for (var i = 0; i < s.length; i++) {
    var d = s[i];
    if (d.charAt(0) === '.') { if (host.slice(-d.length) === d) return '${token}'; }
    else if (host === d || host.slice(-(d.length + 1)) === '.' + d) return '${token}';
  }
  if (/(^|\\.)google\\.(com?\\.)?[a-z]{2,3}$/.test(host)) return '${token}';
  return 'DIRECT';
}`
}

export function pacDataUrl(pac: string): string {
  // Chromium accepts data: URLs for PAC scripts.
  const b64 = typeof Buffer !== 'undefined' ? Buffer.from(pac, 'utf8').toString('base64') : btoa(pac)
  return `data:application/x-ns-proxy-autoconfig;base64,${b64}`
}

export interface ElectronProxyConfig {
  mode: 'direct' | 'system' | 'fixed_servers' | 'pac_script'
  proxyRules?: string
  proxyBypassRules?: string
  pacScript?: string
}

export function electronProxyConfig(p: ProxySettings): ElectronProxyConfig {
  if (p.mode === 'direct') return { mode: 'direct' }
  if (p.mode === 'system' || !isValidProxyHost(p.host)) return { mode: 'system' }
  if (p.googleOnly) return { mode: 'pac_script', pacScript: pacDataUrl(buildPac(p)) }
  return {
    mode: 'fixed_servers',
    proxyRules: `${p.scheme === 'socks5' ? 'socks5' : 'http'}://${p.host}:${p.port}`,
    proxyBypassRules: '<local>',
  }
}
