# 07 — Threat model

The app is offline-first and holds no secrets. It's a single-user desktop app whose only remote dependency is GitHub. The assets worth protecting (T-numbers are referenced elsewhere; T1b was added with ADR-0008):
- **(A1)** each student's progress (weeks of study history)
- **(A2)** the integrity of what students install and update to
- **(A3)** the integrity of the medical content they learn from
- **(A4)** the repository itself (the update channel)

| # | Threat | Vector | Impact | Mitigation | Residual |
|---|---|---|---|---|---|
| T1 | **Malicious release** | Compromise of the maintainer's GitHub account or CI publishes a trojaned release, and the in-app banner prompts students to download it | Critical (A2) | MFA on the GitHub account (recovery codes offline); releases only from CI on `v*` tags; branch protection on `main`; Actions pinned to major versions with minimal `permissions`; checksums published; Dependabot. **No silent install** (ADR-0008): students see the release notes and run the installer themselves | Medium (unsigned builds, D2) |
| T1b | **Spoofed update banner** | A tampered or unexpected API response points the Download button elsewhere | Medium | The Download button always opens the **hardcoded** releases URL, never a URL from the response; the response is zod-validated and shown as text only | Low |
| T2 | **Repository takedown** | A copyrighted file or close-paraphrased text lands in the repo, and a DMCA notice disables the repo (03 F1) | High (A4): updates stop for everyone | ADR-0003; `.gitignore` blocks `*.pdf` and image dumps; CI fails if any `.pdf` or a `pages/` image folder is tracked; content lint n-gram check; 24 h takedown response (03 §4.7) | Low-Medium |
| T3 | **Wrong medical content** | A model error or a mis-cited page teaches a wrong fact before the exam | High (A3) | Citation on every block; **mandatory automated source-check against the cited pages before release** (ADR-0009); ⚑ report button → issue → patch release; lint invariants; disclaimer | Low-Medium (watched by C6) |
| T4 | **Tampered content pack** | A local attacker edits `app.asar` | Low | asar integrity fuse; the content is validated with zod at load; a local attacker with file access already owns the user account | Low |
| T5 | **Malicious import file** | A "progress.json" shared in a group chat is crafted to crash or inject | Medium (A1) | Strict zod (unknown keys rejected); 20 MB size cap; text rendered as text (no `dangerouslySetInnerHTML`); `pre-import` backup | Low |
| T6 | **Content rendering injection** | A content string with HTML/script, or SVG with script | Medium | Markdown subset rendered by our own renderer to React elements (no raw HTML). Diagrams are sanitised at **build time** by the content lint (allowlist of SVG elements and attributes, no `script`, `foreignObject`, `on*` or `href` to external URLs) and rendered via `<img src="data:image/svg+xml…">`, so scripts never execute; strict CSP | Low |
| T7 | **Data loss** | A crash mid-write, disk full, a bad migration, a reinstall | High (A1) | Atomic writes, daily snapshots, pre-action backups, corruption fallback, read-only downgrade mode, export/import; `deleteAppDataOnUninstall: false` | Low |
| T8 | **Electron attack surface** | Navigation to remote content, `window.open`, permission prompts, renderer gaining Node access | High | SECURITY §11 hardening (contextIsolation, sandbox, CSP, navigation/window/permission blocks, sender validation, fuses) | Low |
| T9 | **Supply chain** | A compromised npm dependency | High | Few deps, exact pins, lockfile, `npm ci`, audit in CI, review of new deps | Medium |
| T10 | **Error-report privacy** | The ⚑ issue URL leaks personal info | Low | Only content ID, versions and the user's own comment; the user sees and submits it in their own browser | Low |
| T11 | **Answer-key gaming** | A student reads `correct` from the renderer | None (it's a study tool) | Correctness is computed in main for consistency, not secrecy | Accepted |

**Top attack vectors to watch:** T1 (the release channel is how code reaches every student's PC), T2 (copyright takedown kills distribution) and T3 (wrong content is the product's core failure mode).
