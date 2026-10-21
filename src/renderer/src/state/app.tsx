/**
 * App state: content pack, progress, navigation and derived views (all rules come from @shared/engine).
 * The renderer never computes correctness or writes data — it calls window.imc (SECURITY §1).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ContentPack, TopicMeta } from '@shared/content-schema'
import { studyDate, type ISODate } from '@shared/dates'
import { cardState, isDue, type CardState } from '@shared/engine/cards'
import { scopeOf } from '@shared/engine/plan'
import { progressFigures, topicStats, type ProgressFigures, type TopicStats } from '@shared/engine/stats'
import {
  completionDates,
  reviewsFor,
  taskFlag,
  taskStatus,
  type ContentInfo,
  type Review,
  type StatusContext,
  type TaskFlag,
  type TaskStatus
} from '@shared/engine/status'
import type { AppInfo, IpcResult, SessionStart, UpdateStatus } from '@shared/ipc'
import type { Plan, Progress, Task, Track } from '@shared/progress-schema'

export type View =
  | { name: 'today' }
  | { name: 'plan' }
  | { name: 'study'; topicId?: string; sectionId?: string; mode?: 'read' | 'rapid'; taskId?: string }
  | { name: 'practice'; tab?: string }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'session'; spec: SessionSpec; back: View }

export interface SessionSpec extends SessionStart {
  title: string
  mode: 'tutor' | 'exam' | 'cards' | 'review' | 'rapid' | 'ospe' | 'volume'
  minutes?: number
}

export interface TaskView {
  task: Task
  status: TaskStatus
  flag: TaskFlag
}

export interface Derived {
  track: Track | null
  plan: Plan | null
  ctx: StatusContext | null
  tasks: TaskView[]
  reviews: Review[]
  f: Map<string, ISODate>
  stats: Map<string, TopicStats>
  figures: ProgressFigures | null
  scope: TopicMeta[]
  cards: Map<string, CardState>
  dueCards: string[]
  today: ISODate
}

interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

interface AppCtx {
  pack: ContentPack
  progress: Progress
  info: AppInfo
  update: UpdateStatus | null
  view: View
  go(v: View): void
  track: Track | null
  setTrack(t: Track): void
  derived: Derived
  call<T>(p: Promise<IpcResult<T>>, okText?: string): Promise<T | null>
  refresh(): Promise<void>
  toast(text: string, kind?: 'info' | 'error'): void
  toasts: Toast[]
  dismissToast(id: number): void
  contentInfo: ContentInfo
  topicMeta(id: string): TopicMeta | undefined
  startSession(spec: SessionSpec): void
}

const Ctx = createContext<AppCtx | null>(null)
export const useApp = (): AppCtx => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp outside provider')
  return c
}

function versionDate(v: string): string {
  const [y, m, d] = v.split('.')
  return `${y}-${m}-${d}`
}

export function buildContentInfo(pack: ContentPack): ContentInfo {
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

export function sectionOfQuestion(pack: ContentPack, questionId: string, item?: number): string | null {
  const i = questionId.lastIndexOf('.')
  const t = pack.topics[questionId.slice(0, i)]
  const q = t?.questions.find((x) => x.id === questionId)
  if (!q) return null
  return q.kind === 'sba' ? q.studyRef.sectionId : (q.items[item ?? 0]?.studyRef.sectionId ?? null)
}

export function AppProvider({ pack, initial, info, children }: { pack: ContentPack; initial: Progress; info: AppInfo; children: ReactNode }): ReactNode {
  const [progress, setProgress] = useState(initial)
  const [view, setView] = useState<View>({ name: 'today' })
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [now, setNow] = useState(() => new Date())
  const [trackPick, setTrackPick] = useState<Track | null>(null)
  const contentInfo = useMemo(() => buildContentInfo(pack), [pack])
  const metaById = useMemo(() => new Map(pack.blueprint.topics.map((t) => [t.id, t])), [pack])

  const toast = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 3500)
  }, [])

  const refresh = useCallback(async () => {
    const r = await window.imc.progressGet()
    if (r.ok) setProgress(r.data)
  }, [])

  const call = useCallback(
    async <T,>(p: Promise<IpcResult<T>>, okText?: string): Promise<T | null> => {
      const r = await p
      if (!r.ok) {
        toast(r.message, 'error')
        return null
      }
      if (okText) toast(okText)
      return r.data
    },
    [toast]
  )

  useEffect(() => {
    const off = window.imc.onEvent((e) => {
      if (e.type === 'progressChanged') void refresh()
      if (e.type === 'update') setUpdate(e.status)
    })
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [refresh])

  useEffect(() => {
    const s = progress.settings
    document.documentElement.dataset['theme'] = s.theme === 'system' ? '' : s.theme
    if (s.theme === 'system') delete document.documentElement.dataset['theme']
    document.documentElement.style.setProperty('--font-scale', String(s.fontScale))
  }, [progress.settings])

  const today = studyDate(now, progress.settings.dayStartHour)

  const derived = useMemo<Derived>(() => {
    const plans = progress.plans
    const live = (['midterm', 'final'] as const).filter((t) => plans[t] && !plans[t]!.archivedAt)
    const auto = live.sort((a, b) => (plans[a]!.config.examDate < plans[b]!.config.examDate ? -1 : 1))[0] ?? (plans.final ? 'final' : plans.midterm ? 'midterm' : null)
    const track = trackPick && plans[trackPick] ? trackPick : auto
    const plan = track ? (plans[track] ?? null) : null
    const f = completionDates(progress.events, progress.settings.dayStartHour)
    const stats = topicStats(progress.events, (q, i) => sectionOfQuestion(pack, q, i))
    const examDate = plan?.config.examDate
    const byCard = new Map<string, Progress['events']['cardReviews']>()
    for (const r of progress.events.cardReviews) byCard.set(r.cardId, [...(byCard.get(r.cardId) ?? []), r])
    const cards = new Map<string, CardState>()
    const dueCards: string[] = []
    const readTopics = new Set(progress.events.sectionReads.map((r) => r.topicId))
    for (const t of Object.values(pack.topics)) {
      for (const c of t.cards) {
        const st = cardState(byCard.get(c.id) ?? [], progress.settings.dayStartHour, examDate)
        cards.set(c.id, st)
        if (isDue(st, today) || (st.due === null && (readTopics.has(t.topicId) || f.has(t.topicId)))) dueCards.push(c.id)
      }
    }
    if (!plan || !track) {
      return { track: null, plan: null, ctx: null, tasks: [], reviews: [], f, stats, figures: null, scope: [], cards, dueCards, today }
    }
    const ctx: StatusContext = {
      plan,
      events: progress.events,
      f,
      content: contentInfo,
      caps: info.capabilities,
      today,
      dayStartHour: progress.settings.dayStartHour
    }
    const tasks = plan.tasks.map((task) => {
      const status = taskStatus(task, ctx)
      return { task, status, flag: taskFlag(task, status, ctx) }
    })
    const reviews = reviewsFor(plan, progress.events, f, (id) => metaById.get(id)?.studyHours ?? 1, progress.settings.dayStartHour)
    const scope = scopeOf(plan.config, pack.blueprint.topics)
    const flags = new Map(tasks.map((t) => [t.task.id, t.flag]))
    const figures = progressFigures(ctx, reviews, scope, (v) => flags.get(v.task.id) ?? 'upcoming')
    return { track, plan, ctx, tasks, reviews, f, stats, figures, scope, cards, dueCards, today }
  }, [progress, pack, contentInfo, info.capabilities, today, trackPick, metaById])

  const value: AppCtx = {
    pack,
    progress,
    info,
    update,
    view,
    go: (v) => {
      setView(v)
      document.querySelector('.main')?.scrollTo({ top: 0 })
    },
    track: derived.track,
    setTrack: setTrackPick,
    derived,
    call,
    refresh,
    toast,
    toasts,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    contentInfo,
    topicMeta: (id) => metaById.get(id),
    startSession: (spec) => setView((v) => ({ name: 'session', spec, back: v.name === 'session' ? v.back : v }))
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
