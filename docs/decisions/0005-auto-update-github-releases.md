# ADR-0005 — Auto-update from public GitHub Releases is the only network use
- Status: **Superseded by [ADR-0008](0008-update-notifier-manual-download.md)** (2026-10-21, owner chose a simple "new version available → download" notifier)
- Date: 2026-10-21
- One-way door: the feed location (owner/repo baked into installed copies)

## Context
Content is released system by system over about 6 weeks (docs/08), and students must get it without reinstalling by hand. DailyPot chose no network at all, but this app's value depends on frequent updates.
- electron-updater supports Windows NSIS with the GitHub provider.
- The GitHub API allows "5000 requests per user per hour", and "an update check uses up to 3 requests".
- A private repo needs a token in the app, which the docs call "not suitable for all users".
- Source: [electron.build auto-update](https://www.electron.build/docs/features/auto-update), accessed 2026-10-21, High.
- Behaviour on **unsigned** Windows builds isn't documented there (Medium), so it's verified by the update drill (C3).

## Decision
- **electron-updater with the GitHub provider**, pointing at the **public** repo **`450h/im-companion`** (D3, resolved 2026-10-21).
- It checks on launch and every 6 h, downloads in the background, and installs on quit/relaunch. The user can turn auto-update off.
- The portable exe only notifies.
- No telemetry, crash upload or analytics.
- The renderer can't reach the network (SECURITY §11 allowlist).

## Consequences
- Students receive content automatically.
- GitHub sees each requester's IP, as with any download (stated in the README).
- **The repo must be public and must not move or be renamed after v0.1.0** without a bridge release.
- Release-integrity risk is concentrated in the GitHub account and CI (07 T1).

## Alternatives considered
- No auto-update (DailyPot's choice): students would miss content.
- A custom update server: hosting cost and more ops.

## Reversal cost
High for the feed location, since every installed copy points at owner/repo. Low for turning updates off.
