import { describe, expect, it } from 'vitest'
import {
  brandsHeader,
  buildCompatProfile,
  chromeBrands,
  chromeUserAgent,
  firefoxUserAgent,
  rewriteHeaders,
} from '@shared/compat'

describe('chromeBrands', () => {
  it('matches the real Chrome 131 brand list', () => {
    expect(brandsHeader(chromeBrands(131))).toBe(
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    )
  })

  it('always has exactly one GREASE brand plus Chromium and Google Chrome', () => {
    for (const major of [100, 115, 120, 128, 140, 999]) {
      const brands = chromeBrands(major)
      expect(brands).toHaveLength(3)
      expect(brands.some((b) => b.brand === 'Chromium')).toBe(true)
      expect(brands.some((b) => b.brand === 'Google Chrome')).toBe(true)
      const grease = brands.filter((b) => b.brand !== 'Chromium' && b.brand !== 'Google Chrome')
      expect(grease).toHaveLength(1)
      expect(grease[0]!.brand).toMatch(/^Not.A.Brand$/)
    }
  })

  it('is deterministic for a given major version', () => {
    expect(chromeBrands(140)).toEqual(chromeBrands(140))
    expect(brandsHeader(chromeBrands(140))).toBe(brandsHeader(chromeBrands(140)))
  })

  it('produces full version strings with a GREASE version in x.0.0.0 form when full=true', () => {
    const brands = chromeBrands(152, true, '152.0.7444.60')
    const grease = brands.find((b) => b.brand !== 'Chromium' && b.brand !== 'Google Chrome')!
    const chromium = brands.find((b) => b.brand === 'Chromium')!
    const chrome = brands.find((b) => b.brand === 'Google Chrome')!
    expect(chromium.version).toBe('152.0.7444.60')
    expect(chrome.version).toBe('152.0.7444.60')
    expect(grease.version).toMatch(/^\d+\.0\.0\.0$/)
  })
})

describe('chromeUserAgent', () => {
  it('builds the reduced UA for win32', () => {
    expect(chromeUserAgent('win32', '131.0.6778.86')).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    )
  })

  it('builds the reduced UA for darwin', () => {
    expect(chromeUserAgent('darwin', '131.0.6778.86')).toBe(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    )
  })

  it('builds the reduced UA for linux', () => {
    expect(chromeUserAgent('linux', '131.0.6778.86')).toBe(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    )
  })
})

describe('firefoxUserAgent', () => {
  it('has the expected shape and tracks a version just below Chrome', () => {
    const ua = firefoxUserAgent('win32', '131.0.6778.86')
    expect(ua).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0')
  })

  it('never drops below Firefox 128', () => {
    const ua = firefoxUserAgent('linux', '100.0.0.0')
    expect(ua).toContain('rv:128.0')
    expect(ua).toContain('Firefox/128.0')
  })

  it('uses macOS-style os token without underscores', () => {
    const ua = firefoxUserAgent('darwin', '131.0.0.0')
    expect(ua).toContain('Macintosh; Intel Mac OS X 10.15')
  })
})

describe('buildCompatProfile', () => {
  it('chrome preset fills sec-ch-ua headers and matches platform token', () => {
    const win = buildCompatProfile('chrome', 'win32', '131.0.6778.86', 'x64')
    expect(win.headers['sec-ch-ua']).toBe(brandsHeader(chromeBrands(131)))
    expect(win.headers['sec-ch-ua-mobile']).toBe('?0')
    expect(win.headers['sec-ch-ua-platform']).toBe('"Windows"')

    const mac = buildCompatProfile('chrome', 'darwin', '131.0.6778.86', 'x64')
    expect(mac.headers['sec-ch-ua-platform']).toBe('"macOS"')

    const linux = buildCompatProfile('chrome', 'linux', '131.0.6778.86', 'x64')
    expect(linux.headers['sec-ch-ua-platform']).toBe('"Linux"')
  })

  it('maps architecture/bitness per arch', () => {
    const x64 = buildCompatProfile('chrome', 'win32', '131.0.0.0', 'x64')
    expect(x64.uaData!.architecture).toBe('x86')
    expect(x64.uaData!.bitness).toBe('64')

    const arm64 = buildCompatProfile('chrome', 'darwin', '131.0.0.0', 'arm64')
    expect(arm64.uaData!.architecture).toBe('arm')
    expect(arm64.uaData!.bitness).toBe('64')

    const ia32 = buildCompatProfile('chrome', 'win32', '131.0.0.0', 'ia32')
    expect(ia32.uaData!.architecture).toBe('x86')
    expect(ia32.uaData!.bitness).toBe('32')
  })

  it('electron preset is a no-op', () => {
    const profile = buildCompatProfile('electron', 'win32', '131.0.0.0', 'x64')
    expect(profile).toEqual({ preset: 'electron', userAgent: null, headers: {}, uaData: null })
  })

  it('firefox preset removes all client-hint headers and marks uaData for removal', () => {
    const profile = buildCompatProfile('firefox', 'win32', '131.0.0.0', 'x64')
    expect(profile.userAgent).toBe(firefoxUserAgent('win32', '131.0.0.0'))
    expect(profile.uaData!.remove).toBe(true)
    for (const h of [
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'sec-ch-ua-platform-version',
      'sec-ch-ua-full-version',
      'sec-ch-ua-full-version-list',
      'sec-ch-ua-arch',
      'sec-ch-ua-bitness',
      'sec-ch-ua-model',
      'sec-ch-ua-wow64',
    ]) {
      expect(profile.headers[h]).toBeNull()
    }
  })
})

describe('rewriteHeaders', () => {
  it('replaces User-Agent and overwrites Sec-CH-UA, keeping original casing', () => {
    const headers: Record<string, string> = { 'User-Agent': 'old-ua', 'Sec-CH-UA': 'old-brands' }
    const profile = buildCompatProfile('chrome', 'win32', '131.0.6778.86', 'x64')
    rewriteHeaders(headers, profile)
    expect(headers['User-Agent']).toBe(profile.userAgent)
    expect(headers['Sec-CH-UA']).toBe(profile.headers['sec-ch-ua'])
    expect(Object.keys(headers)).toContain('Sec-CH-UA')
    expect(Object.keys(headers)).not.toContain('sec-ch-ua')
  })

  it('matches header names case-insensitively', () => {
    const headers: Record<string, string> = { 'sec-ch-ua-mobile': '?1' }
    const profile = buildCompatProfile('chrome', 'win32', '131.0.6778.86', 'x64')
    rewriteHeaders(headers, profile)
    expect(headers['sec-ch-ua-mobile']).toBe('?0')
  })

  it('adds sec-ch-ua* headers when missing, but not absent conditional headers', () => {
    const headers: Record<string, string> = {}
    const profile = buildCompatProfile('chrome', 'win32', '131.0.6778.86', 'x64')
    rewriteHeaders(headers, profile)
    expect(headers['sec-ch-ua']).toBe(profile.headers['sec-ch-ua'])
    expect(headers['sec-ch-ua-mobile']).toBe('?0')
    expect(headers['sec-ch-ua-platform']).toBe('"Windows"')
    expect(headers['sec-ch-ua-full-version-list']).toBeUndefined()
    expect(headers['sec-ch-ua-full-version']).toBeUndefined()
  })

  it('rewrites conditional headers when the request already carries them', () => {
    const headers: Record<string, string> = {
      'sec-ch-ua-full-version-list': 'stale',
      'sec-ch-ua-full-version': 'stale',
    }
    const profile = buildCompatProfile('chrome', 'win32', '131.0.6778.86', 'x64')
    rewriteHeaders(headers, profile)
    expect(headers['sec-ch-ua-full-version-list']).toBe(profile.headers['sec-ch-ua-full-version-list'])
    expect(headers['sec-ch-ua-full-version']).toBe(profile.headers['sec-ch-ua-full-version'])
  })

  it('firefox preset deletes client-hint headers and replaces the User-Agent', () => {
    const headers: Record<string, string> = {
      'Sec-CH-UA': 'x',
      'sec-ch-ua-mobile': 'y',
      'User-Agent': 'z',
      'Other-Header': 'w',
    }
    const profile = buildCompatProfile('firefox', 'win32', '131.0.0.0', 'x64')
    rewriteHeaders(headers, profile)
    expect(headers['Sec-CH-UA']).toBeUndefined()
    expect(headers['sec-ch-ua-mobile']).toBeUndefined()
    expect(headers['User-Agent']).toBe(profile.userAgent)
    expect(headers['Other-Header']).toBe('w')
  })

  it('electron preset leaves headers untouched', () => {
    const headers: Record<string, string> = { 'User-Agent': 'unchanged', 'Sec-CH-UA': 'unchanged' }
    const profile = buildCompatProfile('electron', 'win32', '131.0.0.0', 'x64')
    rewriteHeaders(headers, profile)
    expect(headers).toEqual({ 'User-Agent': 'unchanged', 'Sec-CH-UA': 'unchanged' })
  })
})
