# ADR-0004 — Pre-generated content pack in the repo, with immutable IDs
- Status: Accepted
- Date: 2026-10-21
- One-way door: IDs (yes)

## Context
The owner chose a **pre-generated content pack** over live AI. Students shouldn't need API keys, pay per use, or be online. The same content for everyone means an error is fixed once, for all. Progress events reference content by ID.

## Decision
- Content is generated at build time by Claude from the source pages (docs/09), stored as JSON in `content/` (one file per topic), linted in CI, and bundled read-only into each release. Content ships through the normal app update.
- **All content IDs (topic, section, card, question, exam, EMQ theme) are immutable.** Changing meaning means retiring the ID in `content/retired.json` and adding a new one.

## Consequences
- Reviewable diffs, and a single update channel.
- Content errors are fixed by a patch release.
- The pack grows the installer by an estimated 5–15 MB JSON, small next to Electron's ~100 MB.

## Alternatives considered
- Live AI generation (cost, keys, variance, offline loss).
- A separate content download channel (a second trust path to secure).

## Reversal cost
Low for the delivery mechanism. **High for IDs**: renaming orphans every student's history unless a migration map is shipped.
