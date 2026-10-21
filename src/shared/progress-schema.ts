/**
 * Progress store schema (docs/05 §4). progress.json on the student's PC (ADR-0002).
 * Events are append-only (except notes); task status, reviews and stats are derived (ADR-0007).
 */
import { z } from 'zod'
import { isValidDate, isValidISODateTime } from './dates'

export const SCHEMA_VERSION = 1

const id = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,80}$/)
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
export const DateSchema = z.string().refine(isValidDate, 'expected YYYY-MM-DD')
export const DateTimeSchema = z.string().refine(isValidISODateTime, 'expected ISO date-time')

export const TrackSchema = z.enum(['midterm', 'final'])
export type Track = z.infer<typeof TrackSchema>

export const PlanConfigSchema = z.strictObject({
  track: TrackSchema,
  startDate: DateSchema,
  examDate: DateSchema,
  /** 0 = Sunday … 6 = Saturday. */
  studyWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  hoursPerDay: z.number().min(1).max(12),
  systemOrder: z.array(z.string()).min(1).max(10)
})
export type PlanConfig = z.infer<typeof PlanConfigSchema>

export const TaskTypeSchema = z.enum([
  'new',
  'skim',
  'rapid',
  'revision-pass',
  'questions',
  'ospe',
  'weak',
  'chapter-exam',
  'mock',
  'mock-review',
  'final-revision',
  'exam'
])
export type TaskType = z.infer<typeof TaskTypeSchema>

export const PhaseSchema = z.enum(['learn', 'consolidate', 'final', 'exam'])
export type Phase = z.infer<typeof PhaseSchema>

export const TaskSchema = z.strictObject({
  id,
  date: DateSchema,
  session: z.number().int().min(1).max(30),
  phase: PhaseSchema,
  type: TaskTypeSchema,
  topicIds: z.array(id).max(120),
  systemIds: z.array(z.string()).max(10),
  examId: id.optional(),
  title: z.string().min(1).max(200),
  plannedHours: z.number().min(0).max(24),
  /** Questions target (number of attempts) for 'questions' tasks. */
  target: z.number().int().min(1).max(500).optional()
})
export type Task = z.infer<typeof TaskSchema>

export const PlanSchema = z.strictObject({
  config: PlanConfigSchema,
  generatedAt: DateTimeSchema,
  contentVersion: z.string().max(40),
  archivedAt: DateTimeSchema.optional(),
  overCapacity: z.boolean(),
  requiredHoursPerDay: z.number().min(0),
  tasks: z.array(TaskSchema).max(3000)
})
export type Plan = z.infer<typeof PlanSchema>

export const SettingsSchema = z.strictObject({
  theme: z.enum(['system', 'light', 'dark']),
  fontScale: z.number().min(0.8).max(1.6),
  dayStartHour: z.number().int().min(0).max(6),
  firstRunDone: z.boolean(),
  disclaimerAcceptedAt: DateTimeSchema.optional(),
  updates: z.strictObject({
    checkOnLaunch: z.boolean(),
    dismissedVersion: z.string().max(40).optional(),
    lastCheck: z.strictObject({ at: DateTimeSchema, latest: z.string().max(40).nullable(), title: z.string().max(200).nullable() }).optional()
  })
})
export type Settings = z.infer<typeof SettingsSchema>

export const SessionKindSchema = z.enum([
  'section-quiz',
  'topic-quiz',
  'practice',
  'review',
  'rapid-review',
  'weak-drill',
  'ospe',
  'exam',
  'emq-volume'
])
export type SessionKind = z.infer<typeof SessionKindSchema>

export const SectionReadSchema = z.strictObject({ topicId: id, sectionId: id, at: DateTimeSchema })
export const CompletionSchema = z.strictObject({
  topicId: id,
  type: z.enum(['completed', 'reopened']),
  source: z.enum(['auto', 'manual', 'revision']),
  track: TrackSchema.optional(),
  at: DateTimeSchema,
  contentVersion: z.string().max(40).optional()
})
export const SessionSchema = z.strictObject({
  id: uuid,
  kind: SessionKindSchema,
  topicId: id.optional(),
  sectionId: id.optional(),
  systemId: z.string().max(20).optional(),
  examId: id.optional(),
  emqThemeId: id.optional(),
  taskId: id.optional(),
  /** Question ids served in this session, in order (fixed at start). */
  questionIds: z.array(id).max(300),
  startedAt: DateTimeSchema,
  completedAt: DateTimeSchema.optional()
})
export const AttemptSchema = z.strictObject({
  id: uuid,
  sessionId: uuid,
  questionId: id,
  item: z.number().int().min(0).max(13).optional(),
  choice: z.number().int().min(-1).max(25),
  correct: z.boolean(),
  ms: z.number().int().min(0).max(86_400_000),
  at: DateTimeSchema
})
export const CardReviewSchema = z.strictObject({ cardId: id, grade: z.enum(['again', 'hard', 'good', 'easy']), at: DateTimeSchema })
export const ConfidenceSchema = z.strictObject({ topicId: id, value: z.number().int().min(1).max(5), at: DateTimeSchema })
export const OverrideSchema = z.strictObject({ track: TrackSchema, taskId: id, status: z.enum(['done', 'skipped', 'reset']), at: DateTimeSchema })
export const ReflectionSchema = z.strictObject({
  track: TrackSchema,
  weekStart: DateSchema,
  wentWell: z.string().max(2000),
  improve: z.string().max(2000),
  adjust: z.string().max(2000),
  at: DateTimeSchema
})
export const NoteSchema = z.strictObject({ id: uuid, topicId: id, sectionId: id.optional(), text: z.string().min(1).max(2000), at: DateTimeSchema })

export const EventsSchema = z.strictObject({
  sectionReads: z.array(SectionReadSchema),
  completions: z.array(CompletionSchema),
  sessions: z.array(SessionSchema),
  attempts: z.array(AttemptSchema),
  cardReviews: z.array(CardReviewSchema),
  confidence: z.array(ConfidenceSchema),
  overrides: z.array(OverrideSchema),
  reflections: z.array(ReflectionSchema),
  notes: z.array(NoteSchema)
})
export type Events = z.infer<typeof EventsSchema>

export const ProgressSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  createdAt: DateTimeSchema,
  settings: SettingsSchema,
  plans: z.strictObject({ midterm: PlanSchema.optional(), final: PlanSchema.optional() }),
  events: EventsSchema
})
export type Progress = z.infer<typeof ProgressSchema>
export type SectionRead = z.infer<typeof SectionReadSchema>
export type Completion = z.infer<typeof CompletionSchema>
export type Session = z.infer<typeof SessionSchema>
export type Attempt = z.infer<typeof AttemptSchema>
export type CardReview = z.infer<typeof CardReviewSchema>
export type Override = z.infer<typeof OverrideSchema>
export type Reflection = z.infer<typeof ReflectionSchema>
export type Note = z.infer<typeof NoteSchema>

export function emptyProgress(nowIso: string): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: nowIso,
    settings: { theme: 'system', fontScale: 1, dayStartHour: 4, firstRunDone: false, updates: { checkOnLaunch: true } },
    plans: {},
    events: { sectionReads: [], completions: [], sessions: [], attempts: [], cardReviews: [], confidence: [], overrides: [], reflections: [], notes: [] }
  }
}
