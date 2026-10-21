/** R-5 reviews, R-6 status/flags, R-11 cards, R-7 bands. */
import { describe, expect, it } from 'vitest'
import type { Events, Plan } from '../progress-schema'
import { emptyProgress } from '../progress-schema'
import { cardState, nextState } from './cards'
import { bandOf, weakTopics, topicStats } from './stats'
import { completionDates, reviewsFor, taskFlag, taskStatus, type ContentInfo, type StatusContext } from './status'

const ev = (): Events => emptyProgress('2026-10-21T08:00:00.000Z').events
const plan: Plan = {
  config: { track: 'midterm', startDate: '2026-10-21', examDate: '2026-12-01', studyWeekdays: [0, 1, 2, 3, 4], hoursPerDay: 5.5, systemOrder: ['gi'] },
  generatedAt: '2026-10-21T08:00:00.000Z',
  contentVersion: '2026.10.22.1',
  overCapacity: false,
  requiredHoursPerDay: 3,
  tasks: [
    { id: 'midterm-2026-10-21-s1', date: '2026-10-21', session: 1, phase: 'learn', type: 'new', topicIds: ['gi-cirrhosis'], systemIds: ['gi'], title: 'New', plannedHours: 1.75 },
    { id: 'midterm-2026-10-22-s1', date: '2026-10-22', session: 1, phase: 'learn', type: 'new', topicIds: ['gi-ibd'], systemIds: ['gi'], title: 'New', plannedHours: 1.5 }
  ]
}
const content: ContentInfo = {
  available: new Map([['gi-cirrhosis', '2026-10-22']]),
  exams: new Set(),
  sections: new Map([['gi-cirrhosis', ['gi-cirrhosis.s1', 'gi-cirrhosis.s2']]]),
  hasTopicQuiz: new Set(['gi-cirrhosis'])
}
const caps = { quizzes: true, practice: true, drills: true, exams: true, mocks: true, ospe: true }
const ctx = (events: Events, today: string): StatusContext => ({ plan, events, f: completionDates(events, 4), content, caps, today, dayStartHour: 4 })

describe('R-6.1 completion & R-6.2 status', () => {
  it('completion is the latest completed without a later reopened; late-night counts for the previous day', () => {
    const e = ev()
    e.completions.push({ topicId: 'gi-cirrhosis', type: 'completed', source: 'auto', at: '2026-10-22T22:30:00.000Z' })
    // 01:30 local (UTC offset of the test machine aside) — studyDate subtracts dayStartHour
    expect(completionDates(e, 4).has('gi-cirrhosis')).toBe(true)
    e.completions.push({ topicId: 'gi-cirrhosis', type: 'reopened', source: 'manual', at: '2026-10-23T10:00:00.000Z' })
    expect(completionDates(e, 4).has('gi-cirrhosis')).toBe(false)
  })

  it('New Study: done once f exists; pending when content not shipped (never overdue)', () => {
    const e = ev()
    const c = ctx(e, '2026-10-25')
    expect(taskStatus(plan.tasks[1]!, c)).toBe('pending')
    expect(taskFlag(plan.tasks[1]!, 'pending', c)).toBe('pending')
    expect(taskStatus(plan.tasks[0]!, c)).toBe('not-started')
    e.completions.push({ topicId: 'gi-cirrhosis', type: 'completed', source: 'auto', at: '2026-10-24T10:00:00.000Z' })
    expect(taskStatus(plan.tasks[0]!, ctx(e, '2026-10-25'))).toBe('done')
  })

  it('catch-up flag when content arrived after the task date (grace), else overdue', () => {
    const c = ctx(ev(), '2026-10-24')
    expect(taskFlag(plan.tasks[0]!, 'not-started', c)).toBe('catch-up')
    expect(taskFlag(plan.tasks[0]!, 'not-started', ctx(ev(), '2026-11-02'))).toBe('overdue')
  })

  it('overrides: latest wins, reset clears', () => {
    const e = ev()
    e.overrides.push({ track: 'midterm', taskId: plan.tasks[0]!.id, status: 'skipped', at: '2026-10-21T09:00:00.000Z' })
    expect(taskStatus(plan.tasks[0]!, ctx(e, '2026-10-21'))).toBe('skipped')
    e.overrides.push({ track: 'midterm', taskId: plan.tasks[0]!.id, status: 'reset', at: '2026-10-21T10:00:00.000Z' })
    expect(taskStatus(plan.tasks[0]!, ctx(e, '2026-10-21'))).toBe('not-started')
  })
})

describe('R-5 spaced reviews', () => {
  it('due 1/3/7/14 days after f, moved to study days; one session completes one review', () => {
    const e = ev()
    e.completions.push({ topicId: 'gi-cirrhosis', type: 'completed', source: 'auto', at: '2026-10-21T12:00:00.000Z' })
    const f = completionDates(e, 4)
    const r = reviewsFor(plan, e, f, () => 1.75, 4)
    // f = Wed 21 Oct → Thu 22, Sat 24→Sun 25, Wed 28, Wed 4 Nov
    expect(r.map((x) => x.due)).toEqual(['2026-10-22', '2026-10-25', '2026-10-28', '2026-11-04'])
    e.sessions.push({ id: '11111111-1111-4111-8111-111111111111', kind: 'review', topicId: 'gi-cirrhosis', questionIds: [], startedAt: '2026-10-28T09:00:00.000Z', completedAt: '2026-10-28T09:30:00.000Z' })
    const r2 = reviewsFor(plan, e, f, () => 1.75, 4)
    expect(r2.filter((x) => x.done)).toHaveLength(1)
    expect(r2[0]!.done).toBe(true)
  })

  it('reviews falling into Final are spread over Consolidate days; reviews ≤ f are dropped', () => {
    const e = ev()
    e.completions.push({ topicId: 'gi-cirrhosis', type: 'completed', source: 'manual', at: '2026-11-24T12:00:00.000Z' })
    const r = reviewsFor(plan, e, completionDates(e, 4), () => 1, 4)
    for (const x of r) expect(x.due > '2026-11-24' && x.due < '2026-11-29').toBe(true)
    expect(new Set(r.map((x) => x.due)).size).toBe(r.length)
  })
})

describe('R-11 cards', () => {
  it('SM-2 variant intervals and ease clamps', () => {
    expect(nextState({ ease: 2.5, interval: 0 }, 'good')).toEqual({ ease: 2.5, interval: 1 })
    expect(nextState({ ease: 2.5, interval: 1 }, 'good')).toEqual({ ease: 2.5, interval: 3 })
    expect(nextState({ ease: 2.5, interval: 3 }, 'good')).toEqual({ ease: 2.5, interval: 8 })
    expect(nextState({ ease: 2.5, interval: 3 }, 'easy')).toEqual({ ease: 2.65, interval: 10 })
    expect(nextState({ ease: 1.3, interval: 5 }, 'again')).toEqual({ ease: 1.3, interval: 0 })
    expect(nextState({ ease: 2.5, interval: 5 }, 'hard')).toEqual({ ease: 2.35, interval: 6 })
  })
  it('due capped at exam date − 1', () => {
    const s = cardState(
      [
        { cardId: 'x.c1', grade: 'easy', at: '2026-11-20T10:00:00.000Z' },
        { cardId: 'x.c1', grade: 'easy', at: '2026-11-22T10:00:00.000Z' },
        { cardId: 'x.c1', grade: 'easy', at: '2026-11-26T10:00:00.000Z' }
      ],
      4,
      '2026-12-01'
    )
    expect(s.due).toBe('2026-11-30')
  })
})

describe('R-7 bands & weak topics', () => {
  it('band thresholds', () => {
    expect(bandOf(0, null)).toBe('not-started')
    expect(bandOf(10, 0.59)).toBe('weak')
    expect(bandOf(10, 0.6)).toBe('borderline')
    expect(bandOf(10, 0.75)).toBe('strong')
  })
  it('weak drill falls back to lowest-accuracy studied topics when none are weak', () => {
    const e = ev()
    const mk = (q: string, correct: boolean, i: number): Events['attempts'][number] => ({
      id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
      sessionId: '11111111-1111-4111-8111-111111111111',
      questionId: q,
      choice: 0,
      correct,
      ms: 1000,
      at: `2026-10-2${i % 9}T10:00:00.000Z`
    })
    e.attempts.push(mk('a-topic.q1', true, 1), mk('a-topic.q2', true, 2), mk('b-topic.q1', true, 3), mk('b-topic.q2', false, 4), mk('b-topic.q3', true, 5), mk('b-topic.q4', true, 6))
    const stats = topicStats(e, () => null)
    const studied = new Map([
      ['a-topic', '2026-10-21'],
      ['b-topic', '2026-10-21']
    ])
    expect(weakTopics(stats, studied)).toEqual(['b-topic', 'a-topic'])
  })
})
