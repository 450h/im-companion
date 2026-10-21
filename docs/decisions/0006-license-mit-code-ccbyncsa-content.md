# ADR-0006 — License: MIT for code, CC BY-NC-SA 4.0 for content
- Status: Accepted (owner choice)
- Date: 2026-10-21

## Context
The app is free and public, and won't be sold. The owner wants the summaries and questions to stay free and non-commercial. All dependencies are MIT/ISC/Apache-2.0 (checked on npm 2026-10-21).

## Decision
- `LICENSE` (MIT) covers the code.
- `content/LICENSE` (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International) covers everything under `content/`.
- The README states both. Third-party book titles are used only to identify sources.

## Consequences
Anyone may reuse the code. Nobody may sell the content, and derivatives stay CC BY-NC-SA. Mixing in CC BY-SA *adaptations* isn't compatible, which matters for D5 (open images: they'd be included unmodified, under their own license).

## Alternatives considered
- Everything MIT (allows commercial resale of the content).
- All rights reserved (blocks classmates contributing fixes).

## Reversal cost
Medium. Already-released content stays under its license.
