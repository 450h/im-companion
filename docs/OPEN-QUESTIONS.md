# OPEN QUESTIONS (MED 222 IM Companion)

A running log of everything unresolved. Not legal advice.

## 🟥 NEEDS LEGAL/EXTERNAL COUNSEL
| # | Question | Why it matters | Best current read | Confidence |
|---|---|---|---|---|
| L1 | What exceptions (quotation, teaching, private study) does the **Saudi Copyright Law 2026** keep, and does it cover blueprint-organised summaries that cite page numbers? | Defines how close to the source the summaries may stay | Original wording + citations of facts is the safest pattern under any regime (03 F2). The 2003 law allowed quotation with attribution and teaching illustration (F4); the 2026 text wasn't verified. Read the official text (SAIP / Umm Al-Qura) if the project grows beyond the cohort | Low |
| L2 | Is the **EMQ-volume answer-key index** (theme location + correct letters + our own explanations) acceptable to the publisher? | It's the only part derived item-by-item from a specific book | It's short factual data with no expression reproduced, so it's likely fine. If a complaint arrives, remove `emq-volumes.json` in a patch release (original EMQs remain) | Medium |
| L3 | Is using the college's blueprint text (objective lists) in the public repo fine? | The blueprint is a college document | It's a list of topics/objectives, low originality, given to students. Ask the course coordinator as a courtesy | Medium |

## 🟦 NEEDS MY DECISION
| # | Decision | Options | Recommendation | Blocking? |
|---|---|---|---|---|
| D1 | ~~App name vs course code~~ **Resolved 2026-10-21:** the owner confirmed **"MED 222 IM Companion"** despite the blueprint code Med 611. `appId` `io.github.450h.im-companion`; data folder `%APPDATA%\MED 222 IM Companion` | – | – | – |
| D2 | **Code signing** | Unsigned + checksums (free) · OV/EV certificate · cloud signing | Unsigned for v1, with the README showing the SmartScreen "More info → Run anyway" steps. Revisit if C1 shows install drop-off | No |
| D3 | ~~Public GitHub repo name/URL~~ **Resolved 2026-10-21:** **`github.com/450h/im-companion`** (public). The in-app release check points at it (ADR-0008), so avoid renaming it after v0.1.0. The owner creates the empty public repo, and the local folder `Internal_Medicine_Application` pushes to it | – | – | – |
| D4 | **OSCE support for the Final.** The blueprint lists OSCE for the final and many topics are tagged OSCE; you said the final is MCQ. | MCQ only · add OSCE checklists (history/exam stations per system from Talley) in v0.5.x | Add lightweight OSCE station checklists in v0.5.x if time allows | No |
| D5 | **Openly licensed images** (e.g. Wikimedia Commons ECGs, X-rays, blood films) for the OSPE slide exam | None (cite figures only) · add CC0/CC BY images with attribution, unmodified | Add a small set for OSPE-heavy topics, CC0/CC BY only (CC BY-SA kept unmodified and separately licensed), each with attribution, listed in `content/images/ALLOWLIST.json`. Without it, OSPE practice uses cited figures only | **Decide before v0.3.0 (Thu 5 Nov)** |
| D6 | **Winter-break / holidays** inside the Final plan window (2 Dec–5 Jan) | Treat all Sun–Thu as study days · let students mark days off | Add "mark day off" in v0.5.0. The default treats Sun–Thu as study days | No |
| D7 | ~~Cohort size~~ **Resolved 2026-10-21:** under 50 students. C1 uses an assumed cohort of 45 until the exact number is known (50% ≈ 23 active users, 25% ≈ 12) | – | – | – |
| D8 | ~~Your review time for medical content~~ **Resolved 2026-10-21:** owner review is optional. Every topic must pass an automated source-check before release instead (ADR-0009) | – | – | – |
| D9 | **Error-report channel.** GitHub issues need a GitHub account. | GitHub issue only · also a prefilled email to a project address · a Google Form | GitHub issue in v0.2. Add an email fallback if classmates lack accounts | No |
| D10 | **EMQ themes outside the blueprint** (surgery, ENT, psychiatry and others in Vols 1–3) | Hide · show as optional "extra practice" | Index them (cheap), hide by default, with an "Include non-blueprint themes" toggle | No |
| D11 | macOS/Linux builds | Windows only (v1) · add a mac target | Windows only (owner choice) | No |

## 🟨 CHECKPOINTS
| # | What we check | Threshold | Check date | Result |
|---|---|---|---|---|
| C1 | **Success metric / kill criterion:** release downloads + class-group show of hands vs cohort size (D7: < 50, assume 45) | ≥ 50% of the cohort (~23 students) by 25 Nov. **< 25% by 8 Nov → stop features, focus on onboarding and ask classmates why** (08 §6) | 2026-11-08 and 2026-11-25 | |
| C2 | **Content pace** vs the **25 Oct reference plan** (08 §1: GI 25 Oct · ID 27 Oct · Neph 29 Oct · Cardio 1 Nov · Resp 3 Nov · Rheum 5 Nov · Endo 8 Nov · Heme 10 Nov · Hemato-onc 15 Nov · Onc 16 Nov) | Each system released no later than its reference first day (target ≥ 2 days earlier). **Any slip → switch the remaining systems to lean content** (08 §6) | 2026-11-12 | |
| C3 | **Upgrade drill:** v0.1.0 → publish v0.1.1 → the banner appears → Download opens the release page → installing over the old version keeps all progress; offline → silent | Any failure blocks the release announcement | Before announcing v0.1.0 (2026-10-25) | |
| C4 | Dependency health: Electron on a supported major; TS 7 / Vite 8 / electron-vite 6 re-evaluated | If the Electron major is unsupported, upgrade before the next release | 2027-01-10 (after the final) | |
| C5 | Restore drill: export → import into a fresh data dir → identical Progress figures | Any difference blocks the release | Each minor release | |
| C6 | Content quality: ⚑ reports per released topic | > 3 confirmed errors in one system → re-run the source-check (09 §3.7) on that whole system | Weekly from 2026-11-01 | |
