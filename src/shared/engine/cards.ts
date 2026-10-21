/** Flashcard scheduling — docs/05 R-11 (small SM-2 variant). Derived from card review events. */
import { addDays, minDate, studyDate, type ISODate } from '../dates'
import type { CardReview } from '../progress-schema'

export interface CardState {
  ease: number
  interval: number
  reviews: number
  lastReview: ISODate | null
  /** null = new (never reviewed). */
  due: ISODate | null
}

const clampEase = (e: number): number => Math.min(3, Math.max(1.3, Math.round(e * 100) / 100))

export function nextState(s: Pick<CardState, 'ease' | 'interval'>, grade: CardReview['grade']): { ease: number; interval: number } {
  const good = s.interval === 0 ? 1 : s.interval === 1 ? 3 : Math.round(s.interval * s.ease)
  switch (grade) {
    case 'again':
      return { ease: clampEase(s.ease - 0.2), interval: 0 }
    case 'hard':
      return { ease: clampEase(s.ease - 0.15), interval: Math.max(1, Math.round(s.interval * 1.2)) }
    case 'good':
      return { ease: s.ease, interval: good }
    case 'easy':
      return { ease: clampEase(s.ease + 0.15), interval: Math.round(good * 1.3) }
  }
}

/** Fold a card's reviews (any order) into its state; due is capped at `examDate − 1` of the active track. */
export function cardState(reviews: CardReview[], dayStartHour: number, examDate?: ISODate): CardState {
  let st = { ease: 2.5, interval: 0 }
  let last: ISODate | null = null
  const sorted = [...reviews].sort((a, b) => (a.at < b.at ? -1 : 1))
  for (const r of sorted) {
    st = nextState(st, r.grade)
    last = studyDate(r.at, dayStartHour)
  }
  let due: ISODate | null = last ? addDays(last, st.interval) : null
  if (due && examDate) due = minDate(due, addDays(examDate, -1))
  return { ...st, reviews: sorted.length, lastReview: last, due }
}

export function isDue(state: CardState, today: ISODate): boolean {
  return state.due !== null && state.due <= today
}
