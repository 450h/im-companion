# ADR-0001 — Stack: Electron + React + TypeScript (DailyPot's verified set)
- Status: Accepted
- Date: 2026-10-21

## Context
The owner wants "an application for PCs, downloadable like DailyPot", shipped as soon as possible.
- DailyPot uses Electron 44.7 · React 19 · TypeScript 5.9 strict · electron-vite 5 / Vite 7 · zod 4 · Recharts 3 · Vitest · Playwright · electron-builder 26. These were verified on 2026-10-13 (electron-vite 5 declares peer `vite ^5 || ^6 || ^7`).
- On 2026-10-21 npm shows newer majors: electron 45.0.0, electron-vite 6.0.0, vite 8.3.5, typescript 7.0.2 (High).

## Decision
Reuse DailyPot's exact versions and project layout, adding **electron-updater 6.8.9 (MIT)**. No PDF library ships, because the app is cite-only (ADR-0003).

> **Amended 2026-10-21 by [ADR-0008](0008-update-notifier-manual-download.md):** electron-updater is **not** used. The release check uses Electron's built-in `net`, so there are no extra dependencies beyond DailyPot's set.

## Consequences
- The fastest path, with proven hardening, build, CI and release patterns that can be copied.
- One Electron major behind the latest. Checkpoint C4 schedules the upgrade after the final exam.

## Alternatives considered
- Latest majors: unproven together with electron-vite, and a risk mid-sprint.
- Tauri: smaller binaries, but a new stack and a Rust toolchain.
- A web app: needs hosting, and offline use is weaker.

## Reversal cost
Medium. The UI and engine are plain React/TS and would port. The main-process code is Electron-specific.
