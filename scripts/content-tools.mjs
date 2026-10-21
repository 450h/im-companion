#!/usr/bin/env node
/**
 * Build-time content tools (docs/09). Local only: copy-check needs .work/ (the owner's extracted
 * source text, never committed). CI only verifies the resulting hashes (src/main/content.test.ts).
 *
 *   node scripts/content-tools.mjs normalize <topicId|all>    fill citation `page` from .work/pagemap (printed books)
 *   node scripts/content-tools.mjs copycheck <topicId|all>    n-gram + EMQ option-overlap check; stamps copyCheck on pass
 *   node scripts/content-tools.mjs stamp-source <topicId> <checkerVersion>   stamp sourceCheck after a passed source-check
 *   node scripts/content-tools.mjs hash <topicId>
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const CONTENT = join(ROOT, 'content')
const WORK = join(ROOT, '.work')
const HASH_EXCLUDED = new Set(['sourceCheck', 'copyCheck', 'ownerReviewedAt'])

/** Must match canonical() in src/main/content-lint.ts. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
function contentHash(topic) {
  const stripped = {}
  for (const [k, v] of Object.entries(topic)) if (!HASH_EXCLUDED.has(k)) stripped[k] = v
  return createHash('sha256').update(canonical(stripped)).digest('hex')
}

const topicPath = (id) => join(CONTENT, 'topics', `${id}.json`)
const loadTopic = (id) => JSON.parse(readFileSync(topicPath(id), 'utf8'))
const saveTopic = (t) => writeFileSync(topicPath(t.topicId), JSON.stringify(t, null, 1) + '\n', 'utf8')
const allTopicIds = () =>
  existsSync(join(CONTENT, 'topics'))
    ? readdirSync(join(CONTENT, 'topics')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
    : []
const ids = (arg) => (arg === 'all' ? allTopicIds() : arg.split(','))

function* walkCites(node) {
  if (Array.isArray(node)) for (const x of node) yield* walkCites(x)
  else if (node && typeof node === 'object') {
    if (typeof node.book === 'string' && (typeof node.pdfPage === 'number' || typeof node.page === 'number')) yield node
    for (const [k, v] of Object.entries(node)) if (k !== 'sourceCheck' && k !== 'copyCheck') yield* walkCites(v)
  }
}

/* ------------------------------------------------------------------ normalize */
const books = JSON.parse(readFileSync(join(CONTENT, 'books.json'), 'utf8'))
const pageKind = Object.fromEntries(books.map((b) => [b.id, b.pageKind]))
const pagemaps = {}
function printedPage(book, pdfPage) {
  if (pageKind[book] !== 'printed') return pdfPage
  pagemaps[book] ??= existsSync(join(WORK, 'pagemap', `${book}.json`)) ? JSON.parse(readFileSync(join(WORK, 'pagemap', `${book}.json`), 'utf8')) : {}
  const p = pagemaps[book][String(pdfPage)]
  return typeof p === 'number' ? p : pdfPage
}
function normalize(id) {
  const t = loadTopic(id)
  let n = 0
  for (const c of walkCites(t)) {
    if (typeof c.pdfPage !== 'number') continue
    const p = printedPage(c.book, c.pdfPage)
    if (c.page !== p) {
      c.page = p
      n++
    }
    if (typeof c.pageEnd === 'number' && c.pageEnd < c.page) delete c.pageEnd
  }
  saveTopic(t)
  console.log(`${id}: ${n} citation page(s) normalised`)
}

/* ------------------------------------------------------------------ copy check */
const words = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
function strings(node, out = []) {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) node.forEach((x) => strings(x, out))
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) if (!['id', 'sectionId', 'topicId', 'book', 'svg', 'sourceCheck', 'copyCheck'].includes(k)) strings(v, out)
  return out
}
/** Numbers and units: runs dominated by these are factual data (classification/dose tables), not expression. */
const DATA_TOKEN = /^(\d+(\.\d+)?|mg|g|kg|mcg|ug|ml|l|mmol|umol|mmhg|iu|units?|daily|hours?|h|days?|weeks?|years?|x|per|min)$/
function isData(gram) {
  const ws = gram.split(' ')
  return ws.filter((w) => DATA_TOKEN.test(w)).length / ws.length >= 0.4
}
function grams(ws, n) {
  const out = new Map()
  for (let i = 0; i + n <= ws.length; i++) {
    const g = ws.slice(i, i + n).join(' ')
    if (!isData(g)) out.set(g, i)
  }
  return out
}

/** The EMQ books' standard instruction sentence, replaced with our own wording (docs/content-authoring.md). */
const BOOK_LEADIN = /\s*(each|the|any)?\s*(option|item)s?\s*(may|can|could)\s*be\s*used\s*once,?\s*(or\s*)?more\s*than\s*once,?\s*or\s*not\s*at\s*all\.?/gi
const OUR_LEADIN = ' Any option can be the answer for several patients, or for none.'
function fixLeadins(t) {
  let n = 0
  for (const q of t.questions) {
    if (q.kind !== 'emq') continue
    const next = q.leadIn.replace(BOOK_LEADIN, () => (n++, OUR_LEADIN)).replace(/\s{2,}/g, ' ').trim()
    q.leadIn = next
  }
  return n
}
let sourceCache = null
function sources() {
  if (sourceCache) return sourceCache
  const dir = join(WORK, 'text')
  if (!existsSync(dir)) throw new Error('.work/text not found: run scripts/extract/extract_text.py first (local only)')
  sourceCache = []
  for (const book of readdirSync(dir)) {
    if (book === 'blueprint') continue
    for (const f of readdirSync(join(dir, book))) sourceCache.push({ book, page: f.slice(0, -4), ws: words(readFileSync(join(dir, book, f), 'utf8')), raw: null })
  }
  return sourceCache
}
/** For source-checked topics only: normalise lead-ins → copy check → stamp copyCheck + sourceCheck. */
function finalize(id, version) {
  const t = loadTopic(id)
  const fixed = fixLeadins(t)
  if (fixed) saveTopic(t)
  const before = process.exitCode
  process.exitCode = 0
  copycheck(id)
  if (process.exitCode) {
    console.log(`${id}: NOT stamped (copy check failed)`)
    return
  }
  process.exitCode = before
  stampSource(id, version)
  // copyCheck was stamped before sourceCheck; both hash the same content (stamps are excluded from the hash).
}

function copycheck(id) {
  const t = loadTopic(id)
  const own = words(strings({ ...t, sourceCheck: undefined, copyCheck: undefined }).join(' \n '))
  const g12 = grams(own, 12)
  const g8 = grams(own, 8)
  const hits = []
  for (const s of sources()) {
    const isEmq = s.book.startsWith('emq')
    const set = isEmq ? g8 : g12
    const n = isEmq ? 8 : 12
    for (let i = 0; i + n <= s.ws.length; i++) {
      const k = s.ws.slice(i, i + n).join(' ')
      if (set.has(k)) {
        hits.push(`${s.book} p${Number(s.page)}: "${k}"`)
        i += n
      }
    }
  }
  // Original EMQ option lists must not mirror an EMQ-volume theme (> 50% of options on one source page).
  for (const q of t.questions.filter((q) => q.kind === 'emq')) {
    const opts = q.options.map((o) => words(o).join(' ')).filter((o) => o.length > 3)
    for (const s of sources().filter((s) => s.book.startsWith('emq'))) {
      const page = ` ${s.ws.join(' ')} `
      const found = opts.filter((o) => page.includes(` ${o} `)).length
      if (opts.length >= 6 && found / opts.length > 0.5) hits.push(`${q.id}: ${found}/${opts.length} options match ${s.book} p${Number(s.page)}`)
    }
  }
  if (hits.length) {
    console.log(`${id}: COPY CHECK FAILED (${hits.length})\n  ${hits.slice(0, 40).join('\n  ')}`)
    process.exitCode = 1
    return
  }
  t.copyCheck = { passedAt: new Date().toISOString(), contentHash: contentHash(t) }
  saveTopic(t)
  console.log(`${id}: copy check passed`)
}

/** Merge .work/emq-index/vol*.json → content/emq-volumes.json after an 8-gram check of every explanation. */
function mergeEmq() {
  const dir = join(WORK, 'emq-index')
  const all = []
  for (const f of readdirSync(dir).filter((x) => /^vol\d\.json$/.test(x)).sort()) all.push(...JSON.parse(readFileSync(join(dir, f), 'utf8')))
  // One combined 8-gram index of all explanations, then a single pass over the EMQ books.
  const index = new Map()
  for (const th of all) for (const it of th.items) for (const g of grams(words(it.explanation), 8).keys()) index.set(g, `${th.id} item ${it.n}`)
  const hits = []
  for (const s of sources().filter((x) => x.book.startsWith('emq'))) {
    for (let i = 0; i + 8 <= s.ws.length; i++) {
      const g = s.ws.slice(i, i + 8).join(' ')
      if (index.has(g)) hits.push(`${index.get(g)}: "${g}" (${s.book} p${Number(s.page)})`)
    }
  }
  if (hits.length) {
    console.log(`EMQ index COPY CHECK FAILED (${hits.length})\n  ${hits.slice(0, 40).join('\n  ')}`)
    process.exitCode = 1
    return
  }
  const ids = new Set()
  for (const th of all) {
    if (ids.has(th.id)) throw new Error(`duplicate theme id ${th.id}`)
    ids.add(th.id)
  }
  writeFileSync(join(CONTENT, 'emq-volumes.json'), JSON.stringify(all, null, 1) + '\n', 'utf8')
  console.log(`emq-volumes.json: ${all.length} themes (${all.filter((t) => t.inBlueprint).length} in blueprint), copy check passed`)
}

function stampSource(id, version) {
  const t = loadTopic(id)
  t.sourceCheck = { passedAt: new Date().toISOString(), contentHash: contentHash(t), checkerVersion: version ?? 'v1' }
  saveTopic(t)
  console.log(`${id}: sourceCheck stamped`)
}

const [cmd, arg, extra] = process.argv.slice(2)
if (cmd === 'merge-emq') {
  mergeEmq()
  process.exit()
}
if (!cmd || !arg) {
  console.log('usage: content-tools.mjs normalize|copycheck|stamp-source|hash <topicId|all> [checkerVersion]')
  process.exit(2)
}
for (const id of ids(arg)) {
  if (cmd === 'normalize') normalize(id)
  else if (cmd === 'copycheck') copycheck(id)
  else if (cmd === 'stamp-source') stampSource(id, extra)
  else if (cmd === 'finalize') finalize(id, extra ?? 'source-check-v1')
  else if (cmd === 'hash') console.log(id, contentHash(loadTopic(id)))
  else throw new Error(`unknown command ${cmd}`)
}
