import test from 'node:test';
import assert from 'node:assert/strict';
import { EncoderStallProbe } from './encoder-stall-probe.mjs';

test('healthy stream does not report', () => {
 const p = new EncoderStallProbe(); p.start(0); p.input(0); p.output(0);
 for(let t=1000;t<=12000;t+=1000){p.input(t);p.output(t);p.progress(t,t/1000);assert.equal(p.check(t),null);}
});
test('active progress with no new frames reports once', () => {
 const p = new EncoderStallProbe();p.start(0);p.input(0);p.output(0);p.progress(0,12);
 for(let t=1000;t<=6000;t+=1000){p.input(t);p.progress(t,12);}
 assert.deepEqual(p.check(6000),{event:'encoder_stall',progress_pipe:'active',input_fresh:true,output_stalled:true,frame_stalled_ms:6000});
 assert.equal(p.check(7000),null);
});
test('silent progress pipe is distinguished', () => {
 const p = new EncoderStallProbe();p.start(0);p.input(0);p.output(0);p.progress(0,12);
 p.input(6000);assert.equal(p.check(6000).progress_pipe,'silent');
});
test('no incoming data, no frame count, and stopped session do not report', () => {
 const a = new EncoderStallProbe();a.start(0);a.input(0);a.output(0);a.progress(0,12);
 assert.equal(a.check(6000),null);
 const b = new EncoderStallProbe();b.start(0);b.input(6000);b.output(0);
 assert.equal(b.check(6000),null);
 a.stop();assert.equal(a.check(6000),null);
});
test('frame advancement resets stall timer', () => {
 const p = new EncoderStallProbe();p.start(0);p.input(0);p.output(0);p.progress(0,12);
 p.input(5000);p.progress(5000,13);p.input(6000);
 assert.equal(p.check(6000),null);
});
