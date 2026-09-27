import { expect, test, type Page } from '@playwright/test'
import { launch, openAsk, type Running } from './app'

// The Ask window drives each service's page in the background. In E2E runs every model points
// at tests/fixtures/fake-chat.html, a local page that streams "reply to: <prompt> (turn N)".

let run: Running

test.afterEach(async () => {
  await run?.app.close()
})

async function ask(page: Page, prompt: string): Promise<void> {
  const box = page.locator('textarea').first()
  await box.fill(prompt)
  await box.press('Enter')
}

function answers(page: Page) {
  return page.locator('.turn').last().locator('.answer-card')
}

test('sends one prompt to two models and keeps each chat for follow-ups', async () => {
  run = await launch()
  const page = await openAsk(run)

  await page.getByRole('button', { name: /Claude/ }).first().click()
  await ask(page, 'What is a monad?')
  await expect(answers(page)).toHaveCount(2)
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(2, { timeout: 20_000 })
  await expect(answers(page).first()).toContainText('reply to: What is a monad? (turn 0)')

  // The follow-up goes to the same chat on each service, so the fake page counts one earlier turn.
  await ask(page, 'And a functor?')
  await expect(page.locator('.turn')).toHaveCount(2)
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(2, { timeout: 20_000 })
  await expect(answers(page).nth(1)).toContainText('reply to: And a functor? (turn 1)')
})

test('conversations have separate memory and survive a restart', async () => {
  run = await launch()
  let page = await openAsk(run)

  await ask(page, 'First conversation')
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(1, { timeout: 20_000 })

  await page.keyboard.press('Control+N')
  await ask(page, 'Second conversation')
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(1, { timeout: 20_000 })
  // A new conversation starts a new chat on the service: no earlier turns there.
  await expect(answers(page).first()).toContainText('(turn 0)')

  const items = page.locator('.item-btn')
  await expect(items).toHaveCount(2)
  await items.filter({ hasText: 'First conversation' }).click()
  await ask(page, 'Back to the first one')
  await expect(page.locator('.turn')).toHaveCount(2)
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(1, { timeout: 20_000 })
  await expect(answers(page).first()).toContainText('(turn 1)')

  const userData = run.userData
  await run.app.close()
  run = await launch(userData)
  page = await openAsk(run)
  await expect(page.locator('.item-btn')).toHaveCount(2)
  await page.locator('.item-btn').filter({ hasText: 'First conversation' }).click()
  await expect(page.locator('.turn')).toHaveCount(2)
})

test('the title bar button opens the Ask window', async () => {
  run = await launch()
  const isAsk = (p: Page) => /\/renderer\/quick\.html$/.test(p.url())
  const opened = run.app.waitForEvent('window', { predicate: isAsk })
  await run.shell.locator('.titlebar .pill.ask').click()
  const page = await opened
  await expect(page.locator('textarea')).toBeVisible()
})

test('a model that joins later gets the earlier turns', async () => {
  run = await launch()
  const page = await openAsk(run)

  await ask(page, 'Remember the number 42')
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(1, { timeout: 20_000 })

  // Switch the conversation from Gemini to Claude only.
  await page.getByRole('button', { name: /Claude/ }).first().dblclick()
  await ask(page, 'Which number was it?')
  await expect(answers(page).locator('.status-chip[data-status="done"]')).toHaveCount(1, { timeout: 20_000 })
  await expect(answers(page).first()).toContainText('Earlier in this conversation')
  await expect(answers(page).first()).toContainText('Remember the number 42')
})
