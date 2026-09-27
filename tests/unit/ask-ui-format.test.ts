// Pure formatting helpers used by the Ask composer and answer cards.
import { describe, expect, it } from 'vitest'
import { formatOptionsLine, modelButtonLabel } from '@shared/askFormat'
import type { ModelCapabilities, ModelOptions } from '@shared/ask'

const morePart = (n: number): string => `+ ${n}`

describe('modelButtonLabel', () => {
  it('is empty with no models selected', () => {
    expect(modelButtonLabel([], morePart)).toBe('')
  })

  it('is just the name with one model selected', () => {
    expect(modelButtonLabel(['gemini'], morePart)).toBe('Gemini')
    expect(modelButtonLabel(['claude'], morePart)).toBe('Claude')
  })

  it('appends the extra count when comparing several', () => {
    expect(modelButtonLabel(['gemini', 'claude'], morePart)).toBe('Gemini + 1')
    expect(modelButtonLabel(['gemini', 'claude', 'chatgpt', 'qwen'], morePart)).toBe('Gemini + 3')
  })
})

const caps: ModelCapabilities = {
  variants: [
    { id: 'opus', label: 'Opus' },
    { id: 'instant', label: 'Instant' },
  ],
  thinking: true,
  search: true,
}

const labels = { thinking: 'Thinking', search: 'Search' }

describe('formatOptionsLine', () => {
  it('is empty when there are no options', () => {
    expect(formatOptionsLine(undefined, caps, labels)).toBe('')
  })

  it('is empty when nothing non-default is set', () => {
    const options: ModelOptions = { variant: '', thinking: false, search: false }
    expect(formatOptionsLine(options, caps, labels)).toBe('')
  })

  it('joins the variant label, thinking and search with a middot', () => {
    const options: ModelOptions = { variant: 'opus', thinking: true, search: true }
    expect(formatOptionsLine(options, caps, labels)).toBe('Opus · Thinking · Search')
  })

  it('falls back to the raw variant id when capabilities are missing it', () => {
    const options: ModelOptions = { variant: 'unknown-variant', thinking: false, search: false }
    expect(formatOptionsLine(options, caps, labels)).toBe('unknown-variant')
  })

  it('works without capabilities at all', () => {
    const options: ModelOptions = { variant: '', thinking: true, search: false }
    expect(formatOptionsLine(options, undefined, labels)).toBe('Thinking')
  })
})
