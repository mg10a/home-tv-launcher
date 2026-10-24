# Controlled Home Assistant test plan — v3.67-dev

**Status:** prototype; do not install on the production HA Yellow without a backup and a rollback plan. The live launcher on `main` is v3.65.

## Existing prerequisites
- Eufy Security Viewer integration from `keesmod/ha-eufy-cam`, tested here against upstream source corresponding to the user's 0.8.48 installation. Version matching has **not** been verified on the actual HA Yellow.
- An authorised Home Assistant user with permission to read the doorbell camera entity.
- An isolated integration test installation or backup of `/config/custom_components/eufy_viewer`.

## Installation changes required in a disposable test installation
1. Copy `experiments/launcher_recordings.py` to `custom_components/eufy_viewer/launcher_recordings.py`.
2. In `custom_components/eufy_viewer/__init__.py`, add `from .launcher_recordings import async_register_recording_commands` beside `from .viewers import async_register_commands`.
3. In `async_setup`, immediately after `async_register_commands(hass)`, add `async_register_recording_commands(hass)`.
4. Restart the **test** Home Assistant and verify no import, registration or schema errors. Do not alter bridge or transcoder.
5. Authenticate to the HA WebSocket and send `{"id":101,"type":"eufy_viewer/launcher_events","entity_id":"camera.YOUR_EUFY_ENTITY","date":"2026-10-24"}`. Confirm a successful result contains `complete:true` and a `recordings` array.
6. Choose a returned `id` with `thumbnail:true` and send `{"id":102,"type":"eufy_viewer/launcher_thumbnail","entity_id":"camera.YOUR_EUFY_ENTITY","recording_id":"32_HEX_CHARACTER_RECORDING_ID"}`. Confirm a bounded `image/jpeg` response and valid JPEG bytes. Test an unauthorised camera entity and ensure it is rejected.
7. Test `eufy_viewer/watch` JPEG first-frame command separately; record its response and any `frame` or `ended` event. Do not repeatedly wake the battery doorbell.
8. Only after those pass, test the experimental launcher branch in a separate preview, including remote navigation, closing during load and date selection.

## Rollback
Restore the backed-up `custom_components/eufy_viewer` directory and restart HA. Keep the live launcher branch unchanged. Never publish HA tokens, camera serials, signed playback URLs or unredacted diagnostic dumps.

## Known limitations
- The experimental thumbnail API transfers JPEG base64 over the HA WebSocket. Launcher limits loading to the first 12 thumbnails.
- The JPEG first-frame view requires a live camera session, so it can still fail if the existing HEVC path freezes.
- Video playback is not supported by this extension. The existing HA playback URLs are authenticated and should **not** be inserted into an unauthenticated video element.
- The offline diagnostic analyser consumes existing bridge live-video diagnostic JSON; it cannot prove a fault without real session data.
