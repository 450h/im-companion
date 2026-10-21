/** First run (docs/06 §1): disclaimer → plan setup → already studied → preview → create. Also used to create the Final plan. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { studyDate, type ISODate } from '@shared/dates'
import type { PlanPreview } from '@shared/ipc'
import type { PlanConfig, Track } from '@shared/progress-schema'
import { fmtDay } from '../components/ui'
import { useApp } from '../state/app'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function FirstRun({ forceTrack, onDone }: { forceTrack?: Track; onDone?: () => void }): ReactNode {
  const app = useApp()
  const { pack, progress, call, refresh } = app
  const today = studyDate(new Date(), progress.settings.dayStartHour)
  const ex = pack.blueprint.exams
  const defaultTrack: Track = forceTrack ?? (today >= ex.midterm.date ? 'final' : 'midterm')
  const [step, setStep] = useState(progress.settings.firstRunDone ? 1 : 0)
  const [config, setConfig] = useState<PlanConfig>({
    track: defaultTrack,
    startDate: defaultTrack === 'final' && today <= ex.midterm.date ? ex.midterm.date : today,
    examDate: defaultTrack === 'midterm' ? ex.midterm.date : ex.final.date,
    studyWeekdays: [0, 1, 2, 3, 4],
    hoursPerDay: 5.5,
    systemOrder: pack.blueprint.systems.map((s) => s.id)
  })
  const [dayStart, setDayStart] = useState(progress.settings.dayStartHour)
  const [studied, setStudied] = useState<Record<string, ISODate>>({})
  const [preview, setPreview] = useState<PlanPreview | null>(null)
  const sysTitle = useMemo(() => Object.fromEntries(pack.blueprint.systems.map((s) => [s.id, s.title])), [pack])

  useEffect(() => {
    let live = true
    void window.imc.planPreview(config).then((r) => live && setPreview(r.ok ? r.data : null))
    return () => {
      live = false
    }
  }, [config])

  const scopeTopics = pack.blueprint.topics.filter((t) => (config.track === 'midterm' ? t.assessedIn.includes('mid') : true))
  const move = (i: number, d: number): void => {
    const o = [...config.systemOrder]
    const j = i + d
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j]!, o[i]!]
    setConfig({ ...config, systemOrder: o })
  }

  const create = async (): Promise<void> => {
    if (dayStart !== progress.settings.dayStartHour) await call(window.imc.settingsUpdate({ dayStartHour: dayStart }))
    const r = await call(window.imc.planCreate({ config, alreadyStudied: Object.entries(studied).map(([topicId, date]) => ({ topicId, date })) }))
    if (!r) return
    if (!progress.settings.firstRunDone) await call(window.imc.firstRunComplete())
    await refresh()
    app.setTrack(config.track)
    onDone?.()
    app.go({ name: 'today' })
  }

  return (
    <div className="center-screen">
      <div className="panel" style={{ width: 'min(760px, 100%)' }}>
        <div className="steps">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {step === 0 && (
          <div className="card">
            <h1>Welcome to MED 222 IM Companion</h1>
            <p>
              A study planner built on the <strong>Med 611 blueprint</strong>: what to study each day, summaries of every topic, flashcards, quizzes and exams in the
              midterm (EMQ) and final (MCQ) formats — and your progress logs itself as you study.
            </p>
            <div className="banner info">
              <span>
                Every summary point <strong>cites a book and page</strong> (Davidson’s 24e, Kumar & Clark 10e, …). The app does not contain the books — open your own copy to
                check any point or to look at a figure.
              </span>
            </div>
            <div className="banner warn">
              <span>
                <strong>For exam study only — not clinical guidance.</strong> Content is summarised from the cited sources and checked against them before release. If
                something looks wrong, check the cited page and report it with ⚑.
              </span>
            </div>
            <button className="btn primary" onClick={() => setStep(1)}>
              I understand — set up my plan
            </button>
          </div>
        )}
        {step === 1 && (
          <div className="card">
            <h1>Your {config.track === 'midterm' ? 'midterm' : 'final'} plan</h1>
            <p className="muted">
              Exam: <strong>{fmtDay(config.examDate)}</strong> — {config.track === 'midterm' ? ex.midterm.format : ex.final.format}. The plan starts today and follows the Excel
              planner: Learn → Consolidate → Final revision.
            </p>
            <div className="field">
              <span>Study days</span>
              <div className="seg">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    aria-pressed={config.studyWeekdays.includes(i)}
                    onClick={() => {
                      const s = config.studyWeekdays.includes(i) ? config.studyWeekdays.filter((x) => x !== i) : [...config.studyWeekdays, i].sort()
                      if (s.length) setConfig({ ...config, studyWeekdays: s })
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-2">
              <label className="field">
                <span>Hours per study day</span>
                <input className="input" type="number" min={1} max={12} step={0.5} value={config.hoursPerDay} onChange={(e) => setConfig({ ...config, hoursPerDay: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })} />
              </label>
              <label className="field">
                <span>My day starts at (late-night study counts for the previous day)</span>
                <select className="input" value={dayStart} onChange={(e) => setDayStart(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field">
              <span>System order</span>
              <div className="list">
                {config.systemOrder.map((s, i) => (
                  <div key={s} className="list-item" style={{ padding: '4px 0' }}>
                    <span className="faint" style={{ width: 20 }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1 }}>{sysTitle[s]}</span>
                    <button className="btn ghost sm" aria-label="Move up" onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button className="btn ghost sm" aria-label="Move down" onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card">
            <h1>Already studied anything?</h1>
            <p className="muted">Tick topics you have already covered (e.g. on the Excel plan). They’ll be logged as studied and get spaced reviews instead of new study.</p>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {pack.blueprint.systems.map((s) => {
                const ts = scopeTopics.filter((t) => t.systemId === s.id)
                if (!ts.length) return null
                return (
                  <div key={s.id} className="stack" style={{ gap: 2, marginBottom: 8 }}>
                    <strong>{s.title}</strong>
                    {ts.map((t) => (
                      <label className="checkbox-row" key={t.id}>
                        <input
                          type="checkbox"
                          checked={!!studied[t.id]}
                          onChange={(e) =>
                            setStudied((m) => {
                              const n = { ...m }
                              if (e.target.checked) n[t.id] = today
                              else delete n[t.id]
                              return n
                            })
                          }
                        />
                        <span style={{ flex: 1 }}>{t.title}</span>
                        {studied[t.id] && (
                          <input className="input" type="date" style={{ width: 160 }} max={today} value={studied[t.id]} onChange={(e) => e.target.value && setStudied((m) => ({ ...m, [t.id]: e.target.value }))} />
                        )}
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="row">
              <button className="btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn primary" onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card">
            <h1>Preview</h1>
            {!preview && <p className="muted">Calculating…</p>}
            {preview && (
              <>
                <div className="grid grid-4">
                  <Stat label="Study days" value={preview.studyDays} />
                  <Stat label="Learn" value={preview.learn} />
                  <Stat label="Consolidate" value={preview.consolidate} />
                  <Stat label="Final revision" value={preview.final} />
                </div>
                <p>
                  New study ≈ <strong>{preview.budget.toFixed(1)} h</strong> per Learn day out of {config.hoursPerDay} h (the rest is questions, OSPE practice and spaced reviews).
                </p>
                {preview.cram && <div className="banner danger">Very little time left: every topic becomes a rapid review.</div>}
                {preview.skimmed.length > 0 && <div className="banner warn">Time is tight: {preview.skimmed.length} lower-priority topics are set to “skim” (half time). High-priority topics are never skimmed.</div>}
                {preview.overCapacity && <div className="banner danger">Still over capacity: you need about {preview.requiredHoursPerDay} h/day of new study. Consider more hours per day.</div>}
                {preview.warning && !preview.overCapacity && !preview.skimmed.length && <div className="banner warn">This is a full schedule — protect your study time.</div>}
                <div className="faint">
                  First study day per system: {Object.entries(preview.firstDayBySystem).map(([s, d]) => `${sysTitle[s]} ${fmtDay(d)}`).join(' · ')}
                </div>
              </>
            )}
            <div className="row">
              <button className="btn" onClick={() => setStep(2)}>
                Back
              </button>
              <button className="btn primary" disabled={!preview} onClick={() => void create()}>
                Create my plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}
