# Architecture Decision Records (ADRs)

Short, immutable records of **why** a significant choice was made. When a decision changes, **don't edit the old ADR. Write a new one that supersedes it** (mark the old one `Superseded by ADR-XXXX`).

## Format
`NNNN-short-title.md` with **Status · Date · Context · Decision · Consequences · Alternatives · Reversal cost**. Keep each under a page.

## Log
| ADR | Title | Status |
|---|---|---|
| [0001](0001-stack-electron-react.md) | Stack: Electron + React + TypeScript (DailyPot's verified set) | Accepted |
| [0002](0002-local-json-storage-and-backups.md) | Local JSON progress store, atomic writes, snapshots (the data-location/durability decision) | Accepted |
| [0003](0003-cite-only-no-copyrighted-material.md) | Cite-only content: no copyrighted material in the repo or app (one-way door) | Accepted |
| [0004](0004-pregenerated-content-pack-stable-ids.md) | Pre-generated content pack in the repo, with immutable IDs (one-way door) | Accepted |
| [0005](0005-auto-update-github-releases.md) | Auto-update from public GitHub Releases | Superseded by 0008 |
| [0006](0006-license-mit-code-ccbyncsa-content.md) | License: MIT for code, CC BY-NC-SA 4.0 for content | Accepted |
| [0007](0007-materialised-schedule-derived-status.md) | Schedule materialised at plan creation; status, reviews and progress derived from events | Accepted |
| [0008](0008-update-notifier-manual-download.md) | Update notifier + manual download is the only network use (no auto-updater) | Accepted |
| [0009](0009-automated-source-check-instead-of-owner-review.md) | Automated source-check before release instead of owner review gating | Accepted |
