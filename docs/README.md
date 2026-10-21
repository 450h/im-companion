# MED 222 IM Companion — Product & Technical Specification

A free Windows study app for the Internal Medicine course (blueprint code **Med 611**, MBBS). It turns the course blueprint into a study plan that tracks itself. It also holds summaries of every blueprint topic, with a source citation on every point, plus flashcards, solved practice questions, section quizzes, chapter exams and EMQ/MCQ mock exams. Every wrong answer tells the student exactly where to study.

_Generated with the `new-project` skill (claude-skills commit `5b77abd`) on 2026-10-21._

## ⚠️ How to read this
- **Who runs it:** a solo owner (a student in the cohort). Claude Code builds the app and writes the content. A QA agent reviews the app, and an automated source-check verifies every topic against its cited pages before release ([ADR-0009](decisions/0009-automated-source-check-instead-of-owner-review.md)). Owner review of content is optional. Estimates are sized for that.
- **Not legal advice.** Legal, vendor and technical claims were checked against sources on 2026-10-21 and are cited inline with a confidence label. Unresolved items are in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).
- **Profile: "Local-first Lite"**, the same as the owner's DailyPot app:
  - There's no server, no account, no money and no telemetry. Each student's progress stays on their own PC.
  - **That progress is still real and precious** (weeks of study history before an exam), so durability is built into the app itself ([ADR-0002](decisions/0002-local-json-storage-and-backups.md)).
  - The only network traffic is one "is there a newer release?" check against this repo's public GitHub Releases. Students download new versions themselves ([ADR-0008](decisions/0008-update-notifier-manual-download.md)).
  - Re-run the skill's Conditions table if the app ever gains sync, accounts, analytics or a server.
- **The copyright line is the project's main legal risk.** The app ships **no copyrighted material**: no textbook PDFs, figures, or EMQ-book questions. It ships only original content that **cites** the books (book · edition · chapter · page), and students look the citations up in their own copies ([ADR-0003](decisions/0003-cite-only-no-copyrighted-material.md), [03](03-compliance.md)).

## Delivery process (owner-chosen, replaces the two stop-gates)
The owner asked for the app "as soon as possible", and chose the same flow as DailyPot:
1. The docs are written first, and a **QA agent** reviews them. Its findings are fixed.
2. The app is built in phases P1–P4 ([08](08-roadmap-and-risks.md)). **A GitHub release ships after every phase**, so students get the tracker early. The app tells them when a new version with more content is out.
3. A QA agent reports after each phase, and the owner tries the release.
- **Owner changes after the first draft (2026-10-21):** a simple update notifier instead of an auto-updater (ADR-0008), and an automated source-check instead of owner review gating (ADR-0009).

## Reading order
1. [Product overview](01-product-overview.md): users, jobs, journeys, substitutes, success metric, scope
2. [Compliance: copyright & content](03-compliance.md): what we may and may not ship, plus the medical disclaimer
3. [Architecture](04-architecture.md): processes, content pack, distribution and update, one-way doors
4. [Data model & planner engine](05-data-model.md): **the study-plan rules**, content schema, progress store, IPC authorization
5. [Features](06-features.md): screens, study modes, acceptance criteria, IPC contract
6. [Threat model](07-threat-model.md)
7. [Roadmap & risks](08-roadmap-and-risks.md): phases, QA criteria, testing, pre-mortem
8. [Content pipeline](09-content-pipeline.md): how summaries, cards and questions are produced, cited, linted and source-checked

Chapter 02 (monetization) is intentionally absent, because the app is free and non-commercial. Chapter 03 is kept even though no regulated activity is involved, because copyright is the risk that can take the repository down.

## Scope & intake record
- **Intake summary (2026-10-21):**
  - A Windows desktop app, downloadable like DailyPot, for the owner's cohort. Free, not sold, public GitHub repo.
  - Source material is the 14 PDFs in the owner's `Med_source` folder: Davidson's 24e, Kumar & Clark 10e, Essentials of Kumar & Clark, First Aid Step 2 CK 11e, Goldberger's ECG, IM in 25 days (Dr. Allam), Pocket Medicine 8e, Step-Up to Medicine 6e, Talley & O'Connor 8e, Washington Manual 36e, ZeroToFinals, and EMQs for Medical Students Vols 1–3. The course blueprint (Med 611) and the owner's Excel planner are also in that folder.
  - Exams:
    - **Midterm, Tue 1 Dec 2026:** EMQs + OSPE slide exam (blueprint tool table; the blueprint also lists an assignment).
    - **Final, Tue 5 Jan 2027:** MCQs (the blueprint also lists OSCE and an assignment; see D4).
  - Required features:
    - the Excel planner's logic embedded and **logging progress automatically**, split into a **Midterm** tracker and a **Final** tracker (the final covers new material plus revision of the midterm overlap)
    - summaries driven by the blueprint, with sources
    - pictures where available
    - flashcards and other study modes
    - solved questions per chapter, then quizzes after each section and small exams per chapter
    - every wrong answer says where to study
    - the three EMQ volumes implemented, plus original questions in the same style
  - Owner decisions:
    - **cite-only** books, with no source folder or fingerprinting (the student looks citations up in their own copy)
    - a **pre-generated content pack**, with no live AI
    - **cohort** audience, with the **owner as content reviewer**
    - **Windows only**
    - name **"MED 222 IM Companion"**
    - license: **code MIT + content CC BY-NC-SA 4.0**
    - the DailyPot delivery flow
  - Operator: solo. Budget: free/lean. Timeline: urgent (the midterm is 41 days away on intake day).
- **Contradictions found:**
  1. **Name vs course code.** The chosen name says "MED 222", but the blueprint's course code is **Med 611**. It's used as given, and logged as D1.
  2. **"Pictures related to the material" vs cite-only.** The books' figures can't be shown without shipping copyrighted images, and the owner later chose "just reference them". Resolution: figures are **cited** (figure number + page), and the pack includes **original diagrams and tables** we draw. Openly licensed images are an open decision (D5).
  3. **"Implement the EMQ volumes" vs cite-only.** The volumes' question text is copyrighted, so it isn't reproduced. Resolution: an **answer-sheet mode**. The app tells the student which volume, theme and page to open, collects their answers, and marks them against our answer key. Each item gets our own short explanation and a "where to study" link ([09](09-content-pipeline.md) §5). Original EMQs in the same style are added on top.
  4. **Final exam format.** The owner said "Final… MCQ". The blueprint's tool table says Final = MCQs + OSCE + assignment. MCQ practice is built, and OSCE support is logged as D4.
  5. **The Excel plan starts 21 Oct**, but students will install later. The planner generates each student's plan **from the day they start**, using the same structure and rules (05 §3).
  6. **The skill defines Lite as "no production data"**, but students' progress is real data on their own PCs. Durability is therefore moved into the app (ADR-0002), as in DailyPot.
- **QA review of these docs (2026-10-21):** CHANGES REQUIRED, with 6 blocking and 13 non-blocking findings. All are addressed:
  - The core study loop moves into v0.1.0, and completion rules adapt to app capabilities (B1).
  - All 90 topics' metadata ships in v0.1.0, with ⏳ content-pending states (B2).
  - Proportional placement, skim conversion and refusal rules, with golden fixtures (B3).
  - `topicCompleted` events (B4).
  - Review spreading and one-review-per-session, with no double counting (B5).
  - An Excel-deviation table, and mocks moved into Consolidate (B6).
  - The non-blocking findings are fixed in 04/05/06/08/09, the frameworks, ADR-0008, OPEN-QUESTIONS (C2, D5) and the GLOSSARY.
  - Release cadence is now about one per week.
- **Vendor check (2026-10-21):**
  - **No data-holding vendors.** GitHub hosts the source and the release installers, and holds no user data.
  - Dependency versions and licenses were checked on npm on 2026-10-21 (High): electron-builder 26.15.3 MIT, zod 4.6.7 MIT, React 19.3.1 MIT.
  - Newer majors exist (Electron 45, electron-vite 6, Vite 8, TypeScript 7). We deliberately stay on DailyPot's verified set (ADR-0001).
  - Updates: electron-updater's behaviour on **unsigned** Windows builds isn't documented ([electron.build auto-update](https://www.electron.build/docs/features/auto-update), Medium). The owner therefore chose a plain "new version available → download" notifier (ADR-0008), which uses one anonymous GitHub API request per launch.
  - Copyright sources are cited in [03](03-compliance.md).
- **Flags set:** `IF_UI`, `IF_SOLO`, `IF_WEB` style rules adapted to Electron. Lite-style operator profile: no `IF_PROD_DATA` server ops, no `IF_PII` processing by the maintainer, no `IF_PAYMENTS`, no `IF_COMMERCIAL`, no `IF_THIRD_PARTY`. Single language (English, which is the course language), so no `IF_LOCALIZED`/`IF_RTL`. The compliance chapter is kept for copyright (see above).

## Engineering frameworks (read before coding)
- [frameworks/SECURITY-FRAMEWORK.md](frameworks/SECURITY-FRAMEWORK.md)
- [frameworks/DEVELOPMENT-FRAMEWORK.md](frameworks/DEVELOPMENT-FRAMEWORK.md)

## Foundations
- [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) · [GLOSSARY.md](GLOSSARY.md) · [decisions/](decisions/)
- Repo root: [../CLAUDE.md](../CLAUDE.md), [../README.md](../README.md), [../.env.example](../.env.example), `.github/` templates.
