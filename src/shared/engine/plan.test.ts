/** Golden + property tests for plan generation (docs/05 R-1…R-4, R-9, §8). */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BlueprintSchema } from '../content-schema'
import { weekdayIndex } from '../dates'
import type { PlanConfig } from '../progress-schema'
import { generatePlan, PlanError, phasesOf, studyDaysOf, type PlanResult } from './plan'

const bp = BlueprintSchema.parse(JSON.parse(readFileSync(resolve(__dirname, '../../../content/blueprint.json'), 'utf8')))
const systemTitles = Object.fromEntries(bp.systems.map((s) => [s.id, s.title]))
const cfg = (startDate: string, over: Partial<PlanConfig> = {}): PlanConfig => ({
  track: 'midterm',
  startDate,
  examDate: '2026-12-01',
  studyWeekdays: [0, 1, 2, 3, 4],
  hoursPerDay: 5.5,
  systemOrder: bp.systems.map((s) => s.id),
  ...over
})
const run = (c: PlanConfig, studied: string[] = []): PlanResult =>
  generatePlan({ config: c, topics: bp.topics, studied: new Set(studied), systemTitles })

const firstDayBySystem = (r: PlanResult): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const t of r.tasks) if (['new', 'skim', 'rapid', 'revision-pass'].includes(t.type)) out[t.systemIds[0]!] ??= t.date
  return out
}
const placed = (r: PlanResult): string[] => r.tasks.filter((t) => ['new', 'skim', 'rapid', 'revision-pass'].includes(t.type)).flatMap((t) => t.topicIds)

describe('golden plans (docs/05 §8)', () => {
  it('21 Oct defaults reproduce the Excel: phases 20/7/2 and each system’s first study day', () => {
    const r = run(cfg('2026-10-21'))
    expect([r.phases.learn.length, r.phases.consolidate.length, r.phases.final.length]).toEqual([20, 7, 2])
    expect(r.phases.consolidate[0]).toBe('2026-11-18')
    expect(r.phases.final).toEqual(['2026-11-29', '2026-11-30'])
    expect(firstDayBySystem(r)).toEqual({
      gi: '2026-10-21',
      id: '2026-10-26',
      neph: '2026-10-27',
      cardio: '2026-10-29',
      resp: '2026-11-02',
      rheum: '2026-11-04',
      endo: '2026-11-05',
      heme: '2026-11-09',
      hemonc: '2026-11-15',
      onc: '2026-11-16'
    })
    expect(r.warning).toBe(false)
    expect(r.skimmed).toEqual([])
  })

  it('25 Oct reference plan (docs/08 §1)', () => {
    const r = run(cfg('2026-10-25'))
    expect([r.phases.learn.length, r.phases.consolidate.length, r.phases.final.length]).toEqual([18, 7, 2])
    expect(firstDayBySystem(r)).toEqual({
      gi: '2026-10-25',
      id: '2026-10-27',
      neph: '2026-10-29',
      cardio: '2026-11-01',
      resp: '2026-11-03',
      rheum: '2026-11-05',
      endo: '2026-11-08',
      heme: '2026-11-10',
      hemonc: '2026-11-15',
      onc: '2026-11-16'
    })
    expect(r.overCapacity).toBe(false)
  })

  it('10 Nov late start: skim conversion of standard/medium topics, never high', () => {
    const r = run(cfg('2026-11-10'))
    expect(r.skimmed.length).toBeGreaterThan(0)
    const pri = new Map(bp.topics.map((t) => [t.id, t.priority]))
    expect(r.skimmed.every((id) => pri.get(id) !== 'high')).toBe(true)
    expect(r.warning).toBe(true)
    expect(r).toMatchSnapshot({ tasks: expect.any(Array), studyDays: expect.any(Array), phases: expect.any(Object) })
  })

  it('22 Nov very late start still places every topic exactly once', () => {
    const r = run(cfg('2026-11-22'))
    const scope = bp.topics.filter((t) => t.assessedIn.includes('mid')).map((t) => t.id)
    expect(placed(r).sort()).toEqual([...scope].sort())
    expect(r.overCapacity).toBe(true)
  })

  it('start on the exam date is refused (R-1)', () => {
    expect(() => run(cfg('2026-12-01'))).toThrow(PlanError)
  })

  it('cram mode when no Learn days remain', () => {
    const r = run(cfg('2026-11-29'))
    expect(r.cram).toBe(true)
    expect(r.tasks.filter((t) => t.type === 'rapid')).toHaveLength(73)
  })
})

describe('plan properties', () => {
  const starts = ['2026-10-18', '2026-10-21', '2026-10-25', '2026-10-30', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-22', '2026-11-26']
  it.each(starts)('start %s: invariants hold', (start) => {
    const c = cfg(start)
    const r = run(c)
    const studySet = new Set(studyDaysOf(c))
    const scope = bp.topics.filter((t) => t.assessedIn.includes('mid')).map((t) => t.id)
    // each in-scope topic placed exactly once
    expect(placed(r).sort()).toEqual([...scope].sort())
    for (const t of r.tasks) {
      if (t.type === 'exam') {
        expect(t.date).toBe(c.examDate)
        continue
      }
      expect(studySet.has(t.date), `${t.id} on a non-study day`).toBe(true)
      expect(t.plannedHours, `${t.id} hours`).toBeGreaterThan(0)
      expect(t.date >= c.startDate && t.date < c.examDate).toBe(true)
      if (!r.cram && ['new', 'skim'].includes(t.type)) expect(r.phases.learn.includes(t.date)).toBe(true)
    }
    // unique ids, sessions sequential per day
    expect(new Set(r.tasks.map((t) => t.id)).size).toBe(r.tasks.length)
    // Fri/Sat empty
    expect(r.tasks.filter((t) => t.type !== 'exam').every((t) => ![5, 6].includes(weekdayIndex(t.date)))).toBe(true)
  })

  it('already-studied topics are not scheduled as New Study', () => {
    const r = run(cfg('2026-10-25'), ['gi-cirrhosis', 'gi-ibd'])
    expect(placed(r)).not.toContain('gi-cirrhosis')
    expect(placed(r)).toHaveLength(71)
  })

  it('mocks sit on the last two Consolidate days; every system gets a chapter exam', () => {
    const r = run(cfg('2026-10-21'))
    const mocks = r.tasks.filter((t) => t.type === 'mock')
    expect(mocks.map((m) => m.date)).toEqual(r.phases.consolidate.slice(-2))
    expect(r.tasks.filter((t) => t.type === 'chapter-exam').map((t) => t.systemIds[0]).sort()).toEqual(bp.systems.map((s) => s.id).sort())
  })

  it('final track: final-only + unstudied are New Study, studied midterm topics get a Revision pass, interleaved', () => {
    const midIds = bp.topics.filter((t) => t.assessedIn.includes('mid')).map((t) => t.id)
    const studied = midIds.slice(0, 60)
    const r = run(cfg('2026-12-02', { track: 'final', examDate: '2027-01-05' }), studied)
    const news = r.tasks.filter((t) => t.type === 'new' || t.type === 'skim').flatMap((t) => t.topicIds)
    const revs = r.tasks.filter((t) => t.type === 'revision-pass').flatMap((t) => t.topicIds)
    expect(revs.sort()).toEqual([...studied].sort())
    expect(news).toHaveLength(90 - 60)
    expect(r.tasks.some((t) => t.type === 'ospe')).toBe(false)
  })

  it('phasesOf matches R-1 for small D', () => {
    const days = (n: number): string[] => Array.from({ length: n }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    expect(Object.values(phasesOf(days(1))).map((x) => x.length)).toEqual([0, 0, 1])
    expect(Object.values(phasesOf(days(6))).map((x) => x.length)).toEqual([4, 0, 2])
    expect(Object.values(phasesOf(days(29))).map((x) => x.length)).toEqual([20, 7, 2])
  })
})
