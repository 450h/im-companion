import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Launches the built, unpackaged app (out/) with an isolated data dir and a fixture content pack
 * (real blueprint + books, one small fixture topic) so the smoke test doesn't depend on generated content.
 */
export async function launch(dataDir = mkdtempSync(join(tmpdir(), 'imc-e2e-')), realContent = false): Promise<{ app: ElectronApplication; page: Page; dataDir: string }> {
  const root = resolve(__dirname, '../..')
  const contentDir = realContent ? join(root, 'content') : join(dataDir, 'fixture-content')
  if (!realContent) {
    mkdirSync(join(contentDir, 'topics'), { recursive: true })
    cpSync(join(root, 'content', 'blueprint.json'), join(contentDir, 'blueprint.json'))
    cpSync(join(root, 'content', 'books.json'), join(contentDir, 'books.json'))
    cpSync(join(__dirname, 'fixtures', 'gi-history-exam.json'), join(contentDir, 'topics', 'gi-history-exam.json'))
  }
  const env: Record<string, string | undefined> = { ...process.env, IMC_DATA_DIR: join(dataDir, 'data'), IMC_CONTENT_DIR: contentDir, IMC_DISABLE_UPDATES: '1' }
  delete env['ELECTRON_RENDERER_URL']
  delete env['ELECTRON_RUN_AS_NODE']
  const app = await electron.launch({ args: [root], env: env as Record<string, string> })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, dataDir }
}
