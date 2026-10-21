/** Shared UI pieces. Content text is rendered as React text nodes only — never raw HTML (SECURITY §4). */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Block, Book, Citation } from '@shared/content-schema'
import { formatDate, weekdayShort } from '@shared/dates'
import type { Band } from '@shared/engine/stats'
import type { TaskFlag, TaskStatus } from '@shared/engine/status'
import type { TaskType } from '@shared/progress-schema'
import { useApp } from '../state/app'

/** Markdown subset: **bold** and _italic_, newlines → <br/>. */
export function Md({ text }: { text: string }): ReactNode {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*|_[^_\s][^_]*_)/g).map((part, i) => {
            if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
            if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
            return <Fragment key={i}>{part}</Fragment>
          })}
        </Fragment>
      ))}
    </>
  )
}

export function citeText(c: Citation, books: Book[]): string {
  const b = books.find((x) => x.id === c.book)
  const name = b?.short ?? c.book
  const pages = c.pageEnd && c.pageEnd !== c.page ? `pp. ${c.page}–${c.pageEnd}` : `p. ${c.page}`
  const ebook = b?.pageKind === 'ebook' ? ' (e-book)' : c.pdfPage && c.pdfPage !== c.page ? ` (e-book p. ${c.pdfPage})` : ''
  return [name, c.chapter, c.figure, c.table, `${pages}${ebook}`].filter(Boolean).join(' · ')
}

export function Cites({ cites }: { cites: Citation[] }): ReactNode {
  const { pack, toast } = useApp()
  return (
    <div className="cites">
      {cites.map((c, i) => {
        const t = citeText(c, pack.books)
        return (
          <button
            key={i}
            className="cite"
            title="Copy citation"
            onClick={() => {
              void navigator.clipboard?.writeText(t)
              toast(`Copied: ${t}`)
            }}
          >
            📖 {t}
          </button>
        )
      })}
    </div>
  )
}

export function FlagButton({ contentId }: { contentId: string }): ReactNode {
  const { call } = useApp()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  return (
    <>
      <button className="flag-btn" title="Report an error in this content" onClick={() => setOpen(true)}>
        ⚑ Report
      </button>
      {open && (
        <Modal title="Report a content error" onClose={() => setOpen(false)}>
          <p className="muted">
            This opens a pre-filled GitHub issue in your browser for <code>{contentId}</code>. Say what is wrong and which book page supports the correction. Please
            don’t paste text from the books.
          </p>
          <textarea className="input" rows={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} aria-label="What is wrong" />
          <div className="modal-actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                void call(window.imc.reportOpenIssue({ contentId, comment: text }))
                setOpen(false)
                setText('')
              }}
            >
              Open GitHub issue
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function BlockView({ block, id }: { block: Block; id: string }): ReactNode {
  switch (block.type) {
    case 'para':
      return (
        <div className="block">
          <p>
            <Md text={block.text} />
          </p>
          <Cites cites={block.cites} />
        </div>
      )
    case 'bullets':
      return (
        <div className="block">
          {block.title && <div className="b-title">{block.title}</div>}
          <ul>
            {block.items.map((it, i) => (
              <li key={i}>
                <Md text={it} />
              </li>
            ))}
          </ul>
          <Cites cites={block.cites} />
        </div>
      )
    case 'table':
      return (
        <div className="block">
          {block.title && <div className="b-title">{block.title}</div>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {block.columns.map((c, i) => (
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>
                        <Md text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Cites cites={block.cites} />
        </div>
      )
    case 'pearl':
    case 'pitfall':
      return (
        <div className={`block ${block.type}`}>
          <strong>{block.type === 'pearl' ? '⭐ High-yield: ' : '⚠ Pitfall: '}</strong>
          <Md text={block.text} />
          <Cites cites={block.cites} />
        </div>
      )
    case 'diagram':
      return (
        <div className="block">
          <img className="diagram" src={svgDataUri(block.svg)} alt={block.alt} />
          <div className="faint">{block.alt}</div>
          <Cites cites={block.cites} />
        </div>
      )
    case 'figureRef':
      return (
        <div className="block figref" id={id}>
          <strong>📖 Look in the book: </strong>
          <Md text={block.note} />
          <Cites cites={[block.cite]} />
        </div>
      )
  }
}

const TYPE_LABEL: Record<TaskType | 'review', [string, string]> = {
  new: ['New study', 'type-new'],
  skim: ['Skim', 'type-new'],
  rapid: ['Rapid review', 'type-final'],
  'revision-pass': ['Revision pass', 'type-rev'],
  review: ['Revision', 'type-rev'],
  questions: ['Questions', 'type-q'],
  ospe: ['OSPE', 'type-q'],
  weak: ['Weak areas', 'type-weak'],
  'chapter-exam': ['Chapter exam', 'type-q'],
  mock: ['Mock exam', 'type-exam'],
  'mock-review': ['Mock review', 'type-exam'],
  'final-revision': ['Final revision', 'type-final'],
  exam: ['Exam', 'type-exam']
}
export function TypeChip({ type }: { type: TaskType | 'review' }): ReactNode {
  const [label, cls] = TYPE_LABEL[type]
  return <span className={`chip type-chip ${cls}`}>{label}</span>
}

export function FlagChip({ flag, status }: { flag: TaskFlag; status?: TaskStatus }): ReactNode {
  if (flag === 'done') return <span className="chip good">✔ Done</span>
  if (flag === 'skipped') return <span className="chip neutral">Skipped</span>
  if (flag === 'pending') return <span className="chip neutral">⏳ Content pending</span>
  if (flag === 'overdue') return <span className="chip danger">⚠ Overdue</span>
  if (flag === 'catch-up') return <span className="chip warn">Catch up</span>
  if (flag === 'today') return <span className="chip info">● Today{status === 'in-progress' ? ' · in progress' : ''}</span>
  return <span className="chip neutral">{status === 'in-progress' ? 'In progress' : 'Upcoming'}</span>
}

export function BandChip({ band, accuracy }: { band: Band; accuracy?: number | null }): ReactNode {
  const pct = accuracy != null ? ` ${Math.round(accuracy * 100)}%` : ''
  if (band === 'weak') return <span className="chip danger">⚠ Weak{pct}</span>
  if (band === 'borderline') return <span className="chip warn">Borderline{pct}</span>
  if (band === 'strong') return <span className="chip good">✔ Strong{pct}</span>
  return <span className="chip neutral">Not started</span>
}

export function Bar({ value, good, big }: { value: number; good?: boolean; big?: boolean }): ReactNode {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={`bar ${good ? 'good' : ''} ${big ? 'big' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }): ReactNode {
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Menu({ label, items }: { label: string; items: Array<{ label: string; onClick(): void }> }): ReactNode {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button className="btn ghost sm" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⋯
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }): ReactNode {
  return (
    <div className="empty card">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export const fmtDay = (d: string): string => `${weekdayShort(d)} ${formatDate(d)}`
export const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v * 100)}%`)
export const hrs = (h: number): string => `${Math.round(h * 100) / 100} h`
