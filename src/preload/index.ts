/**
 * Preload: exposes only named functions on window.imc (SECURITY §1, §11).
 * No ipcRenderer, Node or Electron objects reach the renderer.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../shared/channels'
import type { AppEvent, ImcApi } from '../shared/ipc'

const call = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: ImcApi = {
  appInfo: () => call(CHANNELS.appInfo),
  contentGet: () => call(CHANNELS.contentGet),
  progressGet: () => call(CHANNELS.progressGet),
  settingsUpdate: (patch) => call(CHANNELS.settingsUpdate, patch),
  firstRunComplete: () => call(CHANNELS.firstRunComplete),
  planPreview: (config) => call(CHANNELS.planPreview, config),
  planCreate: (payload) => call(CHANNELS.planCreate, payload),
  planRebuild: (payload) => call(CHANNELS.planRebuild, payload),
  planOverride: (payload) => call(CHANNELS.planOverride, payload),
  studyMarkRead: (payload) => call(CHANNELS.studyMarkRead, payload),
  topicSetStudied: (payload) => call(CHANNELS.topicSetStudied, payload),
  topicConfidence: (payload) => call(CHANNELS.topicConfidence, payload),
  sessionStart: (payload) => call(CHANNELS.sessionStart, payload),
  sessionAnswer: (payload) => call(CHANNELS.sessionAnswer, payload),
  sessionComplete: (sessionId) => call(CHANNELS.sessionComplete, sessionId),
  cardsGrade: (payload) => call(CHANNELS.cardsGrade, payload),
  reflectionSave: (payload) => call(CHANNELS.reflectionSave, payload),
  notesUpsert: (payload) => call(CHANNELS.notesUpsert, payload),
  notesDelete: (id) => call(CHANNELS.notesDelete, id),
  dataExport: () => call(CHANNELS.dataExport),
  dataImport: () => call(CHANNELS.dataImport),
  backupList: () => call(CHANNELS.backupList),
  backupRestore: (name) => call(CHANNELS.backupRestore, name),
  updateCheck: () => call(CHANNELS.updateCheck),
  updateOpenDownload: () => call(CHANNELS.updateOpenDownload),
  reportOpenIssue: (payload) => call(CHANNELS.reportOpenIssue, payload),
  openRepo: () => call(CHANNELS.openRepo),
  onEvent: (cb) => {
    const listener = (_e: unknown, payload: AppEvent): void => cb(payload)
    ipcRenderer.on(CHANNELS.event, listener)
    return () => {
      ipcRenderer.removeListener(CHANNELS.event, listener)
    }
  }
}

contextBridge.exposeInMainWorld('imc', api)
