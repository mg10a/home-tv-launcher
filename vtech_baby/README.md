# Halo VTech connector — RM7767 experimental profile

This is Halo's maintained Home Assistant integration, based on Kasoo/vtech_baby
(commit `8bd28bf11c028bbb8525b4c12850c28a4922f299`, Apache-2.0). It keeps the existing
`vtech_baby` domain so Halo's camera card and existing entries continue to work.
Do not install it alongside another integration with that domain.

## What changes the connection

The pairing form now has an explicit **RM7767 experimental** profile. It replaces
the derived IOTC auth key in the connection request with the legacy `00000000`
sentinel. This is a transport marker, not a camera password. The owner-provided
QR password and account are retained. The standard profile remains the default;
there is no automatic fallback on failure.

This is a compatibility hypothesis prompted by a camera returning IOTC result 6.
The reference transport defines this sentinel as no IOTC key authentication, and
the Android app has separate connection paths with and without an IOTC auth key.
That does **not** prove the RM7767 accepts this exact wire request. A short reply,
result 6, an unsupported protocol, or a DTLS failure still stops setup.

## Security boundary

Both profiles use `vtech-link==0.3.0`, which requires password-derived PSK DTLS
before AV login. No plaintext AV fallback, cloud connection, relay, remote camera
listener, port forwarding, firmware edit, or authentication-bypass code is added.
The experimental profile does **not** provide the extra IOTC auth-key layer.
It is not security-equivalent to two-layer authentication and is not an audit of
the camera or the official app. Firmware compatibility remains unverified.

The Rust driver creates AV login only after DTLS reports Connected. Its LAN-only
egress policy and encrypted frame handling are unchanged. The package uses the
pinned normal native dependency; it does not require the temporary diagnostic
`.so` or load arbitrary sibling native modules.

Credentials belong only in Home Assistant's pairing form/config entry. Never
commit a QR, capture, UID, camera password, token, or actual footage. All tests
use synthetic credentials. No camera was contacted by the offline tests.

## Build and test

```sh
python -m pip install cryptography
python -m unittest discover -s vtech_baby/tests -v
python vtech_baby/build.py
```

The build creates `vtech_baby/dist/halo-vtech-0.3.1.zip`, containing
`custom_components/vtech_baby/`, the Apache license and attribution. It excludes
captures, credentials, bytecode and native binaries. Home Assistant installs the
pinned native dependency using its normal requirements mechanism.

For the native wire regression, copy `tests/rm7767_wire.rs` into the pinned
upstream `vtech-link/core/tests/` checkout and run:

```sh
cargo test -p vtech-link-core --test rm7767_wire --test iotc --test dtls
```

Validation performed: 7 Python profile/session tests, 1 new Rust wire test,
12 IOTC regression tests and 11 DTLS tests, including incorrect passwords and
refused cipher suites. The full Home Assistant integration suite and a live
RM7767 stream have not been verified.

## Installation and rollback

Before installation, back up the complete existing
`/config/custom_components/vtech_baby` directory outside `custom_components`.
Replace that directory with the packaged directory, then restart Home Assistant.
Select **Halo VTech Baby Monitor** in Add integration, choose the RM7767 profile,
and submit the parent unit QR privately. The profile is retained for reauth;
existing entries without it retain the standard profile.

If setup fails, do not repeat attempts: record the sanitized error classification.
Restoring the backed-up directory and restarting restores the previous version.
No live installation of this candidate has been performed yet.

## Attribution

The integration and transport originate from https://github.com/Kasoo/vtech_baby.
Halo modifications add legacy QR decoding, clearer unsupported-transport errors,
an explicit RM7767 profile, tests and packaging. Original author credit and the
Apache-2.0 license are retained; this is not an upstream release or VTech product.
