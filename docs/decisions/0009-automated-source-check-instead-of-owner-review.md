# ADR-0009 — Automated source-check before release instead of owner review gating
- Status: Accepted (owner choice)
- Date: 2026-10-21

## Context
The first draft made the owner the medical reviewer: topics showed an "Unreviewed" badge until checked, which needed ~15 h of owner time. The owner disagreed. The content is summarised from the sources and every point cites its page, so students can verify anything themselves. The residual risk is mechanical: a misread number (a dose, a cutoff) or a citation a few pages off.

## Decision
- No "Unreviewed/Reviewed" badge and no owner review queue. Owner review is **optional** and never blocks a release.
- Instead, **every topic must pass an automated source-check before it ships** (09 §3.7). A separate agent re-reads every block, card and question against its **cited pages**, and checks that:
  - the claim is supported;
  - numbers, doses and cutoffs match;
  - the page and figure numbers are right;
  - the answer key is correct.
  Failures are fixed and re-checked.
- The topic records `sourceCheck: {passedAt, checkerVersion}`. The content lint refuses to bundle a topic without it.
- Students keep the ⚑ report button, and confirmed errors get a patch release.
- The educational-use disclaimer stays (03 §6). That's standard for any study material, not a sign of distrust in the content.

## Consequences
- The owner spends no time reviewing.
- Quality relies on the citation discipline, the automated check and student reports. Checkpoint C6 watches the error rate.

## Alternatives considered
- Owner review gating (owner time, slows releases).
- Shipping without a second check (misread numbers would reach students).

## Reversal cost
Low.
