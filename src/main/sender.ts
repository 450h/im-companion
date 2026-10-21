/**
 * Trusted-URL checks for IPC senders and navigation (SECURITY §11).
 * app:// has an opaque origin ("null"), so compare protocol + host, never `origin`.
 */
export const APP_PROTOCOL = 'app:'
export const APP_HOST = 'imc'

/** True only for our own UI: app://imc/… in production, the exact dev-server origin in dev. */
export function isTrustedUrl(url: string, devUrl?: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (devUrl) {
    try {
      const d = new URL(devUrl)
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === d.origin
    } catch {
      return false
    }
  }
  return u.protocol === APP_PROTOCOL && u.host === APP_HOST
}

export interface FrameLike {
  url: string
  parent: unknown
}

/** Sender must exist, be a top-level frame, and be our own UI. */
export function isTrustedFrame(frame: FrameLike | null | undefined, devUrl?: string): boolean {
  if (!frame) return false
  if (frame.parent !== null) return false
  return isTrustedUrl(frame.url, devUrl)
}
