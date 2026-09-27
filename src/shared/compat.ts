// Browser-identity presets used to keep Google sign-in working inside Electron.
//
// Google refuses sign-in ("This browser or app may not be secure") when the browser's
// identity is inconsistent: a Chrome User-Agent string paired with client hints or a
// navigator.userAgentData that do not look like Chrome. The "chrome" preset therefore makes
// every surface agree with the Chromium build Electron actually ships: UA string,
// Sec-CH-UA request headers and navigator.userAgentData in page JavaScript.
// Pure functions only, so the logic can be unit-tested outside Electron.

export type CompatPreset = 'chrome' | 'firefox' | 'electron'

export const COMPAT_PRESETS: CompatPreset[] = ['chrome', 'firefox', 'electron']

export interface Brand {
  brand: string
  version: string
}

export interface CompatProfile {
  preset: CompatPreset
  userAgent: string | null
  /** Header overrides for Google requests; `null` value = remove the header. */
  headers: Record<string, string | null>
  /** Data for the main-world navigator.userAgentData patch, or null to leave it alone. */
  uaData: UaDataPatch | null
}

export interface UaDataPatch {
  /** When true, navigator.userAgentData is removed (Firefox has none). */
  remove: boolean
  brands: Brand[]
  fullVersionList: Brand[]
  fullVersion: string
  platform: string
  platformVersion: string
  architecture: string
  bitness: string
}

type Platform = 'win32' | 'darwin' | 'linux'

const GREASE_CHARS = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_']
const GREASE_VERSIONS = ['8', '99', '24']
const ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

/**
 * Port of Chromium's GenerateBrandVersionList (components/embedder_support/user_agent_utils.cc)
 * with the "updated GREASE" algorithm, seeded by the major version, e.g. Chrome 131 yields
 * `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`.
 */
export function chromeBrands(major: number, full = false, fullVersion = `${major}.0.0.0`): Brand[] {
  const order = ORDERS[major % 6]!
  const greaseBrand = `Not${GREASE_CHARS[major % GREASE_CHARS.length]}A${GREASE_CHARS[(major + 1) % GREASE_CHARS.length]}Brand`
  const greaseMajor = GREASE_VERSIONS[major % GREASE_VERSIONS.length]!
  const v = full ? fullVersion : String(major)
  const list: Brand[] = new Array(3)
  list[order[0]!] = { brand: greaseBrand, version: full ? `${greaseMajor}.0.0.0` : greaseMajor }
  list[order[1]!] = { brand: 'Chromium', version: v }
  list[order[2]!] = { brand: 'Google Chrome', version: v }
  return list
}

export function brandsHeader(brands: Brand[]): string {
  return brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ')
}

function osToken(platform: Platform): string {
  switch (platform) {
    case 'win32':
      return 'Windows NT 10.0; Win64; x64'
    case 'darwin':
      return 'Macintosh; Intel Mac OS X 10_15_7'
    default:
      return 'X11; Linux x86_64'
  }
}

function chPlatform(platform: Platform): string {
  return platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux'
}

/** Chrome's reduced User-Agent string (minor/build/patch frozen to 0). */
export function chromeUserAgent(platform: Platform, chromeVersion: string): string {
  const major = chromeVersion.split('.')[0]
  return `Mozilla/5.0 (${osToken(platform)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}

/** Firefox ESR-style UA; Firefox's version tracks Chromium's closely enough for a fallback. */
export function firefoxUserAgent(platform: Platform, chromeVersion: string): string {
  const ff = Math.max(128, Number(chromeVersion.split('.')[0]) - 1)
  const os =
    platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10.15'
        : 'X11; Linux x86_64'
  return `Mozilla/5.0 (${os}; rv:${ff}.0) Gecko/20100101 Firefox/${ff}.0`
}

const CH_HEADERS = [
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
]

export function buildCompatProfile(
  preset: CompatPreset,
  platform: Platform,
  chromeVersion: string,
  arch: string,
): CompatProfile {
  const major = Number(chromeVersion.split('.')[0])
  if (preset === 'electron') return { preset, userAgent: null, headers: {}, uaData: null }

  if (preset === 'firefox') {
    const headers: Record<string, string | null> = {}
    for (const h of CH_HEADERS) headers[h] = null
    return {
      preset,
      userAgent: firefoxUserAgent(platform, chromeVersion),
      headers,
      uaData: {
        remove: true,
        brands: [],
        fullVersionList: [],
        fullVersion: '',
        platform: '',
        platformVersion: '',
        architecture: '',
        bitness: '',
      },
    }
  }

  const brands = chromeBrands(major)
  const fullVersionList = chromeBrands(major, true, chromeVersion)
  const architecture = arch === 'arm64' ? 'arm' : 'x86'
  const bitness = arch === 'ia32' ? '32' : '64'
  return {
    preset,
    userAgent: chromeUserAgent(platform, chromeVersion),
    headers: {
      'sec-ch-ua': brandsHeader(brands),
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': `"${chPlatform(platform)}"`,
      // High-entropy hints are rewritten only when Chromium already decided to send them.
      'sec-ch-ua-full-version-list': brandsHeader(fullVersionList),
      'sec-ch-ua-full-version': `"${chromeVersion}"`,
    },
    uaData: {
      remove: false,
      brands,
      fullVersionList,
      fullVersion: chromeVersion,
      platform: chPlatform(platform),
      platformVersion: platform === 'win32' ? '19.0.0' : platform === 'darwin' ? '15.0.0' : '6.8.0',
      architecture,
      bitness,
    },
  }
}

/** Headers that must only be rewritten if the request already carries them. */
export const CONDITIONAL_HEADERS = new Set(['sec-ch-ua-full-version-list', 'sec-ch-ua-full-version'])

/**
 * Applies the profile's header overrides to a Chromium request-header object in place.
 * Header names in Chromium's map keep their original casing, so matching is case-insensitive.
 */
export function rewriteHeaders(headers: Record<string, string>, profile: CompatProfile): void {
  if (profile.preset === 'electron') return
  const present = new Map<string, string>()
  for (const key of Object.keys(headers)) present.set(key.toLowerCase(), key)
  if (profile.userAgent) {
    const k = present.get('user-agent') ?? 'User-Agent'
    headers[k] = profile.userAgent
  }
  for (const [name, value] of Object.entries(profile.headers)) {
    const existing = present.get(name)
    if (value === null) {
      if (existing) delete headers[existing]
      continue
    }
    if (CONDITIONAL_HEADERS.has(name) && !existing) continue
    if (!existing && !name.startsWith('sec-ch-ua')) continue
    headers[existing ?? name] = value
  }
}
