# DEV doorbell codec transition

## Evidence (28 October 2026)

On the T8213 doorbell through T8030 HomeBase 3, multiple DEV playback attempts began with HEVC parameter sets and pictures. After roughly 20–36 packets, the protocol stream marker changed from 1 to 0. The next packet headers included H264 SPS (NAL type 7), followed by H264 slices (type 1). Incoming packet lengths matched their advertised sizes. The bridge had selected its codec from the initial HEVC data and continued feeding H264 into an HEVC decoder. The earlier HEVC-header diagnostic therefore counted invalid headers after the transition; that is not proof of corrupt or incorrectly decrypted packets.

## Experimental correction: 0.8.39-dev.10

The DEV-only SDK patch waits through the initial HEVC portion on T8030 live VIDEO until it sees marker 0 with an H264 SPS. It then allows the existing SDK to initialize the live stream from that SPS. Both the JPEG and WebRTC consumers receive the same correctly initialized codec. No physical camera settings, account credentials, shared HA integration, original bridge or stable dashboard are changed.

This is a targeted experiment for the observed T8030/T8213 sequence, not a universal HomeBase fix. A T8030 stream that only sends HEVC after its initial marker-1 VPS would not pass this gate. Do not promote this behavior to a general integration without a bounded fallback or a general codec-transition implementation.

Numeric diagnostics retain protocol enum counts only, never raw video, keys or identifiers. Recording/BINARY streams bypass the gate. Existing H264 streams without the HEVC pre-roll pass unchanged.

## Validation

The build workflow validates AMD64 and native ARM64, bridge identity, decoder operation, encoder recovery, portrait scaling and numeric diagnostics. The codec test verifies scope exclusions, the HEVC-to-H264 gate and 30 actual decoded synthetic H264 frames. Real doorbell playback must still be tested for sustained frames, reopening, and cleanup on close.

## Recovery

A fresh DEV-only backup was taken before the packet diagnostics update. Restore that DEV app backup through Home Assistant if this experiment regresses startup. Do not restore the complete Home Assistant system or modify the original bridge. The prior code revision 20423a2d03dc18384418984a875161c2011b6611 is the dev.9 diagnostic baseline. Restoring code alone is preferable to overwriting newer authentication state when an appropriate supported update path is available.

## Actual hardware result after dev.10 installation

The cloud DEV dashboard completed a 91,608 ms session on the real doorbell. Bridge diagnostics selected H264 and reported 1,229 encoded frames, zero dropped/duplicated frames, zero encoder exits and zero stderr chunks. Input continued to within 34 ms of session end; encoded output to within 9 ms. The browser displayed over 240 live JPEG frames with an advancing camera-embedded timestamp. After closing the modal, active viewers was zero and the live state was ended. Reopening delivered another 80 live JPEG frames before the test was deliberately closed.

Cloud WebRTC reported connection_failed and used the existing JPEG fallback. These results establish sustained real-camera decoding and JPEG playback, not successful WebRTC rendering in this cloud environment. Brave/phone WebRTC verification remains outstanding. Production bridge remains 0.8.39; shared HA integration remains 0.8.49-dev.2. Automated validation: https://github.com/mg10a/home-tv-launcher/actions/runs/40785230719 .

## Phone WebRTC result and DEV dashboard workaround

The user subsequently observed briefly moving WebRTC video followed by a solid grey picture while painted-frame counts increased (260, 300, 340). The phone sessions had continued bridge encoding without encoder errors; this does not establish a usable WebRTC image. The grey output remains unresolved and must not be described as fixed.

DEV dashboard v3.77-dev selects the existing authenticated live JPEG transport for cameras marked viewer_dev_bridge=true (or camera.doorbell_dev). This uses the real advancing JPEG stream verified above, not periodic cached snapshot refresh. The stable dashboard, original-camera transport, shared integration and bridge version are unchanged. WebRTC decoding/relay compatibility remains a separate investigation. Revert commit 99629344716d5fc4f49a8bd10474359b49a11c2a to restore the prior DEV transport preference if needed.
