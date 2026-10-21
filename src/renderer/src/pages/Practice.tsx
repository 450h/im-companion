/** Practice (docs/06 §4): flashcards, practice builder, topic quizzes, chapter exams, mocks, weak drill, EMQ volumes. */
import { useMemo, useState, type ReactNode } from 'react'
import { weakTopics } from '@shared/engine/stats'
import { BandChip, Empty } from '../components/ui'
import { useApp } from '../state/app'

type Tab = 'cards' | 'practice' | 'exams' | 'volumes'

export function PracticePage({ tab: initial }: { tab?: string }): ReactNode {
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'practice')
  return (
    <div className="page">
      <div className="page-head">
        <h1>Practice</h1>
        <div className="pill-tabs">
          {(
            [
              ['practice', 'Questions'],
              ['cards', 'Flashcards'],
              ['exams', 'Exams & mocks'],
              ['volumes', 'EMQ Volumes']
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {tab === 'practice' && <QuestionBuilder />}
      {tab === 'cards' && <Flashcards />}
      {tab === 'exams' && <Exams />}
      {tab === 'volumes' && <Volumes />}
    </div>
  )
}

function useAvailable(): Array<{ id: string; title: string; systemId: string }> {
  const { pack } = useApp()
  return pack.blueprint.topics.filter((t) => pack.topics[t.id]).map((t) => ({ id: t.id, title: t.title, systemId: t.systemId }))
}

function QuestionBuilder(): ReactNode {
  const { pack, derived, startSession, topicMeta } = useApp()
  const avail = useAvailable()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<'both' | 'sba' | 'emq'>(derived.track === 'final' ? 'sba' : 'both')
  const [count, setCount] = useState(20)
  const weak = weakTopics(derived.stats, derived.f).filter((id) => pack.topics[id])
  if (!avail.length) return <Empty title="No questions yet">Content arrives system by system — check back after the next update.</Empty>
  const toggleSystem = (s: string): void => {
    const ids = avail.filter((t) => t.systemId === s).map((t) => t.id)
    const all = ids.every((id) => sel.has(id))
    const n = new Set(sel)
    for (const id of ids) {
      if (all) n.delete(id)
      else n.add(id)
    }
    setSel(n)
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
      <div className="card">
        <h2>Choose topics</h2>
        {pack.blueprint.systems.map((s) => {
          const ts = avail.filter((t) => t.systemId === s.id)
          if (!ts.length) return null
          return (
            <div key={s.id} className="stack" style={{ gap: 2 }}>
              <label className="checkbox-row">
                <input type="checkbox" checked={ts.every((t) => sel.has(t.id))} onChange={() => toggleSystem(s.id)} />
                <strong>{s.title}</strong>
              </label>
              {ts.map((t) => (
                <label key={t.id} className="checkbox-row" style={{ paddingLeft: 24 }}>
                  <input
                    type="checkbox"
                    checked={sel.has(t.id)}
                    onChange={() =>
                      setSel((x) => {
                        const n = new Set(x)
                        if (n.has(t.id)) n.delete(t.id)
                        else n.add(t.id)
                        return n
                      })
                    }
                  />
                  <span style={{ flex: 1 }}>{t.title}</span>
                  <BandChip band={derived.stats.get(t.id)?.band ?? 'not-started'} accuracy={derived.stats.get(t.id)?.accuracy} />
                </label>
              ))}
            </div>
          )
        })}
      </div>
      <div className="stack">
        <div className="card">
          <h2>Practice session</h2>
          <div className="field">
            <span>Format</span>
            <div className="seg">
              {(['both', 'emq', 'sba'] as const).map((f) => (
                <button key={f} aria-pressed={format === f} onClick={() => setFormat(f)}>
                  {f === 'both' ? 'Both' : f === 'emq' ? 'EMQ (midterm)' : 'MCQ (final)'}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Number of items</span>
            <input className="input" type="number" min={5} max={100} value={count} onChange={(e) => setCount(Math.min(100, Math.max(5, Number(e.target.value) || 5)))} />
          </label>
          <button
            className="btn primary"
            disabled={!sel.size}
            onClick={() => startSession({ kind: 'practice', topicIds: [...sel], format, count, title: `Practice: ${sel.size} topic(s)`, mode: 'tutor' })}
          >
            Start ({sel.size} topics)
          </button>
          <p className="faint">Tutor mode: each answer is explained, and wrong answers link to the exact section and page to study.</p>
        </div>
        <div className="card">
          <h2>Weak-areas drill</h2>
          {weak.length ? (
            <>
              <p className="muted">{weak.map((id) => topicMeta(id)?.title).join(', ')}</p>
              <button className="btn" onClick={() => startSession({ kind: 'weak-drill', topicIds: weak, title: 'Weak areas drill', mode: 'tutor' })}>
                Start 15-question drill
              </button>
            </>
          ) : (
            <p className="muted">Answer some questions first — weak topics (&lt; 60%) and low-confidence topics appear here.</p>
          )}
        </div>
        <div className="card">
          <h2>Topic quizzes</h2>
          <select
            className="input"
            defaultValue=""
            onChange={(e) => e.target.value && startSession({ kind: 'topic-quiz', topicId: e.target.value, title: `Topic quiz: ${topicMeta(e.target.value)?.title}`, mode: 'tutor' })}
          >
            <option value="">Retake a topic quiz…</option>
            {avail.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function Flashcards(): ReactNode {
  const { pack, derived, startSession } = useApp()
  const rows = pack.blueprint.systems.map((s) => {
    const topics = Object.values(pack.topics).filter((t) => pack.blueprint.topics.find((m) => m.id === t.topicId)?.systemId === s.id)
    const cards = topics.flatMap((t) => t.cards)
    return { s, topics, total: cards.length, due: cards.filter((c) => derived.dueCards.includes(c.id)).length }
  })
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h2>All due cards</h2>
          <button className="btn primary" disabled={!derived.dueCards.length} onClick={() => startSession({ kind: 'practice', title: 'Flashcards due', mode: 'cards', count: 80 })}>
            Review {derived.dueCards.length} due
          </button>
        </div>
        <p className="faint">Spaced repetition: Again / Hard / Good / Easy schedules each card; due dates never fall after your exam.</p>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>System</th>
              <th className="r">Cards</th>
              <th className="r">Due</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.total)
              .map((r) => (
                <tr key={r.s.id}>
                  <td>{r.s.title}</td>
                  <td className="r">{r.total}</td>
                  <td className="r">{r.due}</td>
                  <td className="r">
                    <button className="btn sm" onClick={() => startSession({ kind: 'practice', topicIds: r.topics.map((t) => t.topicId), title: `Flashcards: ${r.s.title}`, mode: 'cards', count: 60 })}>
                      Study
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Exams(): ReactNode {
  const { pack, progress, startSession } = useApp()
  const best = (examId: string): string => {
    const sessions = progress.events.sessions.filter((s) => s.kind === 'exam' && s.examId === examId && s.completedAt)
    if (!sessions.length) return '—'
    const scores = sessions.map((s) => {
      const a = progress.events.attempts.filter((x) => x.sessionId === s.id)
      return a.length ? a.filter((x) => x.correct).length / a.length : 0
    })
    return `${Math.round(Math.max(...scores) * 100)}% best · ${sessions.length} attempt(s)`
  }
  const groups = [
    ['mock-midterm', 'Mock midterm papers (EMQ)'],
    ['mock-final', 'Mock final papers (MCQ)'],
    ['chapter', 'Chapter exams (one per system)']
  ] as const
  if (!pack.exams.length) return <Empty title="Exams arrive with the content updates">Chapter exams unlock as each system is released; mock papers before the Consolidate phase.</Empty>
  return (
    <div className="stack">
      {groups.map(([kind, label]) => {
        const exams = pack.exams.filter((e) => e.kind === kind)
        if (!exams.length) return null
        return (
          <div className="card" key={kind}>
            <h2>{label}</h2>
            {exams.map((e) => (
              <div className="list-item" key={e.id}>
                <div style={{ flex: 1 }}>
                  <strong>{e.title}</strong>
                  <div className="faint">
                    {e.questionIds.length} questions · {e.minutes} min · {best(e.id)}
                  </div>
                </div>
                <button className="btn primary sm" onClick={() => startSession({ kind: 'exam', examId: e.id, title: e.title, mode: 'exam', minutes: e.minutes })}>
                  Start
                </button>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Volumes(): ReactNode {
  const { pack, progress, startSession, topicMeta } = useApp()
  const [vol, setVol] = useState<1 | 2 | 3>(1)
  const [all, setAll] = useState(false)
  const themes = useMemo(() => pack.emqVolumes.filter((t) => t.volume === vol && (all || t.inBlueprint)), [pack, vol, all])
  const done = (id: string): string => {
    const s = progress.events.sessions.filter((x) => x.kind === 'emq-volume' && x.emqThemeId === id && x.completedAt)
    if (!s.length) return ''
    const a = progress.events.attempts.filter((x) => s.some((y) => y.id === x.sessionId))
    return a.length ? `${a.filter((x) => x.correct).length}/${a.length}` : ''
  }
  if (!pack.emqVolumes.length) return <Empty title="EMQ Volumes answer sheet arrives in v0.3">Open the book, answer in the app, get marked with explanations and where to study.</Empty>
  return (
    <div className="stack">
      <div className="card">
        <p>
          Practise with <strong>EMQs for Medical Students</strong> (Vols 1–3): open your copy at the page shown, answer each item here, and get marked with our explanation and a
          link to the section to study. The app does not reproduce the questions.
        </p>
        <div className="row">
          <div className="seg">
            {([1, 2, 3] as const).map((v) => (
              <button key={v} aria-pressed={vol === v} onClick={() => setVol(v)}>
                Volume {v}
              </button>
            ))}
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Include themes outside the Med 611 blueprint
          </label>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {themes.map((t) => {
          const topics = [...new Set(t.items.map((i) => i.topicId).filter((x): x is string => !!x))]
          return (
            <div key={t.id} className="topic-row" onClick={() => startSession({ kind: 'emq-volume', emqThemeId: t.id, title: `EMQ Vol ${t.volume} · ${t.where.title}`, mode: 'volume' })}>
              <div>
                <strong>
                  {t.where.part} · Theme {t.where.themeNo}: {t.where.title}
                </strong>
                <div className="faint">
                  p. {t.where.page} · {t.items.length} items {topics.length ? `· ${topics.map((id) => topicMeta(id)?.title).join(', ')}` : ''}
                </div>
              </div>
              <div className="row">{done(t.id) && <span className="chip info">{done(t.id)}</span>}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
