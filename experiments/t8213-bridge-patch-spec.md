# T8213 live freeze: bridge-only diagnostic patch specification

Status: design for review; NOT installed or validated on HA Yellow.

## Evidence
Bridge 0.8.39 on arm64 starts HEVC, creates H.264 transport output and JPEG,
then times out. Earlier integration diagnostics show video input still arriving
while FFmpeg encoder progress and JPEG output stop. This does not establish
whether the HEVC input contains complete decodable frames.

## Minimal, privacy-preserving bridge patch
Target upstream `bridge/src/live-transcoder.ts`, in `LiveTranscoder.startProcess()`.
The FFmpeg child is spawned with stderr at `process.stderr`, but this stream
currently has no consumer. Add a bounded, diagnostic-only stderr consumer
that classifies FFmpeg error lines into allowlisted categories and counts them.
Do NOT log stderr verbatim: FFmpeg can include private paths, addresses, or
codec extradata. Do NOT log raw video or camera serial numbers.

Suggested categories:
- hevc_invalid_data: line contains `Invalid data found when processing input`
- hevc_reference: line contains `Could not find ref` or `Missing reference`
- hevc_parameter_sets: line contains `PPS id out of range`, `SPS`, or `VPS`
- decode_error: line contains `Error while decoding`
- timestamp_error: line contains `Non-monotonous DTS` or `Invalid DTS`
- encoder_error: line contains `Error initializing output stream`
- other_error: all remaining error lines (count only)

Use bounded line buffering (e.g. 512 bytes, drop overlong lines) and bounded
per-category counters; publish counts only through the existing authenticated
integration diagnostics when `diagnostics: true`. Drain stderr even if diagnostics
are disabled. Ensure no raw strings or video buffers are retained. Add tests for
split lines, huge lines, malicious/private content, counter bounds, and no
diagnostic output when disabled.

Also sample progress stagnation vs incoming-video byte/chunk counters, with
monotonic timestamps and the same per-attempt ID. Do not automatically restart
FFmpeg until input continuity and replay/keyframe safety are established.

## Acceptance on actual Yellow
1. Back up bridge app and HA integration; preserve token and private data.
2. Install one controlled bridge diagnostic candidate (not this document).
3. Run one T8213 livestream for 20–30 seconds and download the authenticated
   integration diagnostics BEFORE restarting.
4. Verify categorized errors and input/progress counters explain the freeze.
5. Restore the existing bridge if snapshot or livestream regress.
6. Only then combine the validated live fix with recording API installation.

The dashboard's working JPEG snapshot and stable root v3.65 remain untouched.
