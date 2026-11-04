# Samsung Food read-only bridge — experimental 0.1.0

Prepared for Home Assistant OS, **not installed or end-to-end tested yet**. The signed-in web planner's seven dated groups and two existing meals were successfully read through the UI. That verifies the extraction route, not unattended operation on your HA hardware.

## What it does

Every 15 minutes, reads the current week of Samsung Food's web planner and publishes `sensor.samsung_food_meal_plan` into HA. The dashboard uses it when present. Day, title and meal slot are included; recipe images, shopping items and writes are not in this first version. The meal card opens a read-only detail dialog with planner/shopping-list links. The shopping link leads to Samsung Food's retailer selector, not directly to checkout.

No order is placed. No recipes or meal plans are edited. It uses rendered website content rather than undocumented private APIs. It depends on Samsung Food keeping that UI compatible.

## Install and trial

1. Refresh your existing `mg10a/home-tv-launcher` add-on repository in HA's app/add-on store.
2. Install **Samsung Food — experimental read-only sync**. Chromium makes the build relatively large; requires a 64-bit amd64/aarch64 host.
3. In its Configuration tab enter your Samsung Food email/password privately. This is a separate login from ChatGPT's browser. Leave the interval at 15 minutes initially.
4. Start manually; leave automatic startup off during this trial. The initial email step may send one sign-in email before the password option is used.
5. Check `sensor.samsung_food_meal_plan` reports `ok`, its `last_success` is current, and its seven dated entries match the Samsung Food app. Then refresh the dashboard.
6. Change a meal in Samsung Food yourself, wait for the next read, and verify the new value and timestamp on both HA and dashboard. Test HA/add-on restart and expired login before enabling boot startup.

The app has Core API access to publish the sensor. Its credentials, browser session and last snapshot live under its private `/data`; they are not sent to GitHub or embedded in the dashboard. HA administrators and backups may access add-on configuration/session data: protect your backups. There are no exposed HTTP ports or remote-debugging endpoints. Logs contain status codes only, not credentials or page dumps.

## Failures and limits

- `login_required`: one login attempt per start, then stops; correct credentials and restart. No automated password resets, CAPTCHA attempts or repeated login loops.
- `read_failed`: preserves the previous snapshot, backs off, and stops after three failed reads. Website changes require a parser update. A fresh sensor state does not mean fresh data: use `last_success`.
- HA restart: the add-on republishes on its next scheduled read. This prototype sensor is a REST state, not an entity-registry integration.
- Only current week and English web UI are supported. Data outside the captured week displays “Not synced”. Notes/unrecognized cards fail the read rather than silently dropping them.
- Browser login may be rejected on the HA host even though the interactive cloud session worked. Stop and investigate; do not attempt to bypass challenges.
- No Docker runtime is available in the development workspace, so the image build, hardware memory usage, startup/login and Supervisor publication still need live validation.

## Editing later

Do not expose write buttons until a deliberate add/move/remove can be verified against a fresh read. Each future write needs a date, slot and recipe identity, conflict checks against the latest plan, no automatic retry after ambiguous success, and a read-back. Samsung Food remains the source of truth. No write endpoint exists in 0.1.0.

## Rollback

Stop/uninstall the add-on and remove `sensor.samsung_food_meal_plan` using HA's States interface if it remains. The dashboard then resumes its calendar meal source. Uninstalling removes the add-on's stored login/session; existing Samsung Food recipes/plans are untouched.
