# Eufy T8213 live stream — investigation

**Isolated development branch. Nothing installed on Home Assistant Yellow.**

## Established from prior logs
HEVC input begins around 3–4 seconds; FFmpeg software output and JPEG frame appear around 4–5 seconds; some attempts get frame ACK. Playback fallback follows around 10–14 seconds, and camera timeout around 14–18 seconds. Lowering bitrate to 1500k and 800k, and closing Eufy app, did not fix it.

## Actual source reviewed
- Upstream `bridge/src/live-transcoder.ts`: FFmpeg receives HEVC elementary stream, reports frame/output-time progress through `-progress pipe:3`, stamps wall-clock PTS, uses VFR and MPEG-TS output.
- Upstream `bridge/src/media.ts`: encoder outputs are observed; a 2-second/1MB startup cache is replayed; readers are destroyed if buffered writes exceed 1MB.
- Upstream `custom_components/eufy_viewer/viewers.py`: `eufy_viewer/watch` with `transport: jpeg` delivers base64 JPEG `frame` events requiring `eufy_viewer/ack`.

## Next diagnostic patch for bridge
Record bounded counters each second per session, no media or credentials:
1. Incoming video bytes/s and time since last input chunk.
2. FFmpeg frame count, output timestamp, stderr errors and last progress age.
3. MPEG-TS output bytes/s, reader count and buffered write bytes.
4. Last frame acknowledgement age and exact camera/viewer timeout trigger.

Interpret:
- Input stops first: Eufy P2P / HomeBase source.
- Input continues but FFmpeg frames stop: decoder/demux/PTS.
- FFmpeg frames continue but MPEG-TS stops: encoder/mux.
- MPEG-TS continues but browser stops: downstream WebRTC / go2rtc.
- Everything continues but timeout fires: ownership/viewer timer logic.

Do **not** increase the timeout blindly: it can conceal a stalled camera and drain its battery.

## Launcher prototype
The experimental launcher on this branch captures the **first live JPEG frame** via the existing authenticated WebSocket viewer protocol, not a historical snapshot. It may wake the doorbell and is not yet device-tested. The stable launcher remains v3.65.

## Recordings
Eufy Events exposes authenticated HTTP endpoints, but GitHub Pages fetch fails. A safe HA-side WebSocket extension must check per-entity read permissions, bound responses, and avoid raw recording files in WebSocket messages. This extension has not been installed or implemented yet.
