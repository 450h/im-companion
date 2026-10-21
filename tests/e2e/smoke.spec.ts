/**
 * Smoke test (docs/08 v0.1.0 acceptance): first run → plan → read all sections + section quizzes → topic quiz
 * → the New Study task is ticked automatically; a wrong answer shows the study link; progress survives relaunch.
 */
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './launch'

const shots = join(__dirname, 'screenshots')
mkdirSync(shots, { recursive: true })

test('first run → study → quizzes → auto-logged → relaunch', async () => {
  const { app, page, dataDir } = await launch()
  try {
    await expect(page.getByRole('heading', { name: 'Welcome to MED 222 IM Companion' })).toBeVisible()
    await page.screenshot({ path: join(shots, '01-welcome.png') })
    await page.getByRole('button', { name: /I understand/ }).click()
    await expect(page.getByRole('heading', { name: /plan$/ })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Already studied anything?' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    await page.screenshot({ path: join(shots, '02-preview.png') })
    await page.getByRole('button', { name: 'Create my plan' }).click()

    // Study the fixture topic directly
    await page.getByRole('button', { name: /Study/ }).first().click()
    await page.getByText('History & physical exam').first().click()
    await expect(page.getByRole('heading', { name: 'Fixture: history taking' })).toBeVisible()
    await page.screenshot({ path: join(shots, '03-reader.png') })

    // Section 1: read → quiz, answer one wrong to see routing
    await page.locator('#gi-history-exam\\.s1').getByRole('button', { name: /Done reading/ }).click()
    await page.getByRole('radio', { name: /Bravo/ }).first().click()
    await expect(page.getByText(/Not quite/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Study this:/ })).toBeVisible()
    await page.getByRole('button', { name: 'Next →' }).click()
    await page.getByRole('radio', { name: /Bravo/ }).first().click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.getByRole('button', { name: 'Close' }).click()

    // Section 2
    await page.locator('#gi-history-exam\\.s2').getByRole('button', { name: /Done reading/ }).click()
    await page.getByRole('radio', { name: /Alpha/ }).first().click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.getByRole('button', { name: 'Close' }).click()

    // Topic quiz → confidence → topic studied
    await page.getByRole('button', { name: 'Start topic quiz' }).click()
    await page.getByRole('radio', { name: /Alpha/ }).first().click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await page.getByRole('button', { name: '4' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('✔ Studied').first()).toBeVisible()
    await page.screenshot({ path: join(shots, '04-studied.png') })

    // Progress page shows it
    await page.getByRole('button', { name: /Progress/ }).first().click()
    await expect(page.getByRole('heading', { name: /Progress — Midterm/ })).toBeVisible()
    await page.screenshot({ path: join(shots, '05-progress.png'), fullPage: true })
  } finally {
    await app.close()
  }

  // Relaunch with the same data: still studied
  const again = await launch(dataDir)
  try {
    await again.page.getByRole('button', { name: /Study/ }).first().click()
    await expect(again.page.getByText('✔ Studied').first()).toBeVisible()
  } finally {
    await again.app.close()
  }
})
