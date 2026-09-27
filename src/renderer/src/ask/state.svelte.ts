// Reactive state for the Ask window: theme + locale, the conversation
// list and whichever conversation is open, wrapped around the 'ask:*' IPC contract. Every
// window.nd call is caught so a missing engine handler shows a line instead of a crash.
import type { QuickState } from '@shared/ipc'
import type { AskAnswerUpdate, AskConversation, AskConversationSummary, ModelId, ModelStatus } from '@shared/ask'
import { MAX_COMPARE_MODELS } from '@shared/ask'
import { MODEL_IDS } from '@shared/services'
import { translate, type I18nKey } from '@shared/i18n'
import type { Locale } from '@shared/settings'
import { readableOn, themeTokens, THEMES, type ThemeId, type ThemeTokens } from '@shared/themes'

export const nd = window.nd

const TOKEN_VAR: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  bgImage: '--bg-image',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  text: '--text',
  text2: '--text-2',
  text3: '--text-3',
  accent: '--accent',
  accentText: '--accent-text',
  tabActive: '--tab-active',
  tabActiveText: '--tab-active-text',
  tabHover: '--tab-hover',
  scrim: '--scrim',
  shadow: '--shadow',
  contentShadow: '--content-shadow',
  danger: '--danger',
  success: '--success',
  warning: '--warning',
}

export const ask = $state({
  ready: false,
  quick: { pinned: false, locale: 'en', dark: false, theme: 'minimal', accent: '' } as QuickState,
  conversations: [] as AskConversationSummary[],
  statuses: [] as ModelStatus[],
  enabledModels: [] as ModelId[],
  defaultModels: [] as ModelId[],
  draftModels: [] as ModelId[],
  current: null as AskConversation | null,
  loadingConv: false,
  search: '',
  sidebarOpen: true,
  drafts: {} as Record<string, string>,
  error: '',
})

export function locale(): Locale {
  return ask.quick.locale
}

export function t(key: I18nKey, params?: Record<string, string | number>): string {
  return translate(locale(), key, params)
}

function applyQuickTheme(s: QuickState): void {
  const id = (s.theme in THEMES ? s.theme : 'minimal') as ThemeId
  const def = THEMES[id]
  const tokens = themeTokens(id, s.dark)
  const root = document.documentElement
  for (const key of Object.keys(TOKEN_VAR) as (keyof ThemeTokens)[]) {
    root.style.setProperty(TOKEN_VAR[key], tokens[key] ?? 'none')
  }
  if (s.accent) {
    root.style.setProperty('--accent', s.accent)
    root.style.setProperty('--accent-text', readableOn(s.accent))
  }
  root.style.setProperty('--radius', `${def.radius}px`)
  root.style.setProperty('--radius-lg', `${def.radiusLg}px`)
  root.style.setProperty('--border-w', `${def.borderWidth}px`)
  root.style.setProperty('--blur', `${def.blur}px`)
  root.style.setProperty('--font', def.font)
  root.style.setProperty('--font-heading', def.headingFont ?? def.font)
  root.style.colorScheme = s.dark ? 'dark' : 'light'
  root.dataset.theme = id
  root.dataset.surface = def.surfaceStyle
  root.dataset.tabStyle = def.tabStyle
  root.dataset.dark = String(s.dark)
}

let errorTimer: ReturnType<typeof setTimeout> | null = null

function reportError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)
  ask.error = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => (ask.error = ''), 6000)
}

export function dismissError(): void {
  ask.error = ''
}

function patchAnswer(u: AskAnswerUpdate): void {
  const conv = ask.current
  if (!conv || conv.id !== u.conversationId) return
  const turn = conv.turns.find((t) => t.id === u.turnId)
  if (!turn) return
  const idx = turn.answers.findIndex((a) => a.model === u.answer.model)
  if (idx >= 0) turn.answers[idx] = u.answer
  else turn.answers.push(u.answer)
}

export async function init(): Promise<void> {
  try {
    const s = await nd.invoke('quick:action', 'init')
    ask.quick = s
    applyQuickTheme(s)
  } catch (e) {
    reportError(e)
  }

  try {
    const data = await nd.invoke('ask:init')
    ask.conversations = data.conversations
    ask.statuses = data.statuses
    ask.enabledModels = data.enabledModels
    ask.defaultModels = data.defaultModels
    ask.draftModels = data.defaultModels.length ? data.defaultModels : data.enabledModels.slice(0, 1)
  } catch (e) {
    reportError(e)
  }

  nd.on('quick-theme', (s) => {
    ask.quick = s
    applyQuickTheme(s)
  })
  nd.on('ask-answer', patchAnswer)
  nd.on('ask-conversations', (list) => (ask.conversations = list))
  nd.on('ask-models', (list) => (ask.statuses = list))

  ask.ready = true
}

export async function selectConversation(id: string): Promise<void> {
  ask.loadingConv = true
  try {
    const conv = await nd.invoke('ask:get', id)
    ask.current = conv
  } catch (e) {
    reportError(e)
  } finally {
    ask.loadingConv = false
  }
}

export function newConversation(): void {
  ask.current = null
}

export function draftKey(): string {
  return ask.current?.id ?? 'new'
}

export function draft(): string {
  return ask.drafts[draftKey()] ?? ''
}

export function setDraft(text: string): void {
  ask.drafts[draftKey()] = text
}

export function activeModels(): ModelId[] {
  return ask.current ? ask.current.models : ask.draftModels
}

function orderModels(list: ModelId[]): ModelId[] {
  return MODEL_IDS.filter((m) => list.includes(m))
}

function applyModels(list: ModelId[]): void {
  const ordered = orderModels(list)
  if (ask.current) {
    ask.current.models = ordered
    void nd.invoke('ask:setModels', ask.current.id, ordered).catch(reportError)
  } else {
    ask.draftModels = ordered
  }
}

export function toggleModel(model: ModelId): void {
  const list = activeModels()
  if (list.includes(model)) {
    if (list.length <= 1) return
    applyModels(list.filter((m) => m !== model))
  } else {
    if (list.length >= MAX_COMPARE_MODELS) return
    applyModels([...list, model])
  }
}

export function selectOnlyModel(model: ModelId): void {
  applyModels([model])
}

export async function send(promptRaw: string): Promise<void> {
  const prompt = promptRaw.trim()
  if (!prompt) return
  // Plain copy: IPC can't clone the reactive proxy behind the selection.
  const models = [...activeModels()]
  if (!models.length) return
  const conversationId = ask.current?.id ?? null
  const key = draftKey()
  ask.drafts[key] = ''
  try {
    const res = await nd.invoke('ask:send', { conversationId, prompt, models })
    await selectConversation(res.conversationId)
  } catch (e) {
    reportError(e)
    ask.drafts[key] = prompt
  }
}

export function stop(): void {
  if (!ask.current) return
  void nd.invoke('ask:stop', ask.current.id).catch(reportError)
}

export function retryAnswer(turnId: string, model: ModelId): void {
  if (!ask.current) return
  void nd.invoke('ask:retry', ask.current.id, turnId, model).catch(reportError)
}

export function renameConversation(id: string, title: string): void {
  const clean = title.trim()
  if (!clean) return
  if (ask.current?.id === id) ask.current.title = clean
  const summary = ask.conversations.find((c) => c.id === id)
  if (summary) summary.title = clean
  void nd.invoke('ask:rename', id, clean).catch(reportError)
}

export function togglePin(id: string, pinned: boolean): void {
  if (ask.current?.id === id) ask.current.pinned = pinned
  const summary = ask.conversations.find((c) => c.id === id)
  if (summary) summary.pinned = pinned
  void nd.invoke('ask:pin', id, pinned).catch(reportError)
}

export function deleteConversation(id: string): void {
  ask.conversations = ask.conversations.filter((c) => c.id !== id)
  if (ask.current?.id === id) ask.current = null
  void nd.invoke('ask:delete', id).catch(reportError)
}

export function openThread(model: ModelId): void {
  if (!ask.current) return
  void nd.invoke('ask:openThread', ask.current.id, model).catch(reportError)
}

export function loginModel(model: ModelId): void {
  void nd.invoke('ask:login', model).catch(reportError)
}

export function showPageModel(model: ModelId): void {
  void nd.invoke('ask:showPage', model).catch(reportError)
}

export function windowAction(a: 'pin' | 'openInMain' | 'close'): void {
  void nd
    .invoke('quick:action', a)
    .then((s) => {
      ask.quick = s
      applyQuickTheme(s)
    })
    .catch(reportError)
}

export function isConversationBusy(conv: AskConversation | null): boolean {
  if (!conv) return false
  return conv.turns.some((t) => t.answers.some((a) => a.status === 'queued' || a.status === 'sending' || a.status === 'streaming'))
}

export function modelStatus(model: ModelId): ModelStatus | undefined {
  return ask.statuses.find((s) => s.id === model)
}

export function copyLastAnswerOfFirstModel(): void {
  const conv = ask.current
  if (!conv || !conv.turns.length || !conv.models.length) return
  const model = conv.models[0]
  const turn = conv.turns[conv.turns.length - 1]
  const answer = turn.answers.find((a) => a.model === model)
  if (!answer) return
  void navigator.clipboard.writeText(answer.markdown)
}

let composerEl: HTMLTextAreaElement | null = null

export function registerComposer(el: HTMLTextAreaElement | null): void {
  composerEl = el
}

export function focusComposer(): void {
  composerEl?.focus()
}

let searchEl: HTMLInputElement | null = null

export function registerSearch(el: HTMLInputElement | null): void {
  searchEl = el
}

export function focusSearch(): void {
  ask.sidebarOpen = true
  queueMicrotask(() => searchEl?.focus())
}
