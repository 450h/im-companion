# ADR-0002 — Local JSON progress store with atomic writes and snapshots
- Status: Accepted
- Date: 2026-10-21

## Context
Each student's progress (reads, attempts, card reviews, confidence, plan) is weeks of work before an exam. There's no server, by choice: the app is free, has no accounts, and the maintainer holds no personal data. Data volume is small: about 10k attempts is under 2 MB.

## Decision
- Store progress as one JSON file at `%APPDATA%\MED 222 IM Companion\progress.json`, validated by zod.
- Writes go through `store.commit()`: temp file → fsync → rename, coalesced to ≤ 1 per 500 ms.
- A daily snapshot goes to `backups/` (14 kept), plus `pre-*` backups before import, restore, rebuild and migration.
- Export/import to a user-chosen file. A newer schema opens read-only. The uninstaller keeps the data.

## Data location
The student's own PC only. Nothing is transmitted. There's no residency question because the maintainer processes no data.

## Consequences
Simple and inspectable. It doesn't sync between PCs: export/import covers moving machines.

## Alternatives considered
- SQLite: a native module and a heavier build, which this data volume doesn't need.
- IndexedDB in the renderer: weaker durability control, and puts the data in the hostile renderer.

## Reversal cost
Low-medium (a migration to another store).
