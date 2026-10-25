# Eufy Viewer DEV two-hub deployment — v0.8.49-dev.2

## What this changes

Affects only Home Assistant custom integration `/config/custom_components/eufy_viewer`.
The production bridge at port 8063, DEV bridge at port 8064, stable Home TV
Launcher v3.65 and DEV dashboard v3.75 are untouched.

The DEV bridge announces `home-tv-dev-<uuid>`. Before this patch, Home Assistant
entity/device registry keys used the physical camera/HomeBase serial number
alone and collided with the original bridge. This version preserves original
registry keys and namespaces only entities belonging to DEV bridge IDs.

All media/recording requests still resolve the physical camera serial after
checking which integration owns the entity. Recordings remain subject to the
separate GitHub Pages HTTP/CORS constraint.

## Tested source (immutable)

- Integration source revision: `93cb332286d7528ab600485d8f117b2fd822ff4a`
- Installer and rollback scripts revision: `fd7fb694cc212e59575fe18f574e0005d6e55727`
- CI: https://github.com/mg10a/home-tv-launcher/actions/runs/40198714679
- CI installed Home Assistant 2026.10.3 on Python 3.14, imported integration
  modules, instantiated original and DEV camera entities, verified namespaced
  device and entity IDs, compiled sources, produced an installable ZIP, and
  executed backup/install/rollback using a fake `/config`. Neither real HA
  configuration nor the real doorbell was part of the tests.

## Before installation

In Home Assistant **Settings > System > Backups**, create a backup. The installer
also preserves a full copy of the existing integration under
`/config/eufy-viewer-backups`. Keep both Eufy bridge add-ons in their current
state, with DEV on 8064 and production on 8063. No new passwords or tokens.

## Installation using the Home Assistant Terminal & SSH app's web UI

Run these commands, in this order:

```sh
curl -fsSL -o /tmp/eufy-dev-install.sh \
  https://raw.githubusercontent.com/mg10a/home-tv-launcher/fd7fb694cc212e59575fe18f574e0005d6e55727/scripts/install-eufy-dual-hub-dev.sh
sh /tmp/eufy-dev-install.sh
```

Expected terminal output includes:
- `INSTALLED: Eufy Security Viewer 0.8.49-dev.2`
- `BACKUP: /config/eufy-viewer-backups/eufy_viewer_...`

If anything says `STOP`, do not restart Home Assistant; report the text.
The script never reads bridge tokens, changes either bridge, or restarts HA.

Restart **Home Assistant Core** from Settings > System. Do **not** restart,
remove, or reinstall the original Eufy bridge.

After HA restarts, open **Settings > Devices & services > Eufy Security Viewer**.
The DEV hub should list additional DEV-named T8213/T8030 devices and a separate
camera entity. DEV camera state attributes should contain
`viewer_dev_bridge: true`, while the original camera remains unchanged.
The launcher at
https://mg10a.github.io/home-tv-launcher/dev/?v=3.75 should offer two camera
sources after it reconnects; do not start simultaneous streams.

## Rollback using the same web terminal

```sh
curl -fsSL -o /tmp/eufy-dev-rollback.sh \
  https://raw.githubusercontent.com/mg10a/home-tv-launcher/fd7fb694cc212e59575fe18f574e0005d6e55727/scripts/rollback-eufy-dual-hub-dev.sh
sh /tmp/eufy-dev-rollback.sh
```

Expected result: `RESTORED: Original Eufy Viewer integration...`.
Restart Home Assistant Core. This restores the original on-disk component.
The entire Home Assistant backup can also restore the configuration/registries
if that becomes necessary. The rollback does not modify bridge add-ons.

## Boundaries

This fixes the **duplicate HA camera identity**, not the bridge's HEVC encoder
stall and not the launcher's HTTPS-to-HA recording CORS path. Actual doorbell
livestream acceptance still needs a run against the DEV camera after installation.
