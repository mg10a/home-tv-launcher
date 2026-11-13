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
2. **Safest first test:** open the GitHub Actions [Build Halo APK](https://github.com/mg10a/home-tv-launcher/actions/workflows/android-apk.yml)
   workflow, open its latest successful run, and download
   **Halo-VTech-Preview-4.1.4-APK**. Unzip and install `app-debug.apk`.
   This is a **separate Android app** called **Halo VTech Preview**
   (`uk.homecinema.launcher.vtechpreview`); it will **not overwrite or delete
   your existing Halo** or its WebView settings. It loads the same live
   Halo website. You do not need to connect Home Assistant in the preview
   just to try the VTech shortcut.
3. Tap the VTech Baby Pro card on Smart Home or the VTech shortcut on
   Launcher. The official VTech app opens if installed/launchable on that
   same Android device. Android Back returns to the preview app.
4. If it reports *not installed or launchable*, verify the VTech app is
   installed on this device and supports its form factor. The official app
   is primarily distributed for phone/tablet.

The workflow also provides **Halo-4.1.4-APK** using the existing production
app ID (`uk.homecinema.launcher`). It may **not** be installable as an
update if your current Halo was signed by a different debug key. Do not
uninstall a working Halo to force the update without preserving its
app-specific settings.

A web dashboard update alone cannot upgrade the Android native bridge.
If Halo says it needs version 4.1.4, use the separately installable preview.

## Rollback

Reinstall the previously working Halo Android APK and use the prior website
revision if you want the old snapshot card. The native launcher does not
change the VTech app or its configuration.

Official app: https://play.google.com/store/apps/details?id=com.cams.vtech.mvb.pro
