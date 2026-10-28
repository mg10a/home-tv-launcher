// Exercise the compiled liveArgs and actual FFmpeg; synthetic footage only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { liveArgs } from './dist/live-transcoder.js';
const temp = mkdtempSync(join(tmpdir(), 'eufy-portrait-'));
function run(bin,args) {
 const p=spawnSync(bin,args,{encoding:'utf8',timeout:90000,maxBuffer:2000000});
 assert.equal(p.status,0,bin+': '+(p.error||p.stderr));
 return p.stdout;
}
try {
 for (const [width,height] of [[1600,2300],[1920,1080],[320,568]]) {
  const input=join(temp,'input.hevc'), output=join(temp,'output.ts');
  run('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i',
   'testsrc2=size='+width+'x'+height+':rate=15','-frames:v','120',
   '-c:v','libx265','-preset','ultrafast','-threads','1',
   '-x265-params','pools=1:wpp=0:log-level=error','-f','hevc',input]);
  const args=liveArgs('hevc',15,'software');
  args.splice(args.indexOf('-i'),0,'-re');
  args[args.indexOf('pipe:0')]=input;
  args[args.indexOf('pipe:1')]=output;
  args.splice(args.indexOf('-progress'),2);
  run('ffmpeg',['-y',...args]);
  const report=JSON.parse(run('ffprobe',['-v','error','-count_packets','-select_streams','v:0',
   '-show_entries','stream=width,height,nb_read_packets','-of','json',output])).streams[0];
  assert.ok(report.width<=1280 && report.height<=1280,JSON.stringify(report));
  assert.ok(report.width<=width && report.height<=height,'must not upscale');
  assert.equal(report.width%2,0); assert.equal(report.height%2,0);
  assert.ok(Number(report.nb_read_packets)>=100,'lost paced output: '+JSON.stringify(report));
  console.log('PASS '+width+'x'+height+' -> '+JSON.stringify(report));
 }
} finally { rmSync(temp,{recursive:true,force:true}); }
