import { describe, expect, it } from 'vitest'
import { promptWithContext, type AskConversation, type AskTurn } from '@shared/ask'
import type { ModelId } from '@shared/services'

const names: Record<ModelId, string> = { gemini: 'Gemini', claude: 'Claude', chatgpt: 'ChatGPT', deepseek: 'DeepSeek', qwen: 'Qwen' }
const labels = { header: 'Earlier:', user: 'Me', footer: 'Now:' }

function turn(id: string, prompt: string, answers: [ModelId, string][]): AskTurn {
  return {
    id,
    prompt,
    createdAt: 0,
    answers: answers.map(([model, markdown]) => ({ model, status: 'done', markdown, startedAt: 0 })),
  }
}

function conv(turns: AskTurn[]): AskConversation {
  return { id: 'c', title: 't', createdAt: 0, updatedAt: 0, pinned: false, models: ['gemini'], threads: {}, turns }
}

describe('promptWithContext', () => {
  it('leaves the prompt alone when the model saw every turn', () => {
    const c = conv([turn('1', 'first', [['gemini', 'a1']]), turn('2', 'second', [])])
    expect(promptWithContext(c, '2', 'gemini', names, labels)).toBe('second')
  })

  it('quotes turns answered by other models for a model that joins later', () => {
    const c = conv([turn('1', 'first', [['gemini', 'a1']]), turn('2', 'second', [['gemini', 'a2']]), turn('3', 'third', [])])
    const text = promptWithContext(c, '3', 'claude', names, labels)
    expect(text).toBe('Earlier:\n\nMe: first\n\nGemini: a1\n\n---\n\nMe: second\n\nGemini: a2\n\nNow:\n\nthird')
  })

  it('only quotes what the model missed since it last answered', () => {
    const c = conv([
      turn('1', 'first', [['claude', 'c1'], ['gemini', 'g1']]),
      turn('2', 'second', [['gemini', 'g2']]),
      turn('3', 'third', []),
    ])
    const text = promptWithContext(c, '3', 'claude', names, labels)
    expect(text).toContain('Me: second\n\nGemini: g2')
    expect(text).not.toContain('first')
  })

  it('skips turns without a finished answer and keeps the newest turns when too long', () => {
    const long = 'x'.repeat(3000)
    const c = conv([
      turn('1', 'one', [['gemini', long]]),
      turn('2', 'two', [['gemini', long]]),
      { ...turn('3', 'three', [['gemini', '']]), answers: [{ model: 'gemini', status: 'error', markdown: '', startedAt: 0 }] },
      turn('4', 'four', [['gemini', long]]),
      turn('5', 'five', []),
    ])
    const text = promptWithContext(c, '5', 'claude', names, labels, 7000)
    expect(text).not.toContain('Me: one')
    expect(text).not.toContain('three')
    expect(text).toContain('Me: two')
    expect(text).toContain('Me: four')
    expect(text.endsWith('Now:\n\nfive')).toBe(true)
  })

  it('clips very long answers', () => {
    const c = conv([turn('1', 'one', [['gemini', 'y'.repeat(5000)]]), turn('2', 'two', [])])
    const text = promptWithContext(c, '2', 'claude', names, labels)
    expect(text).toContain(`Gemini: ${'y'.repeat(4000)}…`)
  })
})
