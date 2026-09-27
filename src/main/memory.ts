// Memory report for the status indicator and the memory panel.
import { app } from 'electron'
import type { MemoryReport } from '@shared/ipc'
import type { TabManager } from './tabs'

const toMB = (kb: number) => Math.round(kb / 1024)

/** Private memory where the OS reports it (Windows), otherwise the working set. */
function footprintKB(m: Electron.ProcessMetric): number {
  return m.memory.privateBytes ?? m.memory.workingSetSize
}

export function memoryReport(tabs: TabManager, shellPid: number | null): MemoryReport {
  const metrics = app.getAppMetrics()
  const byPid = new Map(metrics.map((m) => [m.pid, m]))
  const tabPids = new Map<number, string[]>()
  const report: MemoryReport = { totalMB: 0, shellMB: 0, browserMB: 0, gpuMB: 0, otherMB: 0, tabs: [], sleepingTabs: 0 }

  for (const t of tabs.all()) {
    const wc = t.view?.webContents
    if (!wc || wc.isDestroyed()) {
      report.sleepingTabs++
      report.tabs.push({ id: t.id, mb: null })
      continue
    }
    const pid = wc.getOSProcessId()
    tabPids.set(pid, [...(tabPids.get(pid) ?? []), t.id])
  }

  for (const [pid, ids] of tabPids) {
    const m = byPid.get(pid)
    const kb = m ? footprintKB(m) : 0
    // Tabs of the same site can share one renderer; split its memory evenly.
    for (const id of ids) report.tabs.push({ id, mb: toMB(kb / ids.length) })
  }

  let totalKB = 0
  for (const m of metrics) {
    const kb = footprintKB(m)
    totalKB += kb
    if (tabPids.has(m.pid)) continue
    if (m.pid === shellPid) report.shellMB += toMB(kb)
    else if (m.type === 'Browser') report.browserMB += toMB(kb)
    else if (m.type === 'GPU') report.gpuMB += toMB(kb)
    else report.otherMB += toMB(kb)
  }
  report.totalMB = toMB(totalKB)
  return report
}
