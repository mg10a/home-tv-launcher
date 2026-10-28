#!/usr/bin/env node
/**
 * Read upstream Eufy bridge live_video diagnostic JSON from stdin or file.
 * Offline only: no network, credentials or media are accessed.
 * Usage: node experiments/analyse-eufy-live.mjs diagnostics.json
 */
import { readFileSync } from 'node:fs';

const input = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
let source;
try { source = JSON.parse(input); } catch { console.error('Invalid JSON'); process.exit(2); }

function locate(value, depth = 0) {
  if (depth > 9 || !value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(v => locate(v, depth + 1));
  if (value.input && value.output && value.encoder && value.jpeg && value.state) return [value];
  return Object.entries(value)
    .filter(([key]) => !/token|secret|password|credential|authorization/i.test(key))
    .flatMap(([, child]) => locate(child, depth + 1));
}
const rows = locate(source);
if (!rows.length) {
  console.error('No bridge live_video rows found. Export the bridge live diagnostics JSON, not HA state history.');
  process.exit(1);
}
const num = v => Number.isFinite(v) ? v : null;
const fmt = v => v === null ? '?' : String(v);
for (const [i, r] of rows.entries()) {
  const age = num(r.duration_ms) ?? num(r.age_ms);
  const inp = r.input || {}, out = r.output || {}, jpeg = r.jpeg || {}, enc = r.encoder || {};
  const inputLast = num(inp.last_data_age_ms), outputLast = num(out.last_data_age_ms);
  const frames = num(enc.frames), outputBytes = num(out.bytes);
  let assessment = 'Insufficient evidence to identify the first stalled stage.';
  if (num(inp.bytes) === 0) assessment = 'No video input observed: inspect camera/HomeBase/P2P startup.';
  else if (inputLast !== null && outputLast !== null && inputLast > outputLast + 2000)
    assessment = 'Video input appears to have stopped before encoded output.';
  else if (num(inp.bytes) > 0 && outputBytes === 0)
    assessment = 'Video arrived but no MPEG-TS output: inspect FFmpeg decode/encode/progress.';
  else if (outputBytes > 0 && (r.readers?.backpressure ?? 0) > 0)
    assessment = 'Encoder produced output; downstream reader backpressure was recorded.';
  else if (outputBytes > 0 && num(jpeg.bytes) > 0)
    assessment = 'Video and JPEG output existed. Compare last input/output ages and playback ACK timeline.';
  console.log(JSON.stringify({
    row: i + 1, state: r.state, codec: r.codec ?? '?', duration_ms: age,
    input_bytes: fmt(num(inp.bytes)), input_last_age_ms: fmt(inputLast),
    input_max_gap_ms: fmt(num(inp.max_gap_ms)),
    ffmpeg_frames: fmt(frames), ffmpeg_dropped: fmt(num(enc.dropped)),
    ffmpeg_out_time_ms: fmt(num(enc.out_time_ms)),
    ffmpeg_last_progress_age_ms: fmt(num(enc.last_progress_age_ms)),
    ffmpeg_last_frame_ms: fmt(num(enc.last_frame_ms)),
    output_bytes: fmt(outputBytes), output_last_age_ms: fmt(outputLast),
    jpeg_frames: fmt(num(jpeg.chunks)), reader_backpressure: r.readers?.backpressure ?? 0,
    assessment,
  }, null, 2));
}
