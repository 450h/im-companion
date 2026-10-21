/**
 * Main-process command service (docs/06 §9, SECURITY §1/§4). Every payload is zod-validated, every id is
 * checked against loaded content/plan, answer correctness is computed here, and topicCompleted events are
 * appended by main only (R-6.1). Platform side effects (dialogs, shell, clock) are injected for tests.
 */
import { z } from 'zod'
import type { ContentPack } from '@shared/content-schema'
import { addDays, studyDate, todayLocal } from '@shared/dates'
import { generatePlan, PlanError, phasesOf, scopeOf, studyDaysOf } from '@shared/engine/plan'
import { pickQuestions, grade, questionIndex, SelectionError } from '@shared/engine/sessions'
import { revisionOrder, topicStats } from '@shared/engine/stats'
import { autoCompletionMet, completionDates, taskStatus, topicOfQuestion, type ContentInfo } from '@shared/engine/status'
import {
  NEW_ISSUE_URL,
  zAnswer,
  zConfidence,
  zGrade,
  zMarkRead,
  zNote,
  zOverride,
  zPlanCreate,
  zPlanRebuild,
  zReflection,
  zReport,
  zSessionStart,
  zSetStudied,
  zSettingsPatch,
  type AnswerFeedback,
  type AppInfo,
  type BackupInfo,
  type PlanPreview,
  type SessionResult
} from '@shared/ipc'
import { PlanConfigSchema, type Plan, type PlanConfig, type Progress } from '@shared/progress-schema'
import { CAPABILITIES, contentInfo } from './content'
import type { Store } from './store'

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export interface Platform {
  version: string
  dataPath: string
  now(): Date
  newId(): string
  saveDialog(defaultName: string): Promise<string | null>
  openDialog(): Promise<string | null>
  confirm(message: string, detail: string): Promise<boolean>
  openExternal(url: string): Promise<void>
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  if (!r.success) {
    const i = r.error.issues[0]
    throw new ServiceError('E_VALIDATION', `${i?.path.join('.') || 'payload'}: ${i?.message ?? 'invalid'}`)
  }
  return r.data
}

export class Service {
  private readonly info: ContentInfo
  private readonly qIndex: ReturnType<typeof questionIndex>
  private readonly cardIds: Set<string>
  private readonly sectionIds: Map<string, Set<string>>

  constructor(
    private readonly store: Store,
    readonly pack: ContentPack,
    private readonly platform: Platform
  ) {
    this.info = contentInfo(pack)
    this.qIndex = questionIndex(pack)
    this.cardIds = new Set(Object.values(pack.topics).flatMap((t) => t.cards.map((c) => c.id)))
    this.sectionIds = new Map(Object.values(pack.topics).map((t) => [t.topicId, new Set(t.sections.map((s) => s.id))]))
  }

  private get p(): Progress {
    return this.store.state
  }
  private nowIso(): string {
    return this.platform.now().toISOString()
  }
  private today(): string {
    return studyDate(this.platform.now(), this.p.settings.dayStartHour)
  }
  private topicExists(id: string): boolean {
    return this.pack.blueprint.topics.some((t) => t.id === id)
  }
  private requireTopic(id: string): void {
    if (!this.topicExists(id)) throw new ServiceError('E_REF', `Unknown topic ${id}`)
  }
  private update(fn: (p: Progress) => Progress): Progress {
    return this.store.update(fn)
  }

  appInfo(): AppInfo {
    return {
      version: this.platform.version,
      contentVersion: this.pack.contentVersion,
      dataPath: this.platform.dataPath,
      readOnly: this.store.meta.readOnly,
      restoredFromBackup: this.store.meta.restoredFromBackup,
      capabilities: CAPABILITIES
    }
  }

  getProgress(): Progress {
    return this.p
  }

  settingsUpdate(raw: unknown): Progress {
    const patch = parse(zSettingsPatch, raw)
    return this.update((p) => {
      const { checkOnLaunch, dismissedVersion, ...rest } = patch
      return {
        ...p,
        settings: {
          ...p.settings,
          ...rest,
          updates: {
            ...p.settings.updates,
            ...(checkOnLaunch !== undefined ? { checkOnLaunch } : {}),
            ...(dismissedVersion !== undefined ? { dismissedVersion } : {})
          }
        }
      }
    })
  }

  firstRunComplete(): Progress {
    const at = this.nowIso()
    return this.update((p) => ({ ...p, settings: { ...p.settings, firstRunDone: true, disclaimerAcceptedAt: p.settings.disclaimerAcceptedAt ?? at } }))
  }

  /* ---------------------------------------------------------------- plans */

  private systemTitles(): Record<string, string> {
    return Object.fromEntries(this.pack.blueprint.systems.map((s) => [s.id, s.title]))
  }

  private validateConfig(config: PlanConfig): void {
    const ids = new Set(this.pack.blueprint.systems.map((s) => s.id))
    if (config.systemOrder.some((s) => !ids.has(s as never)) || new Set(config.systemOrder).size !== config.systemOrder.length) {
      throw new ServiceError('E_VALIDATION', 'systemOrder must list known systems once each')
    }
    if (config.examDate <= config.startDate) throw new ServiceError('NO_STUDY_DAYS', 'No study days left before the exam')
  }

  private build(config: PlanConfig, studiedOverride?: Set<string>): ReturnType<typeof generatePlan> {
    this.validateConfig(config)
    const f = completionDates(this.p.events, this.p.settings.dayStartHour)
    const studied = studiedOverride ?? new Set(f.keys())
    let order: string[] | undefined
    if (config.track === 'final') {
      const stats = topicStats(this.p.events, (qid, item) => this.sectionOf(qid, item))
      order = revisionOrder(scopeOf(config, this.pack.blueprint.topics).map((t) => t.id), stats, f)
    }
    try {
      return generatePlan({ config, topics: this.pack.blueprint.topics, studied, revisionOrder: order, systemTitles: this.systemTitles() })
    } catch (e) {
      if (e instanceof PlanError) throw new ServiceError(e.code, e.message)
      throw e
    }
  }

  planPreview(raw: unknown): PlanPreview {
    const config = parse(PlanConfigSchema, raw)
    const r = this.build(config)
    const firstDayBySystem: Record<string, string> = {}
    for (const t of r.tasks) {
      if (!['new', 'skim', 'revision-pass', 'rapid'].includes(t.type)) continue
      for (const s of t.systemIds) firstDayBySystem[s] ??= t.date
    }
    return {
      studyDays: r.studyDays.length,
      learn: r.phases.learn.length,
      consolidate: r.phases.consolidate.length,
      final: r.phases.final.length,
      budget: r.budget,
      warning: r.warning,
      overCapacity: r.overCapacity,
      cram: r.cram,
      skimmed: r.skimmed,
      requiredHoursPerDay: r.requiredHoursPerDay,
      firstDayBySystem,
      tasks: r.tasks.length
    }
  }

  planCreate(raw: unknown): Progress {
    const { config, alreadyStudied } = parse(zPlanCreate, raw)
    if (this.p.plans[config.track] && !this.p.plans[config.track]!.archivedAt) {
      throw new ServiceError('E_EXISTS', 'A plan for this track already exists — use Rebuild')
    }
    if (config.track === 'final') {
      const mid = this.p.plans.midterm?.config.examDate ?? this.pack.blueprint.exams.midterm.date
      if (this.today() < mid) throw new ServiceError('E_TOO_EARLY', `The Final plan can be created from ${mid} (R-9)`)
    }
    const at = this.nowIso()
    // First-run "already studied" topics are logged as manual completions on their chosen date (R-10).
    const extra = (alreadyStudied ?? []).map((s) => {
      this.requireTopic(s.topicId)
      if (s.date > this.today()) throw new ServiceError('E_VALIDATION', 'Studied dates cannot be in the future')
      return { topicId: s.topicId, type: 'completed' as const, source: 'manual' as const, at: `${s.date}T12:00:00.000Z` }
    })
    const studied = new Set([...completionDates(this.p.events, this.p.settings.dayStartHour).keys(), ...extra.map((e) => e.topicId)])
    const result = this.build(config, studied)
    const plan: Plan = {
      config,
      generatedAt: at,
      contentVersion: this.pack.contentVersion,
      overCapacity: result.overCapacity,
      requiredHoursPerDay: result.requiredHoursPerDay,
      tasks: result.tasks
    }
    return this.update((p) => ({
      ...p,
      plans: { ...p.plans, [config.track]: plan },
      events: { ...p.events, completions: [...p.events.completions, ...extra] }
    }))
  }

  async planRebuild(raw: unknown): Promise<Progress> {
    const { track, patch } = parse(zPlanRebuild, raw)
    const old = this.p.plans[track]
    if (!old) throw new ServiceError('E_REF', 'No plan for this track')
    if (old.archivedAt) throw new ServiceError('E_ARCHIVED', 'This plan is archived')
    await this.store.backup('rebuild')
    const today = this.today()
    const config: PlanConfig = { ...old.config, ...patch, startDate: today > old.config.startDate ? today : old.config.startDate }
    const result = this.build(config)
    // Keep done/skipped history (R-10): past tasks that are done or skipped stay; undone overdue/future tasks regenerate.
    const ctx = {
      plan: old,
      events: this.p.events,
      f: completionDates(this.p.events, this.p.settings.dayStartHour),
      content: this.info,
      caps: CAPABILITIES,
      today,
      dayStartHour: this.p.settings.dayStartHour
    }
    const kept = old.tasks.filter((t) => {
      if (t.date >= today) return false
      const st = taskStatus(t, ctx)
      return st === 'done' || st === 'skipped'
    })
    const keptIds = new Set(kept.map((t) => t.id))
    const fresh = result.tasks.filter((t) => !keptIds.has(t.id))
    const plan: Plan = {
      ...old,
      config,
      generatedAt: this.nowIso(),
      contentVersion: this.pack.contentVersion,
      overCapacity: result.overCapacity,
      requiredHoursPerDay: result.requiredHoursPerDay,
      tasks: [...kept, ...fresh].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.session - b.session))
    }
    return this.update((p) => ({ ...p, plans: { ...p.plans, [track]: plan } }))
  }

  planOverride(raw: unknown): Progress {
    const o = parse(zOverride, raw)
    const plan = this.p.plans[o.track]
    const task = plan?.tasks.find((t) => t.id === o.taskId)
    if (!plan || !task) throw new ServiceError('E_REF', 'Unknown task')
    if (plan.archivedAt) throw new ServiceError('E_ARCHIVED', 'This plan is archived')
    const at = this.nowIso()
    return this.update((p) => {
      const completions = [...p.events.completions]
      // A manual Done/Reset on a New Study task is a topic completion/reopening (R-6.1).
      if (task.type === 'new' || task.type === 'skim' || task.type === 'revision-pass') {
        for (const topicId of task.topicIds) {
          if (o.status === 'done') completions.push({ topicId, type: 'completed', source: task.type === 'revision-pass' ? 'revision' : 'manual', track: o.track, at })
          if (o.status === 'reset') completions.push({ topicId, type: 'reopened', source: 'manual', track: o.track, at })
        }
      }
      return { ...p, events: { ...p.events, completions, overrides: [...p.events.overrides, { ...o, at }] } }
    })
  }

  /** Archive plans whose exam date has passed (R-9). Called on load and day change. */
  archivePastPlans(): void {
    const today = this.today()
    const at = this.nowIso()
    const toArchive = (['midterm', 'final'] as const).filter((t) => {
      const pl = this.p.plans[t]
      return pl && !pl.archivedAt && today > pl.config.examDate
    })
    if (!toArchive.length || this.store.meta.readOnly) return
    this.update((p) => {
      const plans = { ...p.plans }
      for (const t of toArchive) plans[t] = { ...plans[t]!, archivedAt: at }
      return { ...p, plans }
    })
  }

  /* ---------------------------------------------------------------- study events */

  private activeTrack(): 'midterm' | 'final' | undefined {
    const today = this.today()
    const cands = (['midterm', 'final'] as const).filter((t) => this.p.plans[t] && !this.p.plans[t]!.archivedAt && this.p.plans[t]!.config.examDate >= today)
    return cands.sort((a, b) => (this.p.plans[a]!.config.examDate < this.p.plans[b]!.config.examDate ? -1 : 1))[0]
  }

  /** Append topicCompleted {auto} the first time R-6.1 is met (idempotent). */
  private withAutoCompletion(p: Progress, topicId: string): Progress {
    const f = completionDates(p.events, p.settings.dayStartHour)
    if (f.has(topicId)) return p
    if (!autoCompletionMet(topicId, p.events, this.info, CAPABILITIES)) return p
    const track = this.activeTrack()
    return {
      ...p,
      events: {
        ...p.events,
        completions: [
          ...p.events.completions,
          { topicId, type: 'completed', source: 'auto', ...(track ? { track } : {}), at: this.nowIso(), contentVersion: this.pack.topics[topicId]?.contentVersion }
        ]
      }
    }
  }

  markRead(raw: unknown): Progress {
    const r = parse(zMarkRead, raw)
    if (!this.sectionIds.get(r.topicId)?.has(r.sectionId)) throw new ServiceError('E_REF', 'Unknown section')
    const today = this.today()
    const dsh = this.p.settings.dayStartHour
    const at = this.nowIso()
    return this.update((p) => {
      const dup = p.events.sectionReads.some((x) => x.topicId === r.topicId && x.sectionId === r.sectionId && studyDate(x.at, dsh) === today)
      const next = dup ? p : { ...p, events: { ...p.events, sectionReads: [...p.events.sectionReads, { ...r, at }] } }
      return this.withAutoCompletion(next, r.topicId)
    })
  }

  setStudied(raw: unknown): Progress {
    const r = parse(zSetStudied, raw)
    this.requireTopic(r.topicId)
    const today = this.today()
    if (r.date && r.date > today) throw new ServiceError('E_VALIDATION', 'Date cannot be in the future')
    const at = r.date && r.date !== today ? `${r.date}T12:00:00.000Z` : this.nowIso()
    const track = this.activeTrack()
    return this.update((p) => ({
      ...p,
      events: {
        ...p.events,
        completions: [
          ...p.events.completions,
          { topicId: r.topicId, type: r.studied ? 'completed' : 'reopened', source: 'manual', ...(track ? { track } : {}), at }
        ]
      }
    }))
  }

  confidence(raw: unknown): Progress {
    const r = parse(zConfidence, raw)
    this.requireTopic(r.topicId)
    const at = this.nowIso()
    return this.update((p) => ({ ...p, events: { ...p.events, confidence: [...p.events.confidence, { ...r, at }] } }))
  }

  /* ---------------------------------------------------------------- sessions */

  sessionStart(raw: unknown): { sessionId: string; questionIds: string[] } {
    const s = parse(zSessionStart, raw)
    for (const id of [s.topicId, ...(s.topicIds ?? [])].filter((x): x is string => !!x)) this.requireTopic(id)
    if (s.sectionId && (!s.topicId || !this.sectionIds.get(s.topicId)?.has(s.sectionId))) throw new ServiceError('E_REF', 'Unknown section')
    if (s.emqThemeId && !this.pack.emqVolumes.some((t) => t.id === s.emqThemeId)) throw new ServiceError('E_REF', 'Unknown EMQ theme')
    if (s.taskId && !Object.values(this.p.plans).some((pl) => pl?.tasks.some((t) => t.id === s.taskId))) throw new ServiceError('E_REF', 'Unknown task')
    const sessionId = this.platform.newId()
    let questionIds: string[]
    try {
      questionIds = pickQuestions({ ...s, pack: this.pack, events: this.p.events, seed: sessionId })
    } catch (e) {
      if (e instanceof SelectionError) throw new ServiceError(e.code, e.message)
      throw e
    }
    if (questionIds.length === 0 && !['rapid-review', 'emq-volume', 'review', 'ospe'].includes(s.kind)) {
      throw new ServiceError('NO_QUESTIONS', 'No questions are available for this yet')
    }
    const at = this.nowIso()
    this.update((p) => ({
      ...p,
      events: {
        ...p.events,
        sessions: [
          ...p.events.sessions,
          {
            id: sessionId,
            kind: s.kind,
            ...(s.topicId ? { topicId: s.topicId } : {}),
            ...(s.sectionId ? { sectionId: s.sectionId } : {}),
            ...(s.systemId ? { systemId: s.systemId } : {}),
            ...(s.examId ? { examId: s.examId } : {}),
            ...(s.emqThemeId ? { emqThemeId: s.emqThemeId } : {}),
            ...(s.taskId ? { taskId: s.taskId } : {}),
            questionIds,
            startedAt: at
          }
        ]
      }
    }))
    return { sessionId, questionIds }
  }

  sectionOf(questionId: string, item?: number): string | null {
    const e = this.qIndex.get(questionId)
    if (!e) return null
    const q = e.q
    return q.kind === 'sba' ? q.studyRef.sectionId : (q.items[item ?? 0]?.studyRef.sectionId ?? null)
  }

  sessionAnswer(raw: unknown): AnswerFeedback {
    const a = parse(zAnswer, raw)
    const session = this.p.events.sessions.find((s) => s.id === a.sessionId)
    if (!session) throw new ServiceError('E_REF', 'Unknown session')
    if (session.completedAt) throw new ServiceError('E_CLOSED', 'This session is already complete')
    const at = this.nowIso()

    if (session.kind === 'emq-volume') {
      const theme = this.pack.emqVolumes.find((t) => t.id === session.emqThemeId)
      const item = theme?.items.find((i) => i.n === (a.item ?? -1))
      if (!theme || !item) throw new ServiceError('E_REF', 'Unknown EMQ item')
      const answer = item.answer.charCodeAt(0) - 65
      const qid = `${item.topicId ?? 'emq'}.v-${theme.id}-${item.n}`
      if (qid !== a.questionId) throw new ServiceError('E_REF', 'Question does not match theme item')
      const accepted = new Set([answer, ...(item.alsoAccept ?? []).map((l) => l.charCodeAt(0) - 65)])
      const correct = accepted.has(a.choice)
      this.update((p) => ({
        ...p,
        events: {
          ...p.events,
          attempts: [
            ...p.events.attempts.filter((x) => !(x.sessionId === a.sessionId && x.questionId === qid)),
            { id: this.platform.newId(), sessionId: a.sessionId, questionId: qid, choice: a.choice, correct, ms: a.ms, at }
          ]
        }
      }))
      return {
        recorded: true,
        correct,
        answer: correct ? a.choice : answer,
        explanation: item.explanation,
        whyNot: null,
        studyRef: item.topicId && item.sectionId ? { topicId: item.topicId, sectionId: item.sectionId } : null,
        cites: [{ book: `emq${theme.volume}` as never, page: theme.where.answersPage }]
      }
    }

    if (!session.questionIds.includes(a.questionId)) throw new ServiceError('E_REF', 'Question is not part of this session')
    const entry = this.qIndex.get(a.questionId)
    if (!entry) throw new ServiceError('E_REF', 'Unknown question')
    const g = grade(entry.q, a.choice, a.item)
    if (!g) throw new ServiceError('E_VALIDATION', 'Item does not match the question type')
    const examMode = session.kind === 'exam'
    const already = this.p.events.attempts.some((x) => x.sessionId === a.sessionId && x.questionId === a.questionId && x.item === a.item)
    if (already && !examMode) throw new ServiceError('E_ANSWERED', 'Already answered')
    this.update((p) => ({
      ...p,
      events: {
        ...p.events,
        attempts: [
          ...p.events.attempts.filter((x) => !(examMode && x.sessionId === a.sessionId && x.questionId === a.questionId && x.item === a.item)),
          {
            id: this.platform.newId(),
            sessionId: a.sessionId,
            questionId: a.questionId,
            ...(a.item !== undefined ? { item: a.item } : {}),
            choice: a.choice,
            correct: g.correct,
            ms: a.ms,
            at
          }
        ]
      }
    }))
    if (examMode) return { recorded: true, correct: null, answer: null, explanation: null, whyNot: null, studyRef: null, cites: [] }
    return {
      recorded: true,
      correct: g.correct,
      answer: g.answer,
      explanation: g.explanation,
      whyNot: g.whyNot,
      studyRef: { topicId: entry.topicId, sectionId: g.sectionId },
      cites: entry.q.cites
    }
  }

  sessionComplete(raw: unknown): SessionResult {
    const sessionId = parse(z.string().uuid(), raw)
    const session = this.p.events.sessions.find((s) => s.id === sessionId)
    if (!session) throw new ServiceError('E_REF', 'Unknown session')
    const at = this.nowIso()
    if (!session.completedAt) {
      this.update((p) => {
        let next: Progress = {
          ...p,
          events: { ...p.events, sessions: p.events.sessions.map((s) => (s.id === sessionId ? { ...s, completedAt: at } : s)) }
        }
        if (session.kind === 'topic-quiz' && session.topicId) next = this.withAutoCompletion(next, session.topicId)
        if (session.kind === 'rapid-review' && session.topicId) {
          // A finished revision pass in the Final track (R-9) completes via rapid-review/reading of that topic.
          const task = session.taskId ? this.p.plans.final?.tasks.find((t) => t.id === session.taskId) : undefined
          if (task?.type === 'revision-pass') {
            next = {
              ...next,
              events: { ...next.events, completions: [...next.events.completions, { topicId: session.topicId, type: 'completed', source: 'revision', track: 'final', at }] }
            }
          }
        }
        return next
      })
    }
    const attempts = this.p.events.attempts.filter((a) => a.sessionId === sessionId)
    const byTopic: SessionResult['byTopic'] = {}
    const wrong: SessionResult['wrong'] = []
    for (const a of attempts) {
      const t = topicOfQuestion(a.questionId)
      const b = (byTopic[t] ??= { total: 0, correct: 0 })
      b.total++
      if (a.correct) b.correct++
      else {
        const sec = this.sectionOf(a.questionId, a.item)
        wrong.push({ questionId: a.questionId, ...(a.item !== undefined ? { item: a.item } : {}), studyRef: sec ? { topicId: t, sectionId: sec } : null })
      }
    }
    return { sessionId, total: attempts.length, correct: attempts.filter((a) => a.correct).length, byTopic, wrong }
  }

  cardsGrade(raw: unknown): Progress {
    const g = parse(zGrade, raw)
    if (!this.cardIds.has(g.cardId)) throw new ServiceError('E_REF', 'Unknown card')
    const at = this.nowIso()
    return this.update((p) => ({ ...p, events: { ...p.events, cardReviews: [...p.events.cardReviews, { ...g, at }] } }))
  }

  reflectionSave(raw: unknown): Progress {
    const r = parse(zReflection, raw)
    const at = this.nowIso()
    return this.update((p) => ({
      ...p,
      events: { ...p.events, reflections: [...p.events.reflections.filter((x) => !(x.track === r.track && x.weekStart === r.weekStart)), { ...r, at }] }
    }))
  }

  notesUpsert(raw: unknown): Progress {
    const n = parse(zNote, raw)
    this.requireTopic(n.topicId)
    if (n.sectionId && !this.sectionIds.get(n.topicId)?.has(n.sectionId)) throw new ServiceError('E_REF', 'Unknown section')
    const at = this.nowIso()
    const id = n.id ?? this.platform.newId()
    return this.update((p) => ({
      ...p,
      events: { ...p.events, notes: [...p.events.notes.filter((x) => x.id !== id), { id, topicId: n.topicId, ...(n.sectionId ? { sectionId: n.sectionId } : {}), text: n.text, at }] }
    }))
  }

  notesDelete(raw: unknown): Progress {
    const id = parse(z.string().uuid(), raw)
    return this.update((p) => ({ ...p, events: { ...p.events, notes: p.events.notes.filter((x) => x.id !== id) } }))
  }

  /* ---------------------------------------------------------------- data */

  async dataExport(): Promise<string | null> {
    const path = await this.platform.saveDialog(`im-companion-progress-${todayLocal(this.platform.now())}.json`)
    if (!path) return null
    await this.store.exportTo(path)
    return path
  }

  async dataImport(): Promise<boolean> {
    const path = await this.platform.openDialog()
    if (!path) return false
    const next = await this.store.readProgressFile(path)
    const ok = await this.platform.confirm('Replace your progress with this file?', 'A backup of your current progress is written first.')
    if (!ok) return false
    await this.store.replaceAll(next, 'import')
    return true
  }

  backupList(): Promise<BackupInfo[]> {
    return this.store.listBackups()
  }

  async backupRestore(raw: unknown): Promise<boolean> {
    const name = parse(z.string().max(80), raw)
    const next = await this.store.readBackup(name)
    const ok = await this.platform.confirm(`Restore ${name}?`, 'A backup of your current progress is written first.')
    if (!ok) return false
    await this.store.replaceAll(next, 'restore')
    return true
  }

  async reportIssue(raw: unknown): Promise<void> {
    const r = parse(zReport, raw)
    const params = new URLSearchParams({
      template: 'content_error.yml',
      title: `Content error: ${r.contentId}`.slice(0, 120),
      content_id: r.contentId,
      versions: `app ${this.platform.version} / content ${this.pack.contentVersion}`,
      details: r.comment
    })
    await this.platform.openExternal(`${NEW_ISSUE_URL}?${params.toString()}`)
  }

  /** Planned day helpers for the renderer are derived there; this exposes the phase split for tests. */
  phases(track: 'midterm' | 'final'): ReturnType<typeof phasesOf> | null {
    const pl = this.p.plans[track]
    return pl ? phasesOf(studyDaysOf(pl.config)) : null
  }

  /** Default midterm config for first run. */
  defaultConfig(track: 'midterm' | 'final'): PlanConfig {
    const today = this.today()
    const ex = this.pack.blueprint.exams
    const start = track === 'final' ? (today > ex.midterm.date ? today : addDays(ex.midterm.date, 1)) : today
    return {
      track,
      startDate: start,
      examDate: track === 'midterm' ? ex.midterm.date : ex.final.date,
      studyWeekdays: [0, 1, 2, 3, 4],
      hoursPerDay: 5.5,
      systemOrder: this.pack.blueprint.systems.map((s) => s.id)
    }
  }
}
