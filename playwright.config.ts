import { defineConfig } from '@playwright/test'

// Drives the built app (out/) through Playwright's Electron support. On Linux CI run it under
// xvfb-run. Tabs load about:blank in these runs (NOTEDESK_E2E), so no Google traffic.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
})
