/**
 * "Is there a newer release?" (ADR-0008). One GET to the GitHub releases API, 6 h cache, Atom fallback on
 * 403/429 (campus NAT, QA N9). The response is zod-validated and only shown as text; the Download button
 * always opens the hardcoded RELEASES_URL (07 T1b). Never downloads or installs anything.
 */
import { z } from 'zod'
import { RELEASES_API, RELEASES_ATOM, type UpdateStatus } from '@shared/ipc'

export const CACHE_MS = 6 * 3_600_000
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/

export function parseSemver(v: string): [number, number, number] | null {
  const m = SEMVER.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest)
  const b = parseSemver(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! > b[i]!
  return false
}

const ApiRelease = z.object({ tag_name: z.string().max(40), name: z.string().max(200).nullable().optional() })

export function parseAtom(xml: string): { tag: string; title: string } | null {
  const entry = /<entry>([\s\S]*?)<\/entry>/.exec(xml)?.[1]
  if (!entry) return null
  const tag = /\/releases\/tag\/([^"<\s]+)/.exec(entry)?.[1]
  const title = /<title>([^<]{1,200})<\/title>/.exec(entry)?.[1] ?? ''
  return tag && parseSemver(decodeURIComponent(tag)) ? { tag: decodeURIComponent(tag), title } : null
}

export type Fetcher = (url: string, accept: string) => Promise<{ status: number; text: string }>

export async function fetchLatest(fetcher: Fetcher): Promise<{ latest: string; title: string } | null> {
  try {
    const r = await fetcher(RELEASES_API, 'application/vnd.github+json')
    if (r.status === 200) {
      const parsed = ApiRelease.safeParse(JSON.parse(r.text))
      if (parsed.success && parseSemver(parsed.data.tag_name)) return { latest: parsed.data.tag_name, title: parsed.data.name ?? parsed.data.tag_name }
      return null
    }
    if (r.status !== 403 && r.status !== 429) return null
  } catch {
    /* fall through to Atom */
  }
  try {
    const r = await fetcher(RELEASES_ATOM, 'application/atom+xml')
    if (r.status !== 200) return null
    const a = parseAtom(r.text)
    return a ? { latest: a.tag, title: a.title } : null
  } catch {
    return null
  }
}

export interface CachedCheck {
  at: string
  latest: string | null
  title: string | null
}

export async function checkForUpdate(
  current: string,
  cached: CachedCheck | undefined,
  now: Date,
  fetcher: Fetcher,
  force: boolean
): Promise<{ status: UpdateStatus; cache: CachedCheck | null }> {
  if (!force && cached && now.getTime() - Date.parse(cached.at) < CACHE_MS) {
    return {
      status: { current, latest: cached.latest, title: cached.title, newer: !!cached.latest && isNewer(cached.latest, current), checkedAt: cached.at },
      cache: null
    }
  }
  const r = await fetchLatest(fetcher)
  if (!r) return { status: { current, latest: cached?.latest ?? null, title: cached?.title ?? null, newer: !!cached?.latest && isNewer(cached.latest, current), checkedAt: cached?.at ?? null }, cache: null }
  const cache = { at: now.toISOString(), latest: r.latest, title: r.title }
  return { status: { current, latest: r.latest, title: r.title, newer: isNewer(r.latest, current), checkedAt: cache.at }, cache }
}
