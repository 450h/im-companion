# 01 — Product overview

## 1. Premise
Before the Med 611 midterm, the cohort has a 23-page blueprint, 11 textbooks (about 14,000 pages), three EMQ books and very little time. The owner's Excel planner already answers "what do I study today?". **MED 222 IM Companion** puts that planner inside an app that also holds the study material. It does five things:
1. It **knows what to study**: every topic and learning objective on the blueprint, and which exam each one is assessed in.
2. It **summarises** each topic by learning objective, citing the book page behind every point.
3. It **tests** the student with section quizzes, topic quizzes, chapter (system) exams and mock exams in the real format (EMQ for the midterm, MCQ for the final).
4. It **routes every mistake** back to the summary section and the book page that answers it.
5. It **logs progress automatically** into a Midterm tracker and a Final tracker built on the Excel planner's rules.

## 2. Users and jobs
| User | Job they hire the app for | What they use today |
|---|---|---|
| **Cohort student** (primary) | "Tell me what to study today, give me the high-yield version with the source, and test me in the exam's format." | The owner's Excel planner, the PDFs, scattered notes, WhatsApp groups, random question banks, or nothing |
| **Owner / reviewer** (the student who maintains it) | "Ship something classmates can rely on, and fix errors fast." | Nothing; this is new |
| **Struggling student** (a sub-case) | "I'm behind and I'm not sure what I'm weak at." | Re-reading textbooks (low yield) |

**Who pays:** nobody. The app is free and not sold. **Value:** time saved and exam performance.

## 3. Top journeys (step counts)
1. **First run (5 steps):** install → choose the exam track (Midterm now; Final unlocks on the midterm date) → confirm study days (default Sun–Thu) and hours per day (default 5.5 h, from the Excel average) → optionally tick topics already studied (e.g. on the Excel plan) → the plan is generated from today to 1 Dec.
2. **A study day (3 steps to start):** open the app → **Today** shows the sessions → click "Start" on the first session. From there the loop is **read** a summary section, then the **section quiz** (2–5 Qs) runs automatically. After the last section comes the **topic quiz**, and the session is marked **Done** automatically.
3. **A wrong answer (1 click):** the result shows the correct answer and an explanation, plus **"Study this: › Section title"** (opens the summary at that section) and the **book citation** ("Davidson's 24e · Ch 24 · p. 862").
4. **Spaced review (2 steps):** Today lists "Review R2: Hypertension" → a review session (that topic's flashcards plus a short mixed quiz) → R2 is marked done, and the student rates their confidence 1–5.
5. **Chapter exam (2 steps):** after a system's topics are studied, Today offers "Cardiology exam (25 Qs, timed)" → the results screen breaks the score down by topic, and weak topics are scheduled into Weak Areas sessions.
6. **EMQ volume practice (3 steps):** Practice → EMQ Volumes → pick a theme ("Vol 1 · Ch 4 · Theme 7, p. 112")
7. **Content not out yet (1 click):** a New Study task for a system whose content hasn't shipped shows **⏳ Content pending** (never Overdue). The student can study it from the book and click **"Studied from the book"**, which schedules its spaced reviews. → open the book at that page, enter the answers in the app's answer sheet → marked, with our explanation and where to study.

## 4. Substitutes (including doing nothing)
- **The Excel planner** has the same plan logic, but progress is typed in by hand, and it has no content or questions. It's the floor this app must beat.
- **Commercial question banks** (UWorld, AMBOSS, etc.) are excellent but paid, US/UK-oriented, and not mapped to this blueprint or to the EMQ midterm format.
- **The textbooks alone** are authoritative but far too long for 41 days, and give no feedback.
- **Doing nothing / cramming** is the real competitor for a busy student.

**Why this wins for this cohort:** it's mapped to *this* blueprint and *these* exam formats, it's free, and it works offline after install.

## 5. Demand evidence
| Evidence | Grade | Notes |
|---|---|---|
| The owner built a detailed Excel planner for the cohort | **Usage** (owner) | Shows the job is real and the owner invests in it |
| Classmates asking for it | Not yet recorded | → checkpoint C1 measures it with release download counts (no telemetry) |

The evidence is owner-usage only. Since the app is free and the cost of being wrong is low, **demand is validated by shipping** (v0.1 within days) rather than by a separate validation phase. C1 sets the bar.

## 6. Success metric
**One metric:** before the midterm, the number of cohort students actively using the app ≥ **50% of the cohort**. Because there's no telemetry, it's measured by **GitHub release download counts plus a show of hands in the class group**. Cohort size is unknown (D7), and kill/pivot thresholds are in OPEN-QUESTIONS C1–C2.

## 7. Scope
**v1 (by the midterm):**
- the Midterm planner/tracker (auto-logging)
- summaries, flashcards, practice questions, section/topic quizzes and chapter exams for all **73 midterm topics**
- original EMQs, an EMQ mock midterm, and the EMQ-volume answer sheet
- a weak-areas drill, search, and backup/export

**v1.x (by 1 Dec, ready for the final):**
- the Final planner (from 2 Dec to 5 Jan)
- content for the **17 final-only topics**
- an MCQ bank and an MCQ mock final

**Out of scope for now:** macOS/Linux (D11), Arabic UI, sync/accounts, live AI generation, an OSCE station simulator (D4), displaying book pages or figures (ADR-0003).
