/** Study (docs/06 §3): topic browser + reader with section quizzes, worked examples, topic quiz, notes, search. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Section, TopicContent, TopicMeta } from '@shared/content-schema'
import type { SessionResult } from '@shared/ipc'
import { ConfidencePicker, EmqView, RapidView, SbaView, TutorRun, useStarted } from '../components/Session'
import { BandChip, BlockView, Empty, FlagButton, Md } from '../components/ui'
import { useApp } from '../state/app'

export function StudyPage({ topicId, sectionId, taskId }: { topicId?: string; sectionId?: string; taskId?: string }): ReactNode {
  if (topicId) return <TopicReader key={topicId} topicId={topicId} sectionId={sectionId} taskId={taskId} />
  return <TopicBrowser />
}

/* ------------------------------------------------------------------ browser + search */

function TopicBrowser(): ReactNode {
  const { pack, derived, go } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'mid' | 'final-only' | 'unstudied' | 'review'>('all')
  const term = q.trim().toLowerCase()
  const hits = useMemo(() => {
    if (term.length < 3) return []
    const out: Array<{ topic: TopicMeta; section: Section; snippet: string }> = []
    for (const t of pack.blueprint.topics) {
      const c = pack.topics[t.id]
      if (!c) continue
      for (const s of c.sections) {
        const text = s.blocks
          .map((b) => (b.type === 'bullets' ? b.items.join(' ') : b.type === 'table' ? b.rows.flat().join(' ') : b.type === 'figureRef' ? b.note : b.type === 'diagram' ? b.alt : b.text))
          .join(' ')
        const i = text.toLowerCase().indexOf(term)
        if (i >= 0 || s.title.toLowerCase().includes(term)) out.push({ topic: t, section: s, snippet: i >= 0 ? `…${text.slice(Math.max(0, i - 60), i + 90)}…` : '' })
      }
    }
    return out.slice(0, 40)
  }, [pack, term])
  const show = (t: TopicMeta): boolean => {
    if (filter === 'mid') return t.assessedIn.includes('mid')
    if (filter === 'final-only') return !t.assessedIn.includes('mid')
    if (filter === 'unstudied') return !derived.f.has(t.id)
    if (filter === 'review') {
      const s = derived.stats.get(t.id)
      return derived.f.has(t.id) && (s?.band === 'weak' || (s?.confidence ?? 5) <= 2)
    }
    return true
  }
  return (
    <div className="page">
      <div className="page-head">
        <h1>Study</h1>
        <input className="input" style={{ maxWidth: 340 }} placeholder="Search all summaries…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>
      {term.length >= 3 && (
        <div className="card">
          <h2>{hits.length} result(s)</h2>
          {hits.map((h) => (
            <div key={h.section.id} className="topic-row" onClick={() => go({ name: 'study', topicId: h.topic.id, sectionId: h.section.id })}>
              <div>
                <strong>{h.topic.title}</strong> › {h.section.title}
                <div className="faint">{h.snippet}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pill-tabs">
        {(
          [
            ['all', 'All topics'],
            ['mid', 'Midterm'],
            ['final-only', 'Final-only'],
            ['unstudied', 'Not studied'],
            ['review', 'Needs review']
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      {pack.blueprint.systems.map((s) => {
        const ts = pack.blueprint.topics.filter((t) => t.systemId === s.id && show(t))
        if (!ts.length) return null
        return (
          <div className="card" key={s.id} style={{ padding: 0 }}>
            <h2 style={{ padding: '14px 16px 4px' }}>{s.title}</h2>
            {ts.map((t) => {
              const st = derived.stats.get(t.id)
              const has = !!pack.topics[t.id]
              return (
                <div key={t.id} className="topic-row" onClick={() => go({ name: 'study', topicId: t.id })}>
                  <div>
                    <div className="row">
                      <strong>{t.title}</strong>
                      {t.priority === 'high' && <span className="chip warn">High priority</span>}
                      {t.assessedIn.map((a) => (
                        <span key={a} className="chip neutral">
                          {a === 'mid' ? 'Mid' : a === 'final' ? 'Final' : 'OSCE'}
                        </span>
                      ))}
                    </div>
                    <div className="faint">
                      {t.objectives.length} objectives · {t.studyHours} h {has ? '' : '· ⏳ content arrives in a coming update'}
                    </div>
                  </div>
                  <div className="row">
                    {derived.f.has(t.id) && <span className="chip good">✔ Studied</span>}
                    <BandChip band={st?.band ?? 'not-started'} accuracy={st?.accuracy} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ reader */

function TopicReader({ topicId, sectionId, taskId }: { topicId: string; sectionId?: string; taskId?: string }): ReactNode {
  const app = useApp()
  const { pack, progress, derived, call, go, startSession } = app
  const meta = app.topicMeta(topicId)
  const topic = pack.topics[topicId]
  const [mode, setMode] = useState<'read' | 'rapid'>('read')
  const [quiz, setQuiz] = useState<string | null>(null)
  const [topicQuiz, setTopicQuiz] = useState(false)
  const reads = useMemo(() => new Set(progress.events.sectionReads.filter((r) => r.topicId === topicId).map((r) => r.sectionId)), [progress, topicId])
  const task = taskId ? derived.plan?.tasks.find((t) => t.id === taskId) : undefined

  useEffect(() => {
    if (sectionId) setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [sectionId])

  if (!meta) return <Empty title="Unknown topic" />
  if (!topic)
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => go({ name: 'study' })}>
          ← All topics
        </button>
        <Empty title={meta.title}>
          <p>⏳ The summary and questions for this topic arrive in a coming update.</p>
          <p className="muted">Until then, study it from the book and mark it studied — spaced reviews are scheduled from that date.</p>
          <ul style={{ textAlign: 'left' }}>
            {meta.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
          {!derived.f.has(topicId) ? (
            <button className="btn primary" onClick={() => void call(window.imc.topicSetStudied({ topicId, studied: true }), 'Logged as studied from the book')}>
              Studied from the book
            </button>
          ) : (
            <span className="chip good">✔ Studied</span>
          )}
        </Empty>
      </div>
    )

  const studied = derived.f.has(topicId)
  const st = derived.stats.get(topicId)
  const worked = topic.questions.filter((q) => q.pool === 'worked')
  const allRead = topic.sections.every((s) => reads.has(s.id))
  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <div className="page-head">
        <div>
          <button className="btn ghost sm" onClick={() => go({ name: 'study' })}>
            ← All topics
          </button>
          <h1>{meta.title}</h1>
          <div className="row faint">
            <span>{pack.blueprint.systems.find((s) => s.id === meta.systemId)?.title}</span>
            <span>· {meta.studyHours} h</span>
            {studied && <span className="chip good">✔ Studied</span>}
            <BandChip band={st?.band ?? 'not-started'} accuracy={st?.accuracy} />
            <span>· checked against sources {topic.sourceCheck ? topic.sourceCheck.passedAt.slice(0, 10) : '—'}</span>
          </div>
        </div>
        <div className="row">
          <div className="seg">
            <button aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
              Full summary
            </button>
            <button aria-pressed={mode === 'rapid'} onClick={() => setMode('rapid')}>
              Rapid review
            </button>
          </div>
          <button className="btn" onClick={() => startSession({ kind: 'practice', topicIds: [topicId], title: `Flashcards: ${meta.title}`, mode: 'cards' })}>
            Flashcards ({topic.cards.length})
          </button>
          <button className="btn" onClick={() => startSession({ kind: 'practice', topicIds: [topicId], count: 15, title: `Practice: ${meta.title}`, mode: 'tutor' })}>
            Practice questions
          </button>
        </div>
      </div>
      {task?.type === 'revision-pass' && (
        <div className="banner info">
          <span>Revision pass (Final track): re-read the rapid review or the full summary, then mark the pass complete — spaced reviews restart from today.</span>
          <button className="btn sm" onClick={() => startSession({ kind: 'rapid-review', topicId, taskId, title: `Revision pass: ${meta.title}`, mode: 'rapid' })}>
            Finish revision pass
          </button>
        </div>
      )}
      {mode === 'rapid' ? (
        <RapidView topic={topic} />
      ) : (
        <div className="reader-grid">
          <nav className="toc" aria-label="Sections">
            {topic.sections.map((s) => (
              <button key={s.id} className={reads.has(s.id) ? 'read' : ''} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}>
                {reads.has(s.id) ? '✔ ' : ''}
                {s.title}
              </button>
            ))}
            <button onClick={() => document.getElementById('topic-quiz')?.scrollIntoView({ behavior: 'smooth' })}>🏁 Topic quiz</button>
          </nav>
          <div className="stack">
            <div className="card">
              <strong>Blueprint objectives</strong>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {meta.objectives.map((o, i) => (
                  <li key={i} className="muted">
                    {o}
                  </li>
                ))}
              </ol>
            </div>
            {topic.sections.map((s) => (
              <SectionView
                key={s.id}
                topic={topic}
                section={s}
                highlight={s.id === sectionId}
                read={reads.has(s.id)}
                quizOpen={quiz === s.id}
                onQuiz={() => setQuiz(s.id)}
                onQuizDone={() => setQuiz(null)}
                workedIds={worked.filter((q) => (q.kind === 'sba' ? q.studyRef.sectionId : q.items[0]?.studyRef.sectionId) === s.id).map((q) => q.id)}
              />
            ))}
            <div className="card" id="topic-quiz">
              <h2>🏁 Topic quiz</h2>
              {!allRead && <p className="muted">Read every section (and do its quick quiz) first — then take the topic quiz to complete this topic.</p>}
              {topicQuiz ? (
                <InlineQuiz kind="topic-quiz" topicId={topicId} onDone={() => setTopicQuiz(false)} withConfidence />
              ) : (
                <button className="btn primary" disabled={!allRead} onClick={() => setTopicQuiz(true)}>
                  Start topic quiz
                </button>
              )}
              {!studied && allRead && <p className="faint">Completing the topic quiz marks this New Study session done and schedules your spaced reviews.</p>}
            </div>
            <Notes topicId={topicId} />
          </div>
        </div>
      )}
    </div>
  )
}

function SectionView({
  topic,
  section,
  highlight,
  read,
  quizOpen,
  onQuiz,
  onQuizDone,
  workedIds
}: {
  topic: TopicContent
  section: Section
  highlight: boolean
  read: boolean
  quizOpen: boolean
  onQuiz(): void
  onQuizDone(): void
  workedIds: string[]
}): ReactNode {
  const { call } = useApp()
  const finish = async (): Promise<void> => {
    if (!read) await call(window.imc.studyMarkRead({ topicId: topic.topicId, sectionId: section.id }))
    onQuiz()
  }
  return (
    <section className={`section ${highlight ? 'highlight' : ''}`} id={section.id}>
      <div className="row-between">
        <h2>{section.title}</h2>
        <FlagButton contentId={section.id} />
      </div>
      {section.blocks.map((b, i) => (
        <BlockView key={i} block={b} id={`${section.id}-b${i}`} />
      ))}
      {workedIds.map((id) => (
        <WorkedExample key={id} topic={topic} questionId={id} />
      ))}
      {quizOpen ? (
        <InlineQuiz kind="section-quiz" topicId={topic.topicId} sectionId={section.id} onDone={onQuizDone} />
      ) : (
        <div className="row">
          <button className={`btn ${read ? '' : 'primary'}`} onClick={() => void finish()}>
            {read ? '↻ Retake section quiz' : '✔ Done reading — quick quiz'}
          </button>
          {read && <span className="chip good">Read</span>}
        </div>
      )}
    </section>
  )
}

function WorkedExample({ topic, questionId }: { topic: TopicContent; questionId: string }): ReactNode {
  const [open, setOpen] = useState(false)
  const q = topic.questions.find((x) => x.id === questionId)
  if (!q) return null
  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <div className="row-between">
        <strong>📝 Worked example</strong>
        <button className="btn sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide solution' : 'Show solution'}
        </button>
      </div>
      {q.kind === 'sba' ? (
        <SbaView q={q} chosen={null} reveal={open} onChoose={() => undefined} locked />
      ) : (
        <EmqView q={q} chosen={{}} feedback={{}} reveal={open} onChoose={() => undefined} lockedItems={() => true} />
      )}
    </div>
  )
}

function InlineQuiz({ kind, topicId, sectionId, onDone, withConfidence }: { kind: 'section-quiz' | 'topic-quiz'; topicId: string; sectionId?: string; onDone(): void; withConfidence?: boolean }): ReactNode {
  const spec = useMemo(() => ({ kind, topicId, ...(sectionId ? { sectionId } : {}), title: '', mode: 'tutor' as const }), [kind, topicId, sectionId])
  const { sessionId, questionIds, error } = useStarted(spec, true)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [confDone, setConfDone] = useState(!withConfidence)
  const { go } = useApp()
  if (error) return <div className="banner warn">{error}</div>
  if (!sessionId) return <p className="muted">Loading quiz…</p>
  if (result)
    return (
      <div className="stack">
        <div className={`feedback ${result.correct === result.total ? 'ok' : 'bad'}`}>
          <strong>
            {result.correct}/{result.total} correct
          </strong>
          {result.wrong.length > 0 && <span>Revisit the sections linked in the feedback above.</span>}
        </div>
        {!confDone && <ConfidencePicker topicId={topicId} onDone={() => setConfDone(true)} />}
        {confDone && (
          <div className="row">
            <button className="btn" onClick={onDone}>
              Close
            </button>
            {kind === 'topic-quiz' && (
              <button className="btn primary" onClick={() => go({ name: 'today' })}>
                Back to Today
              </button>
            )}
          </div>
        )}
      </div>
    )
  return <TutorRun sessionId={sessionId} questionIds={questionIds} onDone={setResult} />
}

function Notes({ topicId }: { topicId: string }): ReactNode {
  const { progress, call } = useApp()
  const notes = progress.events.notes.filter((n) => n.topicId === topicId)
  const [text, setText] = useState('')
  return (
    <div className="card">
      <h2>My notes</h2>
      {notes.map((n) => (
        <div key={n.id} className="list-item">
          <span style={{ flex: 1 }}>
            <Md text={n.text} />
          </span>
          <button className="btn ghost sm" onClick={() => void call(window.imc.notesDelete(n.id))}>
            Delete
          </button>
        </div>
      ))}
      <textarea className="input" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note (mnemonics, things to remember)…" />
      <button
        className="btn sm"
        disabled={!text.trim()}
        onClick={async () => {
          if (await call(window.imc.notesUpsert({ topicId, text }))) setText('')
        }}
      >
        Save note
      </button>
    </div>
  )
}
