// The Ask engine: one hidden, offscreen page per model, each signed into the user's own
// account in the default profile's session. A prompt is typed and submitted the same way a
// person would, and the answer is read back out of the page as Markdown. Conversations and
// their per-model thread URLs live in store.ts; this file only drives the pages and the queues.
import { app, shell, BrowserWindow, type WebContents } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_COMPARE_MODELS,
  sanitizeModelOptions,
  type AskAnswer,
  type AskConversation,
  type AskConversationSummary,
  type AskInit,
  type AskSendRequest,
  type AskSendResult,
  type ModelOptions,
  type ModelState,
  type ModelStatus,
  promptWithContext,
} from '@shared/ask'
import type { EventChannel, EventMap } from '@shared/ipc'
import { isAllowedInApp, isModelId, MODEL_IDS, SERVICES, type ModelId } from '@shared/services'
import type { Settings } from '@shared/settings'
import { emit } from '../bus'
import { t } from '../i18n'
import { sessionFor } from '../sessions'
import { getSettings, onSettingsChange } from '../settings'
import { adapterFor } from './adapters'
import * as pages from './pages'
import {
  runtimeScript,
  toggleScript,
  variantScript,
  COMPOSER_TEXT_SCRIPT,
  FOCUS_SCRIPT,
  HAS_RUNTIME_SCRIPT,
  OUTLINE_SCRIPT,
  PROBE_SCRIPT,
  SEND_SCRIPT,
  STOP_SCRIPT,
} from './runtime'
import * as store from './store'
import { ASK_WORLD_ID, capabilitiesOf, type ModelAdapter, type PageProbe } from './types'

const SWEEP_MS = 60_000
const LOAD_TIMEOUT_MS = 30_000
const READY_TIMEOUT_MS = 25_000
const SEND_CONFIRM_MS = 2_000
const SEND_RETRY_MS = 8_000
const STREAM_POLL_MS = 400
const STREAM_PUSH_MS = 250
const STREAM_QUIET_WITH_STOP_MS = 1_500
const STREAM_QUIET_NO_STOP_MS = 4_000
const HARD_TIMEOUT_MS = 6 * 60_000
// How long a notice gets to prove itself wrong (an answer starting late) before it is treated
// as the reason nothing is happening.
const NOTICE_GRACE_MS = 5_000

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Words a limit/quota/rate/busy notice tends to use, in whatever language the service replies
// with - anything else that reached probe.notice is still an error, just not that kind.
const LIMIT_NOTICE_RE = /limit|quota|too many|busy|capacity|overloaded|exceeded|лимит|превышен|слишком много|перегружен|频繁|上限|繁忙/i

/** Buckets a service's own notice text: a limit/rate/busy message, or some other error. */
export function classifyNotice(text: string): 'limited' | 'error' | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  return LIMIT_NOTICE_RE.test(trimmed) ? 'limited' : 'error'
}

function sameLocation(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    return ua.origin === ub.origin && ua.pathname === ub.pathname && ua.hash === ub.hash
  } catch {
    return false
  }
}

export function isAllowedNav(url: string): boolean {
  if (isAllowedInApp(url)) return true
  return Boolean(process.env['NOTEDESK_E2E']) && url.startsWith('file:')
}

function optionsEqual(a: ModelOptions | null, b: ModelOptions): boolean {
  return !!a && a.variant === b.variant && a.thinking === b.thinking && a.search === b.search
}

/** Clicks the first visible match, for the diagnostics dump only - not part of a normal job. */
function clickFirstVisibleScript(selectors: string[]): string {
  return `(() => {
    var sels = ${JSON.stringify(selectors)}
    for (var i = 0; i < sels.length; i++) {
      var els
      try { els = document.querySelectorAll(sels[i]) } catch (e) { continue }
      for (var j = 0; j < els.length; j++) {
        var el = els[j]
        var rect = el.getBoundingClientRect()
        var style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        if (rect.width === 0 && rect.height === 0) continue
        el.click()
        return true
      }
    }
    return false
  })()`
}

function diagnosticsStamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function originAndPath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}

interface ModelPage {
  win: BrowserWindow
  webContents: WebContents
  lastActivity: number
  queue: Promise<void>
  currentJob: JobHandle | null
  /** Options last switched on this page, and the thread it was on - to skip needless re-clicks. */
  appliedOptions: ModelOptions | null
  appliedThreadUrl: string | null
}

interface JobHandle {
  model: ModelId
  conversationId: string
  turnId: string
  cancelled: boolean
  stopRequested: boolean
}

export class AskEngine {
  private pageMap = new Map<ModelId, ModelPage>()
  private statuses = new Map<ModelId, ModelStatus>()
  private activeJobs = new Set<JobHandle>()
  private sweepTimer: NodeJS.Timeout
  private unsubscribeSettings: () => void

  constructor(
    private openInMainTab: (url: string) => void,
    private uiWebContents: () => WebContents | null,
  ) {
    for (const id of MODEL_IDS) this.statuses.set(id, { id, state: 'unknown', checkedAt: 0 })
    this.sweepTimer = setInterval(() => this.sweepIdle(), SWEEP_MS)
    this.unsubscribeSettings = onSettingsChange((next, prev) => this.onSettingsChange(next, prev))
  }

  // ---------------------------------------------------------------- public API (used by ipc.ts)

  init(): AskInit {
    const capabilities = Object.fromEntries(MODEL_IDS.map((id) => [id, capabilitiesOf(adapterFor(id))])) as AskInit['capabilities']
    return {
      conversations: store.list(),
      statuses: [...this.statuses.values()],
      enabledModels: this.enabledModels(),
      defaultModels: this.defaultModels(),
      capabilities,
      defaultOptions: store.getDefaults(),
    }
  }

  list(): AskConversationSummary[] {
    return store.list()
  }

  get(conversationId: string): AskConversation | null {
    return store.get(conversationId)
  }

  send(req: AskSendRequest): AskSendResult {
    const models = this.validateModels(req.models)
    if (models.length === 0) throw new Error('no enabled models given')
    let conv: AskConversation
    if (req.conversationId) {
      const existing = store.get(req.conversationId)
      if (!existing) throw new Error('conversation not found')
      conv = existing
      store.setModels(conv.id, models)
      // Existing conversation: a model missing from req.options just keeps what it had.
      for (const model of models) {
        const provided = req.options?.[model]
        if (provided) store.setOptions(conv.id, model, this.sanitizeOptions(model, provided))
      }
    } else {
      conv = store.create(models, req.prompt)
      const defaults = store.getDefaults()
      for (const model of models) {
        store.setOptions(conv.id, model, this.sanitizeOptions(model, req.options?.[model] ?? defaults[model]))
      }
    }
    // Whatever ends up in effect (just set above, or carried over) becomes the new default.
    for (const model of models) store.setDefault(model, store.getOptions(conv.id, model))

    const turn = store.addTurn(conv.id, req.prompt, models)
    if (!turn) throw new Error('conversation not found')
    this.pushConversations()
    for (const answer of turn.answers) this.pushAnswer(conv.id, turn.id, answer)
    for (const model of models) this.enqueue(model, conv.id, turn.id, req.prompt)
    return { conversationId: conv.id, turnId: turn.id }
  }

  stop(conversationId: string): void {
    for (const handle of this.activeJobs) {
      if (handle.conversationId !== conversationId || handle.cancelled) continue
      handle.cancelled = true
      const page = this.pageMap.get(handle.model)
      if (page && page.currentJob === handle) {
        handle.stopRequested = true
        void this.runInWorld(page, adapterFor(handle.model), STOP_SCRIPT)
      } else {
        this.markStopped(handle)
      }
    }
  }

  retry(conversationId: string, turnId: string, model: ModelId): void {
    const conv = store.get(conversationId)
    const turn = conv?.turns.find((t) => t.id === turnId)
    if (!conv || !turn) return
    const answer: AskAnswer = { model, status: 'queued', markdown: '', startedAt: Date.now() }
    store.setAnswer(conversationId, turnId, answer)
    this.pushAnswer(conversationId, turnId, answer)
    this.pushConversations()
    this.enqueue(model, conversationId, turnId, turn.prompt)
  }

  setModels(conversationId: string, models: ModelId[]): void {
    store.setModels(conversationId, this.validateModels(models))
    this.pushConversations()
  }

  /** conversationId null: just updates what a new conversation starts with for this model. */
  setOptions(conversationId: string | null, model: ModelId, options: ModelOptions): void {
    const clean = this.sanitizeOptions(model, options)
    if (conversationId) {
      store.setOptions(conversationId, model, clean)
      this.pushConversations()
    }
    store.setDefault(model, clean)
  }

  rename(conversationId: string, title: string): void {
    store.rename(conversationId, title)
    this.pushConversations()
  }

  pin(conversationId: string, pinned: boolean): void {
    store.pin(conversationId, pinned)
    this.pushConversations()
  }

  delete(conversationId: string): void {
    this.stop(conversationId)
    store.remove(conversationId)
    this.pushConversations()
  }

  openThread(conversationId: string, model: ModelId): void {
    const conv = store.get(conversationId)
    this.openInMainTab(conv?.threads[model] || SERVICES[model].home)
  }

  models(): ModelStatus[] {
    return [...this.statuses.values()]
  }

  async checkModels(models?: ModelId[]): Promise<ModelStatus[]> {
    const targets = models && models.length ? models.filter(isModelId) : this.enabledModels()
    await Promise.all(targets.map((m) => this.checkOne(m)))
    return [...this.statuses.values()]
  }

  login(model: ModelId): void {
    const adapter = adapterFor(model)
    pages.openLogin(model, sessionFor(getSettings().defaultProfileId), adapter.loginUrl, () => void this.checkOne(model))
  }

  showPage(model: ModelId): void {
    const page = this.pageMap.get(model)
    const url = page && !page.webContents.isDestroyed() ? page.webContents.getURL() : adapterFor(model).newChatUrl
    pages.showPage(model, sessionFor(getSettings().defaultProfileId), url, () => {
      const p = this.pageMap.get(model)
      if (p && !p.webContents.isDestroyed()) p.webContents.reload()
      void this.checkOne(model)
    })
  }

  /**
   * Dumps the service's current page (an outline of its interactive elements, no chat text) to
   * a text file in Downloads, and opens the folder there. Never throws - a failure just means
   * no file, reported back as null.
   */
  async diagnose(model: ModelId): Promise<string | null> {
    try {
      const adapter = adapterFor(model)
      const page = this.getOrCreatePage(model)
      const current = page.webContents.isDestroyed() ? '' : page.webContents.getURL()
      const onChatPage = current !== '' && (adapter.isThreadUrl(current) || sameLocation(current, adapter.newChatUrl))
      if (!onChatPage) {
        await this.load(page, adapter.newChatUrl)
        await this.waitFor(page, adapter, (p) => this.isSettled(adapter, p), READY_TIMEOUT_MS)
      }
      await this.ensureRuntime(page, adapter)
      if (page.webContents.isDestroyed()) return null

      const probe = await this.probe(page, adapter)
      const lines: string[] = []
      lines.push(`NoteDesk ${app.getVersion()}`)
      lines.push(model)
      lines.push(new Date().toISOString())
      lines.push(originAndPath(page.webContents.isDestroyed() ? '' : page.webContents.getURL()))
      if (probe) {
        const { url, challenge, signedIn, composer, generating, answerCount } = probe
        lines.push(JSON.stringify({ url, challenge, signedIn, composer, generating, answerCount }, null, 2))
      }
      lines.push('')
      lines.push(String((await this.runInWorld(page, adapter, OUTLINE_SCRIPT)) ?? ''))

      if (adapter.page.variant) {
        const opened = await this.runInWorld(page, adapter, clickFirstVisibleScript(adapter.page.variant.menu))
        if (opened) {
          await sleep(700)
          lines.push('')
          lines.push('--- with the model menu open ---')
          lines.push(String((await this.runInWorld(page, adapter, OUTLINE_SCRIPT)) ?? ''))
          if (!page.webContents.isDestroyed()) {
            page.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
            page.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          }
        }
      }

      const path = join(app.getPath('downloads'), `notedesk-${model}-page-${diagnosticsStamp(new Date())}.txt`)
      writeFileSync(path, lines.join('\n'), 'utf8')
      shell.showItemInFolder(path)
      return path
    } catch (err) {
      console.warn('[ask] diagnose failed for', model, err)
      return null
    }
  }

  dispose(): void {
    clearInterval(this.sweepTimer)
    this.unsubscribeSettings()
    pages.closeAll()
    for (const id of [...this.pageMap.keys()]) this.destroyPage(id)
  }

  // ---------------------------------------------------------------- settings

  private onSettingsChange(next: Settings, prev: Settings): void {
    if (next.defaultProfileId !== prev.defaultProfileId) {
      for (const id of [...this.pageMap.keys()]) this.destroyPage(id)
      return
    }
    const enabled = new Set(this.enabledModels(next))
    for (const id of [...this.pageMap.keys()]) if (!enabled.has(id)) this.destroyPage(id)
  }

  private enabledModels(s = getSettings()): ModelId[] {
    return MODEL_IDS.filter((id) => id === 'gemini' || s.enabledModels.includes(id))
  }

  private defaultModels(): ModelId[] {
    const s = getSettings()
    const enabled = new Set(this.enabledModels(s))
    const picked = s.askModels.filter((m) => enabled.has(m))
    return picked.length ? picked : ['gemini']
  }

  private validateModels(models: ModelId[]): ModelId[] {
    const enabled = new Set(this.enabledModels())
    return [...new Set(models)].filter((m) => enabled.has(m)).slice(0, MAX_COMPARE_MODELS)
  }

  private sanitizeOptions(model: ModelId, options: unknown): ModelOptions {
    return sanitizeModelOptions(options, capabilitiesOf(adapterFor(model)))
  }

  // ---------------------------------------------------------------- pages

  private getOrCreatePage(model: ModelId): ModelPage {
    const existing = this.pageMap.get(model)
    if (existing && !existing.webContents.isDestroyed()) return existing
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        offscreen: true,
        session: sessionFor(getSettings().defaultProfileId),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        spellcheck: false,
      },
    })
    const wc = win.webContents
    wc.setFrameRate(5)
    wc.setAudioMuted(true)
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
    wc.on('will-navigate', (e) => {
      if (!isAllowedNav(e.url)) e.preventDefault()
    })
    wc.on('will-redirect', (e) => {
      if (!isAllowedNav(e.url)) e.preventDefault()
    })
    wc.on('render-process-gone', () => this.destroyPage(model))
    wc.on('destroyed', () => this.pageMap.delete(model))
    const page: ModelPage = {
      win,
      webContents: wc,
      lastActivity: Date.now(),
      queue: Promise.resolve(),
      currentJob: null,
      appliedOptions: null,
      appliedThreadUrl: null,
    }
    this.pageMap.set(model, page)
    return page
  }

  private destroyPage(model: ModelId): void {
    const page = this.pageMap.get(model)
    if (!page) return
    this.pageMap.delete(model)
    if (page.currentJob) page.currentJob.cancelled = true
    if (!page.win.isDestroyed()) page.win.destroy()
  }

  private sweepIdle(): void {
    const minutes = getSettings().sleepAfterMinutes || 10
    const cutoff = Date.now() - minutes * 60_000
    for (const [id, page] of this.pageMap) if (!page.currentJob && page.lastActivity < cutoff) this.destroyPage(id)
  }

  private load(page: ModelPage, url: string): Promise<void> {
    const wc = page.webContents
    return new Promise<void>((resolve) => {
      let settled = false
      const timer = setTimeout(finish, LOAD_TIMEOUT_MS)
      function finish(): void {
        if (settled) return
        settled = true
        clearTimeout(timer)
        wc.removeListener('did-stop-loading', onStop)
        wc.removeListener('did-fail-load', onFail)
        resolve()
      }
      function onStop(): void {
        finish()
      }
      function onFail(_e: Electron.Event, code: number): void {
        if (code !== -3) finish()
      }
      wc.once('did-stop-loading', onStop)
      wc.on('did-fail-load', onFail)
      wc.loadURL(url).catch(() => finish())
    })
  }

  private async ensureRuntime(page: ModelPage, adapter: ModelAdapter): Promise<void> {
    if (page.webContents.isDestroyed()) return
    try {
      // Resolves with the value of the last script, not an array.
      const has: unknown = await page.webContents.executeJavaScriptInIsolatedWorld(ASK_WORLD_ID, [{ code: HAS_RUNTIME_SCRIPT }])
      if (!has) await page.webContents.executeJavaScriptInIsolatedWorld(ASK_WORLD_ID, [{ code: runtimeScript(adapter.page) }])
    } catch (err) {
      console.warn('[ask] runtime install failed', err)
    }
  }

  private async runInWorld(page: ModelPage, adapter: ModelAdapter, code: string): Promise<unknown> {
    if (page.webContents.isDestroyed()) return undefined
    await this.ensureRuntime(page, adapter)
    if (page.webContents.isDestroyed()) return undefined
    try {
      return (await page.webContents.executeJavaScriptInIsolatedWorld(ASK_WORLD_ID, [{ code }])) as unknown
    } catch (err) {
      console.warn('[ask] script failed', err)
      return undefined
    }
  }

  private probe(page: ModelPage, adapter: ModelAdapter): Promise<PageProbe | null> {
    return this.runInWorld(page, adapter, PROBE_SCRIPT).then((r) => (r as PageProbe | undefined) ?? null)
  }

  /**
   * Waits for the usual "it started" signal (a new assistant message, or a stop button) - but if
   * a notice shows up instead, it gets NOTICE_GRACE_MS to be proven wrong by an answer starting
   * late before it counts as the reason nothing is happening.
   */
  private async waitForSendOutcome(
    page: ModelPage,
    adapter: ModelAdapter,
    baseline: number,
    timeoutMs: number,
  ): Promise<{ probe: PageProbe | null; blocked: string | null }> {
    let deadline = Date.now() + timeoutMs
    let noticeSince: number | null = null
    for (;;) {
      const probe = await this.probe(page, adapter)
      if (probe && (probe.answerCount > baseline || probe.generating)) return { probe, blocked: null }
      if (probe?.notice) {
        if (noticeSince === null) {
          noticeSince = Date.now()
          deadline = Math.max(deadline, noticeSince + NOTICE_GRACE_MS)
        }
        if (Date.now() - noticeSince >= NOTICE_GRACE_MS) return { probe, blocked: probe.notice }
      } else {
        noticeSince = null
      }
      if (Date.now() >= deadline) return { probe, blocked: probe?.notice ?? null }
      await sleep(300)
    }
  }

  /** Switches variant/thinking/search on the page to match `options`. Returns short warnings for switches that failed. */
  private async applyOptions(page: ModelPage, adapter: ModelAdapter, options: ModelOptions): Promise<string[]> {
    const warnings: string[] = []
    if (options.variant) {
      const variant = adapter.variants.find((v) => v.id === options.variant)
      if (variant) {
        const result = await this.runInWorld(page, adapter, variantScript(variant.match))
        if (result === 'missing') warnings.push(t('askWarn.variant', { name: variant.label }))
      }
    }
    if (adapter.page.thinking) {
      const result = await this.runInWorld(page, adapter, toggleScript('thinking', options.thinking))
      if (result === 'missing') warnings.push(t('askWarn.thinking'))
    }
    if (adapter.page.search) {
      const result = await this.runInWorld(page, adapter, toggleScript('search', options.search))
      if (result === 'missing') warnings.push(t('askWarn.search'))
    }
    return warnings
  }

  /** The page has settled into something we can act on: a composer, a sign-in wall, a challenge -
   * or a notice, since that can be the whole reason there is no composer at all. */
  private isSettled(adapter: ModelAdapter, p: PageProbe): boolean {
    return p.composer || p.signedIn === false || p.challenge || adapter.isLoginUrl(p.url) || !!p.notice
  }

  private async waitFor(
    page: ModelPage,
    adapter: ModelAdapter,
    predicate: (p: PageProbe) => boolean,
    timeoutMs: number,
  ): Promise<PageProbe | null> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const probe = await this.probe(page, adapter)
      if (probe && predicate(probe)) return probe
      if (Date.now() >= deadline) return probe
      await sleep(300)
    }
  }

  // ---------------------------------------------------------------- model status checks

  private async checkOne(model: ModelId): Promise<void> {
    const page = this.getOrCreatePage(model)
    const adapter = adapterFor(model)
    try {
      const current = page.webContents.isDestroyed() ? '' : page.webContents.getURL()
      if (!current || !sameLocation(current, adapter.newChatUrl)) await this.load(page, adapter.newChatUrl)
      const probe = await this.waitFor(page, adapter, (p) => this.isSettled(adapter, p), READY_TIMEOUT_MS)
      if (!probe) return this.setModelState(model, 'error', 'timed out waiting for the page')
      if (adapter.isLoginUrl(probe.url) || probe.signedIn === false) return this.setModelState(model, 'signed-out')
      if (probe.challenge) return this.setModelState(model, 'needs-action')
      if (probe.composer) return this.setModelState(model, 'ready')
      if (probe.notice) return this.setModelState(model, classifyNotice(probe.notice) ?? 'error', probe.notice)
      this.setModelState(model, 'error', 'prompt box not found')
    } catch (err) {
      console.warn('[ask] checkModels failed for', model, err)
      this.setModelState(model, 'error', 'failed to load')
    } finally {
      page.lastActivity = Date.now()
    }
  }

  private setModelState(model: ModelId, state: ModelState, detail?: string): void {
    this.statuses.set(model, { id: model, state, detail, checkedAt: Date.now() })
    this.pushStatuses()
  }

  // ---------------------------------------------------------------- jobs

  private enqueue(model: ModelId, conversationId: string, turnId: string, prompt: string): void {
    const page = this.getOrCreatePage(model)
    const handle: JobHandle = { model, conversationId, turnId, cancelled: false, stopRequested: false }
    this.activeJobs.add(handle)
    page.queue = page.queue
      .then(() => this.runJob(page, handle, prompt))
      .catch((err) => console.warn('[ask] job failed for', model, err))
      .finally(() => this.activeJobs.delete(handle))
  }

  private markStopped(handle: JobHandle): void {
    const conv = store.get(handle.conversationId)
    const answer = conv?.turns.find((t) => t.id === handle.turnId)?.answers.find((a) => a.model === handle.model)
    if (!answer || answer.status === 'done' || answer.status === 'error' || answer.status === 'stopped') return
    const next: AskAnswer = { ...answer, status: 'stopped', finishedAt: Date.now() }
    store.setAnswer(handle.conversationId, handle.turnId, next)
    this.pushAnswer(handle.conversationId, handle.turnId, next)
    this.pushConversations()
  }

  private async runJob(page: ModelPage, handle: JobHandle, prompt: string): Promise<void> {
    if (handle.cancelled) return this.markStopped(handle)
    page.currentJob = handle
    page.lastActivity = Date.now()
    const adapter = adapterFor(handle.model)
    const setAnswer = (patch: Partial<AskAnswer>): void => {
      const turnNow = store.get(handle.conversationId)?.turns.find((t) => t.id === handle.turnId)
      const prev = turnNow?.answers.find((a) => a.model === handle.model)
      const base: AskAnswer = prev ?? { model: handle.model, status: 'queued', markdown: '', startedAt: Date.now() }
      const next: AskAnswer = { ...base, ...patch }
      store.setAnswer(handle.conversationId, handle.turnId, next)
      this.pushAnswer(handle.conversationId, handle.turnId, next)
    }
    // A model that missed earlier turns (answered by other models) gets them quoted first.
    const conv = store.get(handle.conversationId)
    const names = Object.fromEntries(MODEL_IDS.map((id) => [id, SERVICES[id].name])) as Record<ModelId, string>
    const labels = { header: t('askContext.header'), user: t('askContext.user'), footer: t('askContext.footer') }
    const typed = (conv && promptWithContext(conv, handle.turnId, handle.model, names, labels)) || prompt
    try {
      await this.runJobBody(page, adapter, handle, typed, setAnswer)
    } catch (err) {
      console.warn('[ask] job crashed for', handle.model, err)
      if (!handle.cancelled) {
        setAnswer({ status: 'error', error: 'something went wrong talking to the page' })
        this.pushConversations()
      }
    } finally {
      if (page.currentJob === handle) page.currentJob = null
      page.lastActivity = Date.now()
    }
  }

  private async runJobBody(
    page: ModelPage,
    adapter: ModelAdapter,
    handle: JobHandle,
    prompt: string,
    setAnswer: (patch: Partial<AskAnswer>) => void,
  ): Promise<void> {
    const conv = store.get(handle.conversationId)
    if (!conv) return

    setAnswer({ status: 'sending' })
    this.pushConversations()

    const existingThread = conv.threads[handle.model]
    const target = existingThread ?? adapter.newChatUrl
    const current = page.webContents.isDestroyed() ? '' : page.webContents.getURL()
    if (!existingThread || !sameLocation(current, target)) await this.load(page, target)
    if (handle.cancelled) return this.markStopped(handle)

    const ready = await this.waitFor(page, adapter, (p) => this.isSettled(adapter, p), READY_TIMEOUT_MS)
    if (handle.cancelled) return this.markStopped(handle)
    if (!ready) {
      setAnswer({ status: 'error', error: 'the page did not respond' })
      this.setModelState(handle.model, 'error', 'timed out waiting for the page')
      this.pushConversations()
      return
    }
    if (adapter.isLoginUrl(ready.url) || ready.signedIn === false) {
      setAnswer({ status: 'signed-out' })
      this.setModelState(handle.model, 'signed-out')
      this.pushConversations()
      return
    }
    if (ready.challenge) {
      setAnswer({ status: 'needs-action' })
      this.setModelState(handle.model, 'needs-action', 'a verification page is showing')
      this.pushConversations()
      return
    }
    if (!ready.composer) {
      if (ready.notice) {
        const kind = classifyNotice(ready.notice) ?? 'error'
        setAnswer({ status: kind, error: ready.notice, finishedAt: Date.now() })
        this.setModelState(handle.model, kind, ready.notice)
        this.pushConversations()
        return
      }
      setAnswer({ status: 'error', error: 'prompt box not found — the site may have changed' })
      this.setModelState(handle.model, 'error', 'prompt box not found')
      this.pushConversations()
      return
    }

    // Switch variant/thinking/search before typing - skip when this page is already on the
    // same thread with the same switches applied, so a run of follow-ups doesn't re-click them.
    const targetOptions = store.getOptions(handle.conversationId, handle.model)
    const pageUrl = page.webContents.isDestroyed() ? '' : page.webContents.getURL()
    const samePage = page.appliedThreadUrl !== null && sameLocation(page.appliedThreadUrl, pageUrl)
    if (!samePage || !optionsEqual(page.appliedOptions, targetOptions)) {
      const warnings = await this.applyOptions(page, adapter, targetOptions)
      page.appliedOptions = targetOptions
      page.appliedThreadUrl = page.webContents.isDestroyed() ? '' : page.webContents.getURL()
      if (warnings.length) setAnswer({ warning: warnings.join(' ') })
    }
    setAnswer({ options: targetOptions })
    if (handle.cancelled) return this.markStopped(handle)

    const baseline = ready.answerCount
    const wc = page.webContents

    const typeAndSubmit = async (method: 'enter' | 'button'): Promise<void> => {
      await this.runInWorld(page, adapter, FOCUS_SCRIPT)
      if (wc.isDestroyed()) return
      wc.focus()
      await wc.insertText(prompt)
      await sleep(150)
      if (wc.isDestroyed()) return
      if (method === 'enter') {
        wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
        wc.sendInputEvent({ type: 'char', keyCode: '\r' })
        wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
      } else {
        await this.runInWorld(page, adapter, SEND_SCRIPT)
      }
    }

    await typeAndSubmit(adapter.page.submitWith)
    page.lastActivity = Date.now()
    if (handle.cancelled) return this.markStopped(handle)

    let outcome = await this.waitForSendOutcome(page, adapter, baseline, SEND_CONFIRM_MS)
    if (handle.cancelled) return this.markStopped(handle)
    const notSentYet = (o: typeof outcome): boolean => !o.blocked && (!o.probe || (o.probe.answerCount <= baseline && !o.probe.generating))
    if (notSentYet(outcome)) {
      const leftover = await this.runInWorld(page, adapter, COMPOSER_TEXT_SCRIPT)
      const stillThere = typeof leftover === 'string' && prompt.trim().length > 0 && leftover.includes(prompt.trim().slice(0, 40))
      if (stillThere) {
        await typeAndSubmit(adapter.page.submitWith === 'enter' ? 'button' : 'enter')
        outcome = await this.waitForSendOutcome(page, adapter, baseline, SEND_RETRY_MS)
      }
    }
    if (handle.cancelled) return this.markStopped(handle)
    if (outcome.blocked) {
      const kind = classifyNotice(outcome.blocked) ?? 'error'
      setAnswer({ status: kind, error: outcome.blocked, finishedAt: Date.now() })
      this.setModelState(handle.model, kind, outcome.blocked)
      this.pushConversations()
      return
    }
    const sent = outcome.probe
    if (!sent || (sent.answerCount <= baseline && !sent.generating)) {
      setAnswer({ status: 'error', error: 'could not send' })
      this.pushConversations()
      return
    }

    setAnswer({ status: 'streaming' })
    this.pushConversations()

    const hasStop = adapter.page.stop.length > 0
    const quietFor = hasStop ? STREAM_QUIET_WITH_STOP_MS : STREAM_QUIET_NO_STOP_MS
    const hardDeadline = Date.now() + HARD_TIMEOUT_MS
    let lastText = ''
    let lastChangeAt = Date.now()
    let lastPushAt = 0

    for (;;) {
      // Cancelled without a stop click: the model got disabled or its page went away underneath
      // the job. Nothing left to probe — just record whatever text we already have.
      if (handle.cancelled && !handle.stopRequested) {
        setAnswer({ status: 'stopped', markdown: lastText, finishedAt: Date.now() })
        this.pushConversations()
        return
      }
      if (handle.stopRequested) {
        const final = await this.probe(page, adapter)
        setAnswer({ status: 'stopped', markdown: final?.lastAnswer ?? lastText, finishedAt: Date.now() })
        this.pushConversations()
        return
      }
      if (Date.now() > hardDeadline) {
        if (lastText) {
          setAnswer({ status: 'done', markdown: lastText, error: 'stopped early — this was taking too long', finishedAt: Date.now() })
        } else {
          setAnswer({ status: 'error', error: 'timed out', finishedAt: Date.now() })
        }
        this.pushConversations()
        return
      }
      const probe = await this.probe(page, adapter)
      if (!probe) {
        await sleep(STREAM_POLL_MS)
        continue
      }
      page.lastActivity = Date.now()
      if (probe.lastAnswer !== lastText) {
        lastText = probe.lastAnswer
        lastChangeAt = Date.now()
        if (Date.now() - lastPushAt > STREAM_PUSH_MS) {
          setAnswer({ status: 'streaming', markdown: lastText })
          lastPushAt = Date.now()
        }
      }
      if (!probe.generating && Date.now() - lastChangeAt >= quietFor) {
        // An answer that streamed in is kept as-is even if a notice also showed up somewhere -
        // only an empty answer falls back to explaining itself with the service's own words.
        if (lastText) {
          setAnswer({ status: 'done', markdown: lastText, finishedAt: Date.now() })
          break
        }
        if (probe.notice) {
          const kind = classifyNotice(probe.notice) ?? 'error'
          setAnswer({ status: kind, error: probe.notice, finishedAt: Date.now() })
          this.setModelState(handle.model, kind, probe.notice)
          this.pushConversations()
          return
        }
        setAnswer({ status: 'error', error: 'no answer appeared', finishedAt: Date.now() })
        break
      }
      await sleep(STREAM_POLL_MS)
    }

    const finalUrl = page.webContents.isDestroyed() ? '' : page.webContents.getURL()
    if (finalUrl && adapter.isThreadUrl(finalUrl)) store.setThread(conv.id, handle.model, finalUrl)
    this.setModelState(handle.model, 'ready')
    this.pushConversations()
  }

  // ---------------------------------------------------------------- push to the UI + shell

  private pushAnswer(conversationId: string, turnId: string, answer: AskAnswer): void {
    this.broadcast('ask-answer', { conversationId, turnId, answer })
  }

  private pushConversations(): void {
    this.broadcast('ask-conversations', store.list())
  }

  private pushStatuses(): void {
    this.broadcast('ask-models', [...this.statuses.values()])
  }

  private broadcast<K extends EventChannel>(channel: K, payload: EventMap[K]): void {
    const ui = this.uiWebContents()
    if (ui && !ui.isDestroyed()) ui.send(`nd:${channel}`, payload)
    emit(channel, payload)
  }
}
