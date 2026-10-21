/** Accuracy, bands, confidence, weak areas (R-7) and progress figures (R-8). Pure. */
import { diffDays, planWeek, type ISODate } from '../dates'
import type { Events, Plan } from '../progress-schema'
import { studyDaysOf } from './plan'
import { taskStatus, topicOfQuestion, type Review, type StatusContext, type TaskStatus } from './status'

export type Band = 'not-started' | 'weak' | 'borderline' | 'strong'

export interface TopicStats {
  attempts: number
  correct: number
  accuracy: number | null
  band: Band
  confidence: number | null
  lastAttempt: string | null
  /** Section ids answered wrong (most recent first, unique). */
  wrongSections: string[]
}

export function bandOf(attempts: number, accuracy: number | null): Band {
  if (!attempts || accuracy === null) return 'not-started'
  if (accuracy < 0.6) return 'weak'
  if (accuracy < 0.75) return 'borderline'
  return 'strong'
}

/**
 * Per-topic accuracy from graded attempts (all modes). `sectionOf(questionId, item)` maps an attempt to
 * its studyRef section (from content); EMQ-volume attempts use question ids of the form `<topicId>.v…`.
 */
export function topicStats(events: Events, sectionOf: (questionId: string, item?: number) => string | null): Map<string, TopicStats> {
  const out = new Map<string, TopicStats>()
  const get = (id: string): TopicStats => {
    let s = out.get(id)
    if (!s) out.set(id, (s = { attempts: 0, correct: 0, accuracy: null, band: 'not-started', confidence: null, lastAttempt: null, wrongSections: [] }))
    return s
  }
  const sorted = [...events.attempts].sort((a, b) => (a.at < b.at ? 1 : -1))
  for (const a of sorted) {
    const s = get(topicOfQuestion(a.questionId))
    s.attempts++
    if (a.correct) s.correct++
    if (!s.lastAttempt) s.lastAttempt = a.at
    if (!a.correct) {
      const sec = sectionOf(a.questionId, a.item)
      if (sec && !s.wrongSections.includes(sec)) s.wrongSections.push(sec)
    }
  }
  for (const c of [...events.confidence].sort((a, b) => (a.at < b.at ? -1 : 1))) get(c.topicId).confidence = c.value
  for (const s of out.values()) {
    s.accuracy = s.attempts ? s.correct / s.attempts : null
    s.band = bandOf(s.attempts, s.accuracy)
  }
  return out
}

export function needsReview(s: TopicStats | undefined, studied: boolean): boolean {
  if (!studied || !s) return false
  return (s.band === 'weak' && s.attempts >= 5) || (s.confidence !== null && s.confidence <= 2)
}

/** Weak-drill topic choice (R-7): needs-review → borderline → else the 3 lowest-accuracy studied topics. */
export function weakTopics(stats: Map<string, TopicStats>, studied: ReadonlyMap<string, ISODate>, limit = 5): string[] {
  const studiedIds = [...studied.keys()]
  const key = (id: string): [number, string] => [stats.get(id)?.accuracy ?? 1, stats.get(id)?.lastAttempt ?? '']
  const sortFn = (a: string, b: string): number => {
    const [aa, al] = key(a)
    const [ba, bl] = key(b)
    return aa - ba || (al < bl ? -1 : al > bl ? 1 : 0)
  }
  const nr = studiedIds.filter((id) => needsReview(stats.get(id), true)).sort(sortFn)
  const bl = studiedIds.filter((id) => !nr.includes(id) && stats.get(id)?.band === 'borderline').sort(sortFn)
  const picked = [...nr, ...bl]
  if (picked.length) return picked.slice(0, limit)
  return studiedIds.filter((id) => (stats.get(id)?.attempts ?? 0) > 0).sort(sortFn).slice(0, 3)
}

/** Final track revision order (R-9): needs review → weak → borderline → oldest last activity. */
export function revisionOrder(topicIds: string[], stats: Map<string, TopicStats>, studied: ReadonlyMap<string, ISODate>): string[] {
  const rank = (id: string): number => {
    const s = stats.get(id)
    if (needsReview(s, true)) return 0
    if (s?.band === 'weak') return 1
    if (s?.band === 'borderline') return 2
    return 3
  }
  const last = (id: string): string => stats.get(id)?.lastAttempt ?? studied.get(id) ?? ''
  return [...topicIds].sort((a, b) => rank(a) - rank(b) || (last(a) < last(b) ? -1 : last(a) > last(b) ? 1 : 0))
}

/* ---------------------------------------------------------------- R-8 progress */

export interface TaskView {
  task: Plan['tasks'][number]
  status: TaskStatus
}

export interface ProgressFigures {
  plannedHours: number
  doneHours: number
  overall: number
  topicsInScope: number
  topicsStudied: number
  overdueCount: number
  overdueHours: number
  reviewsDone: number
  reviewsScheduled: number
  daysToExam: number
  studyDaysLeft: number
  weekNo: number | null
  byType: Record<string, { planned: number; done: number }>
  bySystem: Record<string, { topics: number; studied: number; planned: number; done: number }>
  byWeek: Array<{ week: number; from: ISODate; to: ISODate; planned: number; done: number }>
}

export function progressFigures(
  ctx: StatusContext,
  reviews: Review[],
  scopeTopics: Array<{ id: string; systemId: string }>,
  flagOf: (v: TaskView) => string
): ProgressFigures {
  const { plan, today } = ctx
  const views: TaskView[] = plan.tasks.map((task) => ({ task, status: taskStatus(task, ctx) }))
  let planned = 0
  let done = 0
  let overdueCount = 0
  let overdueHours = 0
  const byType: ProgressFigures['byType'] = {}
  const bySystem: ProgressFigures['bySystem'] = {}
  const weeks = new Map<number, { from: ISODate; to: ISODate; planned: number; done: number }>()
  const addWeek = (date: ISODate, p: number, d: number): void => {
    const w = planWeek(plan.config.startDate, date)
    const cur = weeks.get(w) ?? { from: date, to: date, planned: 0, done: 0 }
    cur.from = cur.from < date ? cur.from : date
    cur.to = cur.to > date ? cur.to : date
    cur.planned += p
    cur.done += d
    weeks.set(w, cur)
  }
  for (const t of scopeTopics) {
    const b = (bySystem[t.systemId] ??= { topics: 0, studied: 0, planned: 0, done: 0 })
    b.topics++
    if (ctx.f.has(t.id)) b.studied++
  }
  for (const v of views) {
    if (v.status === 'skipped') continue
    const h = v.task.plannedHours
    const d = v.status === 'done' ? h : 0
    planned += h
    done += d
    const bt = (byType[v.task.type] ??= { planned: 0, done: 0 })
    bt.planned += h
    bt.done += d
    for (const s of v.task.systemIds) {
      const b = bySystem[s]
      if (b && ['new', 'skim', 'revision-pass', 'rapid'].includes(v.task.type)) {
        b.planned += h
        b.done += d
      }
    }
    addWeek(v.task.date, h, d)
    if (flagOf(v) === 'overdue') {
      overdueCount++
      overdueHours += h
    }
  }
  let reviewsDone = 0
  for (const r of reviews) {
    planned += r.hours
    const bt = (byType['review'] ??= { planned: 0, done: 0 })
    bt.planned += r.hours
    if (r.done) {
      done += r.hours
      bt.done += r.hours
      reviewsDone++
    } else if (r.due < today) {
      overdueCount++
      overdueHours += r.hours
    }
    addWeek(r.due, r.hours, r.done ? r.hours : 0)
  }
  const days = studyDaysOf(plan.config)
  const inPlan = today >= plan.config.startDate && today <= plan.config.examDate
  return {
    plannedHours: planned,
    doneHours: done,
    overall: planned ? done / planned : 0,
    topicsInScope: scopeTopics.length,
    topicsStudied: scopeTopics.filter((t) => ctx.f.has(t.id)).length,
    overdueCount,
    overdueHours,
    reviewsDone,
    reviewsScheduled: reviews.length,
    daysToExam: Math.max(0, diffDays(today, plan.config.examDate)),
    studyDaysLeft: days.filter((d) => d >= today).length,
    weekNo: inPlan ? planWeek(plan.config.startDate, today) : null,
    byType,
    bySystem,
    byWeek: [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([week, w]) => ({ week, ...w }))
  }
}
