# ADR-0003 — Cite-only content: no copyrighted material in the repo or app
- Status: Accepted
- Date: 2026-10-21
- One-way door: yes

## Context
- The sources are commercial copyrighted textbooks and EMQ books, and the repo and releases are public.
- GitHub disables a whole repository on a valid DMCA notice that isn't remedied within about one business day ([GitHub DMCA policy](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy), accessed 2026-10-21, High).
- Saudi Arabia's 2026 Copyright Law raises maximum penalties to SAR 1M ([Mondaq](https://www.mondaq.com/saudiarabia/copyright/1767752/saudi-arabia-copyright-law-2026-key-changes-and-what-businesses-need-to-know), Medium).
- The owner first chose "bring your own books" (the app renders the student's PDFs), then refined it to **"just reference them… the app references the books and they go and check them out"**.

## Decision
The repo and the app contain **only original content**:
- summaries, cards and questions written in our own words, organised by the blueprint;
- original diagrams;
- **citations** (book · edition · chapter · printed page · figure number, plus an optional e-book page. No file names or folder references);
- for the EMQ volumes, an **answer-key index** (locations, answer letters, original explanations).

There are no PDFs, page images, book figures or verbatim text, and the app has no PDF viewer and no source-folder linking. Guarded by `.gitignore`, a CI check and the content lint's n-gram check (SECURITY §12).

## Consequences
- **Pictures:** book figures are cited ("see Fig 24.18, p. 870"), not shown. Original diagrams fill some of the gap, and openly licensed images are decision D5.
- EMQ-volume practice happens with the book open, using the app's answer sheet.
- Students without the PDFs still get the summaries, cards and questions.

## Alternatives considered
- Bundle the PDFs and figures: rejected (infringement, takedown).
- Render from the student's own PDFs: legally viable, but declined by the owner for simplicity.

## Reversal cost
Very high in the loosening direction. Copyrighted material committed to a public history needs a history rewrite and a re-release. Loosening this rule needs counsel (L1).
