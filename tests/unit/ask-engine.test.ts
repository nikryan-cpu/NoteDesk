// classifyNotice is a plain function with no Electron calls at import time (same trick
// ask-adapters.test.ts relies on for adapters.ts) - safe to import directly under plain Vitest.
import { describe, expect, it } from 'vitest'
import { classifyNotice } from '../../src/main/ask/engine'

describe('classifyNotice', () => {
  it('is null for empty or blank text', () => {
    expect(classifyNotice('')).toBe(null)
    expect(classifyNotice('   ')).toBe(null)
  })

  it('reads a usage-limit style message as limited', () => {
    expect(classifyNotice("You've reached your message limit. Try again after 5 PM.")).toBe('limited')
    expect(classifyNotice('You have hit your daily quota.')).toBe('limited')
    expect(classifyNotice('Rate limit exceeded, please slow down.')).toBe('limited')
  })

  it('reads "the server is busy" / "over capacity" as limited', () => {
    expect(classifyNotice('The server is busy. Please try again later.')).toBe('limited')
    expect(classifyNotice('We are at capacity right now.')).toBe('limited')
  })

  it('reads Russian and Chinese limit wording as limited', () => {
    expect(classifyNotice('Превышен лимит сообщений.')).toBe('limited')
    expect(classifyNotice('服务器繁忙，请稍后再试')).toBe('limited')
  })

  it('reads an unrelated failure as a plain error', () => {
    expect(classifyNotice('Something went wrong. Please refresh the page.')).toBe('error')
    expect(classifyNotice('A network error occurred.')).toBe('error')
    expect(classifyNotice('Something went wrong while generating the response.')).toBe('error')
    expect(classifyNotice('Too many requests. Try again in a minute.')).toBe('limited')
  })
})
