/** Wires the Service to ipcMain with sender validation and typed error results (SECURITY §1, §11). */
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { CHANNELS } from '@shared/channels'
import type { IpcResult } from '@shared/ipc'
import { logError } from './log'
import { isTrustedFrame } from './sender'
import { ServiceError, type Service } from './service'
import { StoreError } from './store'

export function isTrustedSender(event: IpcMainInvokeEvent, devUrl: string | undefined): boolean {
  return isTrustedFrame(event.senderFrame, devUrl)
}

export interface Extras {
  updateCheck(): Promise<unknown>
  updateOpenDownload(): Promise<void>
  openRepo(): Promise<void>
  contentGet(): unknown
  onChange(): void
}

const READS = new Set<string>([CHANNELS.appInfo, CHANNELS.contentGet, CHANNELS.progressGet, CHANNELS.planPreview, CHANNELS.backupList, CHANNELS.updateCheck])

export function registerIpc(service: Service, extras: Extras, devUrl: string | undefined): void {
  const handle = (channel: string, fn: (...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<unknown>> => {
      if (!isTrustedSender(event, devUrl)) return { ok: false, code: 'FORBIDDEN', message: 'Untrusted sender' }
      try {
        const data = await fn(...args)
        if (!READS.has(channel)) extras.onChange()
        return { ok: true, data }
      } catch (e) {
        if (e instanceof ServiceError || e instanceof StoreError) return { ok: false, code: e.code, message: e.message }
        logError(channel, e)
        return { ok: false, code: 'INTERNAL', message: 'Something went wrong. Details are in the log file.' }
      }
    })
  }

  handle(CHANNELS.appInfo, () => service.appInfo())
  handle(CHANNELS.contentGet, () => extras.contentGet())
  handle(CHANNELS.progressGet, () => service.getProgress())
  handle(CHANNELS.settingsUpdate, (p) => service.settingsUpdate(p))
  handle(CHANNELS.firstRunComplete, () => service.firstRunComplete())
  handle(CHANNELS.planPreview, (p) => service.planPreview(p))
  handle(CHANNELS.planCreate, (p) => service.planCreate(p))
  handle(CHANNELS.planRebuild, (p) => service.planRebuild(p))
  handle(CHANNELS.planOverride, (p) => service.planOverride(p))
  handle(CHANNELS.studyMarkRead, (p) => service.markRead(p))
  handle(CHANNELS.topicSetStudied, (p) => service.setStudied(p))
  handle(CHANNELS.topicConfidence, (p) => service.confidence(p))
  handle(CHANNELS.sessionStart, (p) => service.sessionStart(p))
  handle(CHANNELS.sessionAnswer, (p) => service.sessionAnswer(p))
  handle(CHANNELS.sessionComplete, (p) => service.sessionComplete(p))
  handle(CHANNELS.cardsGrade, (p) => service.cardsGrade(p))
  handle(CHANNELS.reflectionSave, (p) => service.reflectionSave(p))
  handle(CHANNELS.notesUpsert, (p) => service.notesUpsert(p))
  handle(CHANNELS.notesDelete, (p) => service.notesDelete(p))
  handle(CHANNELS.dataExport, () => service.dataExport())
  handle(CHANNELS.dataImport, () => service.dataImport())
  handle(CHANNELS.backupList, () => service.backupList())
  handle(CHANNELS.backupRestore, (p) => service.backupRestore(p))
  handle(CHANNELS.updateCheck, () => extras.updateCheck())
  handle(CHANNELS.updateOpenDownload, () => extras.updateOpenDownload())
  handle(CHANNELS.reportOpenIssue, (p) => service.reportIssue(p))
  handle(CHANNELS.openRepo, () => extras.openRepo())
}
