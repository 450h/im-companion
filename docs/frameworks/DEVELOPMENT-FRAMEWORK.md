# Development Framework — Engineering Rules (MED 222 IM Companion)

> **Binding conventions** for building on Electron 44 + React 19 + TypeScript 5.9 (electron-vite 5 / Vite 7), maintained by **one person** with Claude Code. Security rules live in `SECURITY-FRAMEWORK.md`. Section numbers match the skill template; gaps are intentional.

Legend: 🔴 MUST · 🟡 SHOULD · 🟢 GUIDANCE.

## 0. First principles
1. **One source of truth per concept:**
   - Types come from zod schemas: `src/shared/content-schema.ts` for content and `src/shared/progress-schema.ts` for progress.
   - Planner, review, scoring and routing rules live only in `src/shared/engine/`.
   - Dates live only in `src/shared/dates.ts`.
2. **Boring and small.** Few dependencies, no state-management library, no router library (a simple view state), no CSS framework. A solo maintainer must understand it after 6 months.
3. **Pure engine, thin edges.** The engine is a pure function of `(content, plan, events, today)`. Main does I/O and validation. React renders.
4. **Content is data, not code.** Topics are JSON files under `content/`. No content strings are hardcoded in components.

## 2. Types & validation
- 🔴 `strict: true`; no `any` (use `unknown` and narrow); `noUncheckedIndexedAccess` on.
- 🔴 Schema-first: `z.infer` types only. Never hand-write a parallel interface for stored data or content.
- 🔴 The same schemas validate in the renderer (UX), in main (security) and in the content lint (CI).
- 🔴 Dates are `YYYY-MM-DD` local strings validated by regex plus a real-date check. Never `new Date('YYYY-MM-DD')` (that parses as UTC). Weekday maths goes through `dates.ts` only.

## 3. Backend & data layer (main process + JSON store)
- 🔴 Changes to the progress shape bump `schemaVersion` and add a forward-only migration with a test. Never edit a shipped migration.
- 🔴 A `pre-migration` backup is written before a migration saves.
- 🔴 Every write goes through `store.commit()` (validate → atomic write → snapshot), coalesced to ≤ 1 write per 500 ms and flushed on quit. No other code touches `progress.json`.
- 🔴 No business rules in main beyond validation and `correct` recomputation. Everything else comes from the shared engine.
- 🔴 **Content IDs are immutable.** Retiring an ID goes through `content/retired.json`. The lint fails on a reused or vanished ID that isn't retired.

## 5. Content rules (project-specific)
- 🔴 Every content change passes `npm run content:lint` (schema, refs, invariants, SVG sanitiser). The n-gram copy check runs locally before every content release (CI can't, because the books aren't in CI).
- 🔴 Every block, card and question cites ≥ 1 source. Every question has a `studyRef`.
- 🔴 No topic is bundled without a passed **source-check** (`sourceCheck.passedAt`, docs/09 §3.7, ADR-0009). Any edit to a topic's facts, answers or citations means re-running the source-check for that topic.
- 🔴 Topic files ≤ 250 KB; the whole pack ≤ 25 MB (enforced by lint, 05 §2.3). Split very large topics into more sections rather than longer blocks.
- 🔴 `content/blueprint.json` lists all 90 topics from v0.1.0. Topic content is optional per topic (pending until shipped).

## 7. Design system & UX states
- 🔴 Design tokens (colours, spacing, radii, type scale) are defined once as CSS variables in `src/renderer/src/styles/tokens.css`, with light and dark sets. `prefers-color-scheme` is used unless the user overrides it.
- 🔴 Task-type colours match the Excel legend, so returning users recognise them: New Study, Revision, Questions, Weak Areas, Final Revision, Rest, Exam. Each chip **also carries its text label**.
- 🔴 Every screen defines its **empty, loading and error states**, with recovery copy (for example "No plan yet → Create plan", "Content for this system arrives in the next update").
- 🔴 Destructive actions (rebuild, import, restore) need confirmation that names the backup that will be written.
- 🟡 System font stack. No web fonts and no CDN (the app works offline).
- 🟡 Reading view: max line length ~75 characters, a font-size setting, and citation chips that never interrupt the sentence flow.

## 8. Testing
- 🔴 **Engine tests are the critical suite.** Every rule R-1…R-12 in docs/05 has a test, and every bug gets a failing test first.
- 🔴 Plan-generation property tests: no task on a non-study day; every in-scope topic is placed exactly once (New Study, Skim, rapid review or Revision pass); no New Study outside Learn days; no task with ≤ 0 hours; all dates in [start, exam).
- 🔴 **Golden plan fixtures** (05 §8): starts on 21 Oct, 25 Oct, 10 Nov and 22 Nov, and a start on the exam date. Any change to a fixture needs a reason in the PR.
- 🔴 Dates: every "which day is it" decision goes through `studyDate(timestamp, dayStartHour)` in `dates.ts`.
- 🔴 IPC/store tests: validation (positive and negative), forged `correct` ignored, atomic write, corruption fallback, import rejection, migrations, newer-schema read-only.
- 🟡 Playwright `_electron` smoke test before each phase sign-off and each release.

## 9. Git, CI/CD, environments & observability
- 🔴 Environments: dev (`npm run dev`, using `IMC_DATA_DIR=.dev-data` by default) and packaged builds. Never develop against your real progress folder.
- 🔴 CI on every push/PR: `npm ci`, typecheck, lint, unit tests, content lint, the copyright guard (no PDFs tracked), `npm audit --audit-level=high`, build, E2E smoke.
- 🔴 Releases come only from GitHub Actions on a `v*` tag, with SHA256SUMS attached. The tag is semver (`vX.Y.Z`) because the in-app check compares it with the app version (ADR-0008). Release notes list the content topics added or changed.
- 🟡 Small commits with conventional messages. Semantic versioning: content-only changes are patch releases.
- 🟢 Each roadmap phase leaves the app runnable and releasable.

## 10. Performance & accessibility
- 🟡 The content pack (≤ 25 MB JSON) loads and validates in < 2 s on a mid-range laptop. Derived views (Today, Progress) compute in < 50 ms with 10k attempts. Engine calls are memoised per state version.
- 🔴 Accessibility baseline (WCAG 2.2 AA spirit):
  - every control labelled, with a visible focus ring
  - full keyboard operation of quizzes (1–5 / A–N to answer, Enter to submit, N for next) and flashcards (Space to flip, 1–4 to grade)
  - colour is never the only signal
  - contrast ≥ 4.5:1 in both themes
  - `prefers-reduced-motion` respected

---
## Pre-merge development checklist
- [ ] Shapes come from zod schemas; strict TS; lint clean.
- [ ] Progress-shape change = schemaVersion bump + migration + test + pre-migration backup.
- [ ] Rules only in `src/shared/engine`, matching docs/05; dates via `dates.ts`.
- [ ] Content IDs unchanged (or retired properly); content lint green; source-check passed for every new or changed topic.
- [ ] Empty/loading/error states present; keyboard and labels OK; both themes checked.
- [ ] Tests added or updated; CI green; lockfile committed.
