# 03 — Compliance: copyright, content licensing & medical disclaimer

> **Not legal advice.** Sources were accessed 2026-10-21 and carry confidence labels. Anything unresolved is in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) 🟥.

## 1. Why this chapter exists
The app is free, moves no money and processes no third-party personal data, so payments and privacy law don't drive the design. **Copyright does.** The source books are commercial, copyrighted works, and the repository and its releases are **public**. A valid takedown notice can disable the whole repository, and with it the update channel every student depends on.

## 2. The rules that matter (sourced)
| # | Finding | Source | Confidence |
|---|---|---|---|
| F1 | GitHub processes DMCA notices. If a notice says the whole repository infringes, GitHub disables the whole repository. Otherwise it gives the owner about **1 business day** to remove the content, and disables the repository if they don't. Each fork is handled separately. | [GitHub DMCA Takedown Policy](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy) | High |
| F2 | Copyright doesn't protect ideas, procedures, systems, methods or facts. A work's original selection, arrangement and expression are protected. | [US Copyright Office circulars index (Circular 33)](https://www.copyright.gov/circs/), 17 U.S.C. §102(b); *Feist v. Rural* via secondary summaries | Medium-High (the official circular text wasn't fetched) |
| F3 | Saudi Arabia (the owner's and cohort's jurisdiction) passed a **new Copyright Law**. It was published in the Official Gazette on 13 Feb 2026 and takes effect 180 days later (about mid-Aug 2026). Maximum penalties rise to SAR 1,000,000 and one year's imprisonment, and it adds platform safe-harbour rules. | [Mondaq / Gowling WLG, "Saudi Arabia Copyright Law 2026"](https://www.mondaq.com/saudiarabia/copyright/1767752/saudi-arabia-copyright-law-2026-key-changes-and-what-businesses-need-to-know) | Medium (secondary source) |
| F4 | The previous Saudi law (2003) allowed quotation "within customary practice… with source and author named" and use for illustration in teaching. **Whether the 2026 law keeps equivalent exceptions wasn't verified.** | [Mondaq (2003 law overview)](https://www.mondaq.com/saudiarabia/commercial/3555/copyright-law-in-saudi-arabia), [WIPO Lex](https://www.wipo.int/wipolex/en/legislation/details/3594) | Low for the 2026 position → L1 |

## 3. What we ship and what we never ship
| Category | Ships? | Basis |
|---|---|---|
| Textbook PDFs, page images, scans | ❌ Never | Copyrighted works (F1) |
| Book figures, photos, ECG strips, tables (as images or re-typed verbatim) | ❌ Never | Copyrighted expression |
| EMQ-book question stems, option lists, answer explanations (verbatim or close paraphrase) | ❌ Never | Copyrighted expression |
| **Original summaries** written in our own words, organised by the *blueprint's* objectives (not the book's structure), each point citing book · edition · chapter · page | ✅ | Facts and ideas aren't protected (F2). Our selection follows the blueprint, and citation is good scholarly practice (F4) |
| **Citations**: bibliographic references, page numbers, figure numbers ("see Davidson's 24e Fig 24.18, p. 870") | ✅ | Bibliographic facts |
| **EMQ-volume answer key**: for each item, volume/theme/item number → the correct **option letter**, our topic mapping, and an **original** one-to-three-sentence explanation | ✅ (Medium risk; see L2) | Short factual data plus original text. No stems or option lists are reproduced |
| **Original questions** (SBA/MCQ, EMQ themes) written by us "in the same logic" as the volumes, with new vignettes, option lists and explanations | ✅ | Original works. The exam *format* isn't protected (F2) |
| **Original diagrams/tables** (SVG) drawn from facts, e.g. an acid-base algorithm or an AKI staging table | ✅ | Original expression. Not traced from a book figure |
| Openly licensed images (e.g. Wikimedia Commons, with attribution) | ⏸ Decision D5 | License compatibility with CC BY-NC-SA needs a check |

## 4. Content guardrails (enforced in review and by the content linter, [09](09-content-pipeline.md))
1. **No verbatim runs.** No sentence may copy a source sentence. The linter flags any 12+ word run that matches the source text extract used during generation.
2. **Our own structure.** Summaries follow the blueprint objective list, not a chapter's headings.
3. **Every block cites ≥ 1 source page.** An uncited block fails the lint.
4. **Figures are referenced, never reproduced.** An original diagram must not be a trace of a book figure.
5. **EMQ answer key = letters + original explanations only.**
6. **Attribution:** the About screen and README list every cited book with its edition and publisher, and state that the app isn't affiliated with or endorsed by them.
7. **Takedown response:** if a rights holder complains, remove the specific content within 24 hours (F1's 1-business-day window), ship a patch release, and log it.

## 5. Our own licensing (ADR-0006)
- **Code:** MIT.
- **Content pack** (`content/`): **CC BY-NC-SA 4.0**. Classmates and others may share and adapt it with attribution, non-commercially, under the same license.
- Third-party names and book titles are used only to identify the sources (nominative use).

## 6. Medical-content disclaimer
The content is summarised from the cited sources, and every topic passes an automated source-check against its cited pages before release (ADR-0009). Like any study material, it carries a standard disclaimer. The disclaimer is shown in About and on first run: *"For exam study only. Not clinical guidance. Always verify against the cited source. Report errors with the ⚑ button."* Error reports become GitHub issues ([06](06-features.md) §8).

## 7. Privacy (short)
The app collects nothing. Progress is stored in `%APPDATA%\MED 222 IM Companion\` on the student's PC. The only network request is the "newer version?" check to GitHub (ADR-0008), and GitHub sees the requester's IP like any download. Content-error reports are opened by the student in their own browser, so nothing is sent silently.

## 8. Ownership map
| Requirement | How it's satisfied | Owning component |
|---|---|---|
| No copyrighted material in repo or installer | Cite-only content model; `.gitignore` blocks `*.pdf`; CI fails if a PDF or a page-image folder is committed | ADR-0003, CI |
| No verbatim copying | Content linter n-gram check + the source-check pass | `scripts/content-lint`, 09 §4 |
| Takedown readiness | SECURITY.md contact, 24-hour removal procedure | Owner |
| Disclaimer visible | First-run screen, About | Renderer |
| License clarity | `LICENSE` (MIT), `content/LICENSE` (CC BY-NC-SA 4.0) | Repo |
