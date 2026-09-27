// Contract between the Ask engine (engine.ts: hidden pages, queues, history) and the
// per-service adapters (adapters.ts) plus the page runtime (runtime.ts) that runs inside each
// service's page, in an isolated JavaScript world.
import type { ModelId } from '@shared/services'

/** Where things are on a service's page. Every list is tried in order; first match wins. */
export interface PageConfig {
  /** Prompt input: a <textarea> or a contenteditable element (ProseMirror, Lexical, Quill…). */
  composer: string[]
  /** Send button. Used when `submitWith` is 'button', and as a fallback for 'enter'. */
  send: string[]
  /** "Stop generating" button: while it is visible the model is still writing. */
  stop: string[]
  /** One element per assistant message; the last match is the newest answer. */
  assistant: string[]
  /** Optional element inside an assistant message that holds only the answer text. */
  answerBody?: string[]
  /** Elements that exist only when the user is signed out (sign-in buttons, forms). */
  signedOut: string[]
  /** Elements that exist only when the user is signed in (account menu, chat history). */
  signedIn: string[]
  /** Elements that must not end up in the answer text (buttons, feedback bars, citations UI). */
  strip?: string[]
  /** How to submit after the prompt is typed. */
  submitWith: 'enter' | 'button'
}

export interface ModelAdapter {
  id: ModelId
  /** Opens a new, empty chat. */
  newChatUrl: string
  loginUrl: string
  /** True for the URL of one specific chat (so follow-ups can return to it). */
  isThreadUrl(url: string): boolean
  /** True when the page is a sign-in page (redirects there mean "signed out"). */
  isLoginUrl(url: string): boolean
  page: PageConfig
}

/** Snapshot of the page returned by the runtime's probe(). */
export interface PageProbe {
  url: string
  /** Cloudflare / captcha / "verify you are human" interstitial is showing. */
  challenge: boolean
  /** true / false when signedIn / signedOut markers matched; null when neither did. */
  signedIn: boolean | null
  /** A usable (visible, enabled) prompt input was found. */
  composer: boolean
  /** The model is writing: a stop button is visible. */
  generating: boolean
  /** Number of assistant messages currently on the page. */
  answerCount: number
  /** The newest assistant message converted to Markdown ('' when there is none). */
  lastAnswer: string
}

/**
 * API the runtime installs as `window.__ndAsk` inside the isolated world. The engine calls it
 * with webContents.executeJavaScriptInIsolatedWorld(ASK_WORLD_ID, …).
 */
export interface PageRuntime {
  probe(): PageProbe
  /** Focuses the prompt input and clears it. Returns false when there is none. */
  focusComposer(): boolean
  /** Clicks the send button. Returns false when it is missing or disabled. */
  clickSend(): boolean
  /** Clicks the stop button. Returns false when it is missing. */
  clickStop(): boolean
  /** Text currently in the prompt input (to check that typing and sending worked). */
  composerText(): string
}

/** Isolated world id for the runtime; any number above 999 is free for embedders. */
export const ASK_WORLD_ID = 1807
