<!-- Keep PRs small and reversible. Link the phase/issue. -->

## What & why
Closes #

## Phase / acceptance criteria
<!-- Which roadmap phase (docs/08)? Which acceptance criteria does this satisfy? Content: which topics? -->

---
## Security checklist (docs/frameworks/SECURITY-FRAMEWORK.md)
- [ ] New IPC command: zod validation + referential checks in main, with positive/negative tests; `correct` computed in main
- [ ] Preload exposes only named functions; no Node/Electron objects in the renderer
- [ ] Hardened webPreferences, CSP, navigation/window/permission blocks and the network allowlist (release-check URL only) unchanged (or ADR linked)
- [ ] No secrets; lockfile committed; `npm audit` green; new deps reviewed (license MIT-compatible)
- [ ] File inputs size-capped, validated, path-safe; no `dangerouslySetInnerHTML`; SVG via sanitised data URIs
- [ ] Destructive actions write a backup first; no user text in logs
- [ ] **Copyright (ADR-0003):** no PDFs, page images, book figures or verbatim book text; no EMQ-book stems/options

## Development checklist (docs/frameworks/DEVELOPMENT-FRAMEWORK.md)
- [ ] Types from zod schemas; strict TS; lint clean
- [ ] Planner rules only in `src/shared/engine`, matching docs/05; dates via `dates.ts`
- [ ] Progress-shape change = schemaVersion bump + migration + test
- [ ] Content: IDs unchanged or retired; every block/card/question cited; `studyRef` on every question; `npm run content:lint` green (incl. local n-gram check); source-check passed for every new/changed topic
- [ ] Empty/loading/error states; keyboard + labels; light & dark checked
- [ ] Tests added/updated; CI green

## Notes / decisions
<!-- Non-obvious architectural choice? Add/link an ADR in docs/decisions/. -->
