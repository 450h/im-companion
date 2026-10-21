/**
 * Content lint (docs/05 §2.3, SECURITY §4/§12). Pure functions; driven by src/main/content.test.ts in CI
 * and by agents while writing content (`npm run content:lint`, or CONTENT_TOPIC=<id> for one topic).
 */
import { createHash } from 'node:crypto'
import type { Blueprint, Question, TopicContent } from '@shared/content-schema'

export const MAX_TOPIC_BYTES = 250 * 1024
export const MAX_PACK_BYTES = 25 * 1024 * 1024

/** Fields excluded from the content hash (the check stamps themselves). */
const HASH_EXCLUDED = new Set(['sourceCheck', 'copyCheck', 'ownerReviewedAt'])

/** Canonical JSON: sorted keys, no whitespace. Must match scripts/content-tools.mjs. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function contentHash(topic: Record<string, unknown>): string {
  const stripped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(topic)) if (!HASH_EXCLUDED.has(k)) stripped[k] = v
  return createHash('sha256').update(canonical(stripped)).digest('hex')
}

/** Number of gradable items in a question (EMQ items count individually). */
export function itemCount(q: Question): number {
  return q.kind === 'emq' ? q.items.length : 1
}

/** The section a question belongs to (SBA: its studyRef; EMQ: its first item's). */
export function questionSection(q: Question): string {
  return q.kind === 'sba' ? q.studyRef.sectionId : (q.items[0]?.studyRef.sectionId ?? '')
}

const SVG_ELEMENTS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'marker', 'title'
])
const SVG_ATTR_RE = /^(xmlns|viewBox|width|height|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|d|points|fill|stroke|stroke-width|stroke-dasharray|stroke-linecap|stroke-linejoin|font-size|font-family|font-weight|text-anchor|dominant-baseline|transform|opacity|fill-opacity|id|marker-end|marker-start|markerWidth|markerHeight|refX|refY|orient|role|aria-label|class|dx|dy)$/

/** Allowlist SVG sanitiser check (no scripts, handlers, foreignObject or external refs). Returns problems. */
export function svgProblems(svg: string): string[] {
  const problems: string[] = []
  if (!/^\s*<svg[\s>]/.test(svg)) problems.push('diagram must start with <svg')
  for (const m of svg.matchAll(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g)) {
    const tag = m[1] ?? ''
    if (!SVG_ELEMENTS.has(tag)) problems.push(`svg element <${tag}> not allowed`)
    for (const a of (m[2] ?? '').matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g)) {
      const name = a[1] ?? ''
      const val = a[2] ?? ''
      if (!SVG_ATTR_RE.test(name)) problems.push(`svg attribute ${name} not allowed`)
      if (/url\(\s*['"]?(?!#)/i.test(val) || /javascript:/i.test(val)) problems.push(`svg attribute ${name} references external content`)
    }
  }
  if (/<!|<\?/.test(svg.replace(/^\s*<\?xml[^>]*\?>/, ''))) problems.push('svg must not contain doctype/processing instructions')
  return [...new Set(problems)]
}

export interface LintOptions {
  /** Require passed source/copy checks with matching hashes (release mode). */
  requireChecks: boolean
}

/** Lint one (already schema-valid) topic against the blueprint. Returns a list of problems. */
export function lintTopic(topic: TopicContent, raw: Record<string, unknown>, bp: Blueprint, rawBytes: number, opts: LintOptions): string[] {
  const p: string[] = []
  const meta = bp.topics.find((t) => t.id === topic.topicId)
  if (!meta) return [`topicId ${topic.topicId} is not in blueprint.json`]
  if (rawBytes > MAX_TOPIC_BYTES) p.push(`file is ${Math.round(rawBytes / 1024)} KB (max 250 KB)`)

  const ids = new Set<string>()
  const claim = (id: string, what: string): void => {
    if (!id.startsWith(`${topic.topicId}.`)) p.push(`${what} id ${id} must start with "${topic.topicId}."`)
    if (ids.has(id)) p.push(`duplicate id ${id}`)
    ids.add(id)
  }
  const sectionIds = new Set(topic.sections.map((s) => s.id))
  const covered = new Set<number>()
  for (const s of topic.sections) {
    claim(s.id, 'section')
    for (const i of s.objectiveIdx) {
      if (i >= meta.objectives.length) p.push(`section ${s.id} objectiveIdx ${i} out of range (${meta.objectives.length} objectives)`)
      covered.add(i)
    }
    for (const b of s.blocks) if (b.type === 'diagram') for (const x of svgProblems(b.svg)) p.push(`section ${s.id}: ${x}`)
  }
  meta.objectives.forEach((o, i) => {
    if (!covered.has(i)) p.push(`objective ${i} ("${o}") is not covered by any section`)
  })

  for (const c of topic.cards) {
    claim(c.id, 'card')
    if (!sectionIds.has(c.sectionId)) p.push(`card ${c.id} sectionId ${c.sectionId} not found`)
  }
  for (const n of topic.ospe) {
    claim(n.id, 'ospe')
    if (!sectionIds.has(n.sectionId)) p.push(`ospe ${n.id} sectionId ${n.sectionId} not found`)
  }

  const count: Record<string, number> = { worked: 0, practice: 0, exam: 0, mock: 0, topicQuiz: 0 }
  const sectionQuiz = new Map<string, number>()
  for (const q of topic.questions) {
    claim(q.id, 'question')
    if (q.pool === 'quiz' && !q.quizScope) p.push(`question ${q.id}: quiz questions need quizScope`)
    if (q.pool !== 'quiz' && q.quizScope) p.push(`question ${q.id}: quizScope only for pool "quiz"`)
    if (q.kind === 'sba') {
      if (!sectionIds.has(q.studyRef.sectionId)) p.push(`question ${q.id} studyRef ${q.studyRef.sectionId} not found`)
      if ((q.whyNot[q.answer] ?? '') !== '') p.push(`question ${q.id}: whyNot for the correct option must be ""`)
      q.whyNot.forEach((w, i) => {
        if (i !== q.answer && !w.trim()) p.push(`question ${q.id}: whyNot[${i}] is empty for a distractor`)
      })
      if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) p.push(`question ${q.id}: duplicate options`)
    } else {
      q.items.forEach((it, i) => {
        if (it.answer >= q.options.length) p.push(`question ${q.id} item ${i}: answer out of range`)
        if (!sectionIds.has(it.studyRef.sectionId)) p.push(`question ${q.id} item ${i}: studyRef ${it.studyRef.sectionId} not found`)
      })
    }
    const n = itemCount(q)
    if (q.pool === 'quiz' && q.quizScope === 'section') {
      const s = questionSection(q)
      sectionQuiz.set(s, (sectionQuiz.get(s) ?? 0) + n)
    } else if (q.pool === 'quiz') count.topicQuiz = (count.topicQuiz ?? 0) + n
    else count[q.pool] = (count[q.pool] ?? 0) + n
  }

  for (const s of topic.sections) {
    if ((sectionQuiz.get(s.id) ?? 0) < 2) p.push(`section ${s.id} needs ≥ 2 section-quiz items (has ${sectionQuiz.get(s.id) ?? 0})`)
    if (!topic.cards.some((c) => c.sectionId === s.id)) p.push(`section ${s.id} needs ≥ 1 card`)
  }
  const need: Array<[string, number]> = [
    ['topicQuiz', 8],
    ['worked', 3],
    ['practice', 10],
    ['exam', 3]
  ]
  if (meta.assessedIn.includes('mid') || meta.assessedIn.includes('final')) need.push(['mock', 2])
  for (const [k, min] of need) if ((count[k] ?? 0) < min) p.push(`needs ≥ ${min} ${k === 'topicQuiz' ? 'topic-quiz' : k} items (has ${count[k] ?? 0})`)

  if (opts.requireChecks) {
    const h = contentHash(raw)
    if (!topic.sourceCheck) p.push('missing sourceCheck (ADR-0009)')
    else if (topic.sourceCheck.contentHash !== h) p.push('sourceCheck.contentHash does not match: content edited after the source-check')
    if (!topic.copyCheck) p.push('missing copyCheck (SECURITY §12)')
    else if (topic.copyCheck.contentHash !== h) p.push('copyCheck.contentHash does not match: content edited after the copy check')
  }
  return p
}
