# Wiring the tested stall probe into Eufy Bridge (review draft)

**Not an installable package.** The probe's five Node.js tests pass locally
(Node v22.16.0); upstream bridge integration is not yet compiled or tested.

Upstream reference: `keesmod/ha-eufy-cam/bridge/src/live-transcoder.ts`.
The current bridge already parses FFmpeg `-progress pipe:3` and drains stderr.

## Minimal instrumentation points

1. Create one probe for each `LiveTranscoder` process. Start with
   `performance.now()` when the process is spawned.
2. In the **existing** `process.stdout.on('data')` callback, call
   `probe.output(performance.now())` before forwarding the same chunk.
3. In the **existing** `liveProgressParser` callback, call
   `probe.progress(performance.now(), value.frames)` before forwarding
   the progress callback. Do not alter the progress stream.
4. Observe input **without attaching a second `data` listener**:
   instrument the existing video ingress / input accounting callback where
   the bridge already records incoming chunks, and pass its last-data
   timestamp to the probe. Do not wrap `write` or change `pipe`.
5. On an existing 1-second diagnostics timer, call `probe.check(now)`;
   if non-null, emit only its allowlisted fields to the authenticated
   diagnostics store. Never emit serials, token, stderr text or footage.
6. Call `probe.stop()` on every process exit, failure, fallback and
   normal stop. A new FFmpeg process must use a fresh probe.

**Blocking dependency:** locate the exact input-accounting callback and
existing diagnostics timer in upstream bridge source, and ensure the timestamps
are on the same monotonic clock. Do not ship the probe before this is wired and
integration-tested. A second `data` listener on the shared Readable may change
flow control and invalidate the experiment.

## Interpretation

- `progress_pipe: active` + stale frame count: FFmpeg process is alive;
  decoding/encoding/frame-sync may be blocked.
- `progress_pipe: silent` + fresh input: FFmpeg may be blocked or its
  progress pipe stalled; inspect process status and backpressure.
- `output_stalled: false`: transport bytes continue despite frame counter
  not increasing; investigate progress parser/version semantics.
- No stall event: not proof of health; require a baseline input and at least
  one valid frame count.

## Gate before asking user to act

- Bridge TypeScript build and unit tests pass.
- Confirm source bridge revision matches the user's installed v0.8.39.
- Publish a pinned, installable build with checksums and documented rollback.
- Back up HA first. No changes to stable launcher or working JPEG snapshot.
