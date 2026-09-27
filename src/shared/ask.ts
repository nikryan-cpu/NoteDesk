// Ask window: one prompt box, several chat services. Conversations live in NoteDesk's own
// history; each model keeps its own chat on the service side, so follow-up questions go to
// the same chat and every conversation has its own memory.
import type { ModelId } from './services'

export type { ModelId }

/** Sign-in / reachability of a chat service, as last seen by the engine. */
export type ModelState =
  | 'unknown' // not checked yet
  | 'ready' // signed in, prompt box found
  | 'signed-out' // the service wants a sign-in
  | 'needs-action' // captcha / "are you human" / consent page the user has to pass
  | 'limited' // the service says a usage limit is reached or it is too busy right now
  | 'error' // page failed to load or its layout was not recognised

export interface ModelStatus {
  id: ModelId
  state: ModelState
  /** Short technical detail for tooltips (load error, missing element…). */
  detail?: string
  checkedAt: number
}

export type AnswerStatus =
  | 'queued' // waiting for the same model to finish another prompt
  | 'sending' // loading the chat / typing the prompt
  | 'streaming' // the model is writing
  | 'done'
  | 'stopped' // stopped by the user
  | 'error'
  | 'signed-out'
  | 'needs-action'
  | 'limited' // usage limit / rate limit / "server is busy"; `error` holds the service's own words

export interface AskAnswer {
  model: ModelId
  status: AnswerStatus
  /** Answer as Markdown, updated while it streams. */
  markdown: string
  error?: string
  /** Non-fatal note, e.g. an option that could not be switched on the service's page. */
  warning?: string
  /** Options that were in effect for this answer. */
  options?: ModelOptions
  startedAt: number
  finishedAt?: number
}

export interface AskTurn {
  id: string
  prompt: string
  createdAt: number
  /** One answer per model the prompt was sent to, in the order of the conversation's models. */
  answers: AskAnswer[]
}

export interface AskConversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  pinned: boolean
  /** Models the next prompt goes to. One model = single view, several = columns. */
  models: ModelId[]
  /** URL of this conversation's chat on each service, once the service created one. */
  threads: Partial<Record<ModelId, string>>
  /** Per-model switches (variant, thinking, search) used for the next prompt. */
  options: Partial<Record<ModelId, ModelOptions>>
  turns: AskTurn[]
}

export interface AskConversationSummary {
  id: string
  title: string
  updatedAt: number
  pinned: boolean
  models: ModelId[]
  turnCount: number
  /** Start of the last prompt, for the list subtitle. */
  preview: string
  /** True while any answer of the conversation is still being produced. */
  busy: boolean
}

export interface AskSendRequest {
  /** null starts a new conversation. */
  conversationId: string | null
  prompt: string
  models: ModelId[]
  /** Options per model; stored on the conversation (missing models keep what they had). */
  options?: Partial<Record<ModelId, ModelOptions>>
}

export interface AskSendResult {
  conversationId: string
  turnId: string
}

/** Pushed while answers change (status or text). */
export interface AskAnswerUpdate {
  conversationId: string
  turnId: string
  answer: AskAnswer
}

export interface AskInit {
  conversations: AskConversationSummary[]
  statuses: ModelStatus[]
  /** Models enabled in settings (Gemini is always available). */
  enabledModels: ModelId[]
  /** Preselected models for a new conversation. */
  defaultModels: ModelId[]
  /** What each service's page lets NoteDesk switch. */
  capabilities: Record<ModelId, ModelCapabilities>
  /** Options last used per model, the starting point for a new conversation. */
  defaultOptions: Partial<Record<ModelId, ModelOptions>>
}

export const MAX_COMPARE_MODELS = 4

/** Switches on a service's page that NoteDesk sets before typing the prompt. */
export interface ModelOptions {
  /** Id of one of the model's variants; '' leaves the service's own choice. */
  variant: string
  /** Deeper reasoning (Thinking / DeepThink / extended thinking). */
  thinking: boolean
  /** Web search. */
  search: boolean
}

export interface ModelVariant {
  id: string
  /** Family name as the service shows it (Opus, Instant, Pro…); version numbers change too often. */
  label: string
}

export interface ModelCapabilities {
  variants: ModelVariant[]
  thinking: boolean
  search: boolean
}

export const DEFAULT_MODEL_OPTIONS: ModelOptions = { variant: '', thinking: false, search: false }

export function sanitizeModelOptions(input: unknown, caps?: ModelCapabilities): ModelOptions {
  const o = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const variant = typeof o['variant'] === 'string' ? o['variant'].slice(0, 40) : ''
  return {
    variant: caps && variant && !caps.variants.some((v) => v.id === variant) ? '' : variant,
    thinking: o['thinking'] === true && (caps?.thinking ?? true),
    search: o['search'] === true && (caps?.search ?? true),
  }
}

export function conversationSummary(c: AskConversation): AskConversationSummary {
  const last = c.turns[c.turns.length - 1]
  const busy = c.turns.some((t) => t.answers.some((a) => a.status === 'queued' || a.status === 'sending' || a.status === 'streaming'))
  return {
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    pinned: c.pinned,
    models: c.models,
    turnCount: c.turns.length,
    preview: (last?.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    busy,
  }
}

/** Title for a new conversation: the first line of the first prompt, shortened. */
export function titleFromPrompt(prompt: string): string {
  const line = prompt.trim().split(/\r?\n/)[0]?.replace(/\s+/g, ' ') ?? ''
  if (line.length <= 60) return line
  const cut = line.slice(0, 60)
  const space = cut.lastIndexOf(' ')
  return `${space > 30 ? cut.slice(0, space) : cut}…`
}

export interface ContextLabels {
  /** Line before the quoted turns. */
  header: string
  /** Speaker label for the user's messages. */
  user: string
  /** Line between the quoted turns and the new message. */
  footer: string
}

/**
 * One chat for all models: a model only remembers what was said in its own chat on the
 * service, so turns it missed (answered by other models since it last answered) are quoted in
 * front of the prompt. Returns the prompt unchanged when the model has seen everything.
 */
export function promptWithContext(
  conv: AskConversation,
  turnId: string,
  model: ModelId,
  names: Record<ModelId, string>,
  labels: ContextLabels,
  maxChars = 12_000,
): string {
  const index = conv.turns.findIndex((t) => t.id === turnId)
  const current = conv.turns[index]
  if (!current) return ''
  const prior = conv.turns.slice(0, index)
  const answered = (t: AskTurn, m: ModelId) =>
    t.answers.some((a) => a.model === m && (a.status === 'done' || a.status === 'stopped') && a.markdown.trim())
  let lastSeen = -1
  prior.forEach((t, i) => {
    if (answered(t, model)) lastSeen = i
  })

  const blocks: string[] = []
  for (const t of prior.slice(lastSeen + 1)) {
    const answer = t.answers.find((a) => a.model !== model && (a.status === 'done' || a.status === 'stopped') && a.markdown.trim())
    if (!answer) continue
    const text = answer.markdown.trim()
    const clipped = text.length > 4000 ? `${text.slice(0, 4000)}…` : text
    blocks.push(`${labels.user}: ${t.prompt.trim()}\n\n${names[answer.model]}: ${clipped}`)
  }
  if (blocks.length === 0) return current.prompt

  // Keep the most recent turns when the history is long.
  const kept: string[] = []
  let size = 0
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]!
    if (kept.length > 0 && size + block.length > maxChars) break
    kept.unshift(block)
    size += block.length
  }
  return `${labels.header}\n\n${kept.join('\n\n---\n\n')}\n\n${labels.footer}\n\n${current.prompt}`
}
