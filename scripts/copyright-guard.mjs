#!/usr/bin/env node
/**
 * Copyright guard (SECURITY §12, ADR-0003): fails if any tracked file is a PDF, sits in a page-image
 * folder, lives under .work/ or Med_source/, or is a raster image outside content/images (allowlist) and build/.
 */
import { execFileSync } from 'node:child_process'

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const bad = files.filter((f) => {
  const p = f.replace(/\\/g, '/')
  if (/\.pdf$/i.test(p)) return true
  if (/(^|\/)(\.work|Med_source|page-images)\//i.test(p)) return true
  if (/\/pages\/[^/]+\.(png|jpe?g)$/i.test(p)) return true
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(p) && !p.startsWith('build/') && !p.startsWith('content/images/') && !p.startsWith('docs/screenshots/')) return true
  return false
})
if (bad.length) {
  console.error(`Copyright guard failed — these files must not be committed (ADR-0003):\n  ${bad.join('\n  ')}`)
  process.exit(1)
}
console.log(`copyright guard: ${files.length} tracked files OK`)
