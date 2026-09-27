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
