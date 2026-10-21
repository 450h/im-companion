/**
 * Content pack lint (docs/05 §2.3). Runs in CI as part of `npm test`.
 *   CONTENT_TOPIC=<topicId>  lint a single topic (used by content agents while writing)
 *   CONTENT_DRAFT=1          skip the source/copy-check requirement (drafts not yet checked)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  BlueprintSchema,
  BookSchema,
  EmqThemeSchema,
  ExamSchema,
  TopicContentSchema,
  type Blueprint,
  type TopicContent
} from '@shared/content-schema'
import { MAX_PACK_BYTES, itemCount, lintTopic } from './content-lint'

const ROOT = resolve(__dirname, '../../content')
const only = process.env['CONTENT_TOPIC']
const draft = process.env['CONTENT_DRAFT'] === '1'

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'))
const fmt = (e: z.ZodError): string => e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')

const blueprint: Blueprint = BlueprintSchema.parse(readJson(join(ROOT, 'blueprint.json')))
const topicFiles = existsSync(join(ROOT, 'topics'))
  ? readdirSync(join(ROOT, 'topics')).filter((f) => f.endsWith('.json') && (!only || f === `${only}.json`))
  : []

describe('blueprint & books', () => {
  it('blueprint has 90 topics, 73 midterm, unique ids, Excel hour rule', () => {
    if (only) return
    expect(blueprint.topics).toHaveLength(90)
    expect(blueprint.topics.filter((t) => t.assessedIn.includes('mid'))).toHaveLength(73)
    expect(new Set(blueprint.topics.map((t) => t.id)).size).toBe(90)
    for (const t of blueprint.topics) expect(t.studyHours, t.id).toBe(Math.max(0.5, 0.25 * Math.ceil(t.objectives.length / 2)))
  })
  it('books.json is valid', () => {
    z.array(BookSchema).parse(readJson(join(ROOT, 'books.json')))
  })
})

const topics = new Map<string, TopicContent>()

describe.each(topicFiles.length ? topicFiles : ['(none)'])('topic %s', (file) => {
  it('is valid and passes lint', () => {
    if (file === '(none)') return
    const path = join(ROOT, 'topics', file)
    const text = readFileSync(path, 'utf8')
    const raw = JSON.parse(text) as Record<string, unknown>
    const parsed = TopicContentSchema.safeParse(raw)
    if (!parsed.success) throw new Error(`${file} schema errors:\n${fmt(parsed.error)}`)
    expect(`${parsed.data.topicId}.json`, 'file name must equal topicId').toBe(file)
    const problems = lintTopic(parsed.data, raw, blueprint, Buffer.byteLength(text), { requireChecks: !draft })
    if (problems.length) throw new Error(`${file} lint problems:\n- ${problems.join('\n- ')}`)
    topics.set(parsed.data.topicId, parsed.data)
  })
})

describe('pack-level checks', () => {
  it('ids are unique across topics; exams and EMQ index resolve', () => {
    if (only) return
    const all = new Set<string>()
    const questions = new Map<string, { pool: string; topicId: string; items: number }>()
    for (const t of topics.values()) {
      for (const q of t.questions) {
        expect(all.has(q.id), `duplicate ${q.id}`).toBe(false)
        all.add(q.id)
        questions.set(q.id, { pool: q.pool, topicId: t.topicId, items: itemCount(q) })
      }
    }
    const examDir = join(ROOT, 'exams')
    if (existsSync(examDir)) {
      for (const f of readdirSync(examDir).filter((x) => x.endsWith('.json'))) {
        const exam = ExamSchema.parse(readJson(join(examDir, f)))
        const wantPool = exam.kind === 'chapter' ? 'exam' : 'mock'
        let items = 0
        for (const qid of exam.questionIds) {
          const q = questions.get(qid)
          expect(q, `${f}: unknown question ${qid}`).toBeDefined()
          expect(q!.pool, `${f}: ${qid} must come from pool ${wantPool}`).toBe(wantPool)
          items += q!.items
        }
        if (exam.kind === 'chapter') expect(items, `${f}: chapter exams need ≥ 12 items`).toBeGreaterThanOrEqual(12)
      }
    }
    const emqPath = join(ROOT, 'emq-volumes.json')
    if (existsSync(emqPath)) {
      const themes = z.array(EmqThemeSchema).parse(readJson(emqPath))
      const ids = new Set(blueprint.topics.map((t) => t.id))
      for (const th of themes) {
        for (const it of th.items) {
          if (th.inBlueprint) expect(it.topicId && ids.has(it.topicId), `${th.id} item ${it.n}: topicId required`).toBe(true)
          expect(it.answer.charCodeAt(0) - 65, `${th.id} item ${it.n}: answer beyond optionCount`).toBeLessThan(th.optionCount)
        }
      }
    }
  })

  it('no raster images outside the allowlist; pack size within budget', () => {
    if (only) return
    const allowPath = join(ROOT, 'images', 'ALLOWLIST.json')
    const allow = existsSync(allowPath) ? new Set(Object.values(readJson(allowPath) as Record<string, { file: string }>).map((v) => v.file)) : new Set<string>()
    let bytes = 0
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        const st = statSync(full)
        if (st.isDirectory()) walk(full)
        else {
          bytes += st.size
          if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(name)) expect(allow.has(name), `raster image not allowlisted: ${name}`).toBe(true)
        }
      }
    }
    walk(ROOT)
    expect(bytes).toBeLessThanOrEqual(MAX_PACK_BYTES)
  })
})
