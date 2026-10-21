/**
 * Content pack schema (docs/05 §2). Single source of truth for blueprint metadata, topic content,
 * exams and the EMQ-volume answer-key index. Validated in main at load, in the content lint, and in tests.
 * Cite-only (ADR-0003): no book text, figures or EMQ-book stems/options ever appear here.
 */
import { z } from 'zod'

export const SYSTEM_IDS = ['gi', 'id', 'neph', 'cardio', 'resp', 'rheum', 'endo', 'heme', 'hemonc', 'onc'] as const
export const SystemIdSchema = z.enum(SYSTEM_IDS)
export type SystemId = z.infer<typeof SystemIdSchema>

export const BOOK_IDS = [
  'davidson24',
  'kumar10',
  'kcEssentials',
  'fa2ck11',
  'goldberger',
  'allam25',
  'pocket8',
  'stepup6',
  'talley8',
  'washington36',
  'zerotofinals',
  'emq1',
  'emq2',
  'emq3',
  'blueprint'
] as const
export const BookIdSchema = z.enum(BOOK_IDS)
export type BookId = z.infer<typeof BookIdSchema>

const id = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,80}$/, 'ids are lowercase slugs (a-z, 0-9, ., -)')
const text = (max: number): z.ZodString => z.string().trim().min(1).max(max)

export const BookSchema = z.strictObject({
  id: BookIdSchema,
  title: text(200),
  short: text(40),
  edition: z.string().max(40),
  authors: z.string().max(200),
  publisher: z.string().max(120),
  year: z.number().int().min(1950).max(2030).nullable(),
  /** 'printed': citations show the book's printed page. 'ebook': the source has no printed page numbers; pages are e-book pages. */
  pageKind: z.enum(['printed', 'ebook'])
})
export type Book = z.infer<typeof BookSchema>

export const CitationSchema = z.strictObject({
  book: BookIdSchema,
  chapter: z.string().max(120).optional(),
  page: z.number().int().min(1).max(5000),
  pageEnd: z.number().int().min(1).max(5000).optional(),
  pdfPage: z.number().int().min(1).max(5000).optional(),
  figure: z.string().max(40).optional(),
  table: z.string().max(40).optional()
})
export type Citation = z.infer<typeof CitationSchema>
const cites = z.array(CitationSchema).min(1).max(6)

/* ---------------------------------------------------------------- blueprint.json */

export const PrioritySchema = z.enum(['high', 'medium', 'standard'])
export const AssessedSchema = z.enum(['mid', 'final', 'osce'])

export const TopicMetaSchema = z.strictObject({
  id,
  systemId: SystemIdSchema,
  title: text(120),
  assessedIn: z.array(AssessedSchema).min(1),
  priority: PrioritySchema,
  studyHours: z.number().min(0.25).max(4).multipleOf(0.25),
  objectives: z.array(text(300)).min(1).max(30),
  order: z.number().int().min(1)
})
export type TopicMeta = z.infer<typeof TopicMetaSchema>

export const SystemSchema = z.strictObject({ id: SystemIdSchema, title: text(60), order: z.number().int().min(1) })
export type System = z.infer<typeof SystemSchema>

export const BlueprintSchema = z.strictObject({
  course: text(60),
  exams: z.strictObject({
    midterm: z.strictObject({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), format: text(120) }),
    final: z.strictObject({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), format: text(120) })
  }),
  systems: z.array(SystemSchema).length(SYSTEM_IDS.length),
  topics: z.array(TopicMetaSchema).min(1)
})
export type Blueprint = z.infer<typeof BlueprintSchema>

/* ---------------------------------------------------------------- topic content */

/** Markdown subset only: **bold**, _italic_, and line breaks. Rendered to React elements, never HTML. */
const md = (max: number): z.ZodString => text(max)

const BlockBase = { cites }
export const BlockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('para'), text: md(1500), ...BlockBase }),
  z.strictObject({ type: z.literal('bullets'), title: z.string().max(120).optional(), items: z.array(md(400)).min(1).max(20), ...BlockBase }),
  z.strictObject({
    type: z.literal('table'),
    title: z.string().max(120).optional(),
    columns: z.array(text(80)).min(2).max(6),
    rows: z.array(z.array(z.string().max(300))).min(1).max(30),
    ...BlockBase
  }),
  z.strictObject({ type: z.literal('pearl'), text: md(500), ...BlockBase }),
  z.strictObject({ type: z.literal('pitfall'), text: md(500), ...BlockBase }),
  z.strictObject({
    type: z.literal('diagram'),
    /** Original SVG, sanitised by the content lint (SECURITY §4); shown through an <img> data URI. */
    svg: z.string().min(20).max(30000),
    alt: text(300),
    ...BlockBase
  }),
  z.strictObject({
    type: z.literal('figureRef'),
    /** A pointer to a book figure (never the image). `cite.figure` is required. */
    cite: CitationSchema.refine((c) => !!c.figure, 'figureRef needs cite.figure'),
    note: md(300)
  })
])
export type Block = z.infer<typeof BlockSchema>

export const SectionSchema = z.strictObject({
  id,
  title: text(140),
  objectiveIdx: z.array(z.number().int().min(0)).min(1),
  blocks: z.array(BlockSchema).min(1).max(40)
})
export type Section = z.infer<typeof SectionSchema>

export const CardSchema = z.strictObject({ id, sectionId: id, front: md(300), back: md(600), cites })
export type Card = z.infer<typeof CardSchema>

export const PoolSchema = z.enum(['worked', 'quiz', 'practice', 'exam', 'mock'])
export type Pool = z.infer<typeof PoolSchema>
const studyRef = z.strictObject({ sectionId: id })

const QuestionBase = {
  id,
  pool: PoolSchema,
  quizScope: z.enum(['section', 'topic']).optional(),
  difficulty: z.number().int().min(1).max(3),
  cites
}

export const SbaSchema = z.strictObject({
  ...QuestionBase,
  kind: z.literal('sba'),
  stem: md(1500),
  leadIn: md(200),
  options: z.array(text(200)).length(5),
  answer: z.number().int().min(0).max(4),
  explanation: md(1200),
  /** One entry per option; the correct option's entry is "". */
  whyNot: z.array(z.string().max(400)).length(5),
  studyRef
})
export type Sba = z.infer<typeof SbaSchema>

export const EmqItemSchema = z.strictObject({
  stem: md(900),
  answer: z.number().int().min(0).max(13),
  explanation: md(700),
  studyRef
})

export const EmqSchema = z.strictObject({
  ...QuestionBase,
  kind: z.literal('emq'),
  theme: text(120),
  leadIn: md(300),
  options: z.array(text(120)).min(8).max(14),
  items: z.array(EmqItemSchema).min(2).max(6)
})
export type Emq = z.infer<typeof EmqSchema>

export const QuestionSchema = z.discriminatedUnion('kind', [SbaSchema, EmqSchema])
export type Question = z.infer<typeof QuestionSchema>

/** OSPE figure note: what to identify in a cited book figure, for slide-exam practice. */
export const OspeNoteSchema = z.strictObject({
  id,
  sectionId: id,
  cite: CitationSchema.refine((c) => !!c.figure, 'ospe note needs cite.figure'),
  identify: md(400),
  /** Optional allowlisted open-licensed image (content/images/ALLOWLIST.json key). */
  image: z.string().max(80).optional()
})
export type OspeNote = z.infer<typeof OspeNoteSchema>

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const CheckSchema = z.strictObject({ passedAt: z.string().max(40), contentHash: hash, checkerVersion: z.string().max(40).optional() })

export const TopicContentSchema = z.strictObject({
  topicId: id,
  contentVersion: z.string().regex(/^\d{4}\.\d{2}\.\d{2}\.\d+$/),
  sections: z.array(SectionSchema).min(1).max(20),
  cards: z.array(CardSchema).max(60),
  questions: z.array(QuestionSchema).max(120),
  ospe: z.array(OspeNoteSchema).max(30).default([]),
  sourceCheck: CheckSchema.optional(),
  copyCheck: CheckSchema.optional(),
  ownerReviewedAt: z.string().max(40).optional()
})
export type TopicContent = z.infer<typeof TopicContentSchema>

/* ---------------------------------------------------------------- exams & EMQ volumes */

export const ExamSchema = z.strictObject({
  id,
  kind: z.enum(['chapter', 'mock-midterm', 'mock-final']),
  systemId: SystemIdSchema.optional(),
  title: text(120),
  minutes: z.number().int().min(5).max(240),
  questionIds: z.array(id).min(5).max(200)
})
export type Exam = z.infer<typeof ExamSchema>

export const EmqThemeSchema = z.strictObject({
  id,
  volume: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  where: z.strictObject({ part: text(80), themeNo: z.number().int().min(1), title: text(120), page: z.number().int().min(1), answersPage: z.number().int().min(1) }),
  inBlueprint: z.boolean(),
  optionCount: z.number().int().min(2).max(26),
  items: z
    .array(
      z.strictObject({
        n: z.number().int().min(1).max(12),
        answer: z.string().regex(/^[A-Z]$/),
        /** Other letters the book also accepts for this item. */
        alsoAccept: z.array(z.string().regex(/^[A-Z]$/)).max(8).optional(),
        topicId: id.optional(),
        sectionId: id.optional(),
        explanation: md(500)
      })
    )
    .min(1)
    .max(12)
})
export type EmqTheme = z.infer<typeof EmqThemeSchema>

export const ManifestSchema = z.strictObject({
  contentVersion: z.string().regex(/^\d{4}\.\d{2}\.\d{2}\.\d+$/),
  generatedAt: z.string().max(40),
  topics: z.array(id)
})

/** What main hands the renderer: blueprint + available topics (+ exams, EMQ index). */
export interface ContentPack {
  contentVersion: string
  books: Book[]
  blueprint: Blueprint
  topics: Record<string, TopicContent>
  exams: Exam[]
  emqVolumes: EmqTheme[]
  /** D5 open-licensed images (allowlisted), embedded as data URLs by main (CSP img-src data:). */
  images: Record<string, { file: string; title: string; author: string; license: string; source: string; topics: string[]; dataUrl?: string }>
}
