/**
 * Local calendar dates as `YYYY-MM-DD` strings and months as `YYYY-MM`.
 * Arithmetic goes through UTC day numbers so DST and time zones never matter.
 * Never use `new Date('YYYY-MM-DD')` elsewhere (that parses as UTC midnight).
 */

export type ISODate = string
export type MonthKey = string

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/
const MS_PER_DAY = 86_400_000

const pad2 = (n: number): string => String(n).padStart(2, '0')

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return y >= 1900 && y <= 2999 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}

export function isValidMonth(s: string): boolean {
  const m = MONTH_RE.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  return y >= 1900 && y <= 2999 && mo >= 1 && mo <= 12
}

export function parts(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return { y, m, d }
}

export function makeDate(y: number, m: number, d: number): ISODate {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function toDayNumber(date: ISODate): number {
  const { y, m, d } = parts(date)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * MS_PER_DAY)
  return makeDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromDayNumber(toDayNumber(date) + n)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a)
}

export function todayLocal(now: Date = new Date()): ISODate {
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7)
}

export function monthParts(month: MonthKey): { y: number; m: number } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return { y, m }
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const { y, m } = monthParts(month)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`
}

/** The date of `day` in `month`, clamped to the month's last day. */
export function clampedDayIn(month: MonthKey, day: number): ISODate {
  const { y, m } = monthParts(month)
  return makeDate(y, m, Math.min(day, daysInMonth(y, m)))
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b
}

/** Inclusive list of dates from `a` to `b` (empty when b < a). */
export function dateRange(a: ISODate, b: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
  return out
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(date: ISODate, withYear = false): string {
  const { y, m, d } = parts(date)
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`
}

export function formatMonth(month: MonthKey): string {
  const { y, m } = monthParts(month)
  return `${MONTHS[m - 1]} ${y}`
}

export function weekdayShort(date: ISODate): string {
  const { y, m, d } = parts(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!
}

/* ---------------------------------------------------------------- study-day helpers (docs/05 §3) */

/** 0 = Sunday … 6 = Saturday. */
export function weekdayIndex(date: ISODate): number {
  const { y, m, d } = parts(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * The study date a moment belongs to: its local date after subtracting the day-start hour,
 * so a session at 00:30 counts for the previous day (QA N5).
 */
export function studyDate(at: Date | string, dayStartHour = 4): ISODate {
  const t = typeof at === 'string' ? new Date(at) : at
  return todayLocal(new Date(t.getTime() - dayStartHour * 3_600_000))
}

/** The Sunday on or before `date`. */
export function weekStart(date: ISODate): ISODate {
  return addDays(date, -weekdayIndex(date))
}

/** Plan week number: whole weeks from the Sunday on or before `start`, plus 1 (Excel convention). */
export function planWeek(start: ISODate, date: ISODate): number {
  return Math.floor(diffDays(weekStart(start), date) / 7) + 1
}

export function isValidISODateTime(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s))
}
