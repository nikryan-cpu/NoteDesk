import type { LayoutInsets, OsPlatform } from '@shared/ipc'
import type { PublicSettings } from '@shared/settings'
import { THEMES } from '@shared/themes'

export const FINDBAR_H = 44
export const SIDEBAR_W = 248
export const SIDEBAR_COLLAPSED_W = 64
export const GAP = 8

export function titlebarHeight(s: PublicSettings): number {
  if (s.tabLayout === 'vertical') return s.density === 'compact' ? 36 : 40
  return s.density === 'compact' ? 38 : 44
}

/** Space reserved on the right for native caption buttons (Windows/Linux window controls overlay). */
export function captionInset(platform: OsPlatform): number {
  return platform === 'darwin' ? 0 : 140
}

/** Space reserved on the left for macOS traffic lights. */
export function trafficInset(platform: OsPlatform): number {
  return platform === 'darwin' ? 78 : 0
}

export function sidebarWidth(s: PublicSettings): number {
  return s.sidebarCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W
}

export function computeInsets(s: PublicSettings, findOpen: boolean): LayoutInsets {
  const tb = titlebarHeight(s)
  const def = THEMES[s.theme]
  const gap = s.floatingContent ? GAP : 0
  const find = findOpen ? FINDBAR_H : 0
  const radius = s.floatingContent ? Math.min(def.radiusLg, 14) : 0
  if (s.tabLayout === 'vertical') {
    return { top: tb + find, left: sidebarWidth(s), right: gap, bottom: gap, radius, titlebar: tb }
  }
  // Card-style tabs connect straight into the content card, others float slightly below.
  const topGap = s.floatingContent ? (def.tabStyle === 'card' ? 0 : 4) : 0
  return { top: tb + find + topGap, left: gap, right: gap, bottom: gap, radius, titlebar: tb }
}
