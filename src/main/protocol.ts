/** app:// protocol for packaged builds (SECURITY §11): no file://, CSP as a response header. */
import { promises as fs } from 'node:fs'
import { extname, normalize, resolve, sep } from 'node:path'
import { protocol } from 'electron'

export const APP_SCHEME = 'app'
export const APP_ORIGIN = 'app://imc'

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2'
}

/** Must run before app 'ready'. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true } }])
}

/** Resolve a request path inside `root`; null if it escapes. */
export function resolveInside(root: string, urlPath: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  const rel = normalize(decoded === '/' || decoded === '' ? '/index.html' : decoded).replace(/^[\\/]+/, '')
  const full = resolve(root, rel)
  const base = resolve(root)
  return full === base || full.startsWith(base + sep) ? full : null
}

export function handleAppScheme(rendererDir: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const file = url.host === 'imc' ? resolveInside(rendererDir, url.pathname) : null
    if (!file) return new Response('Not found', { status: 404 })
    try {
      const body = await fs.readFile(file)
      return new Response(body, {
        headers: {
          'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'Content-Security-Policy': CSP,
          'X-Content-Type-Options': 'nosniff'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
