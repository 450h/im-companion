# 08 — Roadmap, testing & risks

_Revised 2026-10-21 after QA review: release cadence (N9, N11), the core loop in v0.1.0 (B1), golden tests (B6)._

## 1. Principles
- **The core study loop ships first**, then content streams in system order. A system's content must be released **no later than its first study day in the 25 Oct reference plan**, and ideally ≥ 2 days earlier. Until then its tasks show ⏳ Content pending (R-6.3), which never turns Overdue.
- **About one release a week, on Thursdays.** Students install over the Fri/Sat rest days. Each release is an unsigned installer that triggers SmartScreen, so we batch content instead of shipping every system separately (QA N9). Hotfix releases happen only for real errors.
- Each release is announced in the class group, and installed copies show the "new version" banner (ADR-0008).
- A QA agent reviews each phase against §3 before the tag is pushed. Every topic passes the source-check before it's bundled (ADR-0009).

**Reference plan (start Sun 25 Oct, defaults; R-2 simulation 2026-10-21) — first study day per system:**

| System | First study day |
|---|---|
| GI | Sun 25 Oct |
| ID | Tue 27 Oct |
| Neph | Thu 29 Oct |
| Cardio | Sun 1 Nov |
| Resp | Tue 3 Nov |
| Rheum | Thu 5 Nov |
| Endo | Sun 8 Nov |
| Heme | Tue 10 Nov |
| Hemato-onc | Sun 15 Nov |
| Onc | Mon 16 Nov |

Consolidate runs 18–26 Nov and Final revision 29–30 Nov.

## 2. Phases & releases
| Release | Date | App features | Content | Est. hours (best / likely / worst) |
|---|---|---|---|---|
| **P0** docs | Wed 21 Oct | Docs + QA review + fixes | blueprint seed | 6 / 8 / 12 |
| **v0.1.0** | **Sun 25 Oct** | Hardened shell; store; content schema + lint + hash checks; **planner engine R-1…R-10 with golden tests**; first run (incl. "already studied"); Today; Plan (schedule, week view, overrides, reflections); Progress; reader (citations, worked examples, notes, search, rapid review); **section quiz + topic quiz + practice (tutor mode) + wrong-answer routing (R-12) + confidence**; settings, export/import/restore; new-version banner; CI + release workflow. Capabilities: `quizzes`, `practice` | `blueprint.json` (all 90 topics); **GI (9) + ID (7) + Neph (7)** | 22 / 32 / 45 |
| **v0.2.0** | **Thu 29 Oct** | Flashcards (R-11); weak drill + Weak Areas (`drills`); chapter exams (`exams`); ⚑ reports | **Cardio (9) + Resp (6) + Rheum (5)** + chapter exams for released systems | 10 / 14 / 20 |
| **v0.3.0** | **Thu 5 Nov** | EMQ Volumes answer sheet; OSPE practice (`ospe`, after D5); original EMQ themes | **Endo (9) + Heme (11) + Hemato-onc (4) + Onc (6)**, completing all 73 midterm topics, + their chapter exams; EMQ-volume index | 18 / 26 / 38 |
| **v0.4.0** | **Thu 12 Nov** | Mock exams (`mocks`); polish from feedback | **2 mock midterm papers** (before Consolidate on 18 Nov) | 6 / 9 / 14 |
| **v0.5.0** | **Thu 26 Nov** | Final track (R-9: create on/after 1 Dec, archive the midterm plan, revision pass); day-off marking (D6) | **17 final-only topics**, SBA bank top-up, **mock final** | 12 / 18 / 26 |
| v0.5.x | as needed → Dec | ⚑ fixes, accessibility pass, README tour | corrections | 4 / 8 / 14 |
| **Total** | | | | **78 / 115 / 169 h** |

**Capacity:** the build hours, including content generation and the source-check pass, are Claude Code's. The owner tries each release (~30 min), announces it, and triages ⚑ reports. Medical review is optional (ADR-0009).

## 3. QA acceptance criteria per release
**v0.1.0:**
- [ ] CI green: typecheck, lint, unit tests, content lint (including hash checks), copyright guard, audit, build. The release workflow produces an installer, a portable exe and SHA256SUMS.
- [ ] **Golden plan tests:** starts on 21 Oct, 25 Oct, 10 Nov and 22 Nov match the committed fixtures. 21 Oct reproduces Learn 20 / Consolidate 7 / Final 2 and the Excel's first day per system. A start on the exam date is refused.
- [ ] **Property tests:** no task on a non-study day; each in-scope topic is placed exactly once; no New Study in Consolidate/Final; no negative or zero-hour tasks.
- [ ] Engine tests for R-5 (spread, drop, one-review-per-session), R-6 (topicCompleted event; a content update doesn't un-complete; pending never Overdue), and R-8 (no double counting).
- [ ] **Auto-logging (Playwright):** read all sections + topic quiz → the New Study task is ✔ Done with no manual step. A wrong answer → the study link opens the right section.
- [ ] `correct` is computed in main (a forged value is ignored).
- [ ] Store tests: atomic write, snapshots, corruption fallback, import rejection, newer-schema read-only.
- [ ] SECURITY §11 verified in the packaged build.
- [ ] **Upgrade drill (C3):** v0.1.0 → publish v0.1.1 → banner → install over → progress intact. Offline → silent. Malformed response → ignored.
- [ ] GI/ID/Neph available, all source-checked. The other systems show ⏳ Content pending.

**v0.2.0:**
- [ ] Flashcard intervals match R-11 tests, and due counts show on Today.
- [ ] The Weak drill always completes (falls back to the lowest-accuracy topics).
- [ ] Chapter exams use last-answer-wins until submit, are timed, and show results by section.
- [ ] Cardio is available ≥ 3 days before 1 Nov.

**v0.3.0:**
- [ ] All 73 midterm topics available and source-checked.
- [ ] EMQ index: every blueprint-relevant theme has a location, answer letters and an original explanation. No stem or option text (the lint runs against `.work/` text, including OCR'd Vol 3). The option-overlap lint passes.
- [ ] OSPE practice works with the D5 decision.

**v0.4.0:**
- [ ] Two mock papers built from the `mock` pool only. Mocks sit on the last two Consolidate days of the reference plan.

**v0.5.0:**
- [ ] The Final plan follows R-9: it can't be created before 1 Dec; new and revision tasks interleave; the midterm plan is archived; card caps use the Final exam date.
- [ ] All 17 final-only topics and the mock final are present.

## 4. Testing strategy
| Layer | Tool | What |
|---|---|---|
| Engine (critical) | Vitest | Every R-rule; golden plan fixtures; property tests |
| Content | `content-lint` (Vitest + script) | Schema, refs, invariants, citation validity, hash checks, SVG sanitiser, raster-image guard, n-gram and option-overlap checks (local, attested by `copyCheck.contentHash`) |
| Store / IPC | Vitest (node) | Validation positive/negative, `correct` recomputation, completion events, backups, migrations |
| UI flows | Playwright `_electron` against the unpackaged build | First run → plan → study → quiz → Done; wrong answer → routing; export/import |
| Release | Manual drill | Install, install-over-previous keeps progress, banner on a newer release, uninstall keeps data, portable exe runs |

## 5. Pre-mortem: "it's 1 December and the app failed the cohort"
| # | Cause of death | Probability | Earliest warning sign | Counter |
|---|---|---|---|---|
| 1 | **Content arrived after students needed it** | 25% | A release misses its Thursday date | Reference-plan dates (§1); ⏳ pending instead of Overdue; "Studied from the book"; lean-content fallback (§6) |
| 2 | **Content errors destroyed trust** | 20% | ⚑ reports cluster on one system | Citations everywhere; source-check with hash attestation; fast patch releases; C6 re-check |
| 3 | **Install friction** (SmartScreen, reinstalling each week) | 20% | Downloads ≪ cohort after the first week | README screenshots; weekly batching; class-group announcements with checksums; revisit D2 |
| 4 | **Repo takedown** | 5% | DMCA email/notice | ADR-0003 discipline; no shared-folder references; 24 h response |
| 5 | **Progress loss** after an update or a crash | 5% | Any "my progress reset" report | Atomic writes, snapshots, upgrade drill, import/export |
| 6 | **Plan didn't fit real life** | 25% | Many users with overdue > 1.5 days | Proportional placement, skim conversion, day-start hour, rebuild from today |
| 7 | **Students never updated** | 15% | "Where's Cardiology?" questions | Banner on launch (with RSS fallback for campus NAT), class-group posts, ⏳ pending tasks naming the coming release |

## 6. Kill / pivot criteria (→ OPEN-QUESTIONS C1–C2)
- If by **8 Nov** downloads are < 25% of the cohort, stop adding features, focus on onboarding and announcements, and ask classmates why.
- If any release slips **past a system's reference first-study day**, switch the remaining systems to **lean content**: summary + section/topic quizzes + 10-card decks, with worked examples and extra practice added later.

## 7. Before the first release
- [ ] The README states: free, not affiliated with publishers or the college, educational only, cite-only, privacy.
- [ ] `SECURITY.md` + private vulnerability reporting enabled; MFA on the GitHub account; the public repo `450h/im-companion` exists.
- [ ] `LICENSE` (MIT) + `content/LICENSE` (CC BY-NC-SA 4.0).
