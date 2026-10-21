/** Store durability (ADR-0002, docs/05 §7) and release check (ADR-0008). */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptyProgress } from '@shared/progress-schema'
import { checkForUpdate, isNewer, parseAtom, type Fetcher } from './release-check'
import { Store, StoreError } from './store'

const dir = (): string => mkdtempSync(join(tmpdir(), 'imc-store-'))

describe('store', () => {
  it('coalesced atomic write + daily snapshot, reload round-trips', async () => {
    const d = dir()
    const s = new Store(d, { coalesceMs: 5 })
    await s.load()
    s.update((p) => ({ ...p, settings: { ...p.settings, fontScale: 1.2 } }))
    s.update((p) => ({ ...p, settings: { ...p.settings, dayStartHour: 3 } }))
    await s.flush()
    const s2 = new Store(d)
    await s2.load()
    expect(s2.state.settings.fontScale).toBe(1.2)
    expect(s2.state.settings.dayStartHour).toBe(3)
    s2.update((p) => ({ ...p, settings: { ...p.settings, fontScale: 1.3 } }))
    await s2.flush()
    expect(readdirSync(join(d, 'backups')).some((n) => n.startsWith('progress-'))).toBe(true)
  })

  it('refuses invalid state', async () => {
    const s = new Store(dir())
    await s.load()
    expect(() => s.update((p) => ({ ...p, settings: { ...p.settings, dayStartHour: 99 } }))).toThrow(StoreError)
  })

  it('corrupt file → newest valid backup restored, corrupt file kept', async () => {
    const d = dir()
    const s = new Store(d, { coalesceMs: 1 })
    await s.load()
    s.update((p) => ({ ...p, settings: { ...p.settings, fontScale: 1.4 } }))
    await s.flush()
    s.update((p) => ({ ...p, settings: { ...p.settings, fontScale: 1.5 } }))
    await s.flush() // snapshot now holds 1.4
    writeFileSync(join(d, 'progress.json'), '{not json')
    const s2 = new Store(d)
    await s2.load()
    expect(s2.meta.restoredFromBackup).toBe(true)
    expect(s2.state.settings.fontScale).toBe(1.4)
    expect(readdirSync(d).some((n) => n.startsWith('progress.corrupt-'))).toBe(true)
  })

  it('newer schemaVersion opens read-only and never writes', async () => {
    const d = dir()
    const future = { ...emptyProgress('2026-10-21T00:00:00.000Z'), schemaVersion: 99 }
    writeFileSync(join(d, 'progress.json'), JSON.stringify(future))
    const s = new Store(d)
    await s.load()
    expect(s.meta.readOnly).toBe(true)
    expect(() => s.update((p) => ({ ...p, settings: { ...p.settings, fontScale: 1.1 } }))).toThrow(StoreError)
    expect(JSON.parse(readFileSync(join(d, 'progress.json'), 'utf8')).schemaVersion).toBe(99)
  })

  it('import rejects invalid files and unknown backup names', async () => {
    const d = dir()
    const s = new Store(d)
    await s.load()
    const bad = join(d, 'bad.json')
    writeFileSync(bad, JSON.stringify({ schemaVersion: 1, hacked: true }))
    await expect(s.readProgressFile(bad)).rejects.toThrow(StoreError)
    await expect(s.readBackup('../progress.json')).rejects.toThrow(StoreError)
  })
})

describe('release check', () => {
  it('semver comparison', () => {
    expect(isNewer('v0.2.0', '0.1.9')).toBe(true)
    expect(isNewer('v0.1.0', '0.1.0')).toBe(false)
    expect(isNewer('v1.0.0', '0.9.9')).toBe(true)
    expect(isNewer('garbage', '0.1.0')).toBe(false)
  })
  it('API result, cache, and Atom fallback on 403', async () => {
    const api: Fetcher = async () => ({ status: 200, text: JSON.stringify({ tag_name: 'v0.2.0', name: 'Cardio + flashcards' }) })
    const r = await checkForUpdate('0.1.0', undefined, new Date('2026-10-29T10:00:00Z'), api, false)
    expect(r.status.newer).toBe(true)
    expect(r.cache?.latest).toBe('v0.2.0')
    const cached = await checkForUpdate('0.1.0', r.cache!, new Date('2026-10-29T12:00:00Z'), async () => {
      throw new Error('should use cache')
    }, false)
    expect(cached.status.latest).toBe('v0.2.0')
    const limited: Fetcher = async (url) =>
      url.endsWith('.atom')
        ? { status: 200, text: '<feed><entry><title>v0.3.0</title><link href="https://github.com/450h/im-companion/releases/tag/v0.3.0"/></entry></feed>' }
        : { status: 403, text: '' }
    const r2 = await checkForUpdate('0.2.0', undefined, new Date(), limited, true)
    expect(r2.status.latest).toBe('v0.3.0')
    expect(r2.status.newer).toBe(true)
  })
  it('ignores malformed responses and offline errors', async () => {
    const junk: Fetcher = async () => ({ status: 200, text: '{"tag_name": 42}' })
    expect((await checkForUpdate('0.1.0', undefined, new Date(), junk, true)).status.newer).toBe(false)
    const offline: Fetcher = async () => {
      throw new Error('offline')
    }
    expect((await checkForUpdate('0.1.0', undefined, new Date(), offline, true)).status.newer).toBe(false)
    expect(parseAtom('<feed></feed>')).toBeNull()
  })
})
