/**
 * Session runner: tutor quizzes, timed exams, flashcards, spaced reviews, rapid review, OSPE practice and
 * the EMQ-Volumes answer sheet. Grading happens in main (session:answer); wrong answers route to the
 * section + citation that teaches them (R-12).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Card, Citation, Emq, Question, Sba, TopicContent } from '@shared/content-schema'
import type { AnswerFeedback, SessionResult } from '@shared/ipc'
import { useApp, type SessionSpec, type View } from '../state/app'
import { BlockView, Cites, FlagButton, Md, citeText, pct } from './ui'

const L = (i: number): string => String.fromCharCode(65 + i)

function firstCite(sec: TopicContent['sections'][number] | undefined): Citation | undefined {
  for (const b of sec?.blocks ?? []) {
    if (b.type === 'figureRef') continue
    if (b.cites[0]) return b.cites[0]
  }
  return undefined
}

/* ------------------------------------------------------------------ question views */

function StudyLink({ topicId, sectionId }: { topicId: string; sectionId: string }): ReactNode {
  const { pack, go } = useApp()
  const t = pack.topics[topicId]
  const s = t?.sections.find((x) => x.id === sectionId)
  const title = pack.blueprint.topics.find((x) => x.id === topicId)?.title ?? topicId
  return (
    <button className="study-link" onClick={() => go({ name: 'study', topicId, sectionId })}>
      Study this: {title} › {s?.title ?? 'section'}
    </button>
  )
}

function Feedback({ fb, wrongText }: { fb: AnswerFeedback; wrongText?: string | null }): ReactNode {
  if (fb.correct === null) return null
  return (
    <div className={`feedback ${fb.correct ? 'ok' : 'bad'}`} role="status">
      <strong>{fb.correct ? '✔ Correct' : `✘ Not quite — the answer is ${fb.answer !== null ? L(fb.answer) : ''}`}</strong>
      {!fb.correct && wrongText && (
        <div>
          <em>Why your choice is wrong: </em>
          <Md text={wrongText} />
        </div>
      )}
      {fb.explanation && (
        <div>
          <Md text={fb.explanation} />
        </div>
      )}
      {!fb.correct && fb.studyRef && <StudyLink {...fb.studyRef} />}
      {fb.cites.length > 0 && <Cites cites={fb.cites} />}
    </div>
  )
}

export function SbaView({
  q,
  chosen,
  feedback,
  reveal,
  onChoose,
  locked
}: {
  q: Sba
  chosen: number | null
  feedback?: AnswerFeedback | null
  reveal?: boolean
  onChoose(i: number): void
  locked: boolean
}): ReactNode {
  const answer = feedback?.answer ?? (reveal ? q.answer : null)
  return (
    <div className="q-card">
      <p className="q-stem">
        <Md text={q.stem} />
      </p>
      <p className="q-leadin">
        <Md text={q.leadIn} />
      </p>
      <div className="opts" role="radiogroup">
        {q.options.map((o, i) => {
          let cls = 'opt'
          if (answer !== null && answer !== undefined) {
            if (i === answer) cls += ' correct'
            else if (i === chosen) cls += ' wrong'
          } else if (i === chosen) cls += ' chosen'
          return (
            <button key={i} className={cls} disabled={locked} onClick={() => onChoose(i)} role="radio" aria-checked={i === chosen}>
              <span className="letter">{L(i)}</span>
              <span>{o}</span>
            </button>
          )
        })}
      </div>
      {feedback && <Feedback fb={feedback} wrongText={feedback.whyNot} />}
      {reveal && !feedback && (
        <div className="feedback ok">
          <strong>Answer: {L(q.answer)}</strong>
          <Md text={q.explanation} />
          <Cites cites={q.cites} />
        </div>
      )}
    </div>
  )
}

export function EmqView({
  q,
  chosen,
  feedback,
  reveal,
  onChoose,
  lockedItems
}: {
  q: Emq
  chosen: Record<number, number>
  feedback: Record<number, AnswerFeedback>
  reveal?: boolean
  onChoose(item: number, i: number): void
  lockedItems: (item: number) => boolean
}): ReactNode {
  return (
    <div className="q-card">
      <div className="row-between">
        <h3>Theme: {q.theme}</h3>
        <span className="chip neutral">EMQ · {q.items.length} items</span>
      </div>
      <ol className="emq-options">
        {q.options.map((o, i) => (
          <li key={i}>
            <strong>{L(i)}</strong> {o}
          </li>
        ))}
      </ol>
      <p className="q-leadin">
        <Md text={q.leadIn} />
      </p>
      {q.items.map((it, n) => {
        const fb = feedback[n]
        const answer = fb?.answer ?? (reveal ? it.answer : null)
        return (
          <div key={n} className="emq-item">
            <p className="q-stem">
              <strong>{n + 1}.</strong> <Md text={it.stem} />
            </p>
            <div className="letters" role="radiogroup" aria-label={`Item ${n + 1}`}>
              {q.options.map((_, i) => {
                let cls = ''
                if (answer !== null && answer !== undefined) {
                  if (i === answer) cls = 'correct'
                  else if (i === chosen[n]) cls = 'wrong'
                } else if (i === chosen[n]) cls = 'chosen'
                return (
                  <button key={i} className={cls} disabled={lockedItems(n)} onClick={() => onChoose(n, i)} role="radio" aria-checked={chosen[n] === i}>
                    {L(i)}
                  </button>
                )
              })}
            </div>
            {fb && <Feedback fb={fb} />}
            {reveal && !fb && (
              <div className="feedback ok">
                <strong>Answer: {L(it.answer)}</strong>
                <Md text={it.explanation} />
              </div>
            )}
          </div>
        )
      })}
      {reveal && <Cites cites={q.cites} />}
    </div>
  )
}

/* ------------------------------------------------------------------ helpers */

function useQuestions(): Map<string, Question> {
  const { pack } = useApp()
  return useMemo(() => {
    const m = new Map<string, Question>()
    for (const t of Object.values(pack.topics)) for (const q of t.questions) m.set(q.id, q)
    return m
  }, [pack])
}

export function useStarted(spec: SessionSpec, enabled: boolean): { sessionId: string | null; questionIds: string[]; error: string | null } {
  const { call } = useApp()
  const [state, setState] = useState<{ sessionId: string | null; questionIds: string[]; error: string | null }>({ sessionId: null, questionIds: [], error: null })
  const started = useRef(false)
  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    const { title: _t, mode: _m, minutes: _min, ...payload } = spec
    void window.imc.sessionStart(payload).then((r) => {
      if (r.ok) setState({ sessionId: r.data.sessionId, questionIds: r.data.questionIds, error: null })
      else setState({ sessionId: null, questionIds: [], error: r.message })
    })
  }, [spec, enabled, call])
  return state
}

/* ------------------------------------------------------------------ tutor run */

export function TutorRun({ sessionId, questionIds, onDone }: { sessionId: string; questionIds: string[]; onDone(r: SessionResult): void }): ReactNode {
  const { call } = useApp()
  const qs = useQuestions()
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<Record<string, Record<number, number>>>({})
  const [fb, setFb] = useState<Record<string, Record<number, AnswerFeedback>>>({})
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
  }, [])
  const q = qs.get(questionIds[idx] ?? '')
  const answerKey = (n: number | undefined): number => n ?? -1

  const answer = async (questionId: string, choice: number, item?: number): Promise<void> => {
    if (fb[questionId]?.[answerKey(item)]) return
    setChosen((c) => ({ ...c, [questionId]: { ...c[questionId], [answerKey(item)]: choice } }))
    const r = await call(window.imc.sessionAnswer({ sessionId, questionId, choice, ms: Date.now() - started.current, ...(item !== undefined ? { item } : {}) }))
    started.current = Date.now()
    if (r) setFb((f) => ({ ...f, [questionId]: { ...f[questionId], [answerKey(item)]: r } }))
  }
  const finish = async (): Promise<void> => {
    const r = await call(window.imc.sessionComplete(sessionId))
    if (r) onDone(r)
  }
  const answeredAll = q ? (q.kind === 'sba' ? !!fb[q.id]?.[-1] : q.items.every((_, n) => !!fb[q.id]?.[n])) : true

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (!q || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (q.kind === 'sba' && !fb[q.id]?.[-1]) {
        const n = e.key.toUpperCase().charCodeAt(0) - 65
        if (e.key.length === 1 && n >= 0 && n < 5) void answer(q.id, n)
        if (/^[1-5]$/.test(e.key)) void answer(q.id, Number(e.key) - 1)
      }
      if ((e.key === 'Enter' || e.key.toLowerCase() === 'n') && answeredAll) {
        if (idx < questionIds.length - 1) setIdx(idx + 1)
        else void finish()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  if (!q) return <p className="muted">No questions.</p>
  return (
    <div className="stack">
      <div className="row-between">
        <span className="faint">
          Question {idx + 1} of {questionIds.length} · <span className="kbd">A–E</span> to answer, <span className="kbd">Enter</span> next
        </span>
        <FlagButton contentId={q.id} />
      </div>
      <div className="card">
        {q.kind === 'sba' ? (
          <SbaView q={q} chosen={chosen[q.id]?.[-1] ?? null} feedback={fb[q.id]?.[-1] ?? null} onChoose={(i) => void answer(q.id, i)} locked={!!fb[q.id]?.[-1]} />
        ) : (
          <EmqView
            q={q}
            chosen={chosen[q.id] ?? {}}
            feedback={fb[q.id] ?? {}}
            onChoose={(n, i) => void answer(q.id, i, n)}
            lockedItems={(n) => !!fb[q.id]?.[n]}
          />
        )}
      </div>
      <div className="row-between">
        <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← Previous
        </button>
        {idx < questionIds.length - 1 ? (
          <button className="btn primary" disabled={!answeredAll} onClick={() => setIdx(idx + 1)}>
            Next →
          </button>
        ) : (
          <button className="btn primary" disabled={!answeredAll} onClick={() => void finish()}>
            Finish
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ exam run */

function ExamRun({ sessionId, questionIds, minutes, onDone }: { sessionId: string; questionIds: string[]; minutes: number; onDone(r: SessionResult): void }): ReactNode {
  const { call } = useApp()
  const qs = useQuestions()
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<Record<string, Record<number, number>>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [left, setLeft] = useState(minutes * 60)
  const [confirm, setConfirm] = useState(false)
  const t0 = useRef(0)
  useEffect(() => {
    t0.current = Date.now()
  }, [])
  const submit = useCallback(async () => {
    const r = await call(window.imc.sessionComplete(sessionId))
    if (r) onDone(r)
  }, [call, sessionId, onDone])
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left === 0) void submit()
  }, [left, submit])
  const q = qs.get(questionIds[idx] ?? '')
  const answer = (questionId: string, choice: number, item?: number): void => {
    setChosen((c) => ({ ...c, [questionId]: { ...c[questionId], [item ?? -1]: choice } }))
    void call(window.imc.sessionAnswer({ sessionId, questionId, choice, ms: Date.now() - t0.current, ...(item !== undefined ? { item } : {}) }))
  }
  const isAnswered = (id: string): boolean => {
    const qq = qs.get(id)
    if (!qq) return false
    return qq.kind === 'sba' ? chosen[id]?.[-1] !== undefined : qq.items.every((_, n) => chosen[id]?.[n] !== undefined)
  }
  const unanswered = questionIds.filter((id) => !isAnswered(id)).length
  const mm = Math.max(0, Math.floor(left / 60))
  const ss = String(Math.max(0, left % 60)).padStart(2, '0')
  if (!q) return null
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 240px' }}>
      <div className="stack">
        <div className="card">
          {q.kind === 'sba' ? (
            <SbaView q={q} chosen={chosen[q.id]?.[-1] ?? null} onChoose={(i) => answer(q.id, i)} locked={false} />
          ) : (
            <EmqView q={q} chosen={chosen[q.id] ?? {}} feedback={{}} onChoose={(n, i) => answer(q.id, i, n)} lockedItems={() => false} />
          )}
        </div>
        <div className="row-between">
          <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            ← Previous
          </button>
          <button
            className="btn"
            onClick={() =>
              setFlagged((f) => {
                const n = new Set(f)
                if (n.has(q.id)) n.delete(q.id)
                else n.add(q.id)
                return n
              })
            }
          >
            {flagged.has(q.id) ? '★ Flagged' : '☆ Flag for review'}
          </button>
          <button className="btn primary" disabled={idx === questionIds.length - 1} onClick={() => setIdx(idx + 1)}>
            Next →
          </button>
        </div>
      </div>
      <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 16 }}>
        <div className="row-between">
          <span className="stat-label">Time left</span>
          <span className={`timer ${left < 300 ? 'neg' : ''}`}>
            {mm}:{ss}
          </span>
        </div>
        <div className="navgrid">
          {questionIds.map((id, i) => (
            <button
              key={id}
              className={[isAnswered(id) ? 'answered' : '', i === idx ? 'current' : '', flagged.has(id) ? 'flagged' : ''].join(' ')}
              onClick={() => setIdx(i)}
              aria-label={`Question ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <span className="faint">{unanswered} unanswered · answers can change until you submit</span>
        <button className="btn primary" onClick={() => (unanswered ? setConfirm(true) : void submit())}>
          Submit exam
        </button>
        {confirm && (
          <div className="banner warn">
            <span>{unanswered} question(s) unanswered. Submit anyway?</span>
            <button className="btn sm" onClick={() => void submit()}>
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ results */

function Results({ result, spec, back }: { result: SessionResult; spec: SessionSpec; back: View }): ReactNode {
  const { pack, go, startSession, topicMeta } = useApp()
  const qs = useQuestions()
  const [review, setReview] = useState(false)
  const bySection = new Map<string, { topicId: string; sectionId: string; n: number }>()
  for (const w of result.wrong) {
    if (!w.studyRef) continue
    const k = `${w.studyRef.topicId}|${w.studyRef.sectionId}`
    const cur = bySection.get(k) ?? { ...w.studyRef, n: 0 }
    cur.n++
    bySection.set(k, cur)
  }
  const wrongTopics = [...new Set(result.wrong.map((w) => w.studyRef?.topicId).filter((x): x is string => !!x))]
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <div>
            <div className="stat-label">{spec.title}</div>
            <div className="stat-value">
              {result.correct} / {result.total} <span className="muted">({pct(result.total ? result.correct / result.total : null)})</span>
            </div>
          </div>
          <div className="row">
            {spec.mode === 'exam' && (
              <button className="btn" onClick={() => setReview((r) => !r)}>
                {review ? 'Hide answers' : 'Review answers'}
              </button>
            )}
            {wrongTopics.length > 0 && (
              <button className="btn" onClick={() => startSession({ kind: 'weak-drill', topicIds: wrongTopics, title: 'Drill: what you missed', mode: 'tutor' })}>
                Drill what I missed
              </button>
            )}
            <button className="btn primary" onClick={() => go(back)}>
              Done
            </button>
          </div>
        </div>
        {Object.keys(result.byTopic).length > 1 && (
          <table className="table">
            <thead>
              <tr>
                <th>Topic</th>
                <th className="r">Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.byTopic).map(([t, s]) => (
                <tr key={t}>
                  <td>{topicMeta(t)?.title ?? t}</td>
                  <td className="r">
                    {s.correct}/{s.total} ({pct(s.correct / s.total)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {bySection.size > 0 && (
        <div className="card">
          <h2>Where to study</h2>
          <div className="list">
            {[...bySection.values()]
              .sort((a, b) => b.n - a.n)
              .map((s) => {
                const sec = pack.topics[s.topicId]?.sections.find((x) => x.id === s.sectionId)
                return (
                  <div className="list-item" key={`${s.topicId}${s.sectionId}`}>
                    <span className="chip danger">{s.n} wrong</span>
                    <button className="study-link" onClick={() => go({ name: 'study', topicId: s.topicId, sectionId: s.sectionId })}>
                      {topicMeta(s.topicId)?.title} › {sec?.title}
                    </button>
                    {firstCite(sec) && <span className="faint">{citeText(firstCite(sec)!, pack.books)}</span>}
                  </div>
                )
              })}
          </div>
        </div>
      )}
      {review &&
        spec.mode === 'exam' &&
        [...new Set(result.wrong.map((w) => w.questionId))].map((id) => {
          const q = qs.get(id)
          if (!q) return null
          return (
            <div className="card" key={id}>
              {q.kind === 'sba' ? (
                <SbaView q={q} chosen={null} reveal onChoose={() => undefined} locked />
              ) : (
                <EmqView q={q} chosen={{}} feedback={{}} reveal onChoose={() => undefined} lockedItems={() => true} />
              )}
              {q.kind === 'sba' && <StudyLink topicId={id.slice(0, id.lastIndexOf('.'))} sectionId={q.studyRef.sectionId} />}
            </div>
          )
        })}
    </div>
  )
}

/* ------------------------------------------------------------------ flashcards */

export function CardDeck({ cards, onFinish }: { cards: Card[]; onFinish(): void }): ReactNode {
  const { call } = useApp()
  const [queue, setQueue] = useState(cards)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const c = queue[0]
  const gradeIt = async (g: 'again' | 'hard' | 'good' | 'easy'): Promise<void> => {
    if (!c) return
    await call(window.imc.cardsGrade({ cardId: c.id, grade: g }))
    setFlipped(false)
    setQueue((q) => (g === 'again' ? [...q.slice(1), c] : q.slice(1)))
    if (g !== 'again') setDone((d) => d + 1)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
      if (flipped && /^[1-4]$/.test(e.key)) void gradeIt((['again', 'hard', 'good', 'easy'] as const)[Number(e.key) - 1]!)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  if (!c)
    return (
      <div className="empty card">
        <h2>Deck finished ✔</h2>
        <p className="muted">{done} card(s) reviewed.</p>
        <button className="btn primary" onClick={onFinish}>
          Continue
        </button>
      </div>
    )
  return (
    <div className="stack">
      <div className="row-between">
        <span className="faint">
          {queue.length} left · <span className="kbd">Space</span> flip, <span className="kbd">1–4</span> grade
        </span>
        <FlagButton contentId={c.id} />
      </div>
      <div className="flashcard" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} aria-label="Flip card">
        <div>
          <Md text={c.front} />
        </div>
        {flipped && (
          <div className="back">
            <Md text={c.back} />
            <Cites cites={c.cites} />
          </div>
        )}
        {!flipped && <span className="faint">Click to show the answer</span>}
      </div>
      {flipped && (
        <div className="grade-row">
          <button className="btn danger" onClick={() => void gradeIt('again')}>
            1 · Again
          </button>
          <button className="btn" onClick={() => void gradeIt('hard')}>
            2 · Hard
          </button>
          <button className="btn primary" onClick={() => void gradeIt('good')}>
            3 · Good
          </button>
          <button className="btn" onClick={() => void gradeIt('easy')}>
            4 · Easy
          </button>
        </div>
      )}
    </div>
  )
}

export function ConfidencePicker({ topicId, onDone }: { topicId: string; onDone(): void }): ReactNode {
  const { call } = useApp()
  const [v, setV] = useState<number | null>(null)
  return (
    <div className="card">
      <h2>How confident are you with this topic now?</h2>
      <p className="muted">1 = weak, 5 = solid. Low confidence schedules it into your weak-areas drills.</p>
      <div className="confidence">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-pressed={v === n} onClick={() => setV(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row">
        <button
          className="btn primary"
          disabled={v === null}
          onClick={async () => {
            await call(window.imc.topicConfidence({ topicId, value: v! }))
            onDone()
          }}
        >
          Save
        </button>
        <button className="btn ghost" onClick={onDone}>
          Skip
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ rapid review */

export function RapidView({ topic }: { topic: TopicContent }): ReactNode {
  return (
    <div className="stack">
      {topic.sections.map((s) => {
        const blocks = s.blocks.filter((b) => b.type === 'pearl' || b.type === 'pitfall' || b.type === 'table')
        if (!blocks.length) return null
        return (
          <div className="section" key={s.id}>
            <h2>{s.title}</h2>
            {blocks.map((b, i) => (
              <BlockView key={i} block={b} id={`${s.id}-${i}`} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ EMQ volumes answer sheet */

function VolumeSheet({ sessionId, themeId, onDone }: { sessionId: string; themeId: string; onDone(r: SessionResult): void }): ReactNode {
  const { pack, call } = useApp()
  const theme = pack.emqVolumes.find((t) => t.id === themeId)
  const [chosen, setChosen] = useState<Record<number, number>>({})
  const [fb, setFb] = useState<Record<number, AnswerFeedback>>({})
  if (!theme) return null
  const book = pack.books.find((b) => b.id === `emq${theme.volume}`)
  const answer = async (n: number, choice: number): Promise<void> => {
    if (fb[n]) return
    setChosen((c) => ({ ...c, [n]: choice }))
    const item = theme.items.find((i) => i.n === n)!
    const r = await call(window.imc.sessionAnswer({ sessionId, questionId: `${item.topicId ?? 'emq'}.v-${theme.id}-${n}`, item: n, choice, ms: 0 }))
    if (r) setFb((f) => ({ ...f, [n]: r }))
  }
  return (
    <div className="stack">
      <div className="banner info">
        <span>
          Open <strong>{book?.title ?? `EMQs Vol ${theme.volume}`}</strong> at <strong>{theme.where.part}</strong>, theme {theme.where.themeNo} “{theme.where.title}” —{' '}
          <strong>p. {theme.where.page}</strong>. Answer each item below; explanations here are ours, the book’s full answers are on p. {theme.where.answersPage}.
        </span>
      </div>
      {theme.items.map((it) => (
        <div className="card" key={it.n}>
          <div className="row-between">
            <h3>Item {it.n}</h3>
          </div>
          <div className="letters">
            {Array.from({ length: theme.optionCount }, (_, i) => {
              const f = fb[it.n]
              let cls = ''
              if (f) cls = i === f.answer ? 'correct' : i === chosen[it.n] ? 'wrong' : ''
              else if (chosen[it.n] === i) cls = 'chosen'
              return (
                <button key={i} className={cls} disabled={!!f} onClick={() => void answer(it.n, i)}>
                  {L(i)}
                </button>
              )
            })}
          </div>
          {fb[it.n] && <Feedback fb={fb[it.n]!} />}
        </div>
      ))}
      <button
        className="btn primary"
        onClick={async () => {
          const r = await call(window.imc.sessionComplete(sessionId))
          if (r) onDone(r)
        }}
      >
        Finish theme
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ the page */

export function SessionPage({ spec, back }: { spec: SessionSpec; back: View }): ReactNode {
  const { pack, go, derived, call } = useApp()
  const needsServer = spec.mode !== 'cards' && spec.mode !== 'rapid'
  const { sessionId, questionIds, error } = useStarted(spec, needsServer)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [stage, setStage] = useState<'cards' | 'questions' | 'confidence' | 'done'>(spec.mode === 'review' ? 'cards' : 'questions')
  const topic = spec.topicId ? pack.topics[spec.topicId] : undefined

  const header = (
    <div className="page-head">
      <div>
        <button className="btn ghost sm" onClick={() => go(back)}>
          ← Back
        </button>
        <h1>{spec.title}</h1>
      </div>
    </div>
  )
  if (error)
    return (
      <div className="page">
        {header}
        <div className="banner warn">{error}</div>
      </div>
    )
  if (result && stage !== 'confidence')
    return (
      <div className="page">
        {header}
        <Results result={result} spec={spec} back={back} />
      </div>
    )

  if (spec.mode === 'cards') {
    const ids = new Set(spec.topicIds ?? (spec.topicId ? [spec.topicId] : []))
    const all = Object.values(pack.topics).flatMap((t) => t.cards.filter(() => !ids.size || ids.has(t.topicId)))
    const due = all.filter((c) => derived.dueCards.includes(c.id))
    const deck = (due.length ? due : all).slice(0, spec.count ?? 50)
    return (
      <div className="page">
        {header}
        <CardDeck cards={deck} onFinish={() => go(back)} />
      </div>
    )
  }

  if (spec.mode === 'rapid') {
    const ids = spec.topicIds ?? (spec.topicId ? [spec.topicId] : [])
    return (
      <div className="page">
        {header}
        {ids.map((id) =>
          pack.topics[id] ? (
            <div key={id} className="stack">
              <h2>{pack.blueprint.topics.find((t) => t.id === id)?.title}</h2>
              <RapidView topic={pack.topics[id]!} />
            </div>
          ) : null
        )}
        <button
          className="btn primary"
          onClick={async () => {
            for (const id of ids.filter((x) => pack.topics[x])) {
              const s = await call(window.imc.sessionStart({ kind: 'rapid-review', topicId: id, ...(spec.taskId ? { taskId: spec.taskId } : {}) }))
              if (s) await call(window.imc.sessionComplete(s.sessionId))
            }
            go(back)
          }}
        >
          ✔ Done with this review
        </button>
      </div>
    )
  }

  if (!sessionId) return <div className="page">{header}<p className="muted">Loading…</p></div>

  if (spec.mode === 'volume' && spec.emqThemeId)
    return (
      <div className="page">
        {header}
        <VolumeSheet sessionId={sessionId} themeId={spec.emqThemeId} onDone={setResult} />
      </div>
    )

  if (spec.mode === 'review' && topic) {
    return (
      <div className="page">
        {header}
        {stage === 'cards' && <CardDeck cards={topic.cards} onFinish={() => setStage(questionIds.length ? 'questions' : 'confidence')} />}
        {stage === 'questions' && (
          <TutorRun
            sessionId={sessionId}
            questionIds={questionIds}
            onDone={(r) => {
              setResult(r)
              setStage('confidence')
            }}
          />
        )}
        {stage === 'confidence' && (
          <ConfidencePicker
            topicId={topic.topicId}
            onDone={async () => {
              if (!result) await call(window.imc.sessionComplete(sessionId))
              setStage('done')
              go(back)
            }}
          />
        )}
      </div>
    )
  }

  if (spec.mode === 'ospe') {
    const notes = (spec.topicIds ?? []).flatMap((id) => (pack.topics[id]?.ospe ?? []).map((o) => ({ ...o, topicId: id })))
    return (
      <div className="page">
        {header}
        <div className="card">
          <h2>Slides to look at</h2>
          <p className="muted">For each figure: open the book at the page, decide what it shows, then check the note. Then answer the questions below.</p>
          {notes.length === 0 && <p className="muted">No figure notes for these topics yet.</p>}
          {notes.map((o) => (
            <OspeNoteView key={o.id} note={o} />
          ))}
        </div>
        {questionIds.length > 0 ? (
          <TutorRun sessionId={sessionId} questionIds={questionIds} onDone={setResult} />
        ) : (
          <button
            className="btn primary"
            onClick={async () => {
              const r = await call(window.imc.sessionComplete(sessionId))
              if (r) go(back)
            }}
          >
            ✔ Done
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      {header}
      {spec.mode === 'exam' ? (
        <ExamRun sessionId={sessionId} questionIds={questionIds} minutes={spec.minutes ?? 60} onDone={setResult} />
      ) : (
        <TutorRun
          sessionId={sessionId}
          questionIds={questionIds}
          onDone={(r) => {
            setResult(r)
            if (spec.kind === 'topic-quiz') setStage('confidence')
          }}
        />
      )}
      {stage === 'confidence' && spec.topicId && <ConfidencePicker topicId={spec.topicId} onDone={() => setStage('done')} />}
    </div>
  )
}

function OspeNoteView({ note }: { note: TopicContent['ospe'][number] & { topicId: string } }): ReactNode {
  const { pack } = useApp()
  const [show, setShow] = useState(false)
  const img = note.image ? pack.images[note.image] : undefined
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
      <Cites cites={[note.cite]} />
      {img && (img as { dataUrl?: string }).dataUrl && (
        <figure style={{ margin: 0 }}>
          <img className="ospe-img" src={(img as { dataUrl?: string }).dataUrl} alt={img.title} />
          <figcaption className="faint">
            {img.title} — {img.author}, {img.license} ({img.source})
          </figcaption>
        </figure>
      )}
      {show ? (
        <div className="feedback ok">
          <Md text={note.identify} />
        </div>
      ) : (
        <button className="btn sm" onClick={() => setShow(true)}>
          Show what to identify
        </button>
      )}
    </div>
  )
}
