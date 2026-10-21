/**
 * README screenshots (npm run screenshots): drives the built app with the real content pack and writes
 * PNGs to docs/screenshots/. Not part of CI.
 */
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from '../e2e/launch'

const out = resolve(__dirname, '../../docs/screenshots')
mkdirSync(out, { recursive: true })
const shot = (page: Page, name: string): Promise<Buffer> => page.screenshot({ path: join(out, `${name}.png`) })
const nav = (page: Page, name: string): Promise<void> => page.locator('.sidebar').getByRole('button', { name }).click()

test('README screenshot tour', async () => {
  const { app, page } = await launch(undefined, true)
  try {
    await page.setViewportSize({ width: 1440, height: 900 })

    // First run → plan preview
    await page.getByRole('button', { name: /I understand/ }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    await shot(page, 'plan-preview')
    await page.getByRole('button', { name: 'Create my plan' }).click()
    await expect(page.getByRole('heading', { name: 'Today’s sessions' })).toBeVisible()

    // Reader: cirrhosis
    await nav(page, 'Study')
    await shot(page, 'topics')
    await page.getByText('Chronic liver disease & cirrhosis').first().click()
    await expect(page.getByRole('heading', { name: 'Chronic liver disease & cirrhosis', level: 1 })).toBeVisible()
    await page.locator('.section').first().scrollIntoViewIfNeeded()
    await page.evaluate(() => document.querySelector('.main')?.scrollBy(0, 330))
    await shot(page, 'reader')

    // Section quiz with a wrong answer → routing to the section + page
    const sec = page.locator('.section').first()
    await sec.getByRole('button', { name: /Done reading/ }).click()
    await expect(sec.locator('.q-card').first()).toBeVisible()
    // Answer with the last option until one is wrong, to show the "where to study" routing.
    for (let i = 0; i < 8; i++) {
      const opts = sec.locator('.opt:not([disabled]), .letters button:not([disabled])')
      if (!(await opts.count())) {
        const next = sec.getByRole('button', { name: 'Next →' })
        if (await next.isEnabled().catch(() => false)) {
          await next.click()
          continue
        }
        break
      }
      await opts.last().click()
      await page.waitForTimeout(250)
      if (await sec.getByText(/Not quite/).first().isVisible().catch(() => false)) break
    }
    await page.locator('.feedback').first().scrollIntoViewIfNeeded()
    await page.evaluate(() => document.querySelector('.main')?.scrollBy(0, 200))
    await shot(page, 'wrong-answer-routing')

    // Practice: EMQ format
    await nav(page, 'Practice')
    await page.getByRole('button', { name: 'Questions' }).click()
    await page.getByText('Acute kidney injury').first().click()
    await page.getByRole('button', { name: 'EMQ (midterm)' }).click()
    await page.getByRole('button', { name: /^Start \(/ }).click()
    await expect(page.locator('.emq-options').first()).toBeVisible()
    await shot(page, 'emq-practice')

    // Flashcards
    await nav(page, 'Practice')
    await page.getByRole('button', { name: 'Flashcards' }).click()
    await page.getByRole('row', { name: /Cardiology/ }).getByRole('button', { name: 'Study' }).click()
    await page.locator('.flashcard').click()
    await shot(page, 'flashcards')

    // Timed chapter exam
    await nav(page, 'Practice')
    await page.getByRole('button', { name: 'Exams & mocks' }).click()
    await shot(page, 'exams')
    await page.locator('.list-item', { hasText: 'Cardiology — chapter exam' }).getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.timer')).toBeVisible()
    await page.locator('.opt, .letters button').first().click()
    await shot(page, 'chapter-exam')

    // EMQ Volumes answer sheet
    await nav(page, 'Practice')
    await page.getByRole('button', { name: 'EMQ Volumes' }).click()
    await shot(page, 'emq-volumes')

    // Today, Plan, Progress
    await nav(page, 'Today')
    await shot(page, 'today')
    await nav(page, 'Plan')
    await shot(page, 'plan-week')
    await nav(page, 'Progress')
    await shot(page, 'progress')
  } finally {
    await app.close()
  }
})
