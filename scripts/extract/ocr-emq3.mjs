#!/usr/bin/env node
/**
 * Build-time only (docs/09 §1, QA N7): OCR the scanned EMQ Volume 3 page images in .work/emq3-png
 * into .work/text/emq3/NNNN.txt so the answer-key index and the copy check can use its text.
 * Never shipped; .work/ is gitignored (ADR-0003).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createWorker } from 'tesseract.js'

const root = resolve(import.meta.dirname, '../..')
const src = join(root, '.work', 'emq3-png')
const out = join(root, '.work', 'text', 'emq3')
mkdirSync(out, { recursive: true })

const worker = await createWorker('eng')
const files = readdirSync(src).filter((f) => f.endsWith('.png')).sort()
let n = 0
for (const f of files) {
  const target = join(out, f.replace('.png', '.txt'))
  if (existsSync(target) && !process.argv.includes('--force')) continue
  const { data } = await worker.recognize(join(src, f))
  writeFileSync(target, data.text, 'utf8')
  if (++n % 25 === 0) console.log(`${n} pages…`)
}
await worker.terminate()
console.log(`OCR done: ${n} page(s) written to .work/text/emq3`)
