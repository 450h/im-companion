# 06 — Features

Navigation is a left sidebar: **Today · Plan · Study · Practice · Progress · Settings**. A track switcher (Midterm / Final) sits at the top of the sidebar, with a countdown ("41 days to midterm").

## 1. First run
- A welcome screen with the **disclaimer** (03 §6), which must be accepted. It also explains citations: "Every point cites a book and page, so you can check it in the book."
- Plan setup:
  - the track (Midterm before 1 Dec; Final from 1 Dec, R-9)
  - study weekdays (default Sun–Thu) and hours per day (default 5.5)
  - the day-start hour (default 04:00, so late-night study counts for the previous day)
  - the system order (drag to reorder; default GI first, as in the Excel)
- **"Already studied?"**: tick topics you've already covered and the date (R-10). They're logged as studied and get spaced reviews.
- A preview shows the phases, study days, daily load, and any warning, skim conversion or over-capacity notice (R-2.2). Then "Create plan".

**Acceptance:**
- A plan is created for any start date before the exam, and refused on the exam date (R-1).
- The 21 Oct defaults reproduce the Excel: Learn 20 / Consolidate 7 / Final 2, each system's first day, Fri/Sat empty.
- The other golden starts match their fixtures (08 §3).

## 2. Today (the Excel Dashboard's "Today & this week" + "Next up")
- Header: date, plan week number, phase, days to exam, study days left.
- **Today's sessions** (S1, S2, …), each with its type chip (New Study / Skim / Revision / Questions / OSPE / Weak Areas / Final Revision / Exam), its topics, planned hours, a status and a **Start** button.
  - **⏳ Content pending** tasks say which release brings the content, and offer **"Studied from the book"** (R-6.3).
  - Tasks for features this version doesn't have yet are **manual** (a tick box).
- **Due reviews** (R-5) and **flashcards due** (R-11).
- An **Overdue** list (up to 8, with "see all") and a "Rebuild plan from today" prompt when R-10 applies.
- Today's progress bar (done hours / planned hours) and this week's.

**Acceptance:**
- Starting a New Study session opens the reader at the first unread section.
- Finishing all sections and the topic quiz marks the session Done without any manual action.

## 3. Study (reading)
- **Topic list** by system, with filters: track, priority, studied, needs review. Each row shows its assessed-in chips (Mid/Final/OSCE) and the accuracy band.
- **Topic page:**
  - the objectives checklist (from the blueprint)
  - sections rendered from blocks (paragraphs, bullets, tables, original diagrams, ⭐ pearls, ⚠ pitfalls, 📖 figure references)
  - **every block shows its citation chip(s)**; clicking one shows the full citation (book · edition · chapter · page · figure, plus the e-book page where known) and a "Copy" button
  - **Worked examples** (solved questions) at the end of the relevant section, with the answer and reasoning visible
- **Section end:** "Mark read", then the **section quiz** (2–5 Qs) opens inline. Results show right away with routing (R-12).
- **Topic end:** the **topic quiz** (8–12 Qs), then a confidence rating of 1–5.
- **Rapid review mode:** only pearls, tables and pitfalls, one screen per topic. It's used for Final revision.
- **Personal notes** per section. **Search** across topic titles, section titles and block text (in memory, instant).
- **⚑ Report an error** on any block, card or question. It opens a prefilled GitHub issue in the browser with the content ID, version and the student's comment (no personal data).

## 4. Practice
| Mode | What it does | Feedback |
|---|---|---|
| **Flashcards** | Due cards by topic/system/all, with Again/Hard/Good/Easy (R-11) and keyboard 1–4 | Immediate |
| **Practice questions** | Choose topics, format (SBA/EMQ/both) and count | Tutor mode: explanation and routing after each answer |
| **Topic quiz** | Retake any topic's quiz | After each answer |
| **Chapter exam** | A fixed exam per system, timed | Exam mode: results only at the end, by topic and section |
| **Mock midterm (EMQ)** | A fixed EMQ paper in the midterm style, timed | At the end |
| **Mock final (MCQ)** | A fixed SBA paper in the final style, timed | At the end |
| **EMQ Volumes** | Answer sheet (below) | Per theme |
| **Weak drill** | 15 questions from weak topics, preferring ones answered wrong before (R-7) | Tutor mode |
| **OSPE practice** (midterm) | For each recently studied topic, the list of **cited figures** to look at in the book (with what to identify) plus any D5 open images, then 3–5 "what does this show / what's the next step" questions written from the figure description | Tutor mode |

**EMQ Volumes answer sheet:**
- A list of themes by volume, filterable to blueprint-relevant ones, each showing "Vol 2 · Paper 3 · Theme 12 · p. 85".
- The student opens their own copy at that page and picks a letter (A–N) for each item.
- **Mark** shows correct/incorrect per item, the correct letter, our original explanation, and the study link (topic › section). The answer pages in the book are cited for the full original explanation.
- Attempts count towards topic accuracy when the theme is mapped to a topic.

**Exam UI rules:**
- A visible timer, flag-for-review, and a question navigator grid. Answers can be changed until submission (last answer wins, R-12).
- Submitting asks for confirmation if any questions are unanswered.
- Results are stored and can be re-reviewed later.

## 5. Plan (the Excel Master Schedule + Weekly Planner)
- **Schedule view:** grouped by week, with date, day, phase, session, system, task, type, priority, planned hours, status and flag. Today is highlighted, overdue rows are red, and done rows are dimmed.
- **Manual override** per task: Done / Skipped / Reset, through a menu, recorded as an event.
- **Week view:** Sun–Sat columns with daily priorities and planned/done hours, plus the **weekly review box** (What went well · What to improve · Adjustments for next week). It prompts on the last study day of the week.
- Plan settings: change hours, weekdays or system order (→ rebuild with confirmation). Exam dates can be edited.

## 6. Progress (the Excel Dashboard + Revision/MCQ trackers + Blueprint Coverage)
- **KPI tiles:** days to exam, study days left, overall progress, topics studied, overdue tasks, question accuracy.
- **Progress by system** (bars), **weekly completion**, **hours by task type** (with a table view for every chart).
- **Revision tracker table:** topic · first studied · R1–R4 (due date + ✓) · confidence · accuracy band · needs review.
- **Question tracker table:** topic · attempted · correct · incorrect · accuracy · band · weak areas (wrong sections).
- **Blueprint coverage:** every blueprint topic, where it's assessed, its number of objectives, whether it's in this track, the scheduled date, and whether its content has shipped yet.
- **Final track:** midterm topics show their carried-over accuracy and a "Revision pass" status separately from the new topics.

## 7. Settings & data
- Theme (system/light/dark), font size and day-start hour.
- **Export progress** (JSON), **Import progress** (validated, with a `pre-import` backup), and **Restore from backup** (the list of snapshots).
- **Updates:** current app and content version, "Check for updates", and a "check on launch" toggle (default on). When a newer release exists, a banner appears on every screen: "Version X is available: <release title> · **Download**". Download opens the release page in the browser. The banner can be dismissed until the next version.
- **About:** version, content version, licenses (MIT + CC BY-NC-SA), the source books list with editions and publishers, a "not affiliated" statement, the disclaimer, and the GitHub link.

## 8. Content error reports
⚑ opens `https://github.com/450h/im-companion/issues/new?template=content_error.yml&...` with the form's fields prefilled by their IDs: `content_id` (the content ID), `versions` ("app X / content Y") and `details` (the student's comment, URL-encoded, max 1,500 chars). It's hardcoded to this repo (SECURITY §11) and needs a GitHub account (D9).

## 9. IPC contract (`src/shared/ipc.ts`, preload → `window.imc`)
| Command | Payload (zod) | Effect / returns |
|---|---|---|
| `app:info` | none | versions, content manifest summary |
| `content:get` | none | blueprint + available topics, validated (≤ 25 MB JSON; loaded once) + `capabilities` |
| `progress:get` | none | the whole progress state |
| `settings:update` | partial settings | updated settings |
| `plan:preview` | PlanConfig | generated tasks plus a capacity report (no write) |
| `plan:create` | PlanConfig | writes the plan (refused if one exists for the track; use rebuild) |
| `plan:rebuild` | {track, config?} | backup → regenerate (R-10) |
| `plan:override` | {track, taskId, status} | appends an override |
| `study:markRead` | {topicId, sectionId} | appends a sectionRead (idempotent per study day); main appends `topicCompleted` when R-6.1 is first met |
| `topic:setStudied` | {topicId, studied: bool, date?} | `topicCompleted {source: manual}` / `topicReopened` (first-run "already studied", "Studied from the book", reset) |
| `session:start` | {kind, topicId?, systemId?, examId?} | session id |
| `session:answer` | {sessionId, questionId, item?, choice, ms} | Tutor sessions: once per item → `{correct, answer, explanation, whyNot?, studyRef, cites}`. Exam sessions: stored, last answer wins, no feedback until complete. Correctness is always computed in main |
| `session:complete` | {sessionId} | grades exam sessions; score summary by topic/section; may append `topicCompleted` (topic quiz) |
| `cards:grade` | {cardId, grade} | next due |
| `topic:confidence` | {topicId, value} | — |
| `reflection:save` | {track, weekStart, …} | — |
| `notes:upsert` / `notes:delete` | note | — |
| `data:export` | none | save dialog in main → file path |
| `data:import` / `data:restore` | none / {backupName} | open dialog in main, validate → backup → replace |
| `update:check` | none | `{current, latest?, newer: bool, title?}`. Main fetches the latest release, validates it with zod, compares semver; offline → `newer: false` |
| `update:openDownload` | none | main opens the hardcoded releases URL |
| `report:openIssue` | {contentId, comment} | main builds the URL from constants and opens it |

All commands return `{ok: true, data} | {ok: false, error: {code, message}}`. Invalid payloads → `E_VALIDATION`, unknown IDs → `E_REF`.
