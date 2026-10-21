# ADR-0007 — Schedule materialised at plan creation; status and reviews derived
- Status: Accepted
- Date: 2026-10-21

## Context
- In the Excel planner, dates are fixed (the Master Schedule) while statuses and flags are formulas. Spaced-review dates are fixed from the *planned* study date.
- Students need a stable plan they can trust day to day. But progress must log **automatically** from what they actually do, and reviews should follow their real pace.

## Decision
- **Task dates are materialised** into `plans.<track>.tasks` when a plan is created or rebuilt (docs/05 R-10).
- **Everything else is derived** by the pure engine from append-only events:
  - task status (R-6)
  - spaced reviews from the *actual* study date (R-5)
  - flashcard due dates (R-11)
  - accuracy bands and weak areas (R-7)
  - dashboard figures (R-8)
- Manual overrides are events too.

## Consequences
- No status can drift out of sync with the evidence.
- A rule change fixes every student's view on update, with no migration.
- Engine tests are the critical suite.

## Alternatives considered
- A fully derived schedule (dates would move whenever anything changes, which is confusing).
- Fully stored statuses (they drift, and need the manual logging the owner wants to remove).

## Reversal cost
Low-medium.
