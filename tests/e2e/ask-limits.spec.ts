import { expect, test } from '@playwright/test'
import { launch, type Running } from './app'

// The fake chat page (tests/fixtures/fake-chat.html) treats "#limit" and "#busy" anywhere in the
// prompt as a service-side notice instead of an answer: a role="alert" banner near the composer
// for #limit, a toast for #busy. These drive the engine straight through the shell's IPC bridge
// rather than the Ask window UI, since that window is owned by another part of this change.

let run: Running

test.afterEach(async () => {
  await run?.app.close()
})

interface AskAnswerLike {
  status: string
  error?: string
  markdown: string
}

interface AskConversationLike {
  turns: Array<{ answers: AskAnswerLike[] }>
}

interface ModelStatusLike {
  id: string
  state: string
  detail?: string
}

async function invoke<T>(run: Running, channel: string, ...args: unknown[]): Promise<T> {
  const result = await run.shell.evaluate(
    ({ channel, args }) => {
      const nd = (window as unknown as { nd: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).nd
      return nd.invoke(channel, ...args)
    },
    { channel, args },
  )
  return result as T
}

async function send(run: Running, prompt: string): Promise<string> {
  const result = await invoke<{ conversationId: string; turnId: string }>(run, 'ask:send', {
    conversationId: null,
    prompt,
    models: ['gemini'],
  })
  return result.conversationId
}

async function firstAnswer(run: Running, conversationId: string): Promise<AskAnswerLike | undefined> {
  const conv = await invoke<AskConversationLike | null>(run, 'ask:get', conversationId)
  return conv?.turns[0]?.answers[0]
}

async function waitForAnswerStatus(run: Running, conversationId: string, status: string): Promise<AskAnswerLike> {
  let last: AskAnswerLike | undefined
  await expect
    .poll(
      async () => {
        last = await firstAnswer(run, conversationId)
        return last?.status ?? null
      },
      { timeout: 20_000 },
    )
    .toBe(status)
  return last!
}

async function modelState(run: Running, id: string): Promise<ModelStatusLike | undefined> {
  const statuses = await invoke<ModelStatusLike[]>(run, 'ask:models')
  return statuses.find((s) => s.id === id)
}

test('a usage-limit notice ends the answer as limited, with the service own words', async () => {
  run = await launch()
  const conversationId = await send(run, 'hi #limit')

  const answer = await waitForAnswerStatus(run, conversationId, 'limited')
  expect(answer.error).toContain('message limit')
  expect(answer.markdown).toBe('')

  const gemini = await modelState(run, 'gemini')
  expect(gemini?.state).toBe('limited')
  expect(gemini?.detail).toContain('message limit')
})

test('a "server is busy" toast is reported as limited too', async () => {
  run = await launch()
  const conversationId = await send(run, 'hi #busy')

  const answer = await waitForAnswerStatus(run, conversationId, 'limited')
  expect(answer.error).toContain('busy')

  const gemini = await modelState(run, 'gemini')
  expect(gemini?.state).toBe('limited')
})

test('a model recovers to ready after its next answer goes through', async () => {
  run = await launch()
  const limitedConversation = await send(run, 'hi #limit')
  await waitForAnswerStatus(run, limitedConversation, 'limited')
  expect((await modelState(run, 'gemini'))?.state).toBe('limited')

  const okConversation = await send(run, 'a perfectly normal question')
  await waitForAnswerStatus(run, okConversation, 'done')
  expect((await modelState(run, 'gemini'))?.state).toBe('ready')
})
