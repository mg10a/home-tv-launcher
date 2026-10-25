// Run against the actual compiled add-on source, not a separate reimplementation.
// Inject a controlled fake FFmpeg process: camera input continues and encoder
// progress stops at 12 frames. The bridge must end the stalled owner once.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { LiveTranscoder } from './dist/live-transcoder.js';

const source = new PassThrough({ highWaterMark: 65536 });
const seen = [];
let failures = 0, frames = 0, killed = false;
const proc = new EventEmitter();
proc.stdin = new PassThrough();
proc.stdout = new PassThrough();
proc.stderr = new PassThrough();
proc.stdio = [proc.stdin, proc.stdout, proc.stderr, new PassThrough()];
proc.exitCode = null; proc.signalCode = null;
proc.kill = () => {
  if (killed) return;
  killed = true;
  proc.signalCode = 'SIGKILL';
  proc.emit('exit', null, 'SIGKILL');
  proc.emit('close', null, 'SIGKILL');
};
const diagnostic = {
  encoder: () => {},
  mark: (_serial, name) => seen.push(name),
};
const transcoder = new LiveTranscoder(
  'synthetic', 'hevc', source, 15, 'software', diagnostic,
  () => {}, () => { failures++; }, () => {},
  () => proc
);
transcoder.start();
let bytesSent = 0;
const inputTimer = setInterval(() => { source.write(Buffer.from('001122334455667788')); bytesSent += 9; }, 120);
const progressTimer = setInterval(() => {
  proc.stdio[3].write(Buffer.from('frame=12\nprogress=continue\n'));
}, 200);
proc.stdout.write(Buffer.from('mpegts output observed before stall'));
const started = performance.now();
try {
  await new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (failures > 0) {
        clearInterval(timer);resolve();
      }
      if (performance.now() - started > 8500) {
        clearInterval(timer);reject(new Error('encoder did not detect a stalled stream'));
      }
    }, 100);
  });
  assert.equal(failures, 1, 'must trigger one bridge cleanup');
  assert.ok(bytesSent >= 300, 'camera input must remain fresh');
  assert.ok(seen.includes('media_encoder_stall_progress_active'), 'diagnostic identifies FFmpeg progress without frame advancement');
  assert.equal(killed, true, 'stalled FFmpeg process must be killed');
  console.log('PASS: continuous HEVC input + stagnant FFmpeg frame progress -> one closed camera owner after ' + Math.round(performance.now() - started) + 'ms');
} finally {
  clearInterval(inputTimer);clearInterval(progressTimer);
  transcoder.stop();
  source.destroy();
  proc.stdio[3].destroy();
  proc.stdout.destroy();
  proc.stdin.destroy();
}
