/**
 * Plan generation: docs/05 R-1 (phases), R-2 (placement & capacity), R-3 (daily fill), R-4 (consolidate/final),
 * R-9 (track scope), R-10 (materialised tasks). Pure: (config, topics, studied set, …) → tasks.
 */
import type { TopicMeta } from '../content-schema'
import { addDays, dateRange, formatDate, planWeek, weekdayIndex, type ISODate } from '../dates'
import type { Phase, PlanConfig, Task, TaskType } from '../progress-schema'

export class PlanError extends Error {
  constructor(
    public readonly code: 'NO_STUDY_DAYS' | 'BAD_CONFIG',
    message: string
  ) {
    super(message)
  }
}

export interface PlanInput {
  config: PlanConfig
  /** All blueprint topics (any order). */
  topics: TopicMeta[]
  /** Topic ids that already have a completion date f (R-6.1) at generation time. */
  studied: ReadonlySet<string>
  /** Final track: studied midterm topics ordered by need (R-9). Defaults to plan order. */
  revisionOrder?: string[]
  systemTitles: Record<string, string>
}

export interface PlanResult {
  tasks: Task[]
  studyDays: ISODate[]
  phases: { learn: ISODate[]; consolidate: ISODate[]; final: ISODate[] }
  /** New-study budget per Learn day (b), before and after skim conversion. */
  budget: number
  warning: boolean
  overCapacity: boolean
  cram: boolean
  skimmed: string[]
  requiredHoursPerDay: number
}

interface Unit {
  topic: TopicMeta
  type: Extract<TaskType, 'new' | 'skim' | 'revision-pass' | 'rapid'>
  hours: number
}

/** Round to the nearest quarter hour. */
export const q = (h: number): number => Math.round(h * 4) / 4

export function studyDaysOf(config: PlanConfig): ISODate[] {
  if (config.examDate <= config.startDate) return []
  const set = new Set(config.studyWeekdays)
  return dateRange(config.startDate, addDays(config.examDate, -1)).filter((d) => set.has(weekdayIndex(d)))
}

/** R-1 */
export function phasesOf(days: ISODate[]): PlanResult['phases'] {
  const D = days.length
  const F = Math.min(2, D)
  const C = D >= 7 ? Math.round(0.25 * D) : 0
  const L = Math.max(0, D - F - C)
  return { learn: days.slice(0, L), consolidate: days.slice(L, L + C), final: days.slice(L + C) }
}

/** Topics in scope for a track, in plan order (systemOrder, then order) — R-9. */
export function scopeOf(config: PlanConfig, topics: TopicMeta[]): TopicMeta[] {
  const rank = new Map(config.systemOrder.map((s, i) => [s, i]))
  const inScope = topics.filter((t) => (config.track === 'midterm' ? t.assessedIn.includes('mid') : true))
  return inScope.sort((a, b) => (rank.get(a.systemId) ?? 99) - (rank.get(b.systemId) ?? 99) || a.order - b.order)
}

const PRIORITY_SKIM_ORDER = { standard: 0, medium: 1, high: 2 } as const

export function generatePlan(input: PlanInput): PlanResult {
  const { config } = input
  if (config.examDate <= config.startDate) throw new PlanError('NO_STUDY_DAYS', 'No study days left before the exam')
  const days = studyDaysOf(config)
  if (days.length === 0) throw new PlanError('NO_STUDY_DAYS', 'No study days left before the exam')
  const phases = phasesOf(days)
  const hpd = config.hoursPerDay
  const scope = scopeOf(config, input.topics)

  // Units to place (R-2 / R-9)
  let units: Unit[]
  if (config.track === 'midterm') {
    units = scope.filter((t) => !input.studied.has(t.id)).map((t) => ({ topic: t, type: 'new' as const, hours: t.studyHours }))
  } else {
    const fresh = scope.filter((t) => !t.assessedIn.includes('mid') || !input.studied.has(t.id))
    const byId = new Map(scope.map((t) => [t.id, t]))
    const revIds = (input.revisionOrder ?? scope.map((t) => t.id)).filter((id) => byId.get(id)?.assessedIn.includes('mid') && input.studied.has(id))
    const rev = revIds.map((id) => byId.get(id)!)
    const newU = fresh.map((t) => ({ topic: t, type: 'new' as const, hours: t.studyHours }))
    const revU = rev.map((t) => ({ topic: t, type: 'revision-pass' as const, hours: Math.max(0.5, q(0.4 * t.studyHours)) }))
    units = []
    for (let i = 0; i < Math.max(newU.length, revU.length); i++) {
      if (newU[i]) units.push(newU[i]!)
      if (revU[i]) units.push(revU[i]!)
    }
  }

  const tasks: Task[] = []
  const sessionNo = new Map<ISODate, number>()
  const push = (date: ISODate, phase: Phase, t: Omit<Task, 'id' | 'date' | 'session' | 'phase'>): void => {
    const n = (sessionNo.get(date) ?? 0) + 1
    sessionNo.set(date, n)
    tasks.push({ id: `${config.track}-${date}-s${n}`, date, session: n, phase, ...t })
  }
  const sys = (id: string): string => input.systemTitles[id] ?? id

  const L = phases.learn.length
  const cram = L === 0
  let H = units.reduce((s, u) => s + u.hours, 0)
  const skimmed: string[] = []
  let budget: number
  let warning: boolean
  let overCapacity: boolean

  if (cram) {
    // R-2.4: everything becomes rapid review, spread proportionally over all study days.
    units = units.map((u) => ({ ...u, type: 'rapid' as const, hours: Math.max(0.25, q(0.25 * u.topic.studyHours)) }))
    H = units.reduce((s, u) => s + u.hours, 0)
    budget = H / days.length
    warning = true
    overCapacity = budget > hpd
    placeProportionally(units, days, H, (u, date) =>
      push(date, phaseOfDay(date, phases), {
        type: 'rapid',
        topicIds: [u.topic.id],
        systemIds: [u.topic.systemId],
        title: `Rapid review: ${u.topic.title}`,
        plannedHours: u.hours
      })
    )
  } else {
    budget = H / L
    // R-2.2 skim conversion
    if (budget > 0.9 * hpd) {
      const candidates = units
        .filter((u) => u.type === 'new' && u.topic.priority !== 'high')
        .sort((a, b) => PRIORITY_SKIM_ORDER[a.topic.priority] - PRIORITY_SKIM_ORDER[b.topic.priority] || b.topic.order - a.topic.order)
      for (const u of candidates) {
        if (H / L <= 0.9 * hpd) break
        const next = Math.max(0.25, q(0.5 * u.hours))
        H -= u.hours - next
        u.hours = next
        u.type = 'skim'
        skimmed.push(u.topic.id)
      }
      budget = H / L
    }
    warning = budget > 0.7 * hpd
    overCapacity = budget > hpd

    // R-2.1 proportional placement on Learn days
    const dayNew = new Map<ISODate, number>()
    const dayTopics = new Map<ISODate, string[]>()
    if (H > 0)
      placeProportionally(units, phases.learn, H, (u, date) => {
        dayNew.set(date, (dayNew.get(date) ?? 0) + u.hours)
        dayTopics.set(date, [...(dayTopics.get(date) ?? []), u.topic.id])
        const label = u.type === 'skim' ? 'Skim' : u.type === 'revision-pass' ? 'Revision pass' : 'New'
        push(date, 'learn', { type: u.type, topicIds: [u.topic.id], systemIds: [u.topic.systemId], title: `${label}: ${u.topic.title}`, plannedHours: u.hours })
      })

    // R-3 daily fill on Learn days
    let prevTopics: string[] = []
    phases.learn.forEach((date, i) => {
      let rem = Math.max(0, hpd - (dayNew.get(date) ?? 0))
      const today = dayTopics.get(date) ?? []
      if (config.track === 'midterm' && rem >= 0.25) {
        const h = q(Math.min(0.5, rem))
        if (h >= 0.25) {
          push(date, 'learn', { type: 'ospe', topicIds: [...today], systemIds: [], title: 'OSPE practice: recent topics', plannedHours: h })
          rem -= h
        }
      }
      const qh = q(Math.min(1.5, rem * 0.5))
      if (qh >= 0.25) {
        const topicIds = i === 0 ? today : prevTopics.length ? prevTopics : today
        push(date, 'learn', {
          type: 'questions',
          topicIds,
          systemIds: [],
          title: 'Questions: recently studied topics',
          plannedHours: qh,
          target: Math.ceil(15 * qh)
        })
        rem -= qh
      }
      const next = phases.learn[i + 1]
      const lastOfWeek = !next || planWeek(config.startDate, next) !== planWeek(config.startDate, date)
      if (lastOfWeek && rem >= 0.25) {
        const h = q(Math.min(0.5, rem))
        push(date, 'learn', { type: 'weak', topicIds: [], systemIds: [], title: 'Weekly weak areas', plannedHours: h })
      }
      if (today.length) prevTopics = today
    })
  }

  // R-4 Consolidate
  const C = phases.consolidate.length
  const systems = config.systemOrder.filter((s) => scope.some((t) => t.systemId === s))
  if (C > 0 && !cram) {
    const mockDays = C >= 3 ? phases.consolidate.slice(-2) : C === 2 ? phases.consolidate.slice(-1) : []
    const examDays = phases.consolidate.slice(0, C - mockDays.length)
    const examsByDay = new Map<ISODate, string[]>()
    systems.forEach((s, i) => {
      const d = examDays[Math.min(examDays.length - 1, Math.floor((i * examDays.length) / systems.length))]!
      examsByDay.set(d, [...(examsByDay.get(d) ?? []), s])
    })
    const mockKind = config.track === 'midterm' ? 'midterm' : 'final'
    phases.consolidate.forEach((date) => {
      let rem = hpd - 1 // ≥ 1 h review slot every Consolidate day (QA B5)
      const mockIdx = mockDays.indexOf(date)
      if (mockIdx >= 0) {
        const paper = mockIdx + 1
        push(date, 'consolidate', {
          type: 'mock',
          topicIds: [],
          systemIds: systems,
          examId: `mock-${mockKind}-${paper}`,
          title: `Mock ${mockKind} — paper ${paper}`,
          plannedHours: 2
        })
        push(date, 'consolidate', { type: 'mock-review', topicIds: [], systemIds: [], title: `Review mock paper ${paper} (wrong answers)`, plannedHours: 0.5 })
        rem -= 2.5
      }
      const examined = examsByDay.get(date) ?? []
      for (const s of examined) {
        push(date, 'consolidate', { type: 'chapter-exam', topicIds: [], systemIds: [s], examId: `exam-${s}`, title: `Chapter exam: ${sys(s)}`, plannedHours: 1 })
        rem -= 1
      }
      if (rem >= 1) {
        push(date, 'consolidate', { type: 'weak', topicIds: [], systemIds: [], title: 'Weak areas drill', plannedHours: 1 })
        rem -= 1
      }
      const qh = q(rem)
      if (qh >= 0.25) {
        push(date, 'consolidate', {
          type: 'questions',
          topicIds: scope.filter((t) => (examined.length ? examined : systems).includes(t.systemId)).map((t) => t.id),
          systemIds: examined.length ? examined : systems,
          title: examined.length ? `Questions: ${examined.map(sys).join(', ')}` : 'Mixed questions',
          plannedHours: qh,
          target: Math.ceil(15 * qh)
        })
      }
    })
  }

  // R-4 Final revision days
  if (!cram) {
    const F = phases.final.length
    phases.final.forEach((date, i) => {
      const chunk = systems.slice(Math.floor((i * systems.length) / F), Math.floor(((i + 1) * systems.length) / F))
      push(date, 'final', {
        type: 'final-revision',
        topicIds: scope.filter((t) => chunk.includes(t.systemId)).map((t) => t.id),
        systemIds: chunk,
        title: `Final revision: ${chunk.map(sys).join(', ')}`,
        plannedHours: q(Math.max(0.5, hpd - 1))
      })
      push(date, 'final', { type: 'weak', topicIds: [], systemIds: [], title: 'Last look at weak topics', plannedHours: 1 })
    })
  }

  push(config.examDate, 'exam', {
    type: 'exam',
    topicIds: [],
    systemIds: [],
    title: `${config.track === 'midterm' ? 'MIDTERM' : 'FINAL'} EXAM — ${formatDate(config.examDate, true)}`,
    plannedHours: 0
  })

  tasks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.session - b.session))
  return {
    tasks,
    studyDays: days,
    phases,
    budget,
    warning,
    overCapacity,
    cram,
    skimmed,
    requiredHoursPerDay: Math.ceil(budget * 4) / 4
  }
}

/** Topic i goes on day min(n−1, ⌊n · cumHoursBefore_i / H⌋) — R-2.1. */
function placeProportionally(units: Unit[], days: ISODate[], H: number, place: (u: Unit, date: ISODate) => void): void {
  let cum = 0
  for (const u of units) {
    const idx = Math.min(days.length - 1, Math.floor((days.length * cum) / H + 1e-9))
    place(u, days[idx]!)
    cum += u.hours
  }
}

function phaseOfDay(date: ISODate, p: PlanResult['phases']): Phase {
  if (p.learn.includes(date)) return 'learn'
  if (p.consolidate.includes(date)) return 'consolidate'
  return 'final'
}
