// Renders the README screenshots from the built app (run `npm run build` first; on Linux run
// it under xvfb-run). Tabs stay on about:blank (NOTEDESK_E2E), so the shots show NoteDesk's
// own UI only: tab strip, palette, settings and panels over an empty page.
import { _electron as electron } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'docs/screenshots')
mkdirSync(out, { recursive: true })

const TABS = [
  { service: 'notebook', title: 'Organic Chemistry' },
  { service: 'notebook', title: 'Thesis sources' },
  { service: 'gemini', title: 'Eigenvectors explained' },
  { service: 'notebook', title: 'Quarterly report' },
]

// A few entries for the palette's "Recent" section, in NoteDesk's own history format.
const now = Date.now()
const HISTORY = [
  ['https://notebook.google/notebook/5f2c9a1e-organic', 'Organic Chemistry', 'notebook'],
  ['https://notebook.google/notebook/8b41d7c0-thesis', 'Thesis sources', 'notebook'],
  ['https://gemini.google.com/app/3c9e1f07a2b4', 'Eigenvectors explained', 'gemini-chat'],
  ['https://notebook.google/notebook/a17e5b92-history', 'World history lectures', 'notebook'],
  ['https://gemini.google.com/app/7d20b6e4c91a', 'Regex for log parsing', 'gemini-chat'],
  ['https://notebook.google/notebook/c3f08d4a-ml', 'Machine learning course', 'notebook'],
].map(([url, title, kind], i) => {
  const u = new URL(url)
  return { key: `${u.hostname}${u.pathname}`, url, title, kind, profileId: 'default', lastVisited: now - i * 3_600_000, visits: 3 }
})

async function start(settings) {
  const userData = mkdtempSync(join(tmpdir(), 'notedesk-shots-'))
  writeFileSync(join(userData, 'history.json'), JSON.stringify(HISTORY))
  const env = { ...process.env, NOTEDESK_E2E: '1', NOTEDESK_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: [root, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], env })
  const isShell = (p) => p.url().endsWith('/renderer/index.html')
  const shell = app.windows().find(isShell) ?? (await app.waitForEvent('window', { predicate: isShell }))
  await shell.waitForSelector('[role="tablist"]')
  await app.evaluate(({ BaseWindow }) => {
    const [win] = BaseWindow.getAllWindows()
    win.unmaximize()
    win.setContentSize(1280, 800)
  })
  await shell.evaluate((s) => window.nd.invoke('settings:set', { onboarded: true, ...s }), settings)

  // Replace the default tab with a few named ones.
  const first = await shell.evaluate(async () => (await window.nd.invoke('app:init')).tabs.activeId)
  for (const tab of TABS) await shell.evaluate((s) => window.nd.invoke('tabs:create', { service: s }), tab.service)
  await shell.evaluate((id) => window.nd.invoke('tabs:close', id), first)
  await shell.waitForTimeout(300)
  // Tabs are created in order, so their pages are the live about:blank contents sorted by id.
  await app.evaluate(({ webContents }, titles) => {
    const pages = webContents
      .getAllWebContents()
      .filter((w) => !w.isDestroyed() && w.getURL() === 'about:blank')
      .sort((a, b) => a.id - b.id)
    pages.forEach((wc, i) => wc.executeJavaScript(`document.title = ${JSON.stringify(titles[i] ?? '')}`))
  }, TABS.map((t) => t.title))
  const ids = await shell.evaluate(async () => (await window.nd.invoke('app:init')).tabs.tabs.map((t) => t.id))
  await shell.evaluate((id) => window.nd.invoke('tabs:activate', id), ids[0])
  await shell.waitForTimeout(600)
  return { app, shell, userData, ids }
}

async function command(app, name) {
  await app.evaluate(({ webContents }, name) => {
    webContents.getAllWebContents().find((w) => w.getURL().endsWith('/renderer/index.html'))?.send('nd:command', name)
  }, name)
}

async function shot(run, file) {
  await run.shell.waitForTimeout(700)
  await run.shell.screenshot({ path: join(out, file) })
  await run.app.close()
  rmSync(run.userData, { recursive: true, force: true })
}

// 1. Overview: Aurora, dark, command palette with open tabs, recent notebooks and commands.
{
  const run = await start({ theme: 'aurora', colorMode: 'dark', tabLayout: 'top' })
  await command(run.app, 'palette')
  await run.shell.waitForSelector('.palette input')
  await shot(run, 'overview.png')
}

// 2. Command palette search: Minimal, light.
{
  const run = await start({ theme: 'minimal', colorMode: 'light', tabLayout: 'top' })
  await command(run.app, 'palette')
  await run.shell.waitForSelector('.palette input')
  await run.shell.locator('.palette input').fill('his')
  await shot(run, 'palette.png')
}

// 3. Theme gallery: Paper, light.
{
  const run = await start({ theme: 'paper', colorMode: 'light', tabLayout: 'top' })
  await command(run.app, 'settings')
  await run.shell.waitForSelector('.settings')
  await shot(run, 'themes.png')
}

// 4. Sidebar layout: Catppuccin, dark, with the shortcuts cheat sheet.
{
  const run = await start({ theme: 'catppuccin', colorMode: 'dark', tabLayout: 'vertical', sidebarCollapsed: false })
  await run.shell.evaluate((id) => window.nd.invoke('tabs:sleep', id), run.ids[2])
  await command(run.app, 'shortcuts')
  await shot(run, 'sidebar-dark.png')
}

console.log(`screenshots written to ${out}`)
