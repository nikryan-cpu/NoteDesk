import { expect, test } from '@playwright/test'
import { launch, modifier, readSettings, shortcut, type Running } from './app'

let run: Running

test.afterEach(async () => {
  await run?.app.close()
})

test('starts with one restored tab and the shell UI', async () => {
  run = await launch()
  const { shell } = run
  await expect(shell.locator('[role="tab"]')).toHaveCount(1)
  await expect(shell.locator('html')).toHaveAttribute('data-theme', 'minimal')
  // E2E runs never show onboarding and never reach Google.
  await expect(shell.locator('.overlay')).toHaveCount(0)
  const urls = await run.app.evaluate(({ webContents }) => webContents.getAllWebContents().map((w) => w.getURL()))
  expect(urls.some((u) => u.includes('google'))).toBe(false)
})

test('opens and closes tabs with the + button and shortcuts', async () => {
  run = await launch()
  const { app, shell } = run
  const tabs = shell.locator('[role="tab"]')
  await shell.locator('.titlebar .new button').first().click()
  await expect(tabs).toHaveCount(2)
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

  await shortcut(app, 'G', [modifier, 'shift'])
  await expect(tabs).toHaveCount(3)
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')

  await shortcut(app, 'W', [modifier])
  await expect(tabs).toHaveCount(2)
  await shortcut(app, 'T', [modifier, 'shift'])
  await expect(tabs).toHaveCount(3)
})

test('command palette filters commands and switches the theme', async () => {
  run = await launch()
  const { app, shell } = run
  await shortcut(app, 'K', [modifier])
  const palette = shell.locator('.palette')
  await expect(palette).toBeVisible()
  const input = palette.locator('input')
  await expect(input).toBeFocused()

  await input.fill('>zoom')
  await expect(palette.locator('[role="option"]')).toHaveCount(3)

  await input.fill('nord')
  await expect(palette.getByText('Nord', { exact: false }).first()).toBeVisible()
  await input.press('Enter')
  await expect(shell.locator('.overlay')).toHaveCount(0)
  await expect(shell.locator('html')).toHaveAttribute('data-theme', 'nord')
})

test('prompt palette lists the starter prompts', async () => {
  run = await launch()
  const { app, shell } = run
  await shortcut(app, 'P', [modifier])
  const palette = shell.locator('.palette')
  await expect(palette).toBeVisible()
  await expect(palette.locator('[role="option"]')).toHaveCount(5)
  await shell.keyboard.press('Escape')
  await expect(shell.locator('.overlay')).toHaveCount(0)
})

test('settings are saved to disk and survive a restart', async () => {
  run = await launch()
  const { app, shell, userData } = run
  await shortcut(app, ',', [modifier])
  const settings = shell.locator('.settings')
  await expect(settings).toBeVisible()

  await settings.getByRole('button', { name: /Paper/ }).first().click()
  await expect(shell.locator('html')).toHaveAttribute('data-theme', 'paper')
  await settings.getByRole('radio', { name: 'Sidebar' }).click()
  await expect(shell.locator('html')).toHaveAttribute('data-layout', 'vertical')
  await expect.poll(() => readSettings(userData)['theme']).toBe('paper')
  await expect.poll(() => readSettings(userData)['tabLayout']).toBe('vertical')
  await app.close()

  run = await launch(userData)
  await expect(run.shell.locator('html')).toHaveAttribute('data-theme', 'paper')
  await expect(run.shell.locator('html')).toHaveAttribute('data-layout', 'vertical')
  await expect(run.shell.locator('.sidebar')).toBeVisible()
})
