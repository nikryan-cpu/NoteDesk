import { describe, expect, it } from 'vitest'
import { cleanTitle, formatBytes, fuzzyMatch } from '@shared/text'

describe('cleanTitle', () => {
  it('strips the " - Gemini Notebook" suffix', () => {
    expect(cleanTitle('Physics 101 - Gemini Notebook')).toBe('Physics 101')
  })

  it('strips the " – NotebookLM" suffix', () => {
    expect(cleanTitle('My Chat – NotebookLM')).toBe('My Chat')
  })

  it('strips the " | Google Gemini" suffix', () => {
    expect(cleanTitle('Something | Google Gemini')).toBe('Something')
  })

  it('strips the suffix case-insensitively', () => {
    expect(cleanTitle('Something - gemini notebook')).toBe('Something')
  })

  it('keeps a plain title with no suffix untouched', () => {
    expect(cleanTitle('Plain Title')).toBe('Plain Title')
  })

  it('falls back to the raw trimmed title when stripping would leave nothing', () => {
    expect(cleanTitle('- Gemini Notebook')).toBe('- Gemini Notebook')
  })
})

describe('fuzzyMatch', () => {
  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyMatch('xyz', 'abc')).toBeNull()
  })

  it('scores an empty query as 0 with no hits', () => {
    expect(fuzzyMatch('', 'abc')).toEqual({ score: 0, hits: [] })
    expect(fuzzyMatch('   ', 'abc')).toEqual({ score: 0, hits: [] })
  })

  it('scores a contiguous prefix match higher than a scattered match', () => {
    const prefix = fuzzyMatch('Phy', 'Physics Notes')!
    const scattered = fuzzyMatch('Pcs', 'Physics Notes')!
    expect(prefix).not.toBeNull()
    expect(scattered).not.toBeNull()
    expect(prefix.score).toBeGreaterThan(scattered.score)
  })

  it('scores a word-start match higher than a mid-word match of the same length', () => {
    const wordStart = fuzzyMatch('Notes', 'Physics Notes')!
    const midWord = fuzzyMatch('ysics', 'Physics Notes')!
    expect(wordStart.score).toBeGreaterThan(midWord.score)
  })

  it('reports correct hit indices for highlighting, case-insensitively', () => {
    const result = fuzzyMatch('abc', 'xAbCx')!
    expect(result.hits).toEqual([1, 2, 3])
  })

  it('reports correct hit indices for a scattered subsequence', () => {
    const result = fuzzyMatch('ac', 'abc')!
    expect(result.hits).toEqual([0, 2])
  })
})

describe('formatBytes', () => {
  it('formats zero and invalid input as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
    expect(formatBytes(Infinity)).toBe('0 B')
  })

  it('formats bytes below 1 KB as whole numbers', () => {
    expect(formatBytes(100)).toBe('100 B')
  })

  it('formats kilobytes with one decimal below 10', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats values 10 and above as whole numbers', () => {
    expect(formatBytes(15 * 1024)).toBe('15 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })
})
