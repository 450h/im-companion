import { defineConfig } from '@playwright/test'

/** README screenshots only (npm run screenshots). */
export default defineConfig({
  testDir: 'tests/showcase',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']]
})
