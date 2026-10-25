/** Privacy-safe, bounded live encoder stall classifier.
 * Experimental helper; not wired into the bridge or installed on HA.
 * Feed monotonic milliseconds from a single clock for each session.
 */
export class EncoderStallProbe {
  constructor({ stallMs = 5000, inputFreshMs = 2000 } = {}) {
    this.stallMs = stallMs;
    this.inputFreshMs = inputFreshMs;
    this.startedAt = null;
    this.lastInput = null;
    this.lastOutput = null;
    this.lastProgress = null;
    this.lastFrameAdvance = null;
    this.frames = null;
    this.reported = false;
    this.stopped = false;
  }
  start(now) {
    if (!Number.isFinite(now) || this.startedAt !== null) throw Error('invalid start');
    this.startedAt = now;
    this.lastFrameAdvance = now;
  }
  input(now) { if (this.valid(now)) this.lastInput = now; }
  output(now) { if (this.valid(now)) this.lastOutput = now; }
  progress(now, frames) {
    if (!this.valid(now)) return;
    this.lastProgress = now;
    if (Number.isSafeInteger(frames) && frames >= 0 &&
        (this.frames === null || frames > this.frames)) {
      this.frames = frames;
      this.lastFrameAdvance = now;
      this.reported = false;
    }
  }
  valid(now) { return !this.stopped && this.startedAt !== null &&
    Number.isFinite(now) && now >= this.startedAt; }
  check(now) {
    if (!this.valid(now) || this.reported || this.frames === null ||
        this.lastInput === null || this.lastOutput === null ||
        now - this.lastInput > this.inputFreshMs ||
        now - this.lastFrameAdvance < this.stallMs) return null;
    this.reported = true;
    return Object.freeze({
      event: 'encoder_stall',
      progress_pipe: this.lastProgress !== null &&
        now - this.lastProgress <= this.inputFreshMs ? 'active' : 'silent',
      input_fresh: true,
      output_stalled: now - this.lastOutput >= this.stallMs,
      frame_stalled_ms: Math.min(60000, Math.floor(now - this.lastFrameAdvance)),
    });
  }
  stop() { this.stopped = true; }
}
