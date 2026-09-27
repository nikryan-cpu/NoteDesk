// Contract between the Ask engine (engine.ts: hidden pages, queues, history) and the
// per-service adapters (adapters.ts) plus the page runtime (runtime.ts) that runs inside each
// service's page, in an isolated JavaScript world.
import type { ModelCapabilities } from '@shared/ask'
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
  /**
   * Where the service shows errors and limits (banners, toasts, inline error blocks). Generic
   * places ([role="alert"], toasts) are checked too.
   */
  notices?: string[]
  /** How to submit after the prompt is typed. */
  submitWith: 'enter' | 'button'
  /** How to switch deeper reasoning on and off. */
  thinking?: ToggleConfig
  /** How to switch web search on and off. */
  search?: ToggleConfig
  /** How to pick the model variant. */
  variant?: VariantConfig
}

/**
 * A page option that is either a button with an on/off state, or an entry in a menu. The
 * state is read from aria-pressed / aria-checked / aria-selected / data-state / a class name
 * containing "active", "selected" or "checked".
 */
export interface ToggleConfig {
  /** Button that toggles the option directly. */
  button?: string[]
  /** Otherwise: button that opens a menu (tools, "+", settings)… */
  menu?: string[]
  /** …and the menu entries to look through… */
  item?: string[]
  /** …picking the one whose text contains any of these (case-insensitive). */
  itemText?: string[]
}

export interface VariantConfig {
  /** Button that opens the model picker. */
  menu: string[]
  /** Entries of the opened picker; the one whose text contains the variant's match strings is clicked. */
  item: string[]
}

/** A variant as the adapter knows it: what to look for in the picker. */
export interface AdapterVariant {
  id: string
  label: string
  /** Case-insensitive substrings identifying the entry in the service's model picker. */
  match: string[]
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
  /** Variants offered in the Ask window (empty when the service has no picker NoteDesk can use). */
  variants: AdapterVariant[]
}

/** What the UI may offer for an adapter. */
export function capabilitiesOf(adapter: ModelAdapter): ModelCapabilities {
  return {
    variants: adapter.variants.map((v) => ({ id: v.id, label: v.label })),
    thinking: Boolean(adapter.page.thinking),
    search: Boolean(adapter.page.search),
  }
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
  /**
   * Visible error / limit / "busy" message shown by the service (trimmed text, ≤ 300 chars), or
   * null. Only messages that appeared on the page matter; old ones in the history do not.
   */
  notice: string | null
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
  /**
   * Sets an option to on/off. 'ok' = switched, 'unchanged' = already in that state,
   * 'missing' = the control was not found. May open and close menus, so it is async.
   */
  setToggle(kind: 'thinking' | 'search', on: boolean): Promise<'ok' | 'unchanged' | 'missing'>
  /** Opens the model picker and clicks the entry matching any of `match`. */
  selectVariant(match: string[]): Promise<'ok' | 'missing'>
  /**
   * Outline of the page for diagnostics: interactive elements with their tag, id, classes,
   * role, aria-*, data-testid and short labels. Never includes message text.
   */
  outline(): string
}

/** Isolated world id for the runtime; any number above 999 is free for embedders. */
export const ASK_WORLD_ID = 1807
