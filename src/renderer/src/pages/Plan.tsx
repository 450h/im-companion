/** Plan (docs/06 §5): Master Schedule + Weekly Planner + plan settings/rebuild + create the Final plan. */
import { useState, type ReactNode } from 'react'
import { addDays, dateRange, planWeek, weekStart, weekdayIndex } from '@shared/dates'
import { ReviewRow, TaskRow } from '../components/tasks'
import { Empty, fmtDay, hrs } from '../components/ui'
import { useApp } from '../state/app'
import { FirstRun } from './FirstRun'

export function PlanPage(): ReactNode {
  const app = useApp()
  const { derived, progress, pack } = app
  const [mode, setMode] = useState<'schedule' | 'week' | 'settings'>('week')
  const [createFinal, setCreateFinal] = useState(false)
  const plan = derived.plan
  const canFinal = !progress.plans.final && derived.today >= pack.blueprint.exams.midterm.date
  if (createFinal) return <FirstRun forceTrack="final" onDone={() => setCreateFinal(false)} />
  if (!plan) return <Empty title="No plan yet" />
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{plan.config.track === 'midterm' ? 'Midterm' : 'Final'} plan</h1>
          <p className="muted">
            {fmtDay(plan.config.startDate)} → exam {fmtDay(plan.config.examDate)} · {plan.config.hoursPerDay} h/day · {plan.tasks.length} sessions
            {plan.overCapacity ? ` · over capacity (needs ~${plan.requiredHoursPerDay} h/day of new study)` : ''}
          </p>
        </div>
        <div className="pill-tabs">
          {(
            [
              ['week', 'Week'],
              ['schedule', 'Full schedule'],
              ['settings', 'Plan settings']
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {canFinal && (
        <div className="banner info">
          <span>The midterm is behind you — create your <strong>Final plan</strong> (new topics + a revision pass of everything from the midterm).</span>
          <button className="btn primary sm" onClick={() => setCreateFinal(true)}>
            Create Final plan
          </button>
        </div>
      )}
      {!progress.plans.final && !canFinal && plan.config.track === 'midterm' && <p className="faint">The Final plan (exam {fmtDay(pack.blueprint.exams.final.date)}) can be created from the midterm date.</p>}
      {mode === 'week' && <WeekView />}
      {mode === 'schedule' && <Schedule />}
      {mode === 'settings' && <PlanSettings />}
    </div>
  )
}

function WeekView(): ReactNode {
  const app = useApp()
  const { derived, progress, call } = app
  const plan = derived.plan!
  const [start, setStart] = useState(weekStart(derived.today < plan.config.startDate ? plan.config.startDate : derived.today))
  const days = dateRange(start, addDays(start, 6))
  const studySet = new Set(plan.config.studyWeekdays)
  const wk = planWeek(plan.config.startDate, start)
  const refl = progress.events.reflections.find((r) => r.track === plan.config.track && r.weekStart === start)
  const [form, setForm] = useState({ wentWell: refl?.wentWell ?? '', improve: refl?.improve ?? '', adjust: refl?.adjust ?? '' })
  const sel = derived.tasks.filter((t) => t.task.date >= start && t.task.date <= addDays(start, 6))
  const revs = derived.reviews.filter((r) => r.due >= start && r.due <= addDays(start, 6))
  const planned = sel.reduce((s, t) => s + t.task.plannedHours, 0) + revs.reduce((s, r) => s + r.hours, 0)
  const done = sel.filter((t) => t.status === 'done').reduce((s, t) => s + t.task.plannedHours, 0) + revs.filter((r) => r.done).reduce((s, r) => s + r.hours, 0)
  return (
    <div className="stack">
      <div className="row-between">
        <button className="btn sm" onClick={() => setStart(addDays(start, -7))}>
          ← Previous week
        </button>
        <strong>
          Week {wk} · {fmtDay(start)} – {fmtDay(addDays(start, 6))} · {hrs(done)} of {hrs(planned)} done
        </strong>
        <button className="btn sm" onClick={() => setStart(addDays(start, 7))}>
          Next week →
        </button>
      </div>
      <div className="week-cols">
        {days.map((d) => {
          const ts = sel.filter((t) => t.task.date === d)
          const rest = !studySet.has(weekdayIndex(d))
          return (
            <div key={d} className={`col ${d === derived.today ? 'today' : ''} ${rest ? 'rest' : ''}`}>
              <strong>{fmtDay(d)}</strong>
              {rest && !ts.length && <span className="faint">Rest / catch-up</span>}
              {ts.map((t) => (
                <span key={t.task.id} style={{ opacity: t.status === 'done' ? 0.55 : 1 }}>
                  {t.status === 'done' ? '✔ ' : t.flag === 'overdue' ? '⚠ ' : t.flag === 'pending' ? '⏳ ' : ''}
                  {t.task.title}
                </span>
              ))}
              {revs.filter((r) => r.due === d).length > 0 && <span className="faint">+ {revs.filter((r) => r.due === d).length} review(s)</span>}
            </div>
          )
        })}
      </div>
      <div className="card">
        <h2>Sessions this week</h2>
        <div className="stack">
          {sel.map((v) => (
            <TaskRow key={v.task.id} v={v} showDate />
          ))}
          {revs.map((r) => (
            <ReviewRow key={`${r.topicId}-${r.k}`} r={r} />
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Weekly review</h2>
        <p className="faint">Fill this on your last study day of the week (Excel “review box”).</p>
        {(
          [
            ['wentWell', '✔ What went well'],
            ['improve', '✎ What to improve'],
            ['adjust', '↻ Adjustments for next week']
          ] as const
        ).map(([k, l]) => (
          <label className="field" key={k}>
            <span>{l}</span>
            <textarea className="input" rows={2} maxLength={2000} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <button className="btn sm" onClick={() => void call(window.imc.reflectionSave({ track: plan.config.track, weekStart: start, ...form }), 'Weekly review saved')}>
          Save weekly review
        </button>
      </div>
    </div>
  )
}

function Schedule(): ReactNode {
  const { derived } = useApp()
  const [onlyOpen, setOnlyOpen] = useState(false)
  const weeks = new Map<number, typeof derived.tasks>()
  for (const t of derived.tasks) {
    if (onlyOpen && (t.status === 'done' || t.status === 'skipped')) continue
    const w = planWeek(derived.plan!.config.startDate, t.task.date)
    weeks.set(w, [...(weeks.get(w) ?? []), t])
  }
  return (
    <div className="stack">
      <label className="checkbox-row">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Hide done & skipped
      </label>
      {[...weeks.entries()].map(([w, ts]) => (
        <div className="card" key={w}>
          <h2>
            Week {w} · {ts[0]!.task.phase === 'learn' ? 'Learn' : ts[0]!.task.phase === 'consolidate' ? 'Consolidate' : ts[0]!.task.phase === 'final' ? 'Final revision' : 'Exam'}
          </h2>
          <div className="stack">
            {ts.map((v) => (
              <TaskRow key={v.task.id} v={v} showDate />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlanSettings(): ReactNode {
  const { derived, call, pack } = useApp()
  const plan = derived.plan!
  const [hours, setHours] = useState(plan.config.hoursPerDay)
  const [days, setDays] = useState(plan.config.studyWeekdays)
  const [examDate, setExamDate] = useState(plan.config.examDate)
  const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <div className="card">
      <h2>Plan settings</h2>
      <p className="muted">Changing these rebuilds the rest of your plan from today. Completed work and all history are kept; a backup is written first.</p>
      <div className="field">
        <span>Study days</span>
        <div className="seg">
          {W.map((d, i) => (
            <button key={d} aria-pressed={days.includes(i)} onClick={() => setDays((x) => (x.includes(i) ? (x.length > 1 ? x.filter((y) => y !== i) : x) : [...x, i].sort()))}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-2">
        <label className="field">
          <span>Hours per study day</span>
          <input className="input" type="number" min={1} max={12} step={0.5} value={hours} onChange={(e) => setHours(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
        <label className="field">
          <span>Exam date</span>
          <input className="input" type="date" value={examDate} onChange={(e) => e.target.value && setExamDate(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button
          className="btn primary"
          disabled={!!plan.archivedAt}
          onClick={() => void call(window.imc.planRebuild({ track: plan.config.track, patch: { hoursPerDay: hours, studyWeekdays: days, examDate } }), 'Plan rebuilt')}
        >
          Save & rebuild from today
        </button>
        <button className="btn" disabled={!!plan.archivedAt} onClick={() => void call(window.imc.planRebuild({ track: plan.config.track }), 'Plan rebuilt from today')}>
          Rebuild from today (no changes)
        </button>
      </div>
      <p className="faint">Official dates: midterm {fmtDay(pack.blueprint.exams.midterm.date)}, final {fmtDay(pack.blueprint.exams.final.date)}.</p>
    </div>
  )
}
