# Samsung Food image and backups

Samsung Food keeps the same `samsung_food_bridge` slug and `/data` directory.
Version 0.3.1 changes packaging, not meal planner/shopping behaviour or credentials.

## Why the packaging changed

Supervisor exports `image.tar` into temporary disk storage when an app is locally
built. The previous image was about 2.39 GB, while the saved app data was about
19 MB. The export plus encrypted backup made backups fail on the Yellow's small
internal disk.

`config.json` now declares `ghcr.io/mg10a/halo-samsung-food`. Supervisor downloads
the versioned image and backs up options/data without exporting the software.
The ARM image is about 936 MB unpacked (338 MB download). Python 3.12, Playwright
1.56.0 and websockets 15.0.1 are retained. The slim Python base and Chromium
headless shell remove unused development tooling and the duplicate full browser.

## Publishing and verification

`.github/workflows/samsung-food-image.yml` builds on native AMD64 and ARM64
runners. Both images must pass the offline smoke test before their combined
manifest is published. The test imports the app, verifies timezone support,
launches Chromium, compiles the packaged extraction scripts and reopens a
persistent browser profile with a saved cookie. It uses no real credentials and
does not contact Samsung Food.

For a future release, bump `config.json`, the control sensor's version and the
workflow's `RELEASE` together. Treat released tags as immutable: use a new version
for changes, retain previous tags, and do not run a release build against changed
code with an already-deployed version. Verify successful builds and anonymous
registry access before updating Home Assistant. `.dockerignore` permits only the
Dockerfile and four application source files into the build context.

Restoring an app backup requires internet access to download its published image.
Do not delete these registry versions while backups reference them.

## Migration and rollback

Before the first update, a fresh encrypted snapshot of `/data` was taken with the
app stopped and then restarted. Its decryption, options, browser profile and
remote OneDrive SHA256 were verified. It is stored with recovery instructions
alongside the preserved full backup containing the old 0.3.0 image. No plaintext
credentials or browser state are stored in this repository.

Prefer a native Home Assistant backup restore. If an immediate rollback is needed,
use the preserved full app backup for the old software, then restore the newer
app-data snapshot with the app stopped, following its private recovery note.
Never reset the app, remove its data directory, or create a second app slug as a
substitute for an in-place update.

After updating, verify the installed version/image, live sync, saved recipe/list
counts, and free space. Re-include Samsung Food in automatic backups, then verify
successful creation and all configured destinations. Keep local retention at one;
off-device recovery copies are managed separately.

## Additional storage finding on 28 November 2026

Five abandoned `docker-export-*` directories under Docker's temporary directory
contained copies of the old Samsung Food 0.3.0 image. Their manifests matched the
old image; all files were older than 24 hours (the directories ranged from about
33 hours to 12 days old), and the backup manager was idle. Only those five
identified exports were removed. The installed app, native backup archives,
camera recordings and app data were not removed.

The folders reported about 12 GB apparent disk usage; actual free space rose from
1.6 GB to 9.1 GB, a gain of about 7.5 GB. Use filesystem free space for the real
saving rather than adding apparent image sizes, since layers can be shared.
The prebuilt-image change also avoids creating Samsung Food image exports during
future backups. Do not generalize this cleanup into deleting Docker's live
overlay, image, container or volume directories.

## Deployment verification

On 28 November 2026, native AMD64 and ARM64 build/smoke tests passed, anonymous
registry pulls were verified, and 0.3.1 was installed in place on the Yellow.
Meal plan, shopping list and control sensors reported `ok`; four saved recipes
were present. Twenty Python tests and eleven dashboard tests also passed.

The new native encrypted backup `07a1e34a`, created at 14:52 UTC, contains all nine
apps and Home Assistant settings/history. Its total size is 926.25 MiB. The
Samsung Food component is 5,634,347 bytes and completed in about two seconds.
All 421 members were decrypted and read sequentially in memory using Supervisor's
installed SecureTar reader. Options and the browser profile are present, and
`image.tar` is absent. This verifies archive readability, not a full disaster
restore; no live data was overwritten by the check.

Final verification: Home Assistant reported the backup complete in all three
locations (Yellow, Home Assistant Cloud and OneDrive). Retention left exactly one
local backup; older automatic backups remained in OneDrive. System storage showed
9.1 GB free, and the Repairs page reported no pending repairs.
