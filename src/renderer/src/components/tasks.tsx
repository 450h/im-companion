/** Task rows and "Start" actions: each task type maps to a study mode (docs/06 §2). */
import type { ReactNode } from 'react'
import { weakTopics } from '@shared/engine/stats'
import { questionTopics, type Review } from '@shared/engine/status'
import type { Task } from '@shared/progress-schema'
import { useApp, type TaskView } from '../state/app'
import { FlagChip, Menu, TypeChip, fmtDay, hrs } from './ui'

export function useTaskActions(): { start(t: Task): void; startReview(r: Review): void; override(t: Task, status: 'done' | 'skipped' | 'reset'): void } {
  const app = useApp()
  const { go, startSession, derived, pack, call, track } = app
  const exams = new Map(pack.exams.map((e) => [e.id, e]))
  const title = (id: string): string => app.topicMeta(id)?.title ?? id
  return {
    start(t) {
      switch (t.type) {
        case 'new':
          return go({ name: 'study', topicId: t.topicIds[0], taskId: t.id })
        case 'revision-pass':
          return go({ name: 'study', topicId: t.topicIds[0], taskId: t.id })
        case 'skim':
        case 'rapid':
        case 'final-revision':
          return startSession({ kind: 'rapid-review', topicIds: t.topicIds, taskId: t.id, title: t.title, mode: 'rapid' })
        case 'questions': {
          const ids = questionTopics(t, derived.f).filter((id) => pack.topics[id])
          return startSession({ kind: 'practice', topicIds: ids, count: t.target ?? 15, taskId: t.id, title: `Questions: ${ids.map(title).join(', ')}`, mode: 'tutor' })
        }
        case 'ospe': {
          const recent = [...derived.f.entries()].filter(([id]) => pack.topics[id]).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 3).map(([id]) => id)
          const ids = recent.length ? recent : t.topicIds
          return startSession({ kind: 'ospe', topicIds: ids, taskId: t.id, title: 'OSPE practice', mode: 'ospe' })
        }
        case 'weak': {
          const ids = weakTopics(derived.stats, derived.f).filter((id) => pack.topics[id])
          return startSession({ kind: 'weak-drill', topicIds: ids.length ? ids : [...derived.f.keys()].filter((id) => pack.topics[id]).slice(0, 3), taskId: t.id, title: 'Weak areas drill', mode: 'tutor' })
        }
        case 'chapter-exam':
        case 'mock': {
          const e = t.examId ? exams.get(t.examId) : undefined
          if (!e) return app.toast('This exam arrives in a coming update — tick it done when you have practised another way.')
          return startSession({ kind: 'exam', examId: e.id, taskId: t.id, title: e.title, mode: 'exam', minutes: e.minutes })
        }
        case 'mock-review':
          return go({ name: 'progress' })
        case 'exam':
          return
      }
    },
    startReview(r) {
      startSession({ kind: 'review', topicId: r.topicId, title: `Review R${r.k}: ${title(r.topicId)}`, mode: 'review' })
    },
    override(t, status) {
      if (!track) return
      void call(window.imc.planOverride({ track, taskId: t.id, status }), status === 'reset' ? 'Task reset' : status === 'done' ? 'Marked done' : 'Skipped')
    }
  }
}

const START_LABEL: Partial<Record<Task['type'], string>> = {
  new: 'Study',
  'revision-pass': 'Revise',
  skim: 'Skim',
  rapid: 'Review',
  'final-revision': 'Review',
  questions: 'Practise',
  ospe: 'Start',
  weak: 'Drill',
  'chapter-exam': 'Start exam',
  mock: 'Start mock'
}

export function TaskRow({ v, showDate }: { v: TaskView; showDate?: boolean }): ReactNode {
  const { start, override } = useTaskActions()
  const { app } = { app: useApp() }
  const t = v.task
  const done = v.status === 'done' || v.status === 'skipped'
  const manual = v.status === 'manual'
  const pending = v.status === 'pending'
  return (
    <div className={`task ${done ? 'done' : ''}`}>
      <span className="s-no">S{t.session}</span>
      <div className="stack" style={{ gap: 2 }}>
        <div className="row">
          <TypeChip type={t.type} />
          <span className="t-title">{t.title}</span>
        </div>
        <div className="row faint">
          {showDate && <span>{fmtDay(t.date)}</span>}
          <span>{hrs(t.plannedHours)}</span>
          {t.target && <span>· target {t.target} questions</span>}
          <FlagChip flag={v.flag} status={v.status} />
          {manual && !done && <span className="chip neutral">tick when done</span>}
        </div>
      </div>
      <div className="task-actions">
        {pending && t.topicIds[0] && (
          <button className="btn sm" onClick={() => void app.call(window.imc.topicSetStudied({ topicId: t.topicIds[0]!, studied: true }), 'Logged as studied from the book')}>
            Studied from the book
          </button>
        )}
        {!done && !pending && !manual && t.type !== 'exam' && START_LABEL[t.type] && (
          <button className="btn primary sm" onClick={() => start(t)}>
            {START_LABEL[t.type]}
          </button>
        )}
        {manual && !done && (
          <button className="btn sm" onClick={() => override(t, 'done')}>
            ✔ Done
          </button>
        )}
        {t.type !== 'exam' && (
          <Menu
            label="Task options"
            items={[
              ...(!done ? [{ label: 'Mark done', onClick: () => override(t, 'done') }, { label: 'Skip', onClick: () => override(t, 'skipped') }] : []),
              { label: 'Reset', onClick: () => override(t, 'reset') }
            ]}
          />
        )}
      </div>
    </div>
  )
}

export function ReviewRow({ r }: { r: Review }): ReactNode {
  const { startReview } = useTaskActions()
  const app = useApp()
  const overdue = !r.done && r.due < app.derived.today
  const available = !!app.pack.topics[r.topicId]
  return (
    <div className={`task ${r.done ? 'done' : ''}`}>
      <span className="s-no">R{r.k}</span>
      <div className="stack" style={{ gap: 2 }}>
        <div className="row">
          <TypeChip type="review" />
          <span className="t-title">{app.topicMeta(r.topicId)?.title}</span>
        </div>
        <div className="row faint">
          <span>{fmtDay(r.due)}</span>
          <span>{hrs(r.hours)}</span>
          {r.done ? <span className="chip good">✔ Done</span> : overdue ? <span className="chip danger">⚠ Overdue</span> : r.due === app.derived.today ? <span className="chip info">● Today</span> : null}
        </div>
      </div>
      <div className="task-actions">
        {!r.done && available && (
          <button className="btn primary sm" onClick={() => startReview(r)}>
            Review
          </button>
        )}
      </div>
    </div>
  )
}
