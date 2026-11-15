# Chromecast remote navigation and Eufy live-view troubleshooting

This change is a hosted Halo website update. Existing Chromecast Halo APK
4.1.4 and the separate Halo VTech Preview load these files on their next
cold launch; neither APK nor Home Assistant requires reinstalling.

## What was wrong

The main D-pad code only searched for `button` elements, excluding the
`section[role="button"][tabindex="0"]` Kia Connect card and the focusable
Coffee card. Its key handler also continued navigating Smart Home buttons
behind `<div role="dialog">` overlays, especially the Eufy doorbell, because
it recognised native `<dialog>` but not every custom overlay.

## Changed behaviour

- The main screen includes visible role buttons, controls, selectors and links.
- Native dialog windows and custom Eufy, Salus, pet and calendar overlays
  share a D-pad focus boundary. Focus cannot jump to the dashboard while one
  is open.
- D-pad moves between dialog controls; OK activates the selected action,
  including X/Close. Tab cycles within the modal. Escape is left to native
  dialogs that have their own confirmation/cancel handling.
- Back/BrowserBack keys forwarded to the web page close custom overlays.
  The Android device's physical Back button may not always be forwarded as
  a web key by older APKs; the in-dialog X/Close button remains reachable.
- HA setup retains its separate, tested keyboard-Next handler.
- Focus outlines make Kia, Coffee and dialog actions visibly selected.
- Eufy Live now waits for the initial Home Assistant camera-state load
  and starts once when the selected camera appears, instead of getting stuck
  after opening too early. This avoids extra streaming sessions before HA is
  ready and retains existing bounded live retries.
- Eufy has a **Check connection** button that only reads already received
  Home Assistant status/camera metadata. It never wakes the camera or sends a
  new capture request.

## If doorbell footage is still blank

Open Smart Home > Doorbell > **Check connection**. Read the status shown:

- **Home Assistant: not connected**: reconnect HA on this Chromecast.
- **Doorbell: not found / unavailable**: check that a doorbell camera entity
  is present/available under Home Assistant Devices & Services.
- **Eufy Viewer: not advertised**: verify that the Home Assistant Eufy Viewer
  integration providing `eufy_viewer/watch` is installed and running.
- **Stream: 0 frames** after pressing Live: Home Assistant/bridge has not
  delivered a moving JPEG/WebRTC frame. This cannot be fixed solely by
  Chromecast focus changes; view the live status text for a rejection or
  timeout and investigate the bridge before replacing any integration.
- Use the existing **Snapshot** button for one manual still-image test.
  It is not an automatic/background wake retry.

The status panel reports camera entity name/state, transport and frame count;
it does not show footage or credentials. Do not share HA access tokens, QR
codes or private video in a GitHub issue.

## Test coverage

`tests/tv-remote-navigation.test.cjs` covers Eufy close, D-pad motion,
custom overlays, native Kia/Coffee modal behaviour, Tab, Back and focus
restoration. `tests/tv-remote-browser.test.cjs` exercises real page focus
and buttons in Chromium on a Chromecast-size viewport: it checks that the
Smart Home Kia card is reachable through the D-pad from navigation, and
opens/closes Eufy, heating, pet, calendar, Kia, Coffee, room details,
Groobarbs, family tasks and photo/settings modal windows. Production Eufy
regressions also cover deferred live-start after HA camera states arrive.

**Live Chromecast, camera frames and physical Back hardware have not been
directly tested by CI.** Test with the actual remote and the real Eufy
integration before marking the camera streaming issue resolved.
