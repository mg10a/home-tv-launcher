# DEV portrait encoder experiment

Version 0.8.39-dev.6 caps encoded width and height at 1280 pixels without upscaling. The T8213 portrait input is reduced from 1600x2300 to 890x1280. This tests whether reduced encoding work improves sustained playback; synthetic passing tests do not establish real-camera reliability.

Uses the same upstream server as installed dev.4, pinned to cb52d1347a8a69df10260a798b6d9fd969ba680d. The unused dev.5 serial alias override is removed: HA integration 0.8.49-dev.2 already isolates entities by bridge identity. Physical serials must remain unchanged so existing DEV entities and media routes remain valid.

Only update the existing DEV add-on on port 8064. Do not update the original bridge on 8063 or shared HA integration. Before updating, take a DEV add-on backup and retain the earlier full backup. Restore that DEV add-on backup if needed; do not restore unrelated production components.

Validation: ARM64 and AMD64 builds, HEVC decoding, stall recovery, bridge identity, and portrait/landscape output passed on experiment commit 08b2d244ac500bd235c6075310629f26b883af5b (Actions run 40776223866). Repeat CI on release commit before installation.

Hardware verification: use /dev/ dashboard, select camera.doorbell_dev, open modal for at least 60 seconds, verify decoded frame counter advances, close and confirm sessions stop. Repeat open/close and inspect DEV-only diagnostics. Keep stable dashboard unchanged.
