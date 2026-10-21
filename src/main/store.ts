/**
 * Local JSON progress store (ADR-0002, docs/05 §7): the only code that touches progress.json.
 * Atomic writes, coalesced commits, daily snapshots, pre-action backups, corruption fallback,
 * forward-only migrations, read-only mode for newer schemas.
 */
import { promises as fs } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { todayLocal } from '@shared/dates'
import { ProgressSchema, SCHEMA_VERSION, emptyProgress, type Progress } from '@shared/progress-schema'

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const SNAPSHOTS_KEPT = 14
export const BACKUP_NAME_RE = /^(progress-\d{4}-\d{2}-\d{2}|pre-(import|restore|migration|rebuild)-\d{8}T\d{6})\.json$/
const SNAPSHOT_RE = /^progress-\d{4}-\d{2}-\d{2}\.json$/
const COALESCE_MS = 500

export class StoreError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export interface StoreMeta {
  readOnly: boolean
  restoredFromBackup: boolean
}

export interface StoreOptions {
  now?: () => Date
  rename?: (from: string, to: string) => Promise<void>
  sleep?: (ms: number) => Promise<void>
  migrations?: Record<number, Migration>
  coalesceMs?: number
}

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>
const MIGRATIONS: Record<number, Migration> = {}

export function timestamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function parseProgressText(
  text: string,
  migrations: Record<number, Migration> = MIGRATIONS
): { state: Progress; migrated: boolean } | { error: string; tooNew?: boolean } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: 'The file is not valid JSON' }
  }
  if (typeof raw !== 'object' || raw === null) return { error: 'The file is not a progress file' }
  let obj = raw as Record<string, unknown>
  let v = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : NaN
  if (v > SCHEMA_VERSION) return { error: 'This file was made by a newer version of the app', tooNew: true }
  let migrated = false
  while (v < SCHEMA_VERSION) {
    const step = migrations[v]
    if (!step) break
    obj = { ...step(obj), schemaVersion: v + 1 }
    v++
    migrated = true
  }
  const r = ProgressSchema.safeParse(obj)
  if (!r.success) return { error: `The file failed validation (${r.error.issues[0]?.path.join('.') ?? ''}: ${r.error.issues[0]?.message ?? ''})` }
  return { state: r.data, migrated }
}

export class Store {
  readonly dataFile: string
  readonly backupsDir: string
  state: Progress
  meta: StoreMeta = { readOnly: false, restoredFromBackup: false }
  private queue: Promise<unknown> = Promise.resolve()
  private dirty = false
  private timer: NodeJS.Timeout | null = null
  private readonly now: () => Date
  private readonly renameFn: (from: string, to: string) => Promise<void>
  private readonly sleep: (ms: number) => Promise<void>
  private readonly migrations: Record<number, Migration> | undefined
  private readonly coalesceMs: number

  constructor(
    readonly dir: string,
    opts: StoreOptions = {}
  ) {
    this.dataFile = join(dir, 'progress.json')
    this.backupsDir = join(dir, 'backups')
    this.now = opts.now ?? (() => new Date())
    this.renameFn = opts.rename ?? fs.rename
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.migrations = opts.migrations
    this.coalesceMs = opts.coalesceMs ?? COALESCE_MS
    this.state = emptyProgress(this.now().toISOString())
  }

  async load(): Promise<void> {
    await fs.mkdir(this.backupsDir, { recursive: true })
    let text: string
    try {
      text = await fs.readFile(this.dataFile, 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return
      throw e
    }
    const r = parseProgressText(text, this.migrations)
    if ('state' in r) {
      this.state = r.state
      if (r.migrated) {
        await this.copyToBackup(`pre-migration-${timestamp(this.now())}.json`)
        await this.writeAtomic(r.state)
      }
      return
    }
    if (r.tooNew) {
      this.meta.readOnly = true
      return
    }
    await this.renameFn(this.dataFile, join(this.dir, `progress.corrupt-${timestamp(this.now())}.json`))
    for (const b of await this.listBackups()) {
      const c = parseProgressText(await fs.readFile(join(this.backupsDir, b.name), 'utf8'), this.migrations)
      if ('state' in c) {
        this.state = c.state
        this.meta.restoredFromBackup = true
        await this.writeAtomic(c.state)
        return
      }
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const p = this.queue.then(task, task)
    this.queue = p.catch(() => undefined)
    return p
  }

  /**
   * Apply `fn` to the current state, validate, and schedule a coalesced atomic write (≤ 1 per 500 ms).
   * The in-memory state updates immediately so derived views are current.
   */
  update(fn: (current: Progress) => Progress): Progress {
    if (this.meta.readOnly) throw new StoreError('READ_ONLY', 'Progress is read-only: it was saved by a newer version of the app')
    const next = fn(this.state)
    if (next === this.state) return next
    const r = ProgressSchema.safeParse(next)
    if (!r.success) throw new StoreError('INTEGRITY', `Refusing to save invalid progress: ${r.error.issues[0]?.path.join('.')}: ${r.error.issues[0]?.message}`)
    this.state = r.data
    this.dirty = true
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), this.coalesceMs)
    return r.data
  }

  hasPending(): boolean {
    return this.dirty
  }

  /** Write pending changes now (called on quit, before backups, and by the coalesce timer). */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    return this.enqueue(async () => {
      if (!this.dirty) return
      this.dirty = false
      await this.snapshotIfNeeded()
      await this.writeAtomic(this.state)
    })
  }

  async listBackups(): Promise<Array<{ name: string; size: number; modified: string }>> {
    let names: string[]
    try {
      names = await fs.readdir(this.backupsDir)
    } catch {
      return []
    }
    const out = []
    for (const name of names.filter((n) => BACKUP_NAME_RE.test(n))) {
      const st = await fs.stat(join(this.backupsDir, name))
      out.push({ name, size: st.size, modified: st.mtime.toISOString() })
    }
    return out.sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : a.name < b.name ? 1 : -1))
  }

  async readBackup(name: string): Promise<Progress> {
    if (!BACKUP_NAME_RE.test(name)) throw new StoreError('BAD_NAME', 'Invalid backup name')
    const full = resolve(this.backupsDir, name)
    if (!full.startsWith(resolve(this.backupsDir) + sep)) throw new StoreError('BAD_NAME', 'Invalid backup name')
    return this.readProgressFile(full)
  }

  async readProgressFile(path: string): Promise<Progress> {
    const st = await fs.stat(path)
    if (st.size > MAX_FILE_BYTES) throw new StoreError('TOO_LARGE', 'File is larger than 20 MB')
    const r = parseProgressText(await fs.readFile(path, 'utf8'), this.migrations)
    if ('error' in r) throw new StoreError(r.tooNew ? 'TOO_NEW' : 'INVALID_FILE', r.error)
    return r.state
  }

  /** Write a named pre-action backup of the current state (flushes first). */
  async backup(kind: 'import' | 'restore' | 'rebuild'): Promise<string> {
    await this.flush()
    const name = `pre-${kind}-${timestamp(this.now())}.json`
    await this.enqueue(() => this.copyToBackup(name))
    return name
  }

  /** Replace all progress after a pre-<kind> backup. */
  async replaceAll(next: Progress, kind: 'import' | 'restore'): Promise<void> {
    if (this.meta.readOnly) throw new StoreError('READ_ONLY', 'Progress is read-only: it was saved by a newer version of the app')
    await this.backup(kind)
    this.update(() => next)
    await this.flush()
  }

  exportTo(path: string): Promise<void> {
    return this.flush().then(() =>
      this.enqueue(async () => {
        if (this.meta.readOnly) await fs.copyFile(this.dataFile, path)
        else await fs.writeFile(path, JSON.stringify(this.state, null, 1), 'utf8')
      })
    )
  }

  private async copyToBackup(name: string): Promise<void> {
    try {
      await fs.copyFile(this.dataFile, join(this.backupsDir, name))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
  }

  private async snapshotIfNeeded(): Promise<void> {
    const target = join(this.backupsDir, `progress-${todayLocal(this.now())}.json`)
    try {
      await fs.access(target)
      return
    } catch {
      /* not yet today */
    }
    await this.copyToBackup(`progress-${todayLocal(this.now())}.json`)
    const snaps = (await fs.readdir(this.backupsDir)).filter((n) => SNAPSHOT_RE.test(n)).sort()
    for (const old of snaps.slice(0, Math.max(0, snaps.length - SNAPSHOTS_KEPT))) await fs.rm(join(this.backupsDir, old), { force: true })
  }

  private async writeAtomic(state: Progress): Promise<void> {
    const tmp = `${this.dataFile}.tmp`
    const fh = await fs.open(tmp, 'w')
    try {
      await fh.writeFile(JSON.stringify(state), 'utf8')
      await fh.sync()
    } finally {
      await fh.close()
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await this.renameFn(tmp, this.dataFile)
        return
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code
        if ((code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') && attempt < 5) {
          await this.sleep(50 * 2 ** attempt)
          continue
        }
        throw e
      }
    }
  }
}
