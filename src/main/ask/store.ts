// Ask conversation history: kept in userData 'ask-history.json'. Each conversation remembers
// its own thread URL per model, so a follow-up prompt continues the same chat on the service.
import {
  conversationSummary,
  titleFromPrompt,
  type AskAnswer,
  type AskConversation,
  type AskConversationSummary,
  type AskTurn,
} from '@shared/ask'
import { isModelId, type ModelId } from '@shared/services'
import { readJson, writeJson } from '../store'

const FILE = 'ask-history'
const MAX_CONVERSATIONS = 300
const INTERRUPTED = 'NoteDesk closed while this was still answering'
const RUNNING = new Set(['queued', 'sending', 'streaming'])

let conversations: AskConversation[] | null = null
let seq = 0

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}`
}

function isAnswer(v: unknown): v is AskAnswer {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  return (
    isModelId(a.model) &&
    typeof a.status === 'string' &&
    typeof a.markdown === 'string' &&
    typeof a.startedAt === 'number' &&
    (a.error === undefined || typeof a.error === 'string') &&
    (a.finishedAt === undefined || typeof a.finishedAt === 'number')
  )
}

function isTurn(v: unknown): v is AskTurn {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.prompt === 'string' &&
    typeof t.createdAt === 'number' &&
    Array.isArray(t.answers) &&
    t.answers.every(isAnswer)
  )
}

function isConversation(v: unknown): v is AskConversation {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.createdAt === 'number' &&
    typeof c.updatedAt === 'number' &&
    typeof c.pinned === 'boolean' &&
    Array.isArray(c.models) &&
    c.models.every(isModelId) &&
    !!c.threads &&
    typeof c.threads === 'object' &&
    !Array.isArray(c.threads) &&
    Object.values(c.threads as Record<string, unknown>).every((u) => typeof u === 'string') &&
    Array.isArray(c.turns) &&
    c.turns.every(isTurn)
  )
}

/** Loads the file once and fixes up answers an app quit interrupted mid-flight. */
function load(): AskConversation[] {
  if (conversations) return conversations
  const raw = readJson<unknown>(FILE, [])
  const list = Array.isArray(raw) ? raw.filter(isConversation) : []
  let dirty = !Array.isArray(raw) || raw.length !== list.length
  for (const c of list) {
    for (const turn of c.turns) {
      for (const answer of turn.answers) {
        if (RUNNING.has(answer.status)) {
          answer.status = 'error'
          answer.error = INTERRUPTED
          answer.finishedAt = Date.now()
          dirty = true
        }
      }
    }
  }
  conversations = list
  if (dirty) persist()
  return list
}

function persist(): void {
  writeJson(FILE, () => conversations ?? [])
}

/** Drops the oldest unpinned conversations once the list grows past the cap. */
function enforceCap(all: AskConversation[]): void {
  if (all.length <= MAX_CONVERSATIONS) return
  const droppable = all.filter((c) => !c.pinned).sort((a, b) => a.updatedAt - b.updatedAt)
  while (all.length > MAX_CONVERSATIONS && droppable.length) {
    const victim = droppable.shift()!
    const i = all.indexOf(victim)
    if (i >= 0) all.splice(i, 1)
  }
}

export function list(): AskConversationSummary[] {
  const all = [...load()].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt))
  return all.map(conversationSummary)
}

export function get(conversationId: string): AskConversation | null {
  return load().find((c) => c.id === conversationId) ?? null
}

export function create(models: ModelId[], prompt: string): AskConversation {
  const all = load()
  const now = Date.now()
  const conv: AskConversation = {
    id: newId('c'),
    title: titleFromPrompt(prompt),
    createdAt: now,
    updatedAt: now,
    pinned: false,
    models: [...models],
    threads: {},
    turns: [],
  }
  all.unshift(conv)
  enforceCap(all)
  persist()
  return conv
}

export function addTurn(conversationId: string, prompt: string, models: ModelId[]): AskTurn | null {
  const conv = get(conversationId)
  if (!conv) return null
  const now = Date.now()
  const turn: AskTurn = {
    id: newId('t'),
    prompt,
    createdAt: now,
    answers: models.map((model) => ({ model, status: 'queued', markdown: '', startedAt: now })),
  }
  conv.turns.push(turn)
  conv.updatedAt = now
  persist()
  return turn
}

export function setAnswer(conversationId: string, turnId: string, answer: AskAnswer): void {
  const conv = get(conversationId)
  const turn = conv?.turns.find((t) => t.id === turnId)
  if (!conv || !turn) return
  const i = turn.answers.findIndex((a) => a.model === answer.model)
  if (i >= 0) turn.answers[i] = answer
  else turn.answers.push(answer)
  conv.updatedAt = Date.now()
  persist()
}

export function setThread(conversationId: string, model: ModelId, url: string): void {
  const conv = get(conversationId)
  if (!conv) return
  conv.threads[model] = url
  persist()
}

export function setModels(conversationId: string, models: ModelId[]): void {
  const conv = get(conversationId)
  if (!conv) return
  conv.models = [...models]
  conv.updatedAt = Date.now()
  persist()
}

export function rename(conversationId: string, title: string): void {
  const conv = get(conversationId)
  const clean = title.trim().slice(0, 200)
  if (!conv || !clean) return
  conv.title = clean
  persist()
}

export function pin(conversationId: string, pinned: boolean): void {
  const conv = get(conversationId)
  if (!conv) return
  conv.pinned = pinned
  persist()
}

export function remove(conversationId: string): void {
  const all = load()
  const i = all.findIndex((c) => c.id === conversationId)
  if (i < 0) return
  all.splice(i, 1)
  persist()
}
