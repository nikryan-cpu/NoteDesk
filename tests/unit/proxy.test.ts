import { describe, expect, it } from 'vitest'
import { buildPac, electronProxyConfig, isValidProxyHost, pacDataUrl, proxyToken } from '@shared/proxy'
import type { ProxySettings } from '@shared/settings'

const proxy = (over: Partial<ProxySettings> = {}): ProxySettings => ({
  mode: 'custom',
  scheme: 'socks5',
  host: '127.0.0.1',
  port: 1080,
  username: '',
  passwordEnc: '',
  googleOnly: true,
  ...over,
})

describe('proxyToken', () => {
  it('formats a SOCKS5 token', () => {
    expect(proxyToken({ scheme: 'socks5', host: '127.0.0.1', port: 1080 })).toBe('SOCKS5 127.0.0.1:1080')
  })

  it('formats an http PROXY token', () => {
    expect(proxyToken({ scheme: 'http', host: '1.2.3.4', port: 8080 })).toBe('PROXY 1.2.3.4:8080')
  })
})

describe('isValidProxyHost', () => {
  it('accepts hostnames and IPv4 addresses', () => {
    expect(isValidProxyHost('127.0.0.1')).toBe(true)
    expect(isValidProxyHost('my-proxy.example.com')).toBe(true)
  })

  it('accepts bracketed IPv6 addresses', () => {
    expect(isValidProxyHost('[::1]')).toBe(true)
  })

  it('rejects empty or invalid hosts', () => {
    expect(isValidProxyHost('')).toBe(false)
    expect(isValidProxyHost('evil<script>')).toBe(false)
    expect(isValidProxyHost('has spaces')).toBe(false)
  })
})

describe('buildPac', () => {
  function evalPac(p: Parameters<typeof buildPac>[0]) {
    const pac = buildPac(p)
    return new Function(`${pac}; return FindProxyForURL`)() as (url: string, host: string) => string
  }

  it('routes Google traffic through the proxy', () => {
    const findProxy = evalPac(proxy())
    const token = proxyToken(proxy())
    for (const host of ['notebook.google', 'gemini.google.com', 'www.google.ru', 'lh3.googleusercontent.com', 'fonts.gstatic.com', 'youtube.com']) {
      expect(findProxy(`https://${host}/`, host)).toBe(token)
    }
  })

  it('sends everything else DIRECT, including lookalike domains', () => {
    const findProxy = evalPac(proxy())
    for (const host of ['github.com', 'example.com', 'evilgoogle.com', 'google.com.evil.org']) {
      expect(findProxy(`https://${host}/`, host)).toBe('DIRECT')
    }
  })
})

describe('pacDataUrl', () => {
  it('round-trips the PAC text through base64', () => {
    const pac = buildPac(proxy())
    const url = pacDataUrl(pac)
    expect(url.startsWith('data:application/x-ns-proxy-autoconfig;base64,')).toBe(true)
    const b64 = url.slice(url.indexOf(',') + 1)
    const decoded = Buffer.from(b64, 'base64').toString('utf-8')
    expect(decoded).toBe(pac)
  })
})

describe('electronProxyConfig', () => {
  it('returns direct mode', () => {
    expect(electronProxyConfig(proxy({ mode: 'direct' }))).toEqual({ mode: 'direct' })
  })

  it('returns system mode', () => {
    expect(electronProxyConfig(proxy({ mode: 'system' }))).toEqual({ mode: 'system' })
  })

  it('returns a pac_script with a data url for custom + googleOnly', () => {
    const p = proxy({ mode: 'custom', googleOnly: true })
    const config = electronProxyConfig(p)
    expect(config.mode).toBe('pac_script')
    expect(config.pacScript).toBe(pacDataUrl(buildPac(p)))
  })

  it('returns fixed_servers for custom without googleOnly', () => {
    const socks = electronProxyConfig(proxy({ mode: 'custom', googleOnly: false, scheme: 'socks5' }))
    expect(socks).toEqual({ mode: 'fixed_servers', proxyRules: 'socks5://127.0.0.1:1080', proxyBypassRules: '<local>' })

    const http = electronProxyConfig(proxy({ mode: 'custom', googleOnly: false, scheme: 'http', host: '1.2.3.4', port: 8080 }))
    expect(http).toEqual({ mode: 'fixed_servers', proxyRules: 'http://1.2.3.4:8080', proxyBypassRules: '<local>' })
  })

  it('falls back to system mode for an invalid host', () => {
    const config = electronProxyConfig(proxy({ mode: 'custom', host: 'evil<script>' }))
    expect(config).toEqual({ mode: 'system' })
  })
})
