# Glossary

| Term | Meaning in this project |
|---|---|
| **Blueprint** | The college's "Student Master Assessment Blueprint" for Med 611: systems → topics → learning objectives → assessed in (Mid-term / Final / OSCE) |
| **Track** | Midterm (exam 1 Dec 2026) or Final (exam 5 Jan 2027). Each has its own plan |
| **Topic** | One blueprint row (e.g. "Acute kidney injury"). The unit of New Study |
| **Section** | One part of a topic summary, matching one or a few blueprint objectives |
| **Block** | The smallest content unit in a section (paragraph, bullets, table, diagram, pearl, pitfall, figure reference). Always cited |
| **Citation** | Book · edition · chapter · printed page (· e-book page · figure). Students look it up in their own copy |
| **Content pending (⏳)** | A topic whose content hasn't shipped yet. Its tasks never go Overdue, and "Studied from the book" marks it studied |
| **Capabilities** | The features a given app version has (quizzes, practice, drills, exams, mocks, OSPE). Completion rules adapt to them |
| **Skim** | A topic converted to half its study hours when a late start leaves too little time (R-2) |
| **OSPE practice** | Midterm task: look up the cited figures for recent topics and answer questions about the findings |
| **Day-start hour** | When the app's "day" begins (default 04:00), so late-night study counts for the previous day |
| **Golden plan fixtures** | Committed expected plans for fixed start dates that the engine must reproduce exactly |
| **Pearl / Pitfall** | A high-yield fact / a classic exam trap |
| **Figure reference** | A pointer to a figure in a book (never the image itself) |
| **EMQ** | Extended Matching Question: a theme, an option list (A–N), a lead-in, and several vignettes each matched to one option. The midterm format |
| **SBA / MCQ** | Single Best Answer multiple-choice: a vignette, a lead-in and 5 options. The final format |
| **OSPE** | Objective Structured Practical Examination: the midterm "slide exam" (images/specimens) |
| **OSCE** | Objective Structured Clinical Examination: listed in the blueprint for the final |
| **Worked example** | A solved question shown inside the reader with its reasoning |
| **Section quiz / Topic quiz** | 2–5 questions after each section / 8–12 after a topic. They complete New Study |
| **Chapter exam** | A fixed, timed exam per system (e.g. Cardiology) |
| **Mock midterm / Mock final** | A fixed timed paper in the exam's format |
| **EMQ Volumes answer sheet** | Practice mode for EMQs for Medical Students Vols 1–3: the student reads the book, answers in the app, and is marked against our key |
| **Study link / routing** | What a wrong answer shows: the summary section to study + the book citation |
| **Phase** | Learn → Consolidate → Final revision → Exam (from the Excel planner) |
| **Session (S1, S2, …)** | A slot within a study day, numbered in order |
| **Task type** | New Study · Revision (R1–R4 or a Revision pass) · Questions · Weak Areas · Final Revision · Exam (Rest = non-study days) |
| **R1–R4** | Spaced reviews 1, 3, 7 and 14 days after first study |
| **Revision pass** | Final-track task that re-studies a midterm topic before new reviews start |
| **Accuracy band** | Weak < 60% · Borderline 60–74% · Strong ≥ 75% |
| **Needs review** | Studied, and Weak (≥ 5 attempts) or confidence ≤ 2 |
| **Rebuild** | Regenerate the remaining plan from today, keeping completed work |
| **Content pack** | All original content JSON under `content/`, bundled in each release |
| **Source-check** | The mandatory automated pass where a separate agent verifies every block, card and question against its cited pages before release (ADR-0009) |
| **Update banner** | "Version X is available · Download". The app checks GitHub once per launch, and students install the new version over the old one (ADR-0008) |
| **Cite-only** | The rule that the app ships citations and original text, never book material (ADR-0003) |
