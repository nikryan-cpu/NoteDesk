import { describe, expect, it } from 'vitest'
import { MAX_AWAKE_BACKGROUND, nextZoom, pickTabsToSleep, ZOOM_STEPS, type SleepCandidate } from '@shared/sleep'

const tab = (over: Partial<SleepCandidate> & { id: string }): SleepCandidate => ({
  awake: true,
  active: false,
  audible: false,
  lastActive: 0,
  ...over,
})

describe('pickTabsToSleep', () => {
  it('never sleeps the active tab, even if idle a long time', () => {
    const tabs = [tab({ id: 'a', active: true, lastActive: 0 })]
    expect(pickTabsToSleep(tabs, 100_000, 1000)).toEqual([])
  })

  it('never sleeps a tab playing audio', () => {
    const tabs = [tab({ id: 'a', audible: true, lastActive: 0 })]
    expect(pickTabsToSleep(tabs, 100_000, 1000)).toEqual([])
  })

  it('sleeps background tabs idle past the timer', () => {
    const tabs = [tab({ id: 'a', lastActive: 0 }), tab({ id: 'b', lastActive: 9000 })]
    const result = pickTabsToSleep(tabs, 10_000, 5000)
    expect(result).toContain('a')
    expect(result).not.toContain('b')
  })

  it('ignores tabs that are already asleep', () => {
    const tabs = [tab({ id: 'a', awake: false, lastActive: 0 })]
    expect(pickTabsToSleep(tabs, 100_000, 1000)).toEqual([])
  })

  it('disables the idle timer at 0 but still enforces the max-awake cap by least-recently-used', () => {
    const tabs = [
      tab({ id: 'a', lastActive: 500 }),
      tab({ id: 'b', lastActive: 400 }),
      tab({ id: 'c', lastActive: 300 }),
      tab({ id: 'd', lastActive: 200 }),
      tab({ id: 'e', lastActive: 100 }),
    ]
    const result = pickTabsToSleep(tabs, 1000, 0, 4)
    // 5 eligible tabs, cap is 4: the single least-recently-used one goes to sleep.
    expect(result).toEqual(['e'])
  })

  it('uses MAX_AWAKE_BACKGROUND as the default cap', () => {
    const tabs = Array.from({ length: MAX_AWAKE_BACKGROUND + 2 }, (_, i) =>
      tab({ id: `t${i}`, lastActive: i }),
    )
    const result = pickTabsToSleep(tabs, 1_000_000, 0)
    expect(result).toHaveLength(2)
    expect(new Set(result)).toEqual(new Set(['t0', 't1']))
  })
})

describe('nextZoom', () => {
  it('steps up to the next larger value', () => {
    expect(nextZoom(1, 1)).toBe(1.1)
    expect(nextZoom(0.9, 1)).toBe(1)
  })

  it('steps down to the next smaller value', () => {
    expect(nextZoom(1, -1)).toBe(0.9)
    expect(nextZoom(1.1, -1)).toBe(1)
  })

  it('resets to 1', () => {
    expect(nextZoom(2.5, 0)).toBe(1)
  })

  it('clamps at the top of the range', () => {
    expect(nextZoom(ZOOM_STEPS[ZOOM_STEPS.length - 1]!, 1)).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]!)
  })

  it('clamps at the bottom of the range', () => {
    expect(nextZoom(ZOOM_STEPS[0]!, -1)).toBe(ZOOM_STEPS[0]!)
  })
})
