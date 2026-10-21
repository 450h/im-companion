# Content authoring guide (for content agents)

This is how to write one topic file `content/topics/<topicId>.json`. The schema is `TopicContentSchema` in [src/shared/content-schema.ts](../src/shared/content-schema.ts), the pipeline is [09-content-pipeline.md](09-content-pipeline.md), and the legal rules are [03-compliance.md](03-compliance.md) §3–§4.

## Hard rules (a violation means the topic is rejected)
1. **Own words only.** Never copy a sentence from a source. No run of 12+ consecutive words may match any book (8+ for the EMQ volumes); `content-tools copycheck` enforces this. Paraphrase, restructure, use bullets and tables.
2. **Never reproduce EMQ-volume questions**: no stems, no option lists, no explanations. Our EMQs are **new** vignettes with **new** option lists in the same *format*.
3. **Cite every block, card and question.** Each citation points to the source page where the fact actually appears: `{"book": "davidson24", "pdfPage": 880, "page": 880, "chapter": "Hepatology"}`.
   - Set `page` equal to `pdfPage`. The normaliser converts it to the printed page.
   - `pdfPage` is the number in the `.work/text/<book>/<NNNN>.txt` file name.
   - Add `"figure": "Fig. 24.18"` when citing a figure.
   - **Only cite pages you actually read.** If you can't find a page for a fact, drop the fact.
4. **Follow the blueprint.** Cover every objective of the topic (`objectiveIdx` = 0-based indexes into `content/blueprint.json` → topic → `objectives`). Organise by objective, not by the book's chapter structure.
5. **Primary authority is Davidson's 24e.** Where Kumar & Clark or a quick source disagrees, follow Davidson's and add a `pitfall` block noting the difference.
6. **No clinical-advice tone.** Write for exam study. Drug doses only where examinable, and always cited.
7. **IDs:** every id starts with `<topicId>.` (sections `<topicId>.s1`, cards `<topicId>.c1`, questions `<topicId>.q1`, OSPE notes `<topicId>.o1`). They're lowercase and unique within the topic.

## File shape
```json
{
  "topicId": "neph-aki",
  "contentVersion": "2026.10.22.1",
  "sections": [
    {
      "id": "neph-aki.s1",
      "title": "Definition & KDIGO staging",
      "objectiveIdx": [0, 1],
      "blocks": [
        { "type": "para", "text": "AKI is a **rapid fall in GFR** over hours to days…", "cites": [ { "book": "davidson24", "pdfPage": 434, "page": 434 } ] },
        { "type": "table", "title": "KDIGO stages", "columns": ["Stage", "Creatinine", "Urine output"], "rows": [["1", "…", "…"]], "cites": [ … ] },
        { "type": "bullets", "title": "Pre-renal causes", "items": ["…", "…"], "cites": [ … ] },
        { "type": "pearl", "text": "…high-yield exam point…", "cites": [ … ] },
        { "type": "pitfall", "text": "…classic trap…", "cites": [ … ] },
        { "type": "figureRef", "cite": { "book": "davidson24", "pdfPage": 436, "page": 436, "figure": "Fig. 15.12" }, "note": "Look at: urine sediment — muddy brown granular casts in ATN" },
        { "type": "diagram", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 200\">…</svg>", "alt": "Algorithm: …", "cites": [ … ] }
      ]
    }
  ],
  "cards": [ { "id": "neph-aki.c1", "sectionId": "neph-aki.s1", "front": "KDIGO stage 3 creatinine criterion?", "back": "≥ 3× baseline, or ≥ 354 µmol/L, or starting RRT", "cites": [ … ] } ],
  "questions": [ … see below … ],
  "ospe": [ { "id": "neph-aki.o1", "sectionId": "neph-aki.s3", "cite": { "book": "davidson24", "pdfPage": 436, "page": 436, "figure": "Fig. 15.12" }, "identify": "Granular (muddy brown) casts → acute tubular necrosis" } ]
}
```
- **Markdown in text:** only `**bold**` and `_italic_`. No HTML, links or headings.
- **Diagrams:** optional, and only original ones (algorithms or tables you design). Use simple SVG elements (`svg g path rect circle line polyline polygon text tspan`). No scripts, styles, images, `foreignObject` or external refs.
- **Sections:** usually 4–8 per topic, short blocks, tables where comparisons help. Every section ends with useful pearls/pitfalls where there are any.

## Questions
Every question has `id`, `kind`, `pool`, `difficulty` (1–3), `cites`, and a `studyRef: {"sectionId": …}` pointing to the section that teaches the answer. For EMQs, `studyRef` is per item.

**SBA (single best answer, the final-exam format):**
```json
{ "id": "neph-aki.q1", "kind": "sba", "pool": "quiz", "quizScope": "section", "difficulty": 2,
  "stem": "A 68-year-old man … (clinical vignette with the discriminating clue)",
  "leadIn": "What is the most likely cause?",
  "options": ["A…", "B…", "C…", "D…", "E…"], "answer": 2,
  "explanation": "Why C is right, the key clue, what to remember.",
  "whyNot": ["why A is wrong", "why B is wrong", "", "why D is wrong", "why E is wrong"],
  "studyRef": { "sectionId": "neph-aki.s2" }, "cites": [ … ] }
```
- Options are homogeneous (all causes, or all drugs…). No "all of the above", and no length or grammar cues.
- `whyNot` has one entry per option, and `""` for the correct one.

**EMQ (extended matching, the midterm format):**
```json
{ "id": "neph-aki.q20", "kind": "emq", "pool": "practice", "difficulty": 2,
  "theme": "Causes of acute kidney injury",
  "leadIn": "Match each patient below with the most likely cause from the list above. Any option can be the answer for several patients, or for none.",
  "options": ["8–14 options, same category, plausible"],
  "items": [ { "stem": "vignette 1 …", "answer": 3, "explanation": "…", "studyRef": { "sectionId": "neph-aki.s2" } } ],
  "cites": [ … ] }
```
- **Never use the EMQ books' standard instruction sentence** ("each option may be used once, more than once or not at all") — it fails the copy check. Word the lead-in your own way, e.g. "Any option can be the answer for several patients, or for none."
- Each EMQ has 3–5 items. Each vignette has a discriminating clue (age, timeline, a key lab or sign). At least one item needs a two-step inference.

**Pools and minimum counts per topic** (EMQ items count individually; the lint enforces these):

| Pool | What it's for | Minimum |
|---|---|---|
| `worked` | Shown **solved** in the reader. Write an explanation that teaches the reasoning step by step | ≥ 3 |
| `quiz` + `quizScope: "section"` | The section quiz after each section | ≥ 2 items **per section** |
| `quiz` + `quizScope: "topic"` | The topic quiz (different questions from the section quizzes) | ≥ 8 items |
| `practice` | Practice bank, Questions tasks and drills | ≥ 10 items |
| `exam` | Chapter exams only | ≥ 3 items |
| `mock` | Mock exam papers only | ≥ 2 items |

- **Format mix:** for midterm topics (`assessedIn` includes `mid`), **≥ 50% of items are EMQ items**. For final-only topics, mostly SBA.
- **Cards:** 10–30 per topic (about 12 × `studyHours`, at least 1 per section). One fact per card.
- **OSPE notes:** for topics where images are examined (ECG, CXR, blood film, skin/eye signs, histology, imaging), add 2–8 `ospe` notes that point to real figures in the cited books.

## Workflow for one topic
1. Write the file.
2. Run `CONTENT_TOPIC=<topicId> CONTENT_DRAFT=1 npx vitest run src/main/content.test.ts` and fix **every** reported problem until it passes.
3. Run `node scripts/content-tools.mjs normalize <topicId>`.
4. Run the lint again.
