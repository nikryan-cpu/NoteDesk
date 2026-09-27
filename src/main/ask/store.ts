// Ask conversation history: kept in userData 'ask-history.json'. Each conversation remembers
// its own thread URL per model, so a follow-up prompt continues the same chat on the service.
// The file also holds "defaults": the options last used per model, the starting point offered
// for a new conversation.
import {
  conversationSummary,
  sanitizeModelOptions,
  titleFromPrompt,
  DEFAULT_MODEL_OPTIONS,
  type AskAnswer,
  type AskConversation,
  type AskConversationSummary,
  type AskTurn,
  type ModelOptions,
} from '@shared/ask'
import { isModelId, type ModelId } from '@shared/services'
import { readJson, writeJson } from '../store'

const FILE = 'ask-history'
const MAX_CONVERSATIONS = 300
const INTERRUPTED = 'NoteDesk closed while this was still answering'
const RUNNING = new Set(['queued', 'sending', 'streaming'])

interface StoreFile {
  conversations: AskConversation[]
  defaults: Partial<Record<ModelId, ModelOptions>>
}

let file: StoreFile | null = null
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

/** Keeps only known model ids and runs every entry through sanitizeModelOptions. */
function sanitizeOptionsMap(input: unknown): Partial<Record<ModelId, ModelOptions>> {
  const out: Partial<Record<ModelId, ModelOptions>> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isModelId(key)) out[key] = sanitizeModelOptions(value)
  }
  return out
}

/** Loads the file once, migrating the old plain-array format and fixing up interrupted answers. */
function load(): StoreFile {
  if (file) return file
  const raw = readJson<unknown>(FILE, [])
  const isOldArray = Array.isArray(raw)
  const rawConversations = isOldArray
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).conversations)
      ? ((raw as Record<string, unknown>).conversations as unknown[])
      : []
  const rawDefaults = !isOldArray && raw && typeof raw === 'object' ? (raw as Record<string, unknown>).defaults : undefined

  const list = rawConversations.filter(isConversation)
  let dirty = isOldArray || rawConversations.length !== list.length
  for (const c of list) {
    c.options = sanitizeOptionsMap((c as unknown as Record<string, unknown>).options)
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
  file = { conversations: list, defaults: sanitizeOptionsMap(rawDefaults) }
  if (dirty) persist()
  return file
}

function persist(): void {
  writeJson(FILE, () => file ?? { conversations: [], defaults: {} })
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
  const all = [...load().conversations].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt))
  return all.map(conversationSummary)
}

export function get(conversationId: string): AskConversation | null {
  return load().conversations.find((c) => c.id === conversationId) ?? null
}

export function create(models: ModelId[], prompt: string): AskConversation {
  const all = load().conversations
  const now = Date.now()
  const conv: AskConversation = {
    id: newId('c'),
    title: titleFromPrompt(prompt),
    createdAt: now,
    updatedAt: now,
    pinned: false,
    models: [...models],
    threads: {},
    options: {},
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
  const all = load().conversations
  const i = all.findIndex((c) => c.id === conversationId)
  if (i < 0) return
  all.splice(i, 1)
  persist()
}

/** This model's switches for the given conversation, or the neutral defaults when never set. */
export function getOptions(conversationId: string, model: ModelId): ModelOptions {
  const conv = get(conversationId)
  const found = conv?.options[model]
  return found ? { ...found } : { ...DEFAULT_MODEL_OPTIONS }
}

export function setOptions(conversationId: string, model: ModelId, options: ModelOptions): void {
  const conv = get(conversationId)
  if (!conv) return
  conv.options[model] = options
  conv.updatedAt = Date.now()
  persist()
}

/** Options last used per model - the starting point offered for a new conversation. */
export function getDefaults(): Partial<Record<ModelId, ModelOptions>> {
  return { ...load().defaults }
}

export function setDefault(model: ModelId, options: ModelOptions): void {
  load().defaults[model] = options
  persist()
}
