// Tab hibernation policy (pure).

export interface SleepCandidate {
  id: string
  awake: boolean
  active: boolean
  audible: boolean
  lastActive: number
}

/** Upper bound of awake background tabs, regardless of the idle timer. */
export const MAX_AWAKE_BACKGROUND = 4

/**
 * Returns ids of tabs to put to sleep: background tabs idle longer than `sleepAfterMs`, plus the
 * least recently used ones beyond `maxAwake`. The active tab and tabs playing audio never sleep.
 */
export function pickTabsToSleep(
  tabs: SleepCandidate[],
  now: number,
  sleepAfterMs: number,
  maxAwake = MAX_AWAKE_BACKGROUND,
): string[] {
  const eligible = tabs.filter((t) => t.awake && !t.active && !t.audible)
  const out = new Set<string>()
  if (sleepAfterMs > 0) for (const t of eligible) if (now - t.lastActive >= sleepAfterMs) out.add(t.id)
  const stillAwake = eligible.filter((t) => !out.has(t.id)).sort((a, b) => b.lastActive - a.lastActive)
  for (const t of stillAwake.slice(maxAwake)) out.add(t.id)
  return [...out]
}

export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export function nextZoom(current: number, dir: 1 | -1 | 0): number {
  if (dir === 0) return 1
  if (dir > 0) return ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? ZOOM_STEPS[0]!
}
