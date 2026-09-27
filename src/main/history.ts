// "Recent" list for the command palette: notebooks and Gemini chats the user actually opened,
// captured from navigation events (no scraping of Google's pages).
import type { HistoryEntry } from '@shared/ipc'
import { historyKey, historyKindForUrl } from '@shared/services'
import { cleanTitle } from '@shared/text'
import { readJson, writeJson } from './store'

const MAX = 300
let entries: HistoryEntry[] = []

export function loadHistory(): void {
  const raw = readJson<unknown>('history', [])
  entries = Array.isArray(raw) ? (raw as HistoryEntry[]).filter((e) => e && typeof e.url === 'string').slice(0, MAX) : []
}

function persist(): void {
  writeJson('history', () => entries, 1500)
}

export function recordVisit(url: string, title: string, profileId: string): void {
  const kind = historyKindForUrl(url)
  if (!kind) return
  const key = historyKey(url)
  const existing = entries.find((e) => e.key === key)
  const clean = cleanTitle(title)
  if (existing) {
    existing.lastVisited = Date.now()
    existing.visits++
    existing.url = url
    existing.profileId = profileId
    if (clean && !isPlaceholderTitle(clean)) existing.title = clean
  } else {
    entries.unshift({ key, url, title: isPlaceholderTitle(clean) ? '' : clean, kind, profileId, lastVisited: Date.now(), visits: 1 })
    if (entries.length > MAX) entries.length = MAX
  }
  persist()
}

/** Titles update after navigation; attach them to the matching entry. */
export function updateTitle(url: string, title: string): void {
  const key = historyKey(url)
  const e = entries.find((x) => x.key === key)
  const clean = cleanTitle(title)
  if (e && clean && !isPlaceholderTitle(clean) && e.title !== clean) {
    e.title = clean
    persist()
  }
}

function isPlaceholderTitle(title: string): boolean {
  return /^(gemini notebook|notebooklm|gemini|google gemini|claude|chatgpt|deepseek|qwen|new chat)$/i.test(title)
}

export function listHistory(): HistoryEntry[] {
  return [...entries].sort((a, b) => b.lastVisited - a.lastVisited)
}

export function removeHistory(key: string): void {
  entries = entries.filter((e) => e.key !== key)
  persist()
}

export function clearHistory(): void {
  entries = []
  persist()
}

export function clearHistoryForProfile(profileId: string): void {
  entries = entries.filter((e) => e.profileId !== profileId)
  persist()
}
