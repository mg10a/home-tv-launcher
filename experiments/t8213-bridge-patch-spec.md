# T8213 live freeze: corrected bridge investigation

Status: source-reviewed, not installed or validated on Home Assistant Yellow.

## Important correction
Upstream `bridge/src/diagnostics.ts` **already drains FFmpeg stderr** in
`StreamDiagnostics.encoder()`, classifies `invalid data` and
`error while decoding`, and emits bounded `media_encoder_stderr`,
`media_invalid_data`, `media_decode_error`, `media_encoder_exit`,
and `media_encoder_error` events when diagnostics are enabled.
Thus the previously proposed stderr-draining patch is redundant.

The supplied Oct 25 bridge logs contain no `media_encoder_stderr`,
`media_invalid_data`, or `media_decode_error` in the failed sessions.
That means no classified stderr was observed; it does **not** prove that
HEVC is valid or that the decoder is progressing.

## Next targeted instrumentation
The bridge's `live-transcoder.ts` already parses FFmpeg `-progress pipe:3`
and passes `LiveEncoderProgress` to a callback. Prior integration diagnostics
show encoder progress freezing while incoming bytes still arrive.

Implement **progress-stage observation**, not duplicate stderr parsing:
- Record `last_progress` (progress block receipt) separately from
  `last_frame_advance` (increasing `frames` counter).
- Record whether input video chunks continue during the stall.
- Record monotonic time of last MPEG-TS output chunk.
- Add a single bounded stall marker after 5 seconds with input arriving
  within the last 2 seconds and no frame advancement. Distinguish
  `progress_pipe_active` from `progress_pipe_silent`.
- Avoid restarting or replaying raw HEVC automatically; restarting without
  fresh VPS/SPS/PPS/keyframe can make the stream worse.
- Never log footage, serial numbers, full FFmpeg stderr, or tokens.

Tests: no input, progress pipe active with constant frame count, progress
pipe silent, healthy stream, cleanup on stop, stale callbacks after exit,
and multiple simultaneous sessions.

## Acceptance
Prepare and test the actual patch in a disposable environment, then provide
a verified bridge build and backup/rollback steps for the user's web-only
Home Assistant Yellow. Keep working JPEG snapshot and stable launcher intact.
Only combine recording installation with the livestream repair after the
repair is validated.
