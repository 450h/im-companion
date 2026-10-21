/** Progress (docs/06 §6): Dashboard KPIs, by-system/weekly/type charts with tables, revision + question trackers, blueprint coverage. */
import type { ReactNode } from 'react'
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BandChip, Bar, Empty, fmtDay, hrs, pct } from '../components/ui'
import { useApp } from '../state/app'

const TYPE_NAMES: Record<string, string> = {
  new: 'New study',
  skim: 'Skim',
  rapid: 'Rapid review',
  'revision-pass': 'Revision pass',
  review: 'Spaced reviews',
  questions: 'Questions',
  ospe: 'OSPE',
  weak: 'Weak areas',
  'chapter-exam': 'Chapter exams',
  mock: 'Mocks',
  'mock-review': 'Mock review',
  'final-revision': 'Final revision',
  exam: 'Exam'
}

export function ProgressPage(): ReactNode {
  const { derived, pack, topicMeta } = useApp()
  const fig = derived.figures
  if (!fig || !derived.plan) return <Empty title="No plan yet" />
  const attempts = [...derived.stats.values()].reduce((s, x) => s + x.attempts, 0)
  const correct = [...derived.stats.values()].reduce((s, x) => s + x.correct, 0)
  const systems = pack.blueprint.systems.filter((s) => fig.bySystem[s.id])
  const css = getComputedStyle(document.documentElement)
  const color = (v: string, fb: string): string => css.getPropertyValue(v).trim() || fb
  const chartData = systems.map((s) => ({ name: s.title.split(' ')[0], studied: fig.bySystem[s.id]!.studied, remaining: fig.bySystem[s.id]!.topics - fig.bySystem[s.id]!.studied }))
  const scheduledDate = new Map<string, string>()
  for (const t of derived.plan.tasks) if (['new', 'skim', 'revision-pass', 'rapid'].includes(t.type)) for (const id of t.topicIds) scheduledDate.set(id, t.date)
  return (
    <div className="page">
      <h1>Progress — {derived.plan.config.track === 'midterm' ? 'Midterm' : 'Final'}</h1>
      <div className="grid grid-3">
        <Kpi label="Days to exam" value={String(fig.daysToExam)} sub={`${fig.studyDaysLeft} study days left`} />
        <Kpi label="Overall progress" value={pct(fig.overall)} sub={`${hrs(fig.doneHours)} of ${hrs(fig.plannedHours)}`} bar={fig.overall} />
        <Kpi label="Topics studied" value={`${fig.topicsStudied} / ${fig.topicsInScope}`} bar={fig.topicsInScope ? fig.topicsStudied / fig.topicsInScope : 0} />
        <Kpi label="Overdue tasks" value={String(fig.overdueCount)} sub={hrs(fig.overdueHours)} />
        <Kpi label="Question accuracy" value={attempts ? pct(correct / attempts) : '—'} sub={`${attempts} answered`} />
        <Kpi label="Revisions completed" value={`${fig.reviewsDone} / ${fig.reviewsScheduled}`} />
      </div>

      <div className="card">
        <h2>Progress by system</h2>
        <div className="chart-box" style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ left: -20 }}>
              <CartesianGrid stroke={color("--grid", "#e6e9ee")} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-2)', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
              <RBar dataKey="studied" stackId="a" fill={color("--series-3", "#1baf7a")} name="Studied" />
              <RBar dataKey="remaining" stackId="a" fill={color("--border", "#dfe3e8")} name="Remaining" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>System</th>
              <th className="r">Topics</th>
              <th className="r">Studied</th>
              <th className="r">Planned h</th>
              <th className="r">Done h</th>
              <th style={{ width: 160 }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => {
              const b = fig.bySystem[s.id]!
              return (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td className="r">{b.topics}</td>
                  <td className="r">{b.studied}</td>
                  <td className="r">{b.planned.toFixed(2)}</td>
                  <td className="r">{b.done.toFixed(2)}</td>
                  <td>
                    <Bar value={b.planned ? b.done / b.planned : 0} good />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Weekly completion</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Dates</th>
                <th className="r">Planned</th>
                <th className="r">Done</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {fig.byWeek.map((w) => (
                <tr key={w.week}>
                  <td>Week {w.week}</td>
                  <td className="faint">
                    {fmtDay(w.from)}–{fmtDay(w.to)}
                  </td>
                  <td className="r">{w.planned.toFixed(1)}</td>
                  <td className="r">{w.done.toFixed(1)}</td>
                  <td>
                    <Bar value={w.planned ? w.done / w.planned : 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Time by task type</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="r">Planned h</th>
                <th className="r">Done h</th>
                <th className="r">Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fig.byType)
                .filter(([, v]) => v.planned > 0)
                .map(([k, v]) => (
                  <tr key={k}>
                    <td>{TYPE_NAMES[k] ?? k}</td>
                    <td className="r">{v.planned.toFixed(1)}</td>
                    <td className="r">{v.done.toFixed(1)}</td>
                    <td className="r">{pct(v.planned / fig.plannedHours)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Revision & question tracker</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>First studied</th>
                <th>R1–R4</th>
                <th className="r">Confidence</th>
                <th className="r">Answered</th>
                <th>Accuracy</th>
                <th>Weak sections</th>
              </tr>
            </thead>
            <tbody>
              {derived.scope.map((t) => {
                const st = derived.stats.get(t.id)
                const rs = derived.reviews.filter((r) => r.topicId === t.id)
                const needs = derived.f.has(t.id) && st && ((st.band === 'weak' && st.attempts >= 5) || (st.confidence ?? 5) <= 2)
                return (
                  <tr key={t.id}>
                    <td>
                      {t.title} {needs && <span className="chip danger">⚠ Needs review</span>}
                    </td>
                    <td>{derived.f.get(t.id) ? fmtDay(derived.f.get(t.id)!) : <span className="faint">—</span>}</td>
                    <td>{rs.length ? rs.map((r) => (r.done ? '✔' : r.due < derived.today ? '⚠' : '·')).join(' ') : <span className="faint">—</span>}</td>
                    <td className="r">{st?.confidence ?? '—'}</td>
                    <td className="r">{st?.attempts ?? 0}</td>
                    <td>
                      <BandChip band={st?.band ?? 'not-started'} accuracy={st?.accuracy} />
                    </td>
                    <td className="faint">
                      {(st?.wrongSections ?? [])
                        .slice(0, 2)
                        .map((sid) => pack.topics[t.id]?.sections.find((s) => s.id === sid)?.title)
                        .filter(Boolean)
                        .join('; ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Blueprint coverage</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>System</th>
                <th>Topic</th>
                <th>Assessed in</th>
                <th className="r">Objectives</th>
                <th>This track</th>
                <th>Scheduled</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {pack.blueprint.topics.map((t) => (
                <tr key={t.id}>
                  <td className="faint">{pack.blueprint.systems.find((s) => s.id === t.systemId)?.title}</td>
                  <td>{topicMeta(t.id)?.title}</td>
                  <td>{t.assessedIn.map((a) => (a === 'mid' ? 'Mid' : a === 'final' ? 'Final' : 'OSCE')).join(', ')}</td>
                  <td className="r">{t.objectives.length}</td>
                  <td>{derived.scope.some((s) => s.id === t.id) ? 'Yes' : <span className="faint">Final only</span>}</td>
                  <td>{scheduledDate.get(t.id) ? fmtDay(scheduledDate.get(t.id)!) : derived.f.has(t.id) ? 'Studied' : '—'}</td>
                  <td>{pack.topics[t.id] ? <span className="chip good">Available</span> : <span className="chip neutral">⏳ Coming</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: number }): ReactNode {
  return (
    <div className="card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
      {bar !== undefined && <Bar value={bar} good />}
    </div>
  )
}
