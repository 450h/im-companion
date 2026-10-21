#!/usr/bin/env node
/**
 * Builds content/exams/*.json and content/manifest.json from the available topics (docs/05 §2, R-4).
 *  - Chapter exam per system: every `exam`-pool question of the system's available topics (≥ 12 items).
 *  - Mock midterm papers 1–2: `mock`-pool questions of midterm topics, split alternately (EMQ + SBA).
 *  - Mock final papers 1–2: SBA `mock`-pool questions of all topics, split alternately.
 * Exam ids match what plans reference (exam-<system>, mock-midterm-N, mock-final-N).
 * Usage: node scripts/build-exams.mjs <contentVersion YYYY.MM.DD.N>
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const C = join(ROOT, 'content')
const version = process.argv[2]
if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(version ?? '')) {
  console.error('usage: node scripts/build-exams.mjs YYYY.MM.DD.N')
  process.exit(2)
}
const bp = JSON.parse(readFileSync(join(C, 'blueprint.json'), 'utf8'))
const topics = readdirSync(join(C, 'topics'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(C, 'topics', f), 'utf8')))
const meta = new Map(bp.topics.map((t) => [t.id, t]))
topics.sort((a, b) => meta.get(a.topicId).order - meta.get(b.topicId).order)
const items = (q) => (q.kind === 'emq' ? q.items.length : 1)
const minutesFor = (qs) => Math.max(10, Math.ceil(qs.reduce((s, q) => s + items(q), 0) * 1.5))

const out = []
for (const s of bp.systems) {
  const qs = topics.filter((t) => meta.get(t.topicId).systemId === s.id).flatMap((t) => t.questions.filter((q) => q.pool === 'exam'))
  const n = qs.reduce((x, q) => x + items(q), 0)
  if (n < 12) {
    console.log(`skip exam-${s.id}: ${n} items (< 12)`)
    continue
  }
  out.push({ id: `exam-${s.id}`, kind: 'chapter', systemId: s.id, title: `${s.title} — chapter exam`, minutes: minutesFor(qs), questionIds: qs.map((q) => q.id) })
}
function papers(qs, kind, label) {
  const p = [[], []]
  qs.forEach((q, i) => p[i % 2].push(q))
  return p
    .map((list, i) => ({ list, i }))
    .filter(({ list }) => list.reduce((x, q) => x + items(q), 0) >= 10)
    .map(({ list, i }) => ({ id: `mock-${kind}-${i + 1}`, kind: `mock-${kind}`, title: `${label} — paper ${i + 1}`, minutes: minutesFor(list), questionIds: list.map((q) => q.id) }))
}
const midMocks = topics.filter((t) => meta.get(t.topicId).assessedIn.includes('mid')).flatMap((t) => t.questions.filter((q) => q.pool === 'mock'))
out.push(...papers(midMocks, 'midterm', 'Mock midterm (EMQ style)'))
const finalMocks = topics.flatMap((t) => t.questions.filter((q) => q.pool === 'mock' && q.kind === 'sba'))
out.push(...papers(finalMocks, 'final', 'Mock final (MCQ style)'))

const dir = join(C, 'exams')
if (existsSync(dir)) rmSync(dir, { recursive: true })
mkdirSync(dir)
for (const e of out) writeFileSync(join(dir, `${e.id}.json`), JSON.stringify(e, null, 1) + '\n')
writeFileSync(join(C, 'manifest.json'), JSON.stringify({ contentVersion: version, generatedAt: new Date().toISOString(), topics: topics.map((t) => t.topicId) }, null, 1) + '\n')
console.log(`wrote ${out.length} exam(s): ${out.map((e) => `${e.id} (${e.questionIds.length}q, ${e.minutes} min)`).join(', ')}`)
