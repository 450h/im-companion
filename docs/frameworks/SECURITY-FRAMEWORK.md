# Security Framework — Engineering Rules (MED 222 IM Companion)

> These are **binding rules**, not background reading. A PR that violates a 🔴 MUST does not merge.
> - They're adapted to a **local-first Electron app whose only network use is a "newer version?" check against GitHub Releases** (ADR-0008). There's no auto-updater: students download new versions themselves.
> - They're grounded in the [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security) (DailyPot verification 2026-10-13, High; re-verify on Electron upgrades) and OWASP ASVS principles.
> - In this app, "server" means the **Electron main process** and "client" means the **renderer**.
> - Section numbers match the skill template; gaps are intentional.

Legend: 🔴 MUST (block merge) · 🟡 SHOULD (justify if not) · 🟢 GUIDANCE.

## 0. First principles
1. **The renderer is hostile.** Validation, correctness and file access live in the main process.
2. **One authoritative check:** every IPC command is validated (sender, zod schema, references) in main. Renderer checks are UX only.
3. **Three root causes to design against:** trusting the renderer, exposing Node/Electron to web content, and not validating input (IPC payloads, imported files, the content pack) in main.
4. **Nothing about the student leaves the device.** The release check is the only outbound request (ADR-0008).
5. **The release channel is the crown jewel.** Whoever can publish a release can get students to run it (07 T1).
6. **No copyrighted material, ever** (ADR-0003). A takedown is a security incident for this project.

## 1. Authorization at the data layer (core control)
> There's one local user and no lock. The control is **the IPC allowlist plus main-process validation** ([05 §5](../05-data-model.md)).
- 🔴 **Deny by default:** the preload exposes only the named functions in `src/shared/ipc.ts`. There's no generic `invoke(channel)`, and `ipcRenderer` never reaches the renderer.
- 🔴 Every new command ships with its zod schema, its referential checks and tests **in the same change**.
- 🔴 **Server-write-only fields:** `createdAt`, `schemaVersion`, `plans.*.tasks`, `generatedAt`, `contentVersion`, and attempt `correct` (recomputed from content in main).
- 🔴 IPC tests cover a valid payload (accepted) and invalid ones (wrong type, unknown keys, unknown topic/question/task IDs, a forged `correct`, a far-future timestamp), all rejected.

## 2. Secrets, trust boundary & supply chain
- 🔴 The app has **no API keys or secrets**. It talks to the public GitHub Releases API anonymously. `GH_TOKEN` exists **only** in CI (`github.token`).
- 🔴 `.env*` gitignored. Signing secrets (if D2 is ever chosen) go in GitHub Actions secrets only.
- 🔴 **Supply chain:**
  - lockfile committed and `npm ci` in CI
  - exact version pins
  - Dependabot on
  - `npm audit --audit-level=high` fails CI
  - every new dependency is reviewed for maintenance, popularity, license (MIT-compatible) and install scripts, and comes from the npm registry only
  - the dependency count stays minimal
- 🔴 Build-time Python tooling (`scripts/extract`) runs with `python -I` and only reads the owner's local source folder. It never ships in the app.

## 3. Authentication, identity & operator accounts
- 🔴 **MFA on the maintainer's GitHub account.** It controls source and releases, and therefore what runs on every student's PC. Recovery codes are stored offline.
- 🔴 Branch protection on `main` (no force-push). Release tags are created by the owner, and **builds happen only in CI**.
- 🟢 There are no end-user accounts or PINs (study progress isn't sensitive enough to justify a lock).

## 4. Input validation & integrity
- 🔴 **Validate every IPC payload and every file read from disk** (progress.json, imports, backups, **the content pack at load**) with the shared zod schemas in main, using **strict objects (unknown keys rejected)**.
- 🔴 File inputs: **20 MB** cap; backup names must match the allowlisted pattern and resolve inside `backups/` (no path traversal); dialogs are opened by main, never paths from the renderer.
- 🔴 Appends are idempotent where the meaning requires it:
  - `study:markRead`: once per section per study day.
  - `session:answer` in **tutor** sessions: once per item.
  - `session:answer` in **exam** sessions: last answer wins until `session:complete`, after which answers are refused (05 R-12).
- 🔴 **Content rendering:** content strings are rendered through our markdown-subset renderer to React elements. **No `dangerouslySetInnerHTML` anywhere.** SVG diagrams are sanitised by the content lint (an allowlist of elements and attributes; no `script`, `foreignObject`, event handlers or external `href`) and shown via `<img>` data URIs.
- 🔴 The ⚑ issue URL is built in main from **hardcoded** owner/repo constants. User text is URL-encoded and capped at 1,500 chars.

## 8. Logging, audit & incident response
- 🔴 Destructive local actions (import, restore, plan rebuild, migration) write a `pre-*` backup first. That backup is the audit trail for a single-user app.
- 🔴 Logs hold error types and stack traces only: never note text, answers, or file paths outside the app's own folder.
- 🔴 **Incident** = a vulnerability report, a data-loss bug, a compromised release, or a **copyright complaint**. Triage via GitHub Security Advisories (private vulnerability reporting enabled). For a copyright complaint, remove the content within 24 h (03 §4.7). For a bad release, publish a fixed higher version at once (the updater only moves forward) and announce it in the class group.
- 🔴 **Tested backups:** store tests restore a snapshot and verify it. The corruption fallback is tested. The upgrade drill (C3: install over the previous version, progress intact) runs before each minor release.

## 9. Rate limiting & abuse
- 🔴 Release checks: once per launch plus manual "Check for updates" clicks (debounced to one per minute). That's far under GitHub's anonymous API limit. Failure is silent.
- 🟢 There are no other abuse surfaces (no server, no multi-user).

## 11. Electron desktop hardening (project-specific)
- 🔴 `BrowserWindow` webPreferences: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. No `allowRunningInsecureContent`, `experimentalFeatures`, `enableBlinkFeatures` or `<webview>`.
- 🔴 **Single instance:** `app.requestSingleInstanceLock()`. A second launch focuses the existing window, which prevents two writers on `progress.json`.
- 🔴 DevTools are disabled in packaged builds (`devTools: !app.isPackaged`).
- 🔴 CSP is sent as a response header by the `app://` handler (and as a meta tag in dev):
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  ```
  Inline *styles* are allowed only for chart libraries. Inline *scripts* are never allowed.
- 🔴 Block navigation (`will-navigate` → `preventDefault` unless it's the app's own URL). `setWindowOpenHandler` → `deny`.
- 🔴 `session.setPermissionRequestHandler` → deny everything.
- 🔴 **Network allowlist:** `session.defaultSession.webRequest.onBeforeRequest` decides as follows:
  - It **cancels** every `http(s)`/`ws(s)` request that has a `webContentsId` (i.e. comes from the renderer).
  - For requests without one (main's release check, which uses Electron `net`), it allows **only** `https://api.github.com/repos/450h/im-companion/releases/latest` and the fallback `https://github.com/450h/im-companion/releases.atom`. Redirects (e.g. 301 after a rename) are cancelled.
  - The response is zod-validated (`tag_name` semver, `name` ≤ 200 chars) and shown as text only. **The Download button opens the hardcoded releases URL, never a URL from the response** (07 T1b).
  - Everything else is cancelled and logged by host only.
  - The dev server URL is allowed only when unpackaged.
- 🔴 Validate the IPC sender: `event.senderFrame` must be non-null with the app's own origin (`app://` in prod, the dev server URL in dev).
- 🔴 `shell.openExternal` only with hardcoded constants (the repo URL, the new-issue URL built from constants, the releases URL).
- 🔴 Production UI comes from a custom `app://` protocol: call `protocol.registerSchemesAsPrivileged` before `ready`, then use `protocol.handle` with path normalisation that refuses anything outside the renderer folder. No `file://`.
- 🔴 Electron fuses at package time: `RunAsNode=false`, `EnableNodeOptionsEnvironmentVariable=false`, `EnableNodeCliInspectArguments=false`, `OnlyLoadAppFromAsar=true`, `EnableEmbeddedAsarIntegrityValidation=true`, `GrantFileProtocolExtraPrivileges=false`, `EnableCookieEncryption=true`.
- 🔴 Stay on a supported Electron major (checkpoint C4).
- 🔴 Dev-only env vars (`IMC_DATA_DIR`, `IMC_DISABLE_UPDATES`) are honoured **only when `!app.isPackaged`**.

## 12. Copyright guard (project-specific, ADR-0003)
- 🔴 `.gitignore` blocks `*.pdf`, `.work/` and `Med_source/`. **CI fails** if any tracked file is a PDF or sits under a page-image folder.
- 🔴 Content lint: every block cited; EMQ-volume entries contain no stem or option text.
- 🔴 **Copy check** (local; it needs `.work/`, including OCR'd EMQ Vol 3): no 12+ word overlap with any source and no 8+ word overlap with EMQ-volume text; original EMQ option lists overlap a same-titled volume theme by ≤ 50%. A pass writes `copyCheck.contentHash`.
- 🔴 **CI verifies** `copyCheck.contentHash` and `sourceCheck.contentHash` against the recomputed hash of each topic. A mismatch (edited after checking) fails the build.
- 🔴 No book figure or page image is ever committed, bundled or rendered. **CI fails on any raster image (`png/jpg/jpeg/gif/webp/bmp/tif`) under `content/`** except files listed in `content/images/ALLOWLIST.json` (D5 open-licensed images, each with source URL and license).
- 🔴 Public docs and app text never reference a shared folder of book files. Citations name book · edition · chapter · page (plus an optional e-book page and figure number).

---
## Pre-merge security checklist
- [ ] Every new IPC command has zod validation, referential checks and tests (positive and negative) **in the same change**. `correct` is computed in main.
- [ ] The preload exposes only named functions; no Node/Electron objects reach the renderer.
- [ ] No secrets in the repo; lockfile committed; `npm audit` green; new deps reviewed (license MIT-compatible).
- [ ] File inputs size-capped, validated and path-safe; no `dangerouslySetInnerHTML`; SVG via sanitised data URIs.
- [ ] Hardened webPreferences, CSP, navigation/window/permission blocks and the renderer network block are unchanged (or changed via ADR).
- [ ] Destructive actions write a backup first; no user text in logs.
- [ ] **No PDFs, page images or verbatim book text**; content lint (including the local n-gram check) green.

## Sources
[Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security) · [electron-builder auto-update](https://www.electron.build/docs/features/auto-update) (accessed 2026-10-21; background for ADR-0008) · OWASP ASVS · [GitHub DMCA policy](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy) (accessed 2026-10-21). Re-verify key names and options when upgrading Electron or electron-builder.
