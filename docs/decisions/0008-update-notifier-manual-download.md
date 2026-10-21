# ADR-0008 — Update notifier + manual download (supersedes ADR-0005)
- Status: Accepted (owner choice)
- Date: 2026-10-21
- Supersedes: [ADR-0005](0005-auto-update-github-releases.md)

## Context
ADR-0005 chose electron-updater, which downloads and installs updates silently. Its behaviour on **unsigned** Windows builds isn't documented (Medium). It also needs `latest.yml`, a library and a network allowlist for several download hosts, and it makes the release channel a silent code-execution path onto every PC (07 T1). The owner asked for "normal stuff": students see that a new version exists and download it themselves.

## Decision
- **No auto-updater.** On launch, and when the user clicks "Check for updates", main makes **one** HTTPS GET with Electron `net` to `https://api.github.com/repos/450h/im-companion/releases/latest` and compares `tag_name` with the app version (semver).
- If the release is newer, a banner says "Version X is available: <release title>" with a **Download** button. The button opens the release page `https://github.com/450h/im-companion/releases/latest` in the browser via `shell.openExternal` (a hardcoded constant).
- The student runs the new installer **over** the existing install. Progress lives in `%APPDATA%\MED 222 IM Companion`, separate from the install folder, so it's kept. The portable exe works the same way.
- The check fails silently when offline, and can be switched off in Settings.
- **Rate limits:** the anonymous API allows 60 requests per hour **per IP**, and a class on one campus NAT can share an IP. So the result is cached for 6 h, and on 403/429 the check falls back to the releases Atom feed (`https://github.com/450h/im-companion/releases.atom`) (QA N9).
- **Release cadence:** about one release a week (Thursdays), so students don't face a SmartScreen-warned reinstall every few days (08 §1).
- There's no telemetry. The response is validated with zod (`tag_name`, `name`, `html_url` must start with the hardcoded releases URL), and only text is shown.

## Consequences
- Nothing can break an installation. There's no unsigned-update risk and no `latest.yml`.
- A compromised release still harms anyone who downloads it, but it no longer installs **silently**. Students see the release notes first, and SHA256SUMS are published.
- Students must click Download and run the installer: about 1 minute per content release. Release notes say what's new (which systems), to motivate the update.
- The repo name still matters (it's in the check URL), but it's no longer a hard one-way door. If it ever moves, old copies just stop showing the banner, and an announcement in the class group covers it.

## Alternatives considered
- electron-updater (ADR-0005): more moving parts, and unverified on unsigned builds.
- No network at all (DailyPot's choice): students wouldn't know new content had shipped.

## Reversal cost
Low. Electron-updater can be added later with a superseding ADR.
