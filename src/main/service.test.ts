/** Service/IPC rules (SECURITY §1/§4, docs/05 R-6.1/R-9/R-12): validation, refs, correctness in main, auto-completion. */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { BlueprintSchema, BookSchema, TopicContentSchema, type ContentPack } from '@shared/content-schema'
import { completionDates } from '@shared/engine/status'
import { Service, ServiceError, type Platform } from './service'
import { Store } from './store'

const root = resolve(__dirname, '../..')
const pack: ContentPack = {
  contentVersion: '2026.10.20.1',
  books: BookSchema.array().parse(JSON.parse(readFileSync(join(root, 'content/books.json'), 'utf8'))),
  blueprint: BlueprintSchema.parse(JSON.parse(readFileSync(join(root, 'content/blueprint.json'), 'utf8'))),
  topics: { 'gi-history-exam': TopicContentSchema.parse(JSON.parse(readFileSync(join(root, 'tests/e2e/fixtures/gi-history-exam.json'), 'utf8'))) },
  exams: [{ id: 'exam-gi', kind: 'chapter', systemId: 'gi', title: 'GI exam', minutes: 10, questionIds: ['gi-history-exam.q1', 'gi-history-exam.q2', 'gi-history-exam.q3', 'gi-history-exam.q4', 'gi-history-exam.q5'] }],
  emqVolumes: [],
  images: {}
}

let n = 0
const uuid = (): string => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
let now = new Date('2026-10-25T10:00:00')
const platform: Platform = {
  version: '0.1.0',
  dataPath: '',
  now: () => now,
  newId: uuid,
  saveDialog: async () => null,
  openDialog: async () => null,
  confirm: async () => true,
  openExternal: async () => undefined
}

let store: Store
let svc: Service
beforeEach(async () => {
  now = new Date('2026-10-25T10:00:00')
  store = new Store(mkdtempSync(join(tmpdir(), 'imc-svc-')), { coalesceMs: 5 })
  await store.load()
  svc = new Service(store, pack, platform)
})

const expectCode = (fn: () => unknown, code: string): void => {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(ServiceError)
    expect((e as ServiceError).code).toBe(code)
    return
  }
  throw new Error(`expected ${code}`)
}

describe('validation & references', () => {
  it('rejects unknown keys (a forged "correct") and unknown ids', () => {
    const { sessionId } = svc.sessionStart({ kind: 'section-quiz', topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s1' })
    expectCode(() => svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q1', choice: 3, ms: 10, correct: true }), 'E_VALIDATION')
    expectCode(() => svc.markRead({ topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s9' }), 'E_REF')
    expectCode(() => svc.sessionStart({ kind: 'topic-quiz', topicId: 'nope-topic' }), 'E_REF')
    expectCode(() => svc.cardsGrade({ cardId: 'gi-history-exam.c99', grade: 'good' }), 'E_REF')
  })

  it('correctness is computed in main; a question outside the session is refused; tutor answers once', () => {
    const { sessionId } = svc.sessionStart({ kind: 'section-quiz', topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s1' })
    const fb = svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q1', choice: 3, ms: 10 })
    expect(fb.correct).toBe(false)
    expect(fb.answer).toBe(0)
    expect(fb.studyRef).toEqual({ topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s1' })
    expect(store.state.events.attempts[0]!.correct).toBe(false)
    expectCode(() => svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q1', choice: 0, ms: 10 }), 'E_ANSWERED')
    expectCode(() => svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q4', choice: 0, ms: 10 }), 'E_REF')
  })

  it('exam sessions: last answer wins, no feedback until complete', () => {
    const { sessionId } = svc.sessionStart({ kind: 'exam', examId: 'exam-gi' })
    const fb = svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q1', choice: 3, ms: 10 })
    expect(fb.correct).toBeNull()
    svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q1', choice: 0, ms: 10 })
    const r = svc.sessionComplete(sessionId)
    expect(r.total).toBe(1)
    expect(r.correct).toBe(1)
    expectCode(() => svc.sessionAnswer({ sessionId, questionId: 'gi-history-exam.q2', choice: 1, ms: 1 }), 'E_CLOSED')
  })
})

describe('R-6.1 auto-completion', () => {
  it('reading every section + finishing the topic quiz appends topicCompleted {auto} once', () => {
    svc.markRead({ topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s1' })
    svc.markRead({ topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s2' })
    expect(completionDates(store.state.events, 4).has('gi-history-exam')).toBe(false)
    const { sessionId } = svc.sessionStart({ kind: 'topic-quiz', topicId: 'gi-history-exam' })
    svc.sessionComplete(sessionId)
    expect(store.state.events.completions.filter((c) => c.source === 'auto')).toHaveLength(1)
    svc.markRead({ topicId: 'gi-history-exam', sectionId: 'gi-history-exam.s1' })
    expect(store.state.events.completions.filter((c) => c.source === 'auto')).toHaveLength(1)
  })

  it('studied-from-book and reopen', () => {
    svc.setStudied({ topicId: 'neph-aki', studied: true })
    expect(completionDates(store.state.events, 4).has('neph-aki')).toBe(true)
    svc.setStudied({ topicId: 'neph-aki', studied: false })
    expect(completionDates(store.state.events, 4).has('neph-aki')).toBe(false)
    expectCode(() => svc.setStudied({ topicId: 'neph-aki', studied: true, date: '2027-01-01' }), 'E_VALIDATION')
  })
})

describe('plans', () => {
  it('creates a midterm plan; refuses a second; Final only from the midterm date (R-9)', () => {
    const cfg = svc.defaultConfig('midterm')
    svc.planCreate({ config: cfg, alreadyStudied: [{ topicId: 'gi-cirrhosis', date: '2026-10-22' }] })
    expect(store.state.plans.midterm!.tasks.length).toBeGreaterThan(50)
    expect(completionDates(store.state.events, 4).get('gi-cirrhosis')).toBe('2026-10-22')
    expectCode(() => svc.planCreate({ config: cfg }), 'E_EXISTS')
    expectCode(() => svc.planCreate({ config: { ...svc.defaultConfig('final') } }), 'E_TOO_EARLY')
    now = new Date('2026-12-02T10:00:00')
    svc.archivePastPlans()
    expect(store.state.plans.midterm!.archivedAt).toBeDefined()
    svc.planCreate({ config: svc.defaultConfig('final') })
    expect(store.state.plans.final!.tasks.some((t) => t.type === 'revision-pass' && t.topicIds[0] === 'gi-cirrhosis')).toBe(true)
  })

  it('refuses a plan starting on the exam date', () => {
    expectCode(() => svc.planPreview({ ...svc.defaultConfig('midterm'), startDate: '2026-12-01' }), 'NO_STUDY_DAYS')
  })
})
