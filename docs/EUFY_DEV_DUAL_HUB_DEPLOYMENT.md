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

## Additional compatibility validation — 27 October 2026

CI passed on both Home Assistant 2026.10.3 and the installed 2026.10.4,
using Python 3.14:
https://github.com/mg10a/home-tv-launcher/actions/runs/40599133737

Validation commit: `d895da1f3afbf7d78e9945312a30b96e4cc035aa`.
The integration source is unchanged from the immutable revision above.
The run checks imports, camera identity separation, compilation and simulated
installation/rollback, and publishes ZIPs with SHA-256 manifests named by HA
version. These are CI checks, not a running Yellow or real-camera media test.
The component remains v0.8.49-dev.2 because only validation and documentation
changed.

## Live inspection and next deployment gate — 27 October 2026

Read-only inspection confirmed Home Assistant OS with Core 2026.10.4,
Supervisor 2026.10.4 and OS 18.3. Eufy Security Viewer reported 0.8.48,
two hub entries, two devices and eight entities. Only one camera was
registered: `camera.doorbell`. Both push-connection entities showed Connected.
The second hub listed only one entity. No live updates or restarts were made.

The installed bridge versions, each entry's port/bridge identity, backup
availability and Terminal & SSH access still require verification. Do not infer
installed versions from the update suggestions. In particular, verify the DEV
entry's bridge ID starts with `home-tv-dev-`; port 8064 alone does not trigger
namespacing in this patch.

The offered upstream v0.8.49 release describes experimental T8424 standalone
camera support and requires bridge 0.8.40 first. It is a separate update, not
evidence that this duplicate-camera problem is fixed:
https://github.com/keesmod/ha-eufy-cam/releases/tag/v0.8.49

Before authorizing installation:
1. Confirm a completed full HA backup and its recovery credentials, if applicable.
2. Confirm an existing Terminal & SSH app can open its web UI. If absent, stop
   and obtain approval before installing an app.
3. Record the existing camera ID and the original/DEV entry ownership.
4. Check installed integration version again. If already patched or changed
   from the reviewed 0.8.48 baseline, stop and reassess.
5. Obtain approval to replace the shared integration and restart Core.
   Both bridge entries use this shared code.

Run the installer only once. Retain the printed backup directory independently:
rerunning the installer replaces the "latest backup" pointer with a newer
backup, which might itself contain the experimental integration. The rollback
script restores component files, not entity/device registry state; the full HA
backup is the recovery route for those records.

After installation, first verify that `camera.doorbell` keeps its identity,
the original bridge is connected, and a distinct DEV camera belongs to the
8064 entry with `viewer_dev_bridge: true`. Do not treat two camera names alone
as proof of correct routing. Test media separately after ownership is confirmed.

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
