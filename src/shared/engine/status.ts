/**
 * Derived status (ADR-0007): topic completion f (R-6.1), spaced reviews (R-5), task status & flags (R-6.2–R-6.4).
 * Pure functions of plan + events + content availability + capabilities + today.
 */
import { addDays, diffDays, studyDate, type ISODate } from '../dates'
import type { Events, Plan, Task } from '../progress-schema'
import { phasesOf, studyDaysOf } from './plan'

export interface Capabilities {
  quizzes: boolean
  practice: boolean
  drills: boolean
  exams: boolean
  mocks: boolean
  ospe: boolean
}

export interface ContentInfo {
  /** topicId → contentVersion date (YYYY-MM-DD) for topics whose content is in the pack. */
  available: ReadonlyMap<string, ISODate>
  /** Exam ids present in the pack. */
  exams: ReadonlySet<string>
  /** topicId → section ids (for R-6.1). */
  sections: ReadonlyMap<string, readonly string[]>
  /** topicId → has topic-quiz questions. */
  hasTopicQuiz: ReadonlySet<string>
}

/* ---------------------------------------------------------------- R-6.1 completion */

/** Study date of the latest `completed` without a later `reopened`, per topic. */
export function completionDates(events: Events, dayStartHour: number): Map<string, ISODate> {
  const sorted = [...events.completions].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const out = new Map<string, ISODate>()
  for (const c of sorted) {
    if (c.type === 'completed') out.set(c.topicId, studyDate(c.at, dayStartHour))
    else out.delete(c.topicId)
  }
  return out
}

/** True when R-6.1's auto condition is met (main appends topicCompleted the first time). */
export function autoCompletionMet(topicId: string, events: Events, content: ContentInfo, caps: Capabilities): boolean {
  const sections = content.sections.get(topicId)
  if (!sections || sections.length === 0) return false
  const read = new Set(events.sectionReads.filter((r) => r.topicId === topicId).map((r) => r.sectionId))
  if (!sections.every((s) => read.has(s))) return false
  if (caps.quizzes && content.hasTopicQuiz.has(topicId)) {
    return events.sessions.some((s) => s.kind === 'topic-quiz' && s.topicId === topicId && !!s.completedAt)
  }
  return true
}

/* ---------------------------------------------------------------- R-5 reviews */

export interface Review {
  topicId: string
  k: number
  due: ISODate
  done: boolean
  doneAt?: ISODate
  hours: number
}

export const REVIEW_OFFSETS = [1, 3, 7, 14] as const

/** Derived spaced reviews for a plan (R-5). `hoursOf` gives each topic's studyHours. */
export function reviewsFor(plan: Plan, events: Events, f: ReadonlyMap<string, ISODate>, hoursOf: (topicId: string) => number, dayStartHour: number): Review[] {
  const days = studyDaysOf(plan.config)
  if (days.length === 0) return []
  const { learn, consolidate, final } = phasesOf(days)
  const firstFinal = final[0] ?? plan.config.examDate
  const fallback = consolidate.length ? consolidate : learn.length ? [learn[learn.length - 1]!] : []
  const studyDaySet = new Set(days)
  const nextStudyDay = (d: ISODate): ISODate | null => {
    for (let x = d; x < plan.config.examDate; x = addDays(x, 1)) if (studyDaySet.has(x)) return x
    return null
  }
  // Topics of this plan, in plan order (first scheduled task).
  const order: string[] = []
  const seen = new Set<string>()
  for (const t of plan.tasks) {
    if (!['new', 'skim', 'revision-pass', 'rapid'].includes(t.type)) continue
    for (const id of t.topicIds) {
      if (!seen.has(id)) {
        seen.add(id)
        order.push(id)
      }
    }
  }
  // Studied-from-book / first-run topics that aren't tasks still get reviews.
  for (const id of f.keys()) {
    if (!seen.has(id) && planScopeHas(plan, id)) {
      seen.add(id)
      order.push(id)
    }
  }

  const reviewSessions = events.sessions
    .filter((s) => s.kind === 'review' && s.completedAt && s.topicId)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? -1 : 1))

  let rr = 0
  const out: Review[] = []
  for (const topicId of order) {
    const start = f.get(topicId)
    if (!start || start >= plan.config.examDate) continue
    const dues: ISODate[] = []
    let prev: ISODate | null = null
    for (const off of REVIEW_OFFSETS) {
      let due = nextStudyDay(addDays(start, off))
      if (!due || due >= firstFinal) {
        if (!fallback.length) continue
        due = fallback[rr++ % fallback.length]!
      }
      if (due <= start || (prev && due <= prev)) continue
      dues.push(due)
      prev = due
    }
    const hours = Math.max(0.25, Math.round(0.25 * hoursOf(topicId) * 4) / 4)
    const reviews: Review[] = dues.map((due, k) => ({ topicId, k: k + 1, due, done: false, hours }))
    for (const s of reviewSessions.filter((s) => s.topicId === topicId)) {
      const sd = studyDate(s.completedAt!, dayStartHour)
      if (sd < start) continue
      const r = reviews.find((x) => !x.done && diffDays(sd, x.due) <= 1)
      if (r) {
        r.done = true
        r.doneAt = sd
      }
    }
    out.push(...reviews)
  }
  return out
}

function planScopeHas(plan: Plan, topicId: string): boolean {
  return plan.tasks.some((t) => t.topicIds.includes(topicId))
}

/* ---------------------------------------------------------------- R-6.2 task status */

export type TaskStatus = 'done' | 'skipped' | 'in-progress' | 'not-started' | 'pending' | 'manual'
export type TaskFlag = 'done' | 'pending' | 'overdue' | 'catch-up' | 'today' | 'upcoming' | 'skipped'

export interface StatusContext {
  plan: Plan
  events: Events
  f: ReadonlyMap<string, ISODate>
  content: ContentInfo
  caps: Capabilities
  today: ISODate
  dayStartHour: number
}

export function overrideOf(events: Events, track: string, taskId: string): 'done' | 'skipped' | null {
  let state: 'done' | 'skipped' | null = null
  for (const o of [...events.overrides].filter((o) => o.track === track && o.taskId === taskId).sort((a, b) => (a.at < b.at ? -1 : 1))) {
    state = o.status === 'reset' ? null : o.status
  }
  return state
}

/** The 3 most recently studied topics as of `date` (QA N1), falling back to the task's own topics. */
export function questionTopics(task: Task, f: ReadonlyMap<string, ISODate>): string[] {
  if (task.phase !== 'learn') return task.topicIds
  const recent = [...f.entries()].filter(([, d]) => d <= task.date).sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
  return recent.length ? recent.slice(0, 3).map(([id]) => id) : task.topicIds
}

export function taskStatus(task: Task, ctx: StatusContext): TaskStatus {
  const { events, f, content, caps, dayStartHour } = ctx
  const ov = overrideOf(events, ctx.plan.config.track, task.id)
  if (ov) return ov
  const since = (iso: string | undefined): boolean => !!iso && studyDate(iso, dayStartHour) >= task.date
  const completedSessions = (pred: (s: Events['sessions'][number]) => boolean): boolean => events.sessions.some((s) => pred(s) && since(s.completedAt))
  switch (task.type) {
    case 'exam':
      return 'not-started'
    case 'new':
    case 'skim': {
      if (task.topicIds.every((id) => f.has(id))) return 'done'
      if (task.type === 'skim') {
        if (task.topicIds.every((id) => completedSessions((s) => s.kind === 'rapid-review' && s.topicId === id))) return 'done'
      }
      if (task.topicIds.some((id) => !content.available.has(id))) return 'pending'
      return events.sectionReads.some((r) => task.topicIds.includes(r.topicId)) ? 'in-progress' : 'not-started'
    }
    case 'revision-pass': {
      const done = task.topicIds.every((id) =>
        events.completions.some((c) => c.topicId === id && c.type === 'completed' && c.source === 'revision' && studyDate(c.at, dayStartHour) >= ctx.plan.config.startDate)
      )
      if (done) return 'done'
      if (task.topicIds.some((id) => !content.available.has(id))) return 'manual'
      return events.sectionReads.some((r) => task.topicIds.includes(r.topicId) && since(r.at)) ? 'in-progress' : 'not-started'
    }
    case 'rapid':
    case 'final-revision': {
      const ids = task.topicIds.filter((id) => content.available.has(id))
      if (ids.length === 0) return 'manual'
      const done = ids.filter((id) => completedSessions((s) => s.kind === 'rapid-review' && s.topicId === id))
      return done.length === ids.length ? 'done' : done.length ? 'in-progress' : 'not-started'
    }
    case 'questions': {
      if (!caps.practice) return 'manual'
      const topics = new Set(questionTopics(task, f))
      const practice = new Set(events.sessions.filter((s) => s.kind === 'practice').map((s) => s.id))
      const n = events.attempts.filter((a) => practice.has(a.sessionId) && since(a.at) && topics.has(topicOfQuestion(a.questionId))).length
      if (n >= (task.target ?? 1)) return 'done'
      return n > 0 ? 'in-progress' : 'not-started'
    }
    case 'ospe':
      if (!caps.ospe) return 'manual'
      return completedSessions((s) => s.kind === 'ospe') ? 'done' : 'not-started'
    case 'weak':
      if (!caps.drills) return 'manual'
      return completedSessions((s) => s.kind === 'weak-drill') ? 'done' : events.sessions.some((s) => s.kind === 'weak-drill' && since(s.startedAt)) ? 'in-progress' : 'not-started'
    case 'chapter-exam':
    case 'mock': {
      const enabled = task.type === 'mock' ? caps.mocks : caps.exams
      if (!enabled || !task.examId || !content.exams.has(task.examId)) return 'manual'
      if (events.sessions.some((s) => s.kind === 'exam' && s.examId === task.examId && s.completedAt)) return 'done'
      return events.sessions.some((s) => s.kind === 'exam' && s.examId === task.examId) ? 'in-progress' : 'not-started'
    }
    case 'mock-review':
      return 'manual'
  }
}

/** R-6.4 flags (+ R-6.3 catch-up: content arrived after the task date, 3-study-day grace). */
export function taskFlag(task: Task, status: TaskStatus, ctx: StatusContext): TaskFlag {
  if (status === 'done') return 'done'
  if (status === 'skipped') return 'skipped'
  if (status === 'pending') return 'pending'
  if (task.date === ctx.today) return 'today'
  if (task.date > ctx.today) return 'upcoming'
  if (task.type === 'new' || task.type === 'skim') {
    const arrived = task.topicIds.map((id) => ctx.content.available.get(id)).filter((d): d is ISODate => !!d)
    const latest = arrived.sort().at(-1)
    if (latest && latest > task.date && diffDays(latest, ctx.today) <= 4) return 'catch-up'
  }
  return 'overdue'
}

/** Question ids are `<topicId>.q<n>`; the topic is everything before the last dot-segment. */
export function topicOfQuestion(questionId: string): string {
  const i = questionId.lastIndexOf('.')
  return i > 0 ? questionId.slice(0, i) : questionId
}
