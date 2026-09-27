import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export interface Running {
  app: ElectronApplication
  shell: Page
  userData: string
}

export function freshUserData(): string {
  return mkdtempSync(join(tmpdir(), 'notedesk-e2e-'))
}

/** Starts the built app with an isolated profile folder and returns the shell UI page. */
export async function launch(userData = freshUserData()): Promise<Running> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') env[k] = v
  env['NOTEDESK_E2E'] = '1'
  env['NOTEDESK_USER_DATA'] = userData
  const app = await electron.launch({
    args: [resolve(__dirname, '../..'), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env,
  })
  const isShell = (p: Page) => /\/renderer\/index\.html$/.test(p.url())
  const shell = app.windows().find(isShell) ?? (await app.waitForEvent('window', { predicate: isShell }))
  await shell.waitForSelector('[role="tablist"]')
  return { app, shell, userData }
}

export function readSettings(userData: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}


/**
 * Presses a key combination the way the OS would deliver it to the shell window. Playwright's
 * own keyboard goes through DevTools and skips `before-input-event`, where NoteDesk handles
 * its shortcuts, so this goes through webContents.sendInputEvent instead.
 */
export async function shortcut(app: ElectronApplication, keyCode: string, modifiers: string[] = []): Promise<void> {
  await app.evaluate(
    ({ webContents }, { keyCode, modifiers }) => {
      const wc = webContents.getAllWebContents().find((w) => /\/renderer\/index\.html$/.test(w.getURL()))
      if (!wc) throw new Error('shell not found')
      type Mod = 'control' | 'meta' | 'shift' | 'alt'
      wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers: modifiers as Mod[] })
      wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers: modifiers as Mod[] })
    },
    { keyCode, modifiers },
  )
}

export const modifier = process.platform === 'darwin' ? 'meta' : 'control'

/** Calls `window.nd.invoke` on the shell page, the same bridge the renderer uses. */
export async function invoke<T>(run: Running, channel: string, ...args: unknown[]): Promise<T> {
  const result = await run.shell.evaluate(
    ({ channel, args }) => {
      const nd = (window as unknown as { nd: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).nd
      return nd.invoke(channel, ...args)
    },
    { channel, args },
  )
  return result as T
}

/** Opens the Ask tab (a WebContentsView, which Playwright still sees as a page) and returns it. */
export async function openAsk(run: Running): Promise<Page> {
  const isAsk = (p: Page) => /\/renderer\/ask\.html$/.test(p.url())
  const existing = run.app.windows().find(isAsk)
  await invoke(run, 'tabs:openAsk')
  const page = existing ?? (await run.app.waitForEvent('window', { predicate: isAsk }))
  await page.waitForSelector('textarea')
  return page
}
