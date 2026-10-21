/** Today (docs/06 §2): today's sessions, due reviews, cards due, overdue, rebuild prompt, day/week progress. */
import type { ReactNode } from 'react'
import { planWeek } from '@shared/dates'
import { ReviewRow, TaskRow } from '../components/tasks'
import { Bar, Empty, fmtDay, hrs, pct } from '../components/ui'
import { useApp } from '../state/app'

export function TodayPage(): ReactNode {
  const app = useApp()
  const { derived, progress, call, startSession } = app
  const { plan, tasks, reviews, today, figures } = derived
  if (!plan || !figures) return <Empty title="No active plan">Create a plan from the Plan page.</Empty>
  const todays = tasks.filter((t) => t.task.date === today)
  const dueReviews = reviews.filter((r) => !r.done && r.due <= today)
  const overdue = tasks.filter((t) => t.flag === 'overdue' || t.flag === 'catch-up')
  const planned = todays.reduce((s, t) => s + t.task.plannedHours, 0) + dueReviews.filter((r) => r.due === today).reduce((s, r) => s + r.hours, 0)
  const done = todays.filter((t) => t.status === 'done').reduce((s, t) => s + t.task.plannedHours, 0)
  const wk = planWeek(plan.config.startDate, today)
  const week = figures.byWeek.find((w) => w.week === wk)
  const phase = todays[0]?.task.phase
  const rebuild = figures.overdueHours > 1.5 * plan.config.hoursPerDay && !plan.archivedAt
  const next = tasks.filter((t) => t.task.date > today && t.status !== 'done' && t.task.type !== 'exam').slice(0, 6)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{fmtDay(today)}</h1>
          <p className="muted">
            Week {wk}
            {phase ? ` · ${phase === 'learn' ? 'Learn' : phase === 'consolidate' ? 'Consolidate' : phase === 'final' ? 'Final revision' : 'Exam'}` : ' · Rest / catch-up day'} · {figures.daysToExam} days to the exam · {figures.studyDaysLeft} study days left
          </p>
        </div>
        <div style={{ minWidth: 260 }} className="stack">
          <div className="row-between faint">
            <span>Today</span>
            <span>
              {hrs(done)} / {hrs(planned)}
            </span>
          </div>
          <Bar value={planned ? done / planned : 0} good />
          {week && (
            <>
              <div className="row-between faint">
                <span>This week</span>
                <span>{pct(week.planned ? week.done / week.planned : 0)}</span>
              </div>
              <Bar value={week.planned ? week.done / week.planned : 0} />
            </>
          )}
        </div>
      </div>

      {plan.archivedAt && <div className="banner info">This plan is archived (its exam has passed). Switch track or create the Final plan from the Plan page.</div>}
      {rebuild && (
        <div className="banner warn">
          <span>You have about {hrs(figures.overdueHours)} of overdue work. Rebuild the rest of the plan from today? (Done work is kept; a backup is written first.)</span>
          <button className="btn sm" onClick={() => void call(window.imc.planRebuild({ track: plan.config.track }), 'Plan rebuilt from today')}>
            Rebuild from today
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2>Today’s sessions</h2>
          <span className="faint">progress logs itself as you study</span>
        </div>
        {todays.length === 0 && <p className="muted">No sessions today — a rest or catch-up day. Clear overdue work or review flashcards.</p>}
        <div className="stack">
          {todays.map((v) => (
            <TaskRow key={v.task.id} v={v} />
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h2>Spaced reviews due</h2>
            <span className="faint">R1–R4 at 1, 3, 7, 14 days</span>
          </div>
          {dueReviews.length === 0 ? <p className="muted">Nothing due. ✔</p> : <div className="stack">{dueReviews.map((r) => <ReviewRow key={`${r.topicId}${r.k}`} r={r} />)}</div>}
        </div>
        <div className="card">
          <div className="card-title">
            <h2>Flashcards</h2>
            <span className="chip info">{derived.dueCards.length} due</span>
          </div>
          <p className="muted">Cards unlock as you read topics; due dates are capped before your exam.</p>
          <button className="btn primary" disabled={!derived.dueCards.length} onClick={() => startSession({ kind: 'practice', title: 'Flashcards due', mode: 'cards', count: 60 })}>
            Review due cards
          </button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h2>⚠ Overdue</h2>
            <span className="faint">{overdue.length} task(s) — Fri/Sat are good catch-up days</span>
          </div>
          <div className="stack">
            {overdue.slice(0, 8).map((v) => (
              <TaskRow key={v.task.id} v={v} showDate />
            ))}
          </div>
          {overdue.length > 8 && <button className="btn ghost sm" onClick={() => app.go({ name: 'plan' })}>See all in Plan →</button>}
        </div>
      )}

      <div className="card">
        <h2>Next up</h2>
        <div className="stack">
          {next.map((v) => (
            <TaskRow key={v.task.id} v={v} showDate />
          ))}
        </div>
      </div>
      {progress.events.sessions.length === 0 && <p className="faint">Tip: press “Study” on a New study session to begin — read each section, take its quick quiz, and the session ticks itself.</p>}
    </div>
  )
}
