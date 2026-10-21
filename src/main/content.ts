/**
 * Loads and validates the bundled content pack (docs/04 §3, SECURITY §4). Read-only; any invalid file
 * is skipped and logged (the app still runs with the rest) — except blueprint/books, which are required.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  BlueprintSchema,
  BookSchema,
  EmqThemeSchema,
  ExamSchema,
  TopicContentSchema,
  type ContentPack,
  type TopicContent
} from '@shared/content-schema'
import type { Capabilities, ContentInfo } from '@shared/engine/status'
import { logError } from './log'

/** Features this app version has (docs/05 §3 capabilities). Bump as releases add features. */
export const CAPABILITIES: Capabilities = {
  quizzes: true,
  practice: true,
  drills: true,
  exams: true,
  mocks: true,
  ospe: true
}

const MAX_JSON_BYTES = 2 * 1024 * 1024

function readJson(path: string): unknown {
  const buf = readFileSync(path)
  if (buf.byteLength > MAX_JSON_BYTES * 4) throw new Error(`${path} too large`)
  return JSON.parse(buf.toString('utf8'))
}

export function loadContent(dir: string): ContentPack {
  const blueprint = BlueprintSchema.parse(readJson(join(dir, 'blueprint.json')))
  const books = z.array(BookSchema).parse(readJson(join(dir, 'books.json')))
  const topics: Record<string, TopicContent> = {}
  const tdir = join(dir, 'topics')
  const known = new Set(blueprint.topics.map((t) => t.id))
  if (existsSync(tdir)) {
    for (const f of readdirSync(tdir).filter((x) => x.endsWith('.json'))) {
      try {
        const t = TopicContentSchema.parse(readJson(join(tdir, f)))
        if (known.has(t.topicId)) topics[t.topicId] = t
      } catch (e) {
        logError(`content:${f}`, e)
      }
    }
  }
  const exams = []
  const edir = join(dir, 'exams')
  if (existsSync(edir)) {
    for (const f of readdirSync(edir).filter((x) => x.endsWith('.json'))) {
      try {
        exams.push(ExamSchema.parse(readJson(join(edir, f))))
      } catch (e) {
        logError(`exam:${f}`, e)
      }
    }
  }
  let emqVolumes: ContentPack['emqVolumes'] = []
  const emqPath = join(dir, 'emq-volumes.json')
  if (existsSync(emqPath)) {
    try {
      emqVolumes = z.array(EmqThemeSchema).parse(readJson(emqPath))
    } catch (e) {
      logError('emq-volumes', e)
    }
  }
  let images: ContentPack['images'] = {}
  const allowPath = join(dir, 'images', 'ALLOWLIST.json')
  if (existsSync(allowPath)) {
    try {
      images = z
        .record(z.string(), z.strictObject({ file: z.string(), title: z.string(), author: z.string(), license: z.string(), source: z.string() }))
        .parse(readJson(allowPath))
      const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
      for (const img of Object.values(images)) {
        const ext = img.file.slice(img.file.lastIndexOf('.')).toLowerCase()
        const p = join(dir, 'images', img.file)
        if (MIME[ext] && !/[\\/]/.test(img.file) && existsSync(p)) {
          const buf = readFileSync(p)
          if (buf.byteLength <= 1_500_000) img.dataUrl = `data:${MIME[ext]};base64,${buf.toString('base64')}`
        }
      }
    } catch (e) {
      logError('images', e)
    }
  }
  const versions = Object.values(topics).map((t) => t.contentVersion).sort()
  let contentVersion = versions.at(-1) ?? '0000.00.00.0'
  const manifestPath = join(dir, 'manifest.json')
  if (existsSync(manifestPath)) {
    try {
      const m = readJson(manifestPath) as { contentVersion?: string }
      if (typeof m.contentVersion === 'string') contentVersion = m.contentVersion
    } catch {
      /* fall back to newest topic version */
    }
  }
  return { contentVersion, books, blueprint, topics, exams, emqVolumes, images }
}

/** "2026.10.22.1" → "2026-10-22" */
export function versionDate(v: string): string {
  const [y, m, d] = v.split('.')
  return `${y}-${m}-${d}`
}

export function contentInfo(pack: ContentPack): ContentInfo {
  const available = new Map<string, string>()
  const sections = new Map<string, string[]>()
  const hasTopicQuiz = new Set<string>()
  for (const t of Object.values(pack.topics)) {
    available.set(t.topicId, versionDate(t.contentVersion))
    sections.set(t.topicId, t.sections.map((s) => s.id))
    if (t.questions.some((q) => q.pool === 'quiz' && q.quizScope === 'topic')) hasTopicQuiz.add(t.topicId)
  }
  return { available, sections, hasTopicQuiz, exams: new Set(pack.exams.map((e) => e.id)) }
}
