import type { OsPlatform } from '@shared/ipc'
import type { PublicSettings } from '@shared/settings'
import { readableOn, themeTokens, THEMES, type ThemeTokens } from '@shared/themes'

const VAR: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  bgImage: '--bg-image',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  text: '--text',
  text2: '--text-2',
  text3: '--text-3',
  accent: '--accent',
  accentText: '--accent-text',
  tabActive: '--tab-active',
  tabActiveText: '--tab-active-text',
  tabHover: '--tab-hover',
  scrim: '--scrim',
  shadow: '--shadow',
  contentShadow: '--content-shadow',
  danger: '--danger',
  success: '--success',
  warning: '--warning',
}

export function usesMaterial(s: PublicSettings, platform: OsPlatform, supported: boolean): boolean {
  if (!supported) return false
  const m = THEMES[s.theme].material
  return platform === 'darwin' ? m.mac !== null : platform === 'win32' ? m.win !== 'none' : false
}

export function applyTheme(el: HTMLElement, s: PublicSettings, dark: boolean, platform: OsPlatform, materialSupported: boolean): void {
  const def = THEMES[s.theme]
  const tokens = themeTokens(s.theme, dark)
  const style = el.style
  for (const key of Object.keys(VAR) as (keyof ThemeTokens)[]) {
    style.setProperty(VAR[key], tokens[key] ?? 'none')
  }
  if (s.accent) {
    style.setProperty('--accent', s.accent)
    style.setProperty('--accent-text', readableOn(s.accent))
  }
  style.setProperty('--radius', `${def.radius}px`)
  style.setProperty('--radius-lg', `${def.radiusLg}px`)
  style.setProperty('--border-w', `${def.borderWidth}px`)
  style.setProperty('--blur', `${def.blur}px`)
  style.setProperty('--font', def.font)
  style.setProperty('--font-heading', def.headingFont ?? def.font)

  const d = el.dataset
  d.theme = s.theme
  d.tabStyle = def.tabStyle
  d.surface = def.surfaceStyle
  d.dark = String(dark)
  d.density = s.density
  d.layout = s.tabLayout
  d.platform = platform
  d.material = String(usesMaterial(s, platform, materialSupported))
  d.motion = s.reduceMotion ? 'reduce' : 'full'
  d.floating = String(s.floatingContent)
  el.style.colorScheme = dark ? 'dark' : 'light'
}
