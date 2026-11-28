# Halo / Smart Home — continuation handover

Updated: 28 November 2026 (Europe/London). Source baseline: `1bcb262761418b6c969264c6e07417a4de02ba8a`.

This is an established project. Continue it; do not rebuild, reinstall everything, replace integrations, or repeat completed setup. This document consolidates the current conversation, live checks and repository documentation. It supersedes conflicting status/next-step statements in the 31 October handover. Older feature documents are useful design history, but their installation status can be stale.

## 1. Project and operating rules

- Repository: https://github.com/mg10a/home-tv-launcher
- Production website: https://mg10a.github.io/home-tv-launcher/
- DEV website: https://mg10a.github.io/home-tv-launcher/dev/
- Hardware: Home Assistant Yellow; Samsung phone; TV/streamer and tablet use are also in scope. User has no development PC. Do available investigation/development directly and minimise manual technical steps.
- Three established full screens: Launcher, Smart Home, Family Organiser. Preserve their navigation, appearance, touch gestures, responsive layouts and TV remote focus.
- Preserve HA configuration, credentials, paired devices, recordings, history and existing automations. Do not reset/re-pair devices to solve dashboard bugs.
- Read-only checks and reversible repository fixes can proceed within the requested scope. Respect existing authorisation, but ask before new live service restarts/reconfiguration or physical-device actions not already authorised. Prepare a concrete backup/rollback plan for significant changes.
- Public GitHub must contain no credentials, tokens, private browser profiles, footage, family calendars, locations or backup keys. Private recovery material remains off-repository.
- User prefers actual fixes over speculative recommendations. Report precisely what was tested; a build/test pass is not evidence of physical-device success.

## 2. Architecture and source map

`index.html` is production; `dev/index.html` is the separate development dashboard. They contain substantial inline HA/Eufy/UI logic and are not identical. Shared JS/CSS modules implement other features. Preserve relative asset paths (`./` versus `../`) when changing both.

The hosted dashboard uses the existing authenticated Home Assistant WebSocket and request-ID management. Native Android wrappers provide installed-app launching and authentication support. HA hosts private integrations/apps and data; GitHub Pages hosts public application code only.

Known Android production release is 4.1.4. Hosted HTML/JS fixes load on reopening the app and do not require APK reinstall. Native bridge changes do require an appropriate APK. Preserve package identity and signing continuity; never tell the user to uninstall a working app casually. The separate VTech Preview APK is a distinct app and is not evidence that production was replaced.

Useful files/modules:

| Area | Entry points |
| --- | --- |
| Screens | `home-screens.js`, `home-screens.css`, both index files |
| HA and Eufy | both index files, `custom_components/eufy_viewer/`, Eufy bridge directories |
| Samsung Food | `samsung_food_bridge/`, `samsung-food.js`, `samsung-planner.js`, `family-shopping.js`, `samsung-links.js` |
| Family calendars | `family-calendar.js/css`, `docs/family-calendar.md` |
| Kia | `kia-controls.js`, `kia-refresh.js` |
| Coffee | `coffee-controls.js` |
| Pets / location | `pet-timeline.js`, `pet-portraits.js`, `location-map.js` |
| Weather | `weather.js/css`, `docs/weather.md` |
| Tests/builds | `tests/`, `dev/tests/`, `.github/workflows/` |

## 3. Latest verified operational position

On 28 November:

- Live HA access succeeded through the cloud browser after secure sign-in. Earlier Nabu Casa HTTP/2 errors and subscription disruption are historical; do not assume either current failure or persistent access next session. Verify fresh access before diagnosing credentials.
- Yellow reported roughly **9.1 GiB free** with low CPU use.
- HA update entities reported **no pending updates** during the latest inspection. This is a point-in-time result, not a guarantee for later sessions or manually installed components.
- HA Repairs showed no pending repairs during the final backup checks.
- Original Eufy bridge running; DEV bridge intentionally stopped. Samsung Food and photo service running.
- User confirmed **doorbell footage is running okay inside Halo on the Samsung phone**. The previously reported three-second JPEG delay is no longer an active user-confirmed problem.
- Latest user-reported problem was unavailable Eufy battery percentage. The selection bug has now been fixed and published; phone confirmation is still outstanding.

## 4. Eufy: current state and decisions to preserve

Hardware history: T8213 battery doorbell with T8030 HomeBase 3. Two integrations represent the same physical doorbell, not two separate cameras.

| Component | Last known state |
| --- | --- |
| Original bridge | 0.8.49, running; container `app_e35bd336_eufy_viewer_bridge` |
| Original camera | `camera.doorbell`, available/idle between views; viewer capabilities present |
| DEV bridge | 0.8.39-dev.12, deliberately stopped |
| DEV camera | `camera.doorbell_dev`, unavailable while DEV is stopped |
| Recordings | Earlier 28 November check returned six; not revalidated by the latest battery-only change |

Do not restart DEV merely because its camera is unavailable. Do not run competing bridges unnecessarily. Keep its code/configuration for rollback and historical codec work. A code checkout, installed app image, data directory and backup are different things; do not delete one on the assumption it is a redundant copy of another.

### Live transport

Halo intentionally uses authenticated **live JPEG** for the doorbell. These are advancing live frames, not cached snapshots polled every few seconds. WebRTC previously produced grey output even while frame counters advanced; leave that workaround intact until actual image playback is proven.

The flow is bridge JPEG → HA `eufy_viewer/watch` events → image display → `eufy_viewer/ack`. ACK/backpressure and bounded viewer leases protect memory and battery. Closing/hiding the view releases the viewer. Do not remove these safeguards to chase a nominal FPS value or keep a battery camera awake for a dashboard tile.

A bounded internal 30-second timing test on 28 November produced:

- 214 frames; first frame about 5.97 seconds after request.
- Median inter-frame interval 0.131 seconds; maximum 0.435 seconds.
- Mean JPEG about 61 KB; no reported errors.
- Test unsubscribed and closed; no footage saved.

This measures HA-internal delivery, not phone rendering or remote network throughput. A separate Nabu Casa timing attempt could not authenticate with the internal diagnostic token, so there is **no measured external FPS result**. Do not interpret that failed diagnostic authentication as a broken user login.

### Latest fixes

1. `333dda0488b3b0cc186583cbc984bc660441b3f8`: camera selection now excludes unavailable/unknown cameras before deduplicating original/DEV. A stopped DEV camera cannot hide or override the available original. Legacy snapshot fallback also skips unavailable cameras. When both feeds are available, existing DEV preference is retained; future distinct cameras remain selectable. Published and tested.
2. `1bcb262761418b6c969264c6e07417a4de02ba8a`: battery selection previously sorted DEV first, then stopped on its unavailable reading. It now filters valid numeric 0–100 readings first, prefers the active camera's bridge, and falls back to another valid doorbell reading. Missing/empty/invalid values are not shown as zero; a real 0% is retained. Applied to production and DEV; 26 relevant tests passed and deployed HTML was verified. **Actual current battery value and user-visible recovery have not yet been verified after deployment.**

Tests: `tests/eufy-camera-selection.test.cjs`, `tests/eufy-battery.test.cjs`, `tests/production-launcher.test.cjs`, `tests/eufy-dashboard-dev.test.mjs`.

### Other Eufy details

- Preserve authenticated recordings metadata, short-lived signed playback URLs, clip/date selection and stale-response protections. Do not publish camera URLs/tokens.
- Night view is a display aid, not modification of HomeBase originals. See `docs/doorbell-night-view.md`. Range preservation was tested on this doorbell; do not apply its assumptions blindly to a new camera.
- Earlier kiosk automatic popup logic is specifically tied to DEV event/entity IDs. Because production is now active, inspect this mapping if automatic motion/ring popup is requested or found not working. Do not claim it is currently verified on the intended kiosk.
- An older stock HA Events card showed no available recordings during inspection; that alone does not prove the custom Halo recording path is broken.
- Eufy E10 window camera/HomeBase compatibility was asked about earlier. This handover contains no verified final compatibility conclusion or purchase recommendation; research the exact model and current official support before advising purchase/integration.

## 5. Storage, backups and recovery — resolved immediate problem

The large backup/storage issue was substantially caused by local Samsung Food image exports, not a finding that camera recordings should be deleted.

Samsung Food 0.3.0 used a roughly 2.39 GB locally built image. Supervisor exported `image.tar` into temporary storage during backup. Five abandoned `docker-export-*` folders were identified as old Samsung Food exports (about 33 hours to 12 days old; all files over 24 hours; backup manager idle). Only those verified folders were removed. Actual free space rose from 1.6 GB to 9.1 GB, about **7.5 GB recovered**. Apparent folder sizes were larger because filesystem/image accounting can share layers. Do not generalise this into a Docker prune or deletion of live overlay/image/container/volume directories.

### New backup arrangement

- Keep **one automatic local backup** on Yellow, with off-device copies.
- Native encrypted backup **`07a1e34a`**, 28 November 2026 at 14:52 UTC: **926.25 MiB** (971,243,520 bytes).
- Includes all nine apps plus HA settings/history. Existing media/share exclusions were retained; do not call it a copy of all media or HomeBase recordings.
- Completed in all three locations: Yellow, Home Assistant Cloud, OneDrive.
- Final table showed exactly one local backup; older automatic backups remained in OneDrive. Remote retention is separate from local retention.
- Samsung Food component: 5,634,347 bytes, about two seconds, 421 members. Its options and saved browser profile were present; `image.tar` absent.
- Component was decrypted/read sequentially in memory with Supervisor's installed SecureTar reader. This verifies archive readability, **not a full disaster restore**.

Preserved recovery material includes the full 25 November backup `a749a156` (about 1.87 GB, containing the old Samsung Food image), a fresh encrypted pre-update Samsung Food `/data` snapshot, private recovery instructions and an emergency kit in OneDrive. Seven older backups were previously offloaded with SHA256 verification. Never print or commit recovery keys, OAuth tokens, browser profiles or account details.

Preferred recovery is native HA backup restore. The old full app backup plus newer private data snapshot provide a rollback path if required. Restore only the affected app where possible, with its data stopped consistently; do not roll back the whole household casually. Read `docs/samsung-food-backups.md` before future packaging, backup or rollback work.

More storage was planned for a few weeks later. Expansion remains useful capacity planning, but immediate disk pressure was relieved; it is not currently a prerequisite for routine fixes.

## 6. Samsung Food — implemented, not a new exploration

Installed app **0.3.1**, same existing slug `b998e2ed_samsung_food_bridge` and private `/data`. Credentials/session preserved. Image: `ghcr.io/mg10a/halo-samsung-food:0.3.1`. It is a prebuilt multiarch image; ARM unpacked size about 936 MB. Digest at deployment: `sha256:08dc75af4bc56823b773ae0c76f47e52b9033040a1e0b115835654bac781a918`.

Live verification after update: meal-plan, shopping and control sensors `ok`; four saved recipes present. Packaging changed, not the user's meal data or account.

Implemented flow uses Samsung Food's rendered website and private persistent browser profile. It is an experimental website bridge, **not an official Samsung API**. Dashboard can select saved recipes, plan meals by day, clear days/weeks, and create a dated shopping list from a week. Existing shopping lists are preserved. Recipe servings come from Samsung Food. Shopping data is surfaced through HA; do not assume every possible Samsung shopping edit or supermarket checkout is supported.

Safety/logic to retain:

- Authenticated HA events, no public inbound app ports; current command flow requires an HA administrator to fire events.
- Serialized commands with command IDs and expected week revisions.
- Conflicting edits stop rather than overwrite; uncertain shopping submissions are not automatically replayed.
- Repeated successful submissions reuse their generated list; indistinguishable duplicate recipes are rejected instead of guessed.
- Session reuse and increasing login cooldown; verification challenges require owner action.
- Weekly reset implementation defaults to Sunday 13:00 Europe/London, configurable in Meals → Weekly reset. It clears the finishing week only, preserves next week/recipes/lists, keeps 20 private pre-clear snapshots, and does not automatically repeat an interrupted reset. Recheck actual saved settings before claiming the default is enabled live.
- No verified end-to-end Sainsbury's basket/checkout integration is recorded here. That remains separate from creating a Samsung Food shopping list.

Build workflow `.github/workflows/samsung-food-image.yml` tests native AMD64 and ARM64, including browser launch and persisted synthetic cookie recovery, before publishing. Keep version fields in sync and release tags immutable. Retain published images while backups reference them; restores now need internet access to retrieve the software image.

## 7. Wider Halo functionality and important logic

These areas already exist. Do not reduce the project to Eufy or storage. Unless explicitly noted above, they were not all physically retested during the latest camera/battery work.

### Launcher, photos, Android and TV

Entertainment cards launch installed apps through Android where available. Preserve phone/TV package variants and fallbacks. User handles NordVPN/split tunnelling; no automatic VPN switching or extra VPN prompt on app taps.

Photos remain private through existing HA/sync setup. Album selection, refresh, slideshow/fullscreen and orientation handling exist. Prior check recorded photo sync 97/97 on 25 November. Rclone later appeared stopped/Error with a known exit-143 shutdown history; do not infer photo loss or reinstall from that status alone. Inspect actual freshness if needed.

TV D-pad fixes include focusable cards, modal boundaries, close/back handling and focus restoration. CI is not a physical remote test. See `docs/CHROMECAST_REMOTE_AND_EUFY.md`.

### VTech

**User's deliberate final choice: official app shortcut only.** Do not reopen pairing/protocol experiments or expose baby-monitor footage through HA. `com.cams.vtech.mvb.pro` is launched locally; no VTech credentials/footage/session data go to the web dashboard. The stopped historical installer is not a request to restart it. See `docs/VTECH_ANDROID_SHORTCUT.md`.

### Heating / Salus

Existing iT500 controls, setpoint, modes, boost and history UI are established. Missing graph history was fixed in PR #13, commit `47b4694`, by handling keyed WebSocket history arrays correctly; 14 tests passed and production/DEV were deployed. Do not replace the heating integration to fix graph presentation.

A legacy failed Salus entry (historically ID 14 versus working ID 6) was identified earlier. Confirm exact entries/dependencies before any removal; no evidence here that it should be deleted automatically.

### Family organiser / calendars / birthdays

Actual HA calendar events are fetched through `calendar.get_events`, with per-user calendar selection/names/colours/roles saved in HA user data. They follow the same HA user across devices. Preserve Europe/London dates, exclusive all-day ends, overlaps and source attribution; do not invent calendars or birthdays.

Overview has fortnight/calendar and family views; expanded month layouts, role/person mapping and separate meals are implemented. Birthdays use a -14/+28-day window and separate per-occurrence message/present checklist flags in HA. These flags do not send messages or buy gifts. Same-flag simultaneous cross-device edits remain last-write-wins. Main screen/view persistence and orientation handling exist now; the October statement that screen persistence was absent is stale.

Calendar refresh is every five minutes while visible plus reconnect/state/manual refresh. Upstream Google caching can delay updates. Partial failure must not become an empty calendar. See `docs/family-calendar.md`.

Do not describe household chores as a complete recurring/assigned system without checking current implementation and agreed recurrence rules. Earlier plans are not proof of delivery.

### Kia

Existing Kia Sorento HEV integration, dashboard controls/status and refresh logic must be preserved. Use full vehicle report state, not just door-lock state. `kia-refresh.js` checks the cloud cache before bounded vehicle wake requests where supported. Current foreground wake guardrails: connected/visible dashboard, 07:00–22:00, reported 12V battery at least 40%, at most eight requests/day, at least one hour apart, stop after two failed requests/day. These counters are local-browser policy, not a server-wide household quota. Preserve manual controls and don't test by unlocking/starting the vehicle.

### Coffee, pets, rooms and location

Home Connect coffee uses existing HA entities/automation and confirmation logic; do not test with an unsolicited brew or lock change. Exact model/capabilities should be checked when needed, not guessed from the old 'Samsung EQ500' wording.

Sure Petcare has Maia/Solo activity and mutually exclusive flap modes. Each cat's activity time must remain individual; don't use one global polling timestamp for both. Existing lock actions were user-confirmed historically.

Room light/climate controls and location modules exist. Unavailable Hue/printer/temperature entities may reflect physical state; don't delete them to make the dashboard look healthy. SmartTag2/phone tracking must show reported age/staleness and respect permissions; don't claim every requested tag/device is connected without live inventory.

### Weather / Groobarbs

Keep weather source/missing-data semantics, saved-versus-preview locations, warnings failure states, long-range uncertainty and keyboard/touch navigation. Model agreement is not ground-truth verification. See `docs/weather.md`.

Groobarbs has existing component/dashboard work including reviewed changes and restoring the original item. A missing `services.yaml` repair was completed earlier (PR #12). Early paragraphs of `docs/groobarbs.md` describe old initial read-only stages; inspect current component before assuming writes are absent. Never change an actual food order solely as a test; preserve revision/cutoff checks and verification after uncertain responses.

## 8. Remaining priorities

1. User confirmation that battery percentage now appears after reopening Halo. If still unavailable, read actual HA battery entities/values; do not guess a percentage or restart the camera.
2. Preserve the now-working phone live video. There is no active confirmed three-second regression after the user's correction.
3. Check the next scheduled backup's destinations/retention when doing maintenance; no reminder/automation was created by this handover.
4. Targeted real-device acceptance: TV remote/back behaviour, recordings playback, current production event popup mapping if wanted, and household features the user has not yet tried.
5. Samsung Food: verify real weekly workflow/reset settings and practical shopping handoff; maintain the website bridge if Samsung changes its pages. Supermarket checkout is not confirmed delivered.
6. Storage expansion later; retain one local backup and off-device recovery. Don't delete DEV/configuration/history merely for speculative space savings.
7. Optional research only when requested: WebRTC grey-picture cause, exact E10/HomeBase compatibility, further tags/locations/new hardware, recurring chores. VTech direct integration is deliberately out of scope.

## 9. How the next developer should resume

Read this document, current repository head and relevant feature docs. Fetch before editing; do not trust an old scratch checkout. Discover currently available GitHub/HA tools. Verify access and current live states without exposing secrets. Only then select a focused outstanding task.

Recent checkpoints:

| Commit | Result |
| --- | --- |
| `47b4694` | Salus history graph fix |
| `913f8f7`, `5e5984e` | Samsung Food prebuilt images / release 0.3.1 |
| `dbea607`, `c51b92e`, `70ae412` | Backup/storage recovery documentation and verified completion |
| `333dda0` | Available-camera selection fix |
| `1bcb262` | Valid active-bridge battery selection fix |

For the latest dashboard fixes, rollback can be a focused Git revert of the relevant commit, followed by tests and deployment. No HA restart, re-pairing or credential reset is needed for that rollback. For app/backend changes use the appropriate private/native backup plan instead.

Suggested next-chat prompt:

> Continue my established Halo / Smart Home project. Read `docs/HALO_HANDOVER_2026-11-28.md` in `mg10a/home-tv-launcher` and check subsequent commits before doing anything. Preserve the working original Eufy bridge; DEV is intentionally stopped. Samsung Food 0.3.1 and three-location backups are already working. Phone live footage was confirmed okay; the latest battery fix is published and needs user confirmation. Understand the whole three-screen project, keep VTech as an official-app shortcut, and do available technical work directly without rebuilding the system.
