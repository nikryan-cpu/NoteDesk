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

export interface AskAnswer {
  model: ModelId
  status: AnswerStatus
  /** Answer as Markdown, updated while it streams. */
  markdown: string
  error?: string
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
}

export const MAX_COMPARE_MODELS = 4

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
