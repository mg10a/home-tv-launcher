# Halo VTech RM7767 - experimental one-time installer

This helper installs the **specific experimental candidate** in
[PR #5](https://github.com/mg10a/home-tv-launcher/pull/5), source commit
`21b53f628fd511dfd03568bd1ad357a235ea42dd` (integration 0.3.1). It is
**not** an official VTech integration or a confirmed streaming fix.

## Before you start

1. Save a current **Home Assistant backup** via Settings > System > Backups.
2. Ensure the existing Halo Home TV Launcher add-on repository is installed. If
   this experimental app does not appear, refresh the add-on/app store. Its
   default action is `install` and **Start on boot is disabled**.
3. Installing this app **does not** restart Home Assistant or initiate camera
   pairing. You control those actions.

## Install (phone-friendly)

1. Open **Settings > Apps** (or Add-ons, depending on your Home Assistant UI),
   find **Halo VTech RM7767 - Experimental Installer**, and install it.
2. In **Configuration**, leave **action = install**. Select **Start** once.
3. Open **Logs**. Look for `Installed Halo VTech Baby Monitor 0.3.1` and the
   backup confirmation. The app stops after running.
4. In Home Assistant, restart **Home Assistant only** (not the device).
5. Open **Settings > Devices & services > Add integration**, choose
   **Halo VTech Baby Monitor**, select **RM7767 experimental - encrypted
   password login**, and submit the parent-unit QR **privately in Home Assistant**.
   If the integration is already configured, use **Reconfigure / Reauthenticate**
   rather than adding a duplicate entry.
6. Make one pairing attempt. If it fails, **do not repeat attempts**; copy only
   the error **classification** (e.g. `unsupported_transport`, `invalid_auth`,
   `cannot_connect`, or `module_unavailable`) without any QR, UID, passwords,
   tokens, IP addresses, packet captures or footage.

The original `custom_components/vtech_baby` directory, if present, is moved
into `/config/halo_vtech_backups/original-<date>-<pid>` before installing.
Home Assistant config entries, credentials and other integrations are untouched.
The running installer makes **no network requests**. Its image build downloads
public source from the pinned commit over HTTPS. No camera data is downloaded,
recorded or uploaded by the helper.

## Roll back

In the same app open Configuration and change **action = rollback**. Start it
once. Check the Logs for `Rollback complete`, then restart Home Assistant.
The tested experimental code is preserved separately in
`/config/halo_vtech_backups/experimental-*` rather than deleted. If no prior
vtech_baby code directory existed, rollback removes only this candidate.

If the app cannot run, use your saved Home Assistant backup or restore the
`original-*` directory manually with Home Assistant's Terminal & SSH app.
Do not delete credentials or the integration entry to fix a transport rejection.

## Security limitations

The experimental profile does **not** add a cloud stream, public listener,
forwarding rule, video uploader, or unencrypted audio/video fallback. The
native library still requires PSK DTLS and AV password authentication.
**However**, this profile skips an *additional* IOTC transport-key authentication
layer. It is **not** equivalent to the standard profile or a security audit of
the official baby monitor. Do not rely on this experimental integration as a
sole safety-critical baby-monitoring system.

Source attribution and licence are bundled with the integration. For technical
protocol and test details, see [the candidate's README](https://github.com/mg10a/home-tv-launcher/blob/experimental/vtech-rm7767/vtech_baby/README.md).
