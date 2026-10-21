/**
 * Real-content tour (run with REAL_CONTENT=1): loads the full content pack, creates a plan and captures
 * screenshots of the main screens for a visual release check. Skipped in CI by default.
 */
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './launch'

const shots = join(__dirname, 'screenshots', 'real')
mkdirSync(shots, { recursive: true })

test.skip(process.env['REAL_CONTENT'] !== '1', 'set REAL_CONTENT=1 to run the real-content tour')

test('real content tour', async () => {
  const { app, page } = await launch(undefined, true)
  try {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.getByRole('button', { name: /I understand/ }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create my plan' }).click()
    await expect(page.getByRole('heading', { name: 'Today’s sessions' })).toBeVisible()
    await page.screenshot({ path: join(shots, '01-today.png') })

    await page.getByRole('button', { name: /Study/ }).first().click()
    await page.screenshot({ path: join(shots, '02-topics.png') })
    await page.getByText('Acute kidney injury').first().click()
    await expect(page.getByRole('heading', { name: 'Acute kidney injury', level: 1 })).toBeVisible()
    await page.screenshot({ path: join(shots, '03-reader-aki.png') })
    await page.mouse.wheel(0, 1600)
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(shots, '04-reader-aki-scrolled.png') })

    await page.getByRole('button', { name: 'Practice questions' }).click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(shots, '05-practice.png') })

    await page.getByRole('button', { name: /Practice/ }).first().click()
    await page.getByRole('button', { name: 'EMQ Volumes' }).click()
    await page.screenshot({ path: join(shots, '06-emq-volumes.png') })
    await page.getByRole('button', { name: 'Exams & mocks' }).click()
    await page.screenshot({ path: join(shots, '07-exams.png') })

    await page.getByRole('button', { name: /Plan/ }).first().click()
    await page.screenshot({ path: join(shots, '08-plan-week.png') })
    await page.getByRole('button', { name: /Progress/ }).first().click()
    await page.screenshot({ path: join(shots, '09-progress.png') })
  } finally {
    await app.close()
  }
})
