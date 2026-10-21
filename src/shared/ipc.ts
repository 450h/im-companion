/** IPC contract between preload and main (docs/06 §9). Payload schemas are validated in main. */
import { z } from 'zod'
import type { Citation, ContentPack } from './content-schema'
import type { Capabilities } from './engine/status'
import { DateSchema, PlanConfigSchema, SessionKindSchema, TrackSchema, type Progress, type SessionKind, type Track } from './progress-schema'

export const REPO_URL = 'https://github.com/450h/im-companion'
export const RELEASES_URL = `${REPO_URL}/releases/latest`
export const RELEASES_API = 'https://api.github.com/repos/450h/im-companion/releases/latest'
export const RELEASES_ATOM = `${REPO_URL}/releases.atom`
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new`

export type IpcResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }

export interface AppInfo {
  version: string
  contentVersion: string
  dataPath: string
  readOnly: boolean
  restoredFromBackup: boolean
  capabilities: Capabilities
}

export interface UpdateStatus {
  current: string
  latest: string | null
  title: string | null
  newer: boolean
  checkedAt: string | null
}

export interface BackupInfo {
  name: string
  size: number
  modified: string
}

export interface PlanPreview {
  studyDays: number
  learn: number
  consolidate: number
  final: number
  budget: number
  warning: boolean
  overCapacity: boolean
  cram: boolean
  skimmed: string[]
  requiredHoursPerDay: number
  firstDayBySystem: Record<string, string>
  tasks: number
}

/** Feedback for a tutor-mode answer (R-12). */
export interface AnswerFeedback {
  recorded: true
  correct: boolean | null
  answer: number | null
  explanation: string | null
  whyNot: string | null
  studyRef: { topicId: string; sectionId: string } | null
  cites: Citation[]
}

export interface SessionResult {
  sessionId: string
  total: number
  correct: number
  byTopic: Record<string, { total: number; correct: number }>
  wrong: Array<{ questionId: string; item?: number; studyRef: { topicId: string; sectionId: string } | null }>
}

export type AppEvent = { type: 'progressChanged' } | { type: 'update'; status: UpdateStatus }

/* ------------------------------------------------------------- payload schemas (main validates) */

export const zSettingsPatch = z
  .strictObject({
    theme: z.enum(['system', 'light', 'dark']),
    fontScale: z.number().min(0.8).max(1.6),
    dayStartHour: z.number().int().min(0).max(6),
    checkOnLaunch: z.boolean(),
    dismissedVersion: z.string().max(40)
  })
  .partial()
export type SettingsPatch = z.infer<typeof zSettingsPatch>

const topicId = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,80}$/)
export const zAlreadyStudied = z.array(z.strictObject({ topicId, date: DateSchema })).max(120)
export const zPlanCreate = z.strictObject({ config: PlanConfigSchema, alreadyStudied: zAlreadyStudied.optional() })
export const zPlanRebuild = z.strictObject({
  track: TrackSchema,
  patch: z
    .strictObject({
      studyWeekdays: PlanConfigSchema.shape.studyWeekdays,
      hoursPerDay: PlanConfigSchema.shape.hoursPerDay,
      systemOrder: PlanConfigSchema.shape.systemOrder,
      examDate: DateSchema
    })
    .partial()
    .optional()
})
export const zOverride = z.strictObject({ track: TrackSchema, taskId: topicId, status: z.enum(['done', 'skipped', 'reset']) })
export const zMarkRead = z.strictObject({ topicId, sectionId: topicId })
export const zSetStudied = z.strictObject({ topicId, studied: z.boolean(), date: DateSchema.optional() })
export const zConfidence = z.strictObject({ topicId, value: z.number().int().min(1).max(5) })
export const zSessionStart = z.strictObject({
  kind: SessionKindSchema,
  topicId: topicId.optional(),
  sectionId: topicId.optional(),
  topicIds: z.array(topicId).max(120).optional(),
  systemId: z.string().max(20).optional(),
  examId: topicId.optional(),
  emqThemeId: topicId.optional(),
  taskId: topicId.optional(),
  format: z.enum(['sba', 'emq', 'both']).optional(),
  count: z.number().int().min(1).max(100).optional()
})
export type SessionStart = z.infer<typeof zSessionStart>
export const zAnswer = z.strictObject({
  sessionId: z.string().uuid(),
  questionId: topicId,
  item: z.number().int().min(0).max(13).optional(),
  choice: z.number().int().min(-1).max(25),
  ms: z.number().int().min(0).max(86_400_000)
})
export const zGrade = z.strictObject({ cardId: topicId, grade: z.enum(['again', 'hard', 'good', 'easy']) })
export const zReflection = z.strictObject({
  track: TrackSchema,
  weekStart: DateSchema,
  wentWell: z.string().max(2000),
  improve: z.string().max(2000),
  adjust: z.string().max(2000)
})
export const zNote = z.strictObject({ id: z.string().uuid().optional(), topicId, sectionId: topicId.optional(), text: z.string().trim().min(1).max(2000) })
export const zReport = z.strictObject({ contentId: z.string().max(120), comment: z.string().max(1500) })

export interface ImcApi {
  appInfo(): Promise<IpcResult<AppInfo>>
  contentGet(): Promise<IpcResult<ContentPack>>
  progressGet(): Promise<IpcResult<Progress>>
  settingsUpdate(patch: SettingsPatch): Promise<IpcResult<Progress>>
  firstRunComplete(): Promise<IpcResult<Progress>>
  planPreview(config: z.infer<typeof PlanConfigSchema>): Promise<IpcResult<PlanPreview>>
  planCreate(payload: z.infer<typeof zPlanCreate>): Promise<IpcResult<Progress>>
  planRebuild(payload: z.infer<typeof zPlanRebuild>): Promise<IpcResult<Progress>>
  planOverride(payload: z.infer<typeof zOverride>): Promise<IpcResult<Progress>>
  studyMarkRead(payload: z.infer<typeof zMarkRead>): Promise<IpcResult<Progress>>
  topicSetStudied(payload: z.infer<typeof zSetStudied>): Promise<IpcResult<Progress>>
  topicConfidence(payload: z.infer<typeof zConfidence>): Promise<IpcResult<Progress>>
  sessionStart(payload: SessionStart): Promise<IpcResult<{ sessionId: string; questionIds: string[] }>>
  sessionAnswer(payload: z.infer<typeof zAnswer>): Promise<IpcResult<AnswerFeedback>>
  sessionComplete(sessionId: string): Promise<IpcResult<SessionResult>>
  cardsGrade(payload: z.infer<typeof zGrade>): Promise<IpcResult<Progress>>
  reflectionSave(payload: z.infer<typeof zReflection>): Promise<IpcResult<Progress>>
  notesUpsert(payload: z.infer<typeof zNote>): Promise<IpcResult<Progress>>
  notesDelete(id: string): Promise<IpcResult<Progress>>
  dataExport(): Promise<IpcResult<string | null>>
  dataImport(): Promise<IpcResult<boolean>>
  backupList(): Promise<IpcResult<BackupInfo[]>>
  backupRestore(name: string): Promise<IpcResult<boolean>>
  updateCheck(): Promise<IpcResult<UpdateStatus>>
  updateOpenDownload(): Promise<IpcResult<void>>
  reportOpenIssue(payload: z.infer<typeof zReport>): Promise<IpcResult<void>>
  openRepo(): Promise<IpcResult<void>>
  onEvent(cb: (e: AppEvent) => void): () => void
}

export type { SessionKind, Track }
