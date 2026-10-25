# Eufy T8213 live freeze: evidence-led bridge fix plan

Status: investigation, **not a verified fix**. No production HA or bridge changes.

## Existing user diagnostics (24 October 2026)
- In a 14,565 ms session, bridge HEVC input reached 14,517 ms (48 ms before end), 127 chunks / 279,804 bytes.
- FFmpeg progress last advanced at 4,658 ms, 9,907 ms before end; only 12 frames / 1,323 ms output time reported.
- MPEG-TS output last arrived at 7,332 ms (7,233 ms before end); JPEG output last arrived at 4,444 ms (10,121 ms before end).
- No reader backpressure reported. Similar stalls recur across sessions.
- Therefore a camera transport outage is not the primary explanation for this example. The processing/output path is suspect, though whether it is decoder, timestamp/filter graph, encoder, or downstream muxer remains unresolved.

## Upstream source review
`bridge/src/live-transcoder.ts` currently:
- Starts FFmpeg with `-threads 1`, `-f hevc -i pipe:0`, `libx264 -preset ultrafast -tune zerolatency`.
- Applies `setpts='(time(0)-<origin>)/TB',scale='min(1920,iw)':-2`, VFR `-fps_mode vfr`, and `-enc_time_base 1:90000`.
- Uses software mode on this device; input is piped from the P2P Readable, and output is consumed from stdout.
- Progress pipe is drained, and diagnostics indicate no reader backpressure.

## Candidate experiments (one variable at a time)
1. **Timestamp filter isolation**: controlled test replacing the wall-clock setpts filter with monotonic synthetic timestamps (and suitable output clock settings). This may affect playback pacing and must not be shipped without testing.
2. **HEVC decode isolation**: retain the exact source HEVC sample and run FFmpeg to null output, distinguishing decode stalls from encoder/mux stalls. No raw camera footage should be added to a public repository.
3. **Encoder isolation**: with the same source sample, test decode+scale+H264 encode to null output; then MPEG-TS output.
4. **Bounded watchdog**: only after root cause is understood, consider a diagnostic-only warning when input continues but output/progress stalls. Blind FFmpeg restart mid-HEVC GOP can fail without VPS/SPS/IDR, so do not deploy automatic restarts without recovery testing.

## Acceptance
- Repeated live viewing for at least 60 seconds on the user's HA Yellow.
- No freeze after first frame, no unbounded buffering, and no regression in JPEG snapshot, recordings, or HA Events card.
- Bundle the validated bridge change with the recording WebSocket extension into one backed-up HA installation.
