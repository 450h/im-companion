/** Local error log (≤ 1 MB, one rotation). Never log note text, answers or user text (SECURITY §8). */
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

let logFile: string | null = null
const MAX_BYTES = 1024 * 1024

export function initLog(dir: string): void {
  const logs = join(dir, 'logs')
  mkdirSync(logs, { recursive: true })
  logFile = join(logs, 'main.log')
}

export function logError(context: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error('Non-error thrown')
  const line = `${new Date().toISOString()} [${context}] ${e.name}: ${e.message}\n${e.stack ?? ''}\n`
  if (!logFile) {
    console.error(line)
    return
  }
  try {
    const size = statSync(logFile, { throwIfNoEntry: false })?.size ?? 0
    if (size > MAX_BYTES) renameSync(logFile, `${logFile}.1`)
    appendFileSync(logFile, line)
  } catch {
    console.error(line)
  }
}
