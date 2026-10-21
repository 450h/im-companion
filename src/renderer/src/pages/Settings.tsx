/** Settings & data (docs/06 §7): appearance, day start, updates, export/import/restore, about (sources, licenses, disclaimer). */
import { useEffect, useState, type ReactNode } from 'react'
import type { BackupInfo, UpdateStatus } from '@shared/ipc'
import { useApp } from '../state/app'

export function SettingsPage(): ReactNode {
  const { progress, call, info, pack, refresh } = useApp()
  const s = progress.settings
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [upd, setUpd] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    void window.imc.backupList().then((r) => r.ok && setBackups(r.data))
  }, [])
  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="card">
        <h2>Appearance</h2>
        <div className="row">
          <div className="seg">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} aria-pressed={s.theme === t} onClick={() => void call(window.imc.settingsUpdate({ theme: t }))}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <label className="row">
            Text size
            <input type="range" min={0.8} max={1.6} step={0.1} value={s.fontScale} onChange={(e) => void call(window.imc.settingsUpdate({ fontScale: Number(e.target.value) }))} />
          </label>
          <label className="row">
            Day starts at
            <select className="input" style={{ width: 100 }} value={s.dayStartHour} onChange={(e) => void call(window.imc.settingsUpdate({ dayStartHour: Number(e.target.value) }))}>
              {[0, 1, 2, 3, 4, 5, 6].map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Updates</h2>
        <p className="muted">
          You have app <strong>v{info.version}</strong> with content <strong>{info.contentVersion}</strong>. New content is released about weekly; the app checks GitHub once per
          launch and shows a banner. Download the new installer and run it over this version — your progress is kept.
        </p>
        <label className="checkbox-row">
          <input type="checkbox" checked={s.updates.checkOnLaunch} onChange={(e) => void call(window.imc.settingsUpdate({ checkOnLaunch: e.target.checked }))} /> Check for a new version
          when the app starts
        </label>
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              const r = await call(window.imc.updateCheck())
              if (r) setUpd(r)
            }}
          >
            Check for updates now
          </button>
          {upd && (upd.newer ? <span className="chip info">Version {upd.latest} available</span> : <span className="chip good">You’re up to date{upd.latest ? ` (${upd.latest})` : ''}</span>)}
          {upd?.newer && (
            <button className="btn primary sm" onClick={() => void call(window.imc.updateOpenDownload())}>
              Download
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Your data</h2>
        <p className="muted">
          Progress is stored only on this PC ({info.dataPath}). A snapshot is kept daily (14 kept) and before every import, restore or rebuild.
        </p>
        <div className="row">
          <button className="btn" onClick={() => void call(window.imc.dataExport(), 'Progress exported')}>
            Export progress…
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (await call(window.imc.dataImport(), 'Progress imported')) await refresh()
            }}
          >
            Import progress…
          </button>
        </div>
        {backups.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Backup</th>
                <th>Saved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {backups.slice(0, 10).map((b) => (
                <tr key={b.name}>
                  <td>{b.name}</td>
                  <td className="faint">{new Date(b.modified).toLocaleString()}</td>
                  <td className="r">
                    <button
                      className="btn sm"
                      onClick={async () => {
                        if (await call(window.imc.backupRestore(b.name), 'Backup restored')) await refresh()
                      }}
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>About</h2>
        <p>
          <strong>MED 222 IM Companion</strong> — a free study app for the Med 611 Internal Medicine course. Code under the MIT license; study content under CC BY-NC-SA 4.0.
        </p>
        <div className="banner warn">
          <span>
            <strong>For exam study only — not clinical guidance.</strong> Summaries are written in our own words from the sources below and checked against the cited pages
            before release. Always verify against the cited source; report errors with ⚑.
          </span>
        </div>
        <h3>Sources cited (not included in the app)</h3>
        <ul>
          {pack.books
            .filter((b) => b.id !== 'blueprint')
            .map((b) => (
              <li key={b.id}>
                {b.title}
                {b.edition ? `, ${b.edition}` : ''}
                {b.authors ? ` — ${b.authors}` : ''}
                {b.publisher ? `. ${b.publisher}` : ''}
                {b.year ? `, ${b.year}` : ''}.
              </li>
            ))}
        </ul>
        <p className="faint">
          This app is not affiliated with or endorsed by the authors or publishers above, or by the college. It contains no text, figures or questions from these books — only
          original summaries and questions that cite them.
        </p>
        <div className="row">
          <button className="btn" onClick={() => void call(window.imc.openRepo())}>
            GitHub repository
          </button>
        </div>
      </div>
    </div>
  )
}
