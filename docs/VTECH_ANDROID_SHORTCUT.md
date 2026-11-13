# MyVTech Baby Pro — Android shortcut in Halo

The Smart Home **Baby camera** card now acts as a **VTech Baby Pro** app launcher,
not a Home Assistant snapshot. A small matching shortcut also appears beside
App settings on Halo's Launcher screen. These controls do not depend on VTech
pairing in Home Assistant.

## How it works

- The production Halo Android **4.1.4** app and DEV Android app recognise the
  official Google Play package `com.cams.vtech.mvb.pro`.
- On a supported Android device, Halo gets the **installed app's actual icon**
  via Android PackageManager, entirely locally, and displays it in the shortcuts.
  If the app isn't installed, Halo uses a baby-symbol placeholder instead.
- Tapping launches the package's main Android activity. Android's **Back** or
  recent-apps UI returns to Halo. The official VTech app handles video/audio
  and its own pairing, login and network traffic.
- No VTech credentials, video, microphone audio or session data are pulled into
  the Halo web page or public GitHub.
- No new Home Assistant integration, relay, public camera URL or cloud stream is
  created by this shortcut.

## Install from your phone

1. Install and sign in to **MyVTech Baby Pro** on the same Android device that
   runs Halo. Being installed on your phone does not make it installed on a
   separate Google TV / streamer.
2. Open the GitHub Actions [Build Halo APK](https://github.com/mg10a/home-tv-launcher/actions/workflows/android-apk.yml)
   workflow, open its latest successful run and download the
   **Halo-4.1.4-APK** artifact. Unzip and install `app-debug.apk` over
   your existing Halo Android app (application ID `uk.homecinema.launcher`).
3. Tap the VTech Baby Pro card on Smart Home or the VTech icon on Launcher.
   If it reports *not installed or launchable*, verify the VTech app is on
   this same Android device and supports its form factor. The official app is
   primarily distributed for phone/tablet.
4. If Halo says it needs version 4.1.4, update the Halo APK. Updating the
   hosted web dashboard alone cannot upgrade Android's native app allowlist.

The test APK is a debug build and Android may refuse an in-place install if
the existing Halo was signed by another key. In that case, do **not** remove
Halo before preserving its app-specific storage/settings. Ask for assistance
rather than deleting a working installation.

## Rollback

Reinstall the previously working Halo Android APK and use the prior website
revision if you want the old snapshot card. The native launcher does not
change the VTech app or its configuration.

Official app: https://play.google.com/store/apps/details?id=com.cams.vtech.mvb.pro
