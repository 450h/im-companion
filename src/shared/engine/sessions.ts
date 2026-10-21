/**
 * Question selection per session kind (R-3 Questions, R-7 drills, R-12) and grading. Pure.
 * Pools: quizzes/practice/drills use worked+quiz+practice only — never exam or mock (R-7).
 */
import type { ContentPack, EmqTheme, Question } from '../content-schema'
import type { Events, SessionKind } from '../progress-schema'

export interface PickInput {
  kind: SessionKind
  pack: ContentPack
  events: Events
  topicId?: string
  sectionId?: string
  topicIds?: string[]
  examId?: string
  format?: 'sba' | 'emq' | 'both'
  count?: number
  /** Deterministic shuffle seed (e.g. the session id). */
  seed: string
}

export class SelectionError extends Error {
  constructor(
    public readonly code: 'NO_CONTENT' | 'NO_QUESTIONS' | 'BAD_REQUEST',
    message: string
  ) {
    super(message)
  }
}

/** Small deterministic PRNG so selections are reproducible per session. */
function rng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle<T>(arr: T[], seed: string): T[] {
  const r = rng(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function questionIndex(pack: ContentPack): Map<string, { q: Question; topicId: string }> {
  const m = new Map<string, { q: Question; topicId: string }>()
  for (const t of Object.values(pack.topics)) for (const q of t.questions) m.set(q.id, { q, topicId: t.topicId })
  return m
}

const sectionOfQ = (q: Question): string => (q.kind === 'sba' ? q.studyRef.sectionId : (q.items[0]?.studyRef.sectionId ?? ''))
const STUDY_POOLS = new Set(['worked', 'quiz', 'practice'])

/** Ids answered before / answered wrong before. */
function history(events: Events): { seen: Set<string>; wrong: Set<string> } {
  const seen = new Set<string>()
  const wrong = new Set<string>()
  for (const a of events.attempts) {
    seen.add(a.questionId)
    if (!a.correct) wrong.add(a.questionId)
  }
  return { seen, wrong }
}

export function pickQuestions(input: PickInput): string[] {
  const { pack, kind } = input
  const topic = input.topicId ? pack.topics[input.topicId] : undefined
  const fmt = (q: Question): boolean => !input.format || input.format === 'both' || q.kind === input.format
  switch (kind) {
    case 'section-quiz': {
      if (!topic || !input.sectionId) throw new SelectionError('NO_CONTENT', 'This topic has no content yet')
      return topic.questions.filter((q) => q.pool === 'quiz' && q.quizScope === 'section' && sectionOfQ(q) === input.sectionId).map((q) => q.id)
    }
    case 'topic-quiz': {
      if (!topic) throw new SelectionError('NO_CONTENT', 'This topic has no content yet')
      return topic.questions.filter((q) => q.pool === 'quiz' && q.quizScope === 'topic').map((q) => q.id)
    }
    case 'review': {
      if (!topic) throw new SelectionError('NO_CONTENT', 'This topic has no content yet')
      const { seen } = history(input.events)
      const pool = topic.questions.filter((q) => STUDY_POOLS.has(q.pool) && q.pool !== 'worked')
      const fresh = pool.filter((q) => !seen.has(q.id))
      return shuffle(fresh.length >= 5 ? fresh : pool, input.seed).slice(0, 5).map((q) => q.id)
    }
    case 'practice':
    case 'weak-drill': {
      const ids = input.topicIds ?? (input.topicId ? [input.topicId] : [])
      const { seen, wrong } = history(input.events)
      const pool = ids.flatMap((id) => pack.topics[id]?.questions ?? []).filter((q) => STUDY_POOLS.has(q.pool) && q.pool !== 'worked' && fmt(q))
      if (!pool.length) throw new SelectionError('NO_QUESTIONS', 'No questions available for these topics yet')
      const count = input.count ?? (kind === 'weak-drill' ? 15 : 20)
      const prev = shuffle(pool.filter((q) => wrong.has(q.id)), input.seed)
      const unseen = shuffle(pool.filter((q) => !seen.has(q.id)), input.seed)
      const rest = shuffle(pool.filter((q) => seen.has(q.id) && !wrong.has(q.id)), input.seed)
      const ordered = kind === 'weak-drill' ? [...prev, ...unseen, ...rest] : [...unseen, ...prev, ...rest]
      // Count gradable items so an EMQ with 4 items counts as 4.
      const out: string[] = []
      let items = 0
      for (const q of ordered) {
        if (items >= count) break
        if (out.includes(q.id)) continue
        out.push(q.id)
        items += q.kind === 'emq' ? q.items.length : 1
      }
      return out
    }
    case 'ospe': {
      const ids = input.topicIds ?? []
      const out: string[] = []
      for (const id of ids) {
        const t = pack.topics[id]
        if (!t) continue
        const secs = new Set(t.ospe.map((o) => o.sectionId))
        out.push(...t.questions.filter((q) => STUDY_POOLS.has(q.pool) && secs.has(sectionOfQ(q))).map((q) => q.id))
      }
      return shuffle(out, input.seed).slice(0, input.count ?? 6)
    }
    case 'exam': {
      const exam = pack.exams.find((e) => e.id === input.examId)
      if (!exam) throw new SelectionError('NO_CONTENT', 'This exam is not available yet')
      return [...exam.questionIds]
    }
    case 'rapid-review':
    case 'emq-volume':
      return []
  }
}

export interface Graded {
  correct: boolean
  answer: number
  explanation: string
  whyNot: string | null
  sectionId: string
}

/** Grade one answer against content (main only — never trust the renderer). */
export function grade(q: Question, choice: number, item?: number): Graded | null {
  if (q.kind === 'sba') {
    if (item !== undefined) return null
    return {
      correct: choice === q.answer,
      answer: q.answer,
      explanation: q.explanation,
      whyNot: choice !== q.answer && choice >= 0 ? (q.whyNot[choice] ?? null) : null,
      sectionId: q.studyRef.sectionId
    }
  }
  if (item === undefined) return null
  const it = q.items[item]
  if (!it) return null
  return { correct: choice === it.answer, answer: it.answer, explanation: it.explanation, whyNot: null, sectionId: it.studyRef.sectionId }
}

/** EMQ-volume attempt ids: `<topicId>.v-<themeId>-<n>` (topic resolves via topicOfQuestion). */
export function volumeAttemptId(theme: EmqTheme, n: number): string {
  const item = theme.items.find((i) => i.n === n)
  return `${item?.topicId ?? 'emq'}.v-${theme.id}-${n}`
}
