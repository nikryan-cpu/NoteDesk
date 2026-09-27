// Tiny JSON persistence: synchronous read at startup, debounced atomic writes afterwards.
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pending = new Map<string, { timer: NodeJS.Timeout; data: () => unknown }>()

function fileFor(name: string): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, `${name}.json`)
}

export function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(fileFor(name), 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeNow(name: string, data: unknown): void {
  const file = fileFor(name)
  const tmp = `${file}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    renameSync(tmp, file)
  } catch (err) {
    console.error(`[store] failed to write ${name}:`, err)
  }
}

/** Schedules a write; `data` is evaluated when the write happens so bursts coalesce. */
export function writeJson(name: string, data: () => unknown, delayMs = 400): void {
  const existing = pending.get(name)
  if (existing) clearTimeout(existing.timer)
  const timer = setTimeout(() => {
    pending.delete(name)
    writeNow(name, data())
  }, delayMs)
  pending.set(name, { timer, data })
}

/** Flushes all scheduled writes synchronously (called on quit). */
export function flushAll(): void {
  for (const [name, { timer, data }] of pending) {
    clearTimeout(timer)
    writeNow(name, data())
  }
  pending.clear()
}
