# DEV recordings and kiosk viewer — 28 October 2026

DEV v3.80 keeps the working authenticated JPEG live transport and separates Live and Recordings into full-height views. The recording selector shows time and duration; a preview is requested only for the selected clip, including clips beyond the former twelve-thumbnail limit. Date selection reloads the list and its count. Production index.html is unchanged.

## Verified hardware results

On v3.79 the installed authenticated WebSocket commands returned 20 recordings for 2026-10-28 and 13 for 2026-10-27, with real thumbnails. The installed launcher_recordings.py uses coordinator.camera_serial for DEV ownership and is registered in integration setup.

Recording preparation still uses the existing authenticated HTTP endpoint and short-lived HA signed playback URLs. A direct unauthenticated CORS preflight to Home Assistant returned HTTP 403 with origin https://mg10a.github.io not allowed. Current configuration.yaml has no http section or matching origin. The user approved the configuration change and Core restart. Configuration was backed up as /config/configuration.yaml.before-eufy-cors-20261028. The exact GitHub Pages origin was appended under http.cors_allowed_origins; ha core check completed successfully. ha core restart was issued. Nabu Casa has not yet recovered, so post-restart HTTP and recording playback verification remain blocked. Restore that backup to /config/configuration.yaml and restart Core to roll back if necessary. Neither bridge was reinstalled or restarted separately. Successful preflight does not prove recording playback; actual clip preparation and playback must then be tested.

## Kiosk intent

The intended automatic popup target is an always-on tablet displaying the dashboard. The implementation observes event.doorbell_dev_event while the page is visible, rejects restored/stale events and duplicate timestamps, selects camera.doorbell_dev and opens live video. It does not wake or unlock a phone. Real motion-event testing on the intended kiosk is outstanding. Current behavior does not interrupt an already-open camera modal.

## Validation

Run Node tests dev/tests/eufy-dashboard.test.cjs, tests/eufy-dashboard-dev.test.mjs, tests/eufy-recording-preview.test.cjs. Preview test covers older clips and stale response isolation. Real phone/tablet layout and actual playback still require validation; compilation and fixtures alone do not establish hardware success.
