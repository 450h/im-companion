# 09 — Content pipeline

How the content pack is produced. The rules in 03 §4 (no verbatim text, cite everything, figures referenced only) apply at every step.

## 1. Inputs (on the owner's PC only, never committed)
The owner's local source folder (`IMC_SOURCE_DIR`) holds the books, the blueprint and the Excel planner. It is never referenced in the app or the public docs beyond this build-time variable (QA N6).
- Text is extracted per page into `.work/text/<bookId>/<pdfPage>.txt` (gitignored) with `scripts/extract/extract_text.py`.
- **EMQ Vol 3 is scanned**, so its pages are OCR'd at build time (tesseract.js, Apache-2.0, a dev dependency only) into the same `.work/text` layout. The copy-check lints can then run on it too (QA N7).
- A **page map** (PDF page ↔ printed page) is built per book from running headers and footers, then spot-checked.

## 2. Sources and their roles
| `bookId` | Source | Role | Text layer |
|---|---|---|---|
| `davidson24` | Davidson's Principles and Practice of Medicine, 24th ed. | **Primary**: pathophysiology, clinical features, investigations, management | Yes (1,440 pp) |
| `kumar10` | Kumar & Clark's Clinical Medicine, 10th ed. | **Primary**: second authority, cross-check | Yes (1,508 pp) |
| `kcEssentials` | Essentials of Kumar & Clark's Clinical Medicine (Pocket Essentials) | Quick facts, pearls | Yes |
| `zerotofinals` | Zero to Finals | Concise summaries, pearls | Yes |
| `allam25` | IM in 25 days (Dr. Allam) | Local-course emphasis, high-yield lists | Yes |
| `pocket8` | Pocket Medicine, 8th ed. | Workups, algorithms, management tables | Yes |
| `stepup6` | Step-Up to Medicine, 6th ed. | Question-style framing, clinical vignettes logic | Yes |
| `fa2ck11` | First Aid for the USMLE Step 2 CK, 11th ed. (2023) | High-yield, MCQ-style emphasis | Yes |
| `washington36` | The Washington Manual of Medical Therapeutics, 36th ed. | Drug management and doses | Yes |
| `talley8` | Talley & O'Connor's Clinical Examination, 8th ed. | History & physical topics, signs | Yes |
| `goldberger` | Goldberger's Clinical Electrocardiography: A Simplified Approach | ECG/arrhythmia topics | Yes |
| `emq1`, `emq2` | EMQs for Medical Students, Vols 1–2 | Answer-key index + style model | Yes |
| `emq3` | EMQs for Medical Students, Vol 3 | Answer-key index + style model | **No (scanned)**: OCR'd at build time into `.work/` |

Exact editions, authors, publishers and years are confirmed from each book's title page while building v0.1.0 and recorded in `content/books.json`.

## 3. Per-topic production steps
1. **Scope:** take the topic's metadata from `content/blueprint.json`: objectives, priority, assessed-in (Mid/Final/OSCE) and `studyHours`. In v0.1.0 that file is built from `scripts/seed/planner-topics.json` (the Excel extract) plus the blueprint PDF's objective text (05 §2.1).
2. **Locate:** find the relevant page ranges in `davidson24` and `kumar10` (chapter indexes and text search), plus at least one quick source (`zerotofinals`, `kcEssentials`, `allam25`, `pocket8`). Add `talley8` for history & exam topics, `goldberger` for arrhythmias, and `washington36` for drug management.
3. **Write sections**, one per objective (or per small group of objectives):
   - It's written **in our own words**, organised by the blueprint, not by the book.
   - Blocks are short: bullets and tables preferred, plus ⭐ pearls (what examiners love) and ⚠ pitfalls (classic traps).
   - **Each block cites the exact page(s)** it came from (printed page, plus the e-book page where known). Where two books disagree, follow Davidson's and note the difference as a pitfall.
   - **Figure references:** where a book figure clarifies (an ECG, an X-ray pattern, a histology image, an algorithm), add a `figureRef` with the figure number and page. That's useful for the OSPE slide exam ("Look at: Davidson's Fig 24.18, p. 870").
   - **Original diagrams** (SVG) only for algorithms or tables we construct ourselves, never traced from a figure.
   - **Rapid review:** pearls and tables are written to stand alone, since they make up the rapid-review mode.
4. **Cards:** 10–30 per topic (scaled to `studyHours`). Each card tests one fact, has a `sectionId` and cites a source.
5. **Questions** (all original vignettes):
   - `worked`: 3–5 per topic, shown solved inside the reader with step-by-step reasoning.
   - `quiz` with `quizScope: section`: 2–5 per section (the section quiz).
   - `quiz` with `quizScope: topic`: 8–12 (the topic quiz, separate from the section quizzes).
   - `practice`: ≥ 10 per topic (feeds Questions tasks and drills).
   - `exam`: 3–6 per topic (chapter exams only).
   - `mock`: ≥ 2 per midterm topic and ≥ 2 per topic for the final (reserved for mock papers, never seen elsewhere).
   - Format mix: **midterm topics ≥ 50% EMQ items**; final-only topics SBA-first. EMQ items count individually toward minimums.
   - **OSPE figure notes** (midterm topics with `figureRef`s): for each cited figure, a one-line "what to identify" note and 1–2 questions written from facts about that finding (not from the figure itself).
   - Every item has an `explanation`, a `studyRef` and cites. SBAs have a `whyNot` for each distractor.
6. **Lint** (`npm run content:lint`): schema, refs, invariants (05 §2.3), SVG sanitiser, raster-image guard, and the local **copy check** against `.work/text`:
   - a 12+ word overlap with any source, and an 8+ word overlap with EMQ-volume text;
   - an original EMQ theme whose option list overlaps a same-titled volume theme by > 50%.
   
   On a pass it writes `copyCheck {passedAt, contentHash}`.
7. **Source-check pass (mandatory, ADR-0009).** A separate agent that didn't write the topic re-reads **every** block, card and question against the text of its **cited pages**. It checks:
   - (a) the claim is supported by the cited page;
   - (b) numbers, doses, cutoffs and criteria match exactly;
   - (c) the printed page, e-book page (if given) and figure numbers are right;
   - (d) each answer key is correct and the distractors are wrong;
   - (e) every blueprint objective is covered.
   
   Failures are fixed and re-checked. On a pass, the topic gets `sourceCheck: {passedAt, checkerVersion, contentHash}`.
   
   **CI recomputes `contentHash` and fails if either check's hash doesn't match.** Any later edit forces both checks to be re-run (QA N8).
8. **Release.** No owner sign-off is required (§6).

## 4. Question style: "the same logic as the volumes"
The EMQ volumes' pattern, reproduced in **form only**:
- **Theme** (e.g. "Causes of hyponatraemia"), an **option list of 8–14 items** (A–N) sharing one category, a **lead-in** ("For each patient below, choose the most likely…; each option may be used once, more than once or not at all"), and **3–6 clinical vignettes**. Each vignette has a discriminating clue (age, timeline, a key lab or sign).
- Distractors are plausible members of the same category. At least one vignette needs a second-order step (interpret the lab value, then name the cause).
- **SBA (final):** a vignette + lead-in + 5 options (A–E), one best answer, and homogeneous distractors.
- **Avoid:** "all of the above", negatively phrased stems (unless marked), and cues that give the answer away (grammar or length).

## 5. EMQ volumes answer-key index (`content/emq-volumes.json`)
1. Volumes 1–2: parse the text layer for themes (`THEME:` headers), item counts and the answers section. Volume 3: parse the OCR text in `.work/text/emq3/`, and check unclear answer letters against the rendered page images.
2. For each theme, record: volume, part/paper label, theme number, theme title (a short name, recorded as an identifier), question page, answers page, option count, item count and **answer letters**.
3. Map blueprint-relevant themes to `topicId` (+ `sectionId` where clear). Themes outside the blueprint (e.g. surgery, ENT) are kept with `inBlueprint: false` and hidden by default.
4. Write an **original** 1–3-sentence explanation per item. **Never** copy the book's explanation, stems or options. A lint check confirms no 8+ word overlap with the extracted text.

## 6. Corrections (and optional owner review)
- ⚑ issues get the label `content-error`. Each one is verified against the cited page. A confirmed error is fixed, the topic is re-run through the source-check, and a patch release names the topic in its notes.
- If one system collects > 3 confirmed errors, re-run the source-check on that whole system (C6).
- The owner may review any topic but doesn't have to. If they do, `ownerReviewedAt` is recorded in the topic file. No badge depends on it.

## 7. Versioning
- `contentVersion` is in `YYYY.MM.DD.n` format in `content/manifest.json`, and each topic file has its own `contentVersion`.
- IDs are **immutable**. Changing a question's meaning means retiring the old ID (`content/retired.json`) and creating a new one.
