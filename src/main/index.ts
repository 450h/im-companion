/**
 * Electron main process: hardened window, single instance, app:// protocol, network allowlist (release
 * check only), store + content + IPC wiring, day rollover and plan archiving (SECURITY §11, ADR-0002/0008).
 */
import { join, resolve } from 'node:path'
import { BrowserWindow, app, dialog, net, session, shell } from 'electron'
import { CHANNELS } from '@shared/channels'
import { studyDate } from '@shared/dates'
import { RELEASES_API, RELEASES_ATOM, RELEASES_URL, REPO_URL, type AppEvent } from '@shared/ipc'
import { loadContent } from './content'
import { registerIpc } from './ipc'
import { initLog, logError } from './log'
import { APP_ORIGIN, handleAppScheme, registerAppScheme } from './protocol'
import { checkForUpdate } from './release-check'
import { isTrustedUrl } from './sender'
import { Service, type Platform } from './service'
import { Store } from './store'

const isDev = !app.isPackaged
const devUrl = isDev ? process.env['ELECTRON_RENDERER_URL'] : undefined
const updatesDisabled = isDev && process.env['IMC_DISABLE_UPDATES'] !== '0'

if (isDev) app.setPath('userData', resolve(process.env['IMC_DATA_DIR'] ?? '.dev-data'))
app.setName('MED 222 IM Companion')

const ALLOWED_MAIN_URLS = new Set([RELEASES_API, RELEASES_ATOM])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerAppScheme()
  void main()
}

let mainWindow: BrowserWindow | null = null
function send(event: AppEvent): void {
  mainWindow?.webContents.send(CHANNELS.event, event)
}

async function main(): Promise<void> {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (ev, url) => {
      if (!isTrustedUrl(url, devUrl)) ev.preventDefault()
    })
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (ev) => ev.preventDefault())
  })

  await app.whenReady()
  const dataDir = app.getPath('userData')
  initLog(dataDir)

  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  // Network allowlist (SECURITY §11): renderer → nothing (dev server only in dev); main → the release check only.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, cb) => {
    const fromRenderer = typeof details.webContentsId === 'number'
    if (devUrl && new URL(details.url).origin === new URL(devUrl).origin) return cb({ cancel: false })
    if (!fromRenderer && ALLOWED_MAIN_URLS.has(details.url)) return cb({ cancel: false })
    cb({ cancel: true })
  })

  handleAppScheme(join(__dirname, '../renderer'))

  // IMC_CONTENT_DIR (dev/test only) points E2E tests at a fixture pack; ignored when packaged.
  const contentDir = app.isPackaged ? join(process.resourcesPath, 'content') : resolve(process.env['IMC_CONTENT_DIR'] ?? join(__dirname, '../../content'))
  const pack = loadContent(contentDir)
  const store = new Store(dataDir)
  await store.load()

  const platform: Platform = {
    version: app.getVersion(),
    dataPath: dataDir,
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    async saveDialog(defaultName) {
      const r = await dialog.showSaveDialog(mainWindow!, { defaultPath: defaultName, filters: [{ name: 'Progress', extensions: ['json'] }] })
      return r.canceled || !r.filePath ? null : r.filePath
    },
    async openDialog() {
      const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Progress', extensions: ['json'] }] })
      return r.canceled ? null : (r.filePaths[0] ?? null)
    },
    async confirm(message, detail) {
      const r = await dialog.showMessageBox(mainWindow!, { type: 'warning', buttons: ['Cancel', 'Continue'], defaultId: 0, cancelId: 0, message, detail })
      return r.response === 1
    },
    async openExternal(url) {
      // Only URLs built from hardcoded constants reach here (SECURITY §11).
      if (url.startsWith(`${REPO_URL}/`)) await shell.openExternal(url)
    }
  }

  const service = new Service(store, pack, platform)
  if (!store.meta.readOnly) {
    try {
      service.archivePastPlans()
    } catch (e) {
      logError('archive', e)
    }
  }

  const fetcher = async (url: string, accept: string): Promise<{ status: number; text: string }> => {
    const res = await net.fetch(url, { headers: { Accept: accept, 'User-Agent': 'im-companion' }, redirect: 'error' })
    return { status: res.status, text: (await res.text()).slice(0, 200_000) }
  }
  const updateCheck = async (force: boolean): Promise<unknown> => {
    const settings = store.state.settings
    if (updatesDisabled) return { current: app.getVersion(), latest: null, title: null, newer: false, checkedAt: null }
    const r = await checkForUpdate(app.getVersion(), settings.updates.lastCheck, new Date(), fetcher, force)
    if (r.cache && !store.meta.readOnly) {
      store.update((p) => ({ ...p, settings: { ...p.settings, updates: { ...p.settings.updates, lastCheck: r.cache! } } }))
    }
    return r.status
  }

  registerIpc(
    service,
    {
      updateCheck: () => updateCheck(true),
      updateOpenDownload: () => shell.openExternal(RELEASES_URL),
      openRepo: () => shell.openExternal(REPO_URL),
      contentGet: () => pack,
      onChange: () => send({ type: 'progressChanged' })
    },
    devUrl
  )

  createWindow()

  if (store.state.settings.updates.checkOnLaunch) {
    setTimeout(() => {
      updateCheck(false)
        .then((s) => send({ type: 'update', status: s as never }))
        .catch((e) => logError('update', e))
    }, 4000)
  }

  // Day rollover (day-start hour): archive past plans and refresh views.
  let lastDay = studyDate(new Date(), store.state.settings.dayStartHour)
  setInterval(() => {
    const d = studyDate(new Date(), store.state.settings.dayStartHour)
    if (d !== lastDay) {
      lastDay = d
      try {
        service.archivePastPlans()
      } catch (e) {
        logError('rollover', e)
      }
      send({ type: 'progressChanged' })
    }
  }, 60_000)

  app.on('before-quit', (e) => {
    if (store.hasPending()) {
      e.preventDefault()
      store
        .flush()
        .catch((err) => logError('flush', err))
        .finally(() => app.exit(0))
    }
  })
  app.on('window-all-closed', () => app.quit())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'MED 222 IM Companion',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      spellcheck: false,
      devTools: isDev
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  if (devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
}
