import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('dev/index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.ok(scripts.length>0,'Dashboard has inline JavaScript');
for(const [i,source] of scripts.entries())new vm.Script(source,{filename:'inline-'+i+'.js'});
assert.match(html,/v3\.72-dev/,'Visible version label updated');
assert.ok(html.includes('/api/eufy_viewer/recordings/'),'Uses existing HA recording API');
assert.ok(html.includes("type:'eufy_viewer/ack'"),'Live JPEG acknowledges frames');
assert.ok(!html.includes('eufy_viewer/launcher_events'),'No unavailable experimental API');
assert.ok(!html.includes('HomeTVNative'),'No dependency on broken Android wrapper');

const script=scripts.at(-1);
const from=script.indexOf('let eufyLiveSubscription=');
const to=script.indexOf('let eufyAbort=',from);
assert.ok(from>=0&&to>from,'Live-JPEG block found');
const liveCode=script.slice(from,to);
const sent=[];
let guard;
let pendingRetry;
const elements=new Map();
const classList=()=>({add(){},remove(){},contains(){return false}});
const image={onload:null,onerror:null,classList:classList()};
Object.defineProperty(image,'src',{set(value){this._src=value;this.onload?.()},get(){return this._src}});
const document={
 hidden:false,
 addEventListener(){},
 getElementById(name){
  if(name==='eufyStill')return image;
  if(!elements.has(name))elements.set(name,{classList:classList(),textContent:'',value:'2026-10-25'});
  return elements.get(name);
 }
};
const ws={readyState:1,send(message){sent.push(JSON.parse(message))}};
const context={document,WebSocket:{OPEN:1},haSocket:ws,haRequestId:100,haVerified:true,
 eufyWsPending:new Map(),eufyCameraEntity:()=> 'camera.front_door',eufyBattery:()=>null,
 eufyStopJpeg:()=>{},Date,JSON,
 setInterval(fn){guard=fn;return 1},clearInterval(){guard=null},
 setTimeout(fn){pendingRetry=fn;return 2},clearTimeout(){pendingRetry=null}};
vm.createContext(context);
vm.runInContext(liveCode,context);
vm.runInContext('eufyStartLive()',context);
assert.equal(sent[0].type,'eufy_viewer/watch');
assert.equal(sent[0].transport,'jpeg');
vm.runInContext("eufyLiveEvent({event:{type:'frame',sequence:1,jpeg:'ZmFrZQ=='}})",context);
assert.ok(sent.some(m=>m.type==='eufy_viewer/ack'&&m.sequence===1),'Frame acknowledged after image load');
assert.equal(elements.get('eufyMeta').textContent.includes('Live JPEG'),true);
vm.runInContext('eufyStopLive()',context);
assert.ok(sent.some(m=>m.type==='unsubscribe_events'&&m.subscription===100),'Stop unsubscribes');
assert.equal(guard,null);
vm.runInContext('eufyStartLive()',context);
vm.runInContext('eufyLiveLastFrame=Date.now()-11000',context);
guard();
assert.equal(elements.get('eufyMeta').textContent.includes('Reconnecting'),true,'Frame stall schedules bounded recovery');
assert.equal(typeof pendingRetry,'function');
vm.runInContext('eufyStopLive()',context);
assert.equal(pendingRetry,null,'Closing cancels recovery timer');

// Exercise the actual recording loader against mocked existing-API responses.
const a=script.indexOf('async function loadEufyRecordings(){');
const b=script.indexOf('function closeEufyPlayer(){',a);
assert.ok(a>=0&&b>a);
const loader=script.slice(a,b);
const recordId='a'.repeat(32),paths=[];
const grid={children:[],replaceChildren(){this.children=[]},append(child){this.children.push(child)}};
const note={textContent:''};
const date={value:'2026-10-25'};
const recDocument={
 getElementById(id){return {eufyRecordingGrid:grid,eufyRecordingNote:note,eufyDate:date}[id]},
 createElement(tag){return {tagName:tag,className:'',type:'',textContent:'',children:[],append(...c){this.children.push(...c)}}}
};
const rec={document:recDocument,eufyAbort:null,eufyRecords:[],eufyStopLive(){},closeEufyPlayer(){},
 eufyClearThumbs(){},eufyRecordingCamera:()=> 'camera.front_door',eufyThumbUrls:[],
 AbortController,Error,Array,encodeURIComponent,
 eufyRecordingError:e=>e.message,
 eufyApi:async path=>{paths.push(path);return {ok:true,json:async()=>({complete:true,recordings:[{id:recordId,start:'2026-10-25T07:00:00',end:'2026-10-25T07:00:10',thumbnail:false}]})}},
 playEufyRecording(){}};
vm.createContext(rec);vm.runInContext(loader,rec);
await vm.runInContext('loadEufyRecordings()',rec);
assert.equal(paths[0],'/api/eufy_viewer/recordings/camera.front_door?date=2026-10-25');
assert.equal(rec.eufyRecords.length,1);
assert.equal(grid.children.length,1);
assert.match(note.textContent,/1 recordings/);
console.log('PASS: inline JS syntax, version, real REST recording route, live JPEG frame ACK, unsubscribe, stall recovery, recording list fixture');
