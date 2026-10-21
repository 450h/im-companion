/** App shell: loads content + progress, gates on first run, renders the sidebar and the current view. */
import { useEffect, useState, type ReactNode } from 'react'
import type { ContentPack } from '@shared/content-schema'
import { diffDays } from '@shared/dates'
import type { AppInfo } from '@shared/ipc'
import type { Progress } from '@shared/progress-schema'
import { SessionPage } from './components/Session'
import { FirstRun } from './pages/FirstRun'
import { PlanPage } from './pages/Plan'
import { PracticePage } from './pages/Practice'
import { ProgressPage } from './pages/Progress'
import { SettingsPage } from './pages/Settings'
import { StudyPage } from './pages/Study'
import { TodayPage } from './pages/Today'
import { AppProvider, useApp, type View } from './state/app'

export function App(): ReactNode {
  const [boot, setBoot] = useState<{ pack: ContentPack; progress: Progress; info: AppInfo } | { error: string } | null>(null)
  useEffect(() => {
    void (async () => {
      const [i, c, p] = await Promise.all([window.imc.appInfo(), window.imc.contentGet(), window.imc.progressGet()])
      if (!i.ok || !c.ok || !p.ok) setBoot({ error: (!i.ok && i.message) || (!c.ok && c.message) || (!p.ok && p.message) || 'Failed to start' })
      else setBoot({ info: i.data, pack: c.data, progress: p.data })
    })()
  }, [])
  if (!boot) return <div className="center-screen muted">Loading…</div>
  if ('error' in boot) return <div className="center-screen"><div className="banner danger">{boot.error}</div></div>
  return (
    <AppProvider pack={boot.pack} initial={boot.progress} info={boot.info}>
      <Shell />
    </AppProvider>
  )
}

const NAV: Array<[View['name'], string, string]> = [
  ['today', 'Today', '◎'],
  ['plan', 'Plan', '▦'],
  ['study', 'Study', '📚'],
  ['practice', 'Practice', '✎'],
  ['progress', 'Progress', '📈'],
  ['settings', 'Settings', '⚙']
]

function Shell(): ReactNode {
  const app = useApp()
  const { progress, view, go, derived, update, info } = app
  const needsFirstRun = !progress.settings.firstRunDone || !Object.keys(progress.plans).length
  if (needsFirstRun) return <FirstRun />
  const plan = derived.plan
  const days = plan ? diffDays(derived.today, plan.config.examDate) : null
  const showUpdate = update?.newer && update.latest !== progress.settings.updates.dismissedVersion
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-mark">IM</div>
          <div>
            MED 222
            <div className="faint" style={{ fontWeight: 400 }}>
              IM Companion
            </div>
          </div>
        </div>
        <div className="track-switch">
          <div className="seg" role="group" aria-label="Exam track">
            {(['midterm', 'final'] as const).map((t) => (
              <button
                key={t}
                aria-pressed={derived.track === t}
                disabled={!progress.plans[t]}
                title={progress.plans[t] ? '' : t === 'final' ? 'The Final plan can be created from the midterm date' : ''}
                onClick={() => app.setTrack(t)}
              >
                {t === 'midterm' ? 'Midterm' : 'Final'}
              </button>
            ))}
          </div>
          {days !== null && (
            <div className="countdown">
              {plan?.archivedAt ? 'Exam done — plan archived' : days > 0 ? `${days} days to the ${derived.track} (${plan!.config.examDate})` : days === 0 ? `${derived.track} exam today — good luck!` : 'Exam passed'}
            </div>
          )}
        </div>
        {NAV.map(([name, label, icon]) => (
          <button
            key={name}
            className="nav-btn"
            aria-current={view.name === name || (view.name === 'session' && view.back.name === name) ? 'page' : undefined}
            onClick={() => go({ name } as View)}
          >
            <span aria-hidden>{icon}</span> {label}
          </button>
        ))}
        <div className="sidebar-foot faint">
          v{info.version} · content {info.contentVersion}
        </div>
      </nav>
      <main className="main">
        {info.readOnly && <div className="banner warn" style={{ margin: 16 }}>Your progress file was saved by a newer version of the app. It is open read-only — please update.</div>}
        {info.restoredFromBackup && <div className="banner warn" style={{ margin: 16 }}>Your progress file was damaged, so the newest backup was restored.</div>}
        {showUpdate && (
          <div className="banner info" style={{ margin: '16px 32px 0' }}>
            <span>
              <strong>Version {update!.latest} is available</strong>
              {update!.title ? ` — ${update!.title}` : ''}. Download it and run the installer over this version; your progress is kept.
            </span>
            <span className="row">
              <button className="btn primary sm" onClick={() => void app.call(window.imc.updateOpenDownload())}>
                Download
              </button>
              <button className="btn ghost sm" onClick={() => void app.call(window.imc.settingsUpdate({ dismissedVersion: update!.latest! }))}>
                Later
              </button>
            </span>
          </div>
        )}
        <Router />
      </main>
      <div className="toasts" aria-live="polite">
        {app.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            <span>{t.text}</span>
            <button onClick={() => app.dismissToast(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Router(): ReactNode {
  const { view } = useApp()
  switch (view.name) {
    case 'today':
      return <TodayPage />
    case 'plan':
      return <PlanPage />
    case 'study':
      return <StudyPage topicId={view.topicId} sectionId={view.sectionId} taskId={view.taskId} />
    case 'practice':
      return <PracticePage tab={view.tab} />
    case 'progress':
      return <ProgressPage />
    case 'settings':
      return <SettingsPage />
    case 'session':
      return <SessionPage key={JSON.stringify(view.spec)} spec={view.spec} back={view.back} />
  }
}
