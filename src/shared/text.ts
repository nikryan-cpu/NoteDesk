// Small pure text helpers shared by main and renderer.

const TITLE_SUFFIX = /\s*[-–—|·]\s*(?:Gemini Notebook|NotebookLM|Google Gemini|Gemini)\s*$/i

/** "Physics 101 – Gemini Notebook" → "Physics 101". Falls back to the raw title. */
export function cleanTitle(title: string): string {
  const t = title.replace(TITLE_SUFFIX, '').trim()
  return t || title.trim()
}

export interface FuzzyResult {
  score: number
  /** Indices of matched characters, for highlighting. */
  hits: number[]
}

/**
 * Subsequence fuzzy matcher tuned for short labels: rewards consecutive runs, word starts
 * and prefix matches. Returns null when `query` is not a subsequence of `text`.
 */
export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.trim().toLowerCase()
  if (!q) return { score: 0, hits: [] }
  const s = text.toLowerCase()
  const direct = s.indexOf(q)
  if (direct >= 0) {
    const hits = Array.from({ length: q.length }, (_, i) => direct + i)
    const wordStart = direct === 0 || /[\s\-_/.(]/.test(s[direct - 1] ?? '')
    return { score: 1000 - direct * 2 + (wordStart ? 200 : 0) - s.length * 0.1, hits }
  }
  const hits: number[] = []
  let score = 0
  let run = 0
  let qi = 0
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      hits.push(i)
      run++
      score += 10 + run * 5
      if (i === 0 || /[\s\-_/.(]/.test(s[i - 1] ?? '')) score += 25
      qi++
    } else {
      run = 0
    }
  }
  if (qi < q.length) return null
  return { score: score - (hits[0] ?? 0) - s.length * 0.2, hits }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}
