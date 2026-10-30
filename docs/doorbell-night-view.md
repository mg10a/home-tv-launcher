# Doorbell night view

Night view is a display aid, not a change to HomeBase originals or camera exposure.

- Dashboard Auto samples a small central crop once per second while the camera modal is visible. It requires a dark, near-monochrome scene; two matching samples enable enhancement, three nonmatching samples disable it.
- Auto / Off / On is remembered on this browser/device. The mode applies to live JPEG, WebRTC, recording thumbnails and playback.
- When a recording cannot be sampled because of browser origin restrictions, Auto uses the recording timestamp (21:00–06:00 in the viewing device timezone), never the current viewing time. The status explicitly identifies this fallback. Manual Off/On remains available.
- The tone curve is amplitude 0.75 and exponent 0.32 in sRGB, matching the non-generative comparison. It reveals noise and compression as well as real detail.
- The bridge option `preserve_shadow_detail` preserves T8213 samples below nominal limited-range black in dashboard derivatives. Uploaded H.264 PiP samples carried a limited-range label despite containing usable values below 16. H.264 remuxing corrects the range flag; JPEG and transcoded video explicitly preserve full-range input.
- This range override is based on the tested doorbell. If additional cameras are added, assess their range separately before using this bridge-wide option. It can alter contrast on genuinely limited-range inputs, including daytime clips.

Rollback: select Off for the display tone curve. To also restore previous decoding, set `preserve_shadow_detail: false` in the bridge options and restart the bridge, or restore the pre-update app backup. Daytime has no automatic tone boost, but decoding range preservation still applies.

Validation: dashboard regression suite, infrared/day/colour detector tests, AMD64 and ARM64 bridge build and streaming regression suites, and nonzero below-black values recovered from the supplied H.264 clip after corrected remux.
