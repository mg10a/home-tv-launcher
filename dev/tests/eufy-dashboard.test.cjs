const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const html=readFileSync('dev/index.html','utf8');
const liveSource=html.slice(html.indexOf('/* DEV live view:'),html.indexOf("document.addEventListener('visibilitychange'",html.indexOf('/* DEV live view:')));
assert.ok(liveSource.includes('eufyRtcReady'), 'DEV WebRTC implementation must exist');

test('all inline scripts parse without JavaScript errors',()=>{
 const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=2);
 for(const [i,s] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(s[1],{filename:'inline-'+i+'.js'}));
});
test('visible DEV version and original snapshot path preserved',()=>{
 assert.match(html,/v3\.74-dev/);
 assert.match(html,/id="eufyLiveVideo"/);
 assert.match(html,/async function refreshEufySnapshot\(\)/);
 assert.match(html,/eufyJpegFirstFrame\(entity\)/);
 assert.match(html,/type:'eufy_viewer\/watch',entity_id:entity,transport:'jpeg'/);
});
test('recording API uses installed 0.8.48 integration (not experimental WS extension)',()=>{
 assert.match(html,/\/api\/eufy_viewer\/recordings\/'\+encodeURIComponent\(camera\)/);
 assert.match(html,/eufyApi\(path,\{signal\}\)/);
 assert.match(html,/eufyApi\(path,\{method:'POST',signal\}\)/);
 assert.doesNotMatch(html,/eufy_viewer\/launcher_events/);
});

function harness(){
 const sent=[],elements={};
 let now=100000,heartbeat=null,retryTimer=null;
 class Clock extends Date{static now(){return now}}
 const advance=(ms)=>{now+=ms;heartbeat?.()};
 const fireRetry=()=>{const action=retryTimer;retryTimer=null;action?.()};
 const classes=hidden=>({hidden,add(x){if(x==='hidden')this.hidden=true},remove(x){if(x==='hidden')this.hidden=false},contains(x){return x==='hidden'&&this.hidden}});
 for(const id of ['eufyLiveButton','eufyLiveVideo','eufyStill','eufyStillPlaceholder','eufyMeta','eufyOverlay']){
  elements[id]={textContent:'',classList:classes(id!=='eufyOverlay'),
   pause(){},play(){return Promise.resolve()},srcObject:null,
   requestVideoFrameCallback(cb){this.paint=cb;return 2},
   cancelVideoFrameCallback(){this.paint=null}};
 }
 const document={getElementById(id){assert.ok(elements[id],id);return elements[id]},hidden:false};
 const haSocket={readyState:1,send(s){sent.push(JSON.parse(s))}};
 const WebSocket={OPEN:1};
 const haStates={'camera.front_door':{attributes:{viewer_webrtc:true}}};
 class Peer{constructor(){this.connectionState='new';Peer.last=this}addTransceiver(){}
  async createOffer(){return {sdp:'offer-test'}}
  async setLocalDescription(x){this.localDescription=x}
  async setRemoteDescription(x){this.remoteDescription=x}
  async addIceCandidate(x){this.lastCandidate=x}
  close(){this.closed=true}}
 class MediaStream{constructor(){this.tracks=[]}addTrack(t){this.tracks.push(t)}getTracks(){return this.tracks}}
 const deps={document,WebSocket,haSocket,haStates,eufyWsPending:new Map(),haVerified:true,
  RTCPeerConnection:Peer,MediaStream,eufyCameraEntity:()=> 'camera.front_door',
  eufyBattery:()=> '46%',eufyStopJpeg:()=>{},
  eufyWsCommand:async x=>{sent.push(x);return {success:true,result:{accepted:true}}},
  setInterval:fn=>{heartbeat=fn;return 1},clearInterval:()=>{heartbeat=null},
  setTimeout:fn=>{retryTimer=fn;return 2},clearTimeout:()=>{retryTimer=null},Date:Clock};
 const fn=new Function(...Object.keys(deps),
  "let haRequestId=900;"+liveSource+
  ';return {start:eufyStartLive,event:eufyLiveEvent,stop:eufyStopLive,id:()=>eufyLiveSubscription};');
 return {api:fn(...Object.values(deps)),sent,elements,Peer,advance,fireRetry};
}
test('WebRTC offers, accepts a displayed frame, and unsubscribes on stop',async()=>{
 const {api,sent,elements,Peer}=harness();
 api.start();
 assert.equal(sent.find(x=>x.type==='eufy_viewer/watch')?.transport,'webrtc');
 api.event({event:{type:'ready',fallback:true,ice_servers:[]}});
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(sent.find(x=>x.type==='eufy_viewer/signal'&&x.offer)?.offer,'offer-test');
 assert.ok(Peer.last);
 Peer.last.ontrack?.({track:{stop(){}}});
 await Promise.resolve();
 assert.equal(elements.eufyLiveVideo.classList.hidden,false,'video must be visible to paint');
 api.event({event:{type:'answer',sdp:'answer-test'}});
 api.event({event:{type:'tick',sequence:1}});
 elements.eufyLiveVideo.paint?.();
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(sent.find(x=>x.type==='eufy_viewer/ack')?.sequence,1);
 api.stop();
 assert.ok(sent.some(x=>x.type==='unsubscribe_events'));
 assert.ok(Peer.last.closed);
});
test('bridge fallback moves from WebRTC to authenticated JPEG on same lease',async()=>{
 const {api,sent,elements}=harness();
 api.start();
 const id=api.id();
 api.event({event:{type:'fallback'}});
 assert.equal(api.id(),id,'fallback must retain same viewer subscription');
 api.event({event:{type:'frame',jpeg:'/9j/',sequence:1}});
 assert.equal(typeof elements.eufyStill.onload,'function');
 elements.eufyStill.onload();
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.ok(sent.some(x=>x.type==='eufy_viewer/ack'&&x.subscription===id&&x.sequence===1));
 api.stop();
});

test('stalled JPEG fallback retries a fresh owner after seven seconds, maximum twice',()=>{
 const {api,sent,elements,advance,fireRetry}=harness();
 api.start();
 let id=api.id();
 api.event({event:{type:'fallback'}});
 assert.equal(api.id(),id,'must initially retain existing viewer on JPEG fallback');
 advance(7001);
 assert.match(elements.eufyMeta.textContent,/Retry 1\/2/);
 assert.equal(sent.filter(x=>x.type==='eufy_viewer/watch').length,1);
 fireRetry();
 assert.equal(sent.filter(x=>x.type==='eufy_viewer/watch').length,2,'retry must create a fresh viewer');
 id=api.id();
 api.event({event:{type:'fallback'}});
 advance(7001);
 assert.match(elements.eufyMeta.textContent,/Retry 2\/2/);
 fireRetry();
 assert.equal(sent.filter(x=>x.type==='eufy_viewer/watch').length,3);
 api.event({event:{type:'fallback'}});
 advance(7001);
 assert.match(elements.eufyMeta.textContent,/stopped/);
 fireRetry();
 assert.equal(sent.filter(x=>x.type==='eufy_viewer/watch').length,3,'must never retry indefinitely');
 api.stop();
});
test('JPEG fallback that delivers a frame does not prematurely restart camera session',async()=>{
 const {api,sent,elements,advance}=harness();
 api.start();const id=api.id();api.event({event:{type:'fallback'}});
 api.event({event:{type:'frame',jpeg:'/9j/',sequence:1}});
 elements.eufyStill.onload();
 await Promise.resolve();await Promise.resolve();
 advance(7001);
 assert.equal(api.id(),id,'JPEG playback should retain a healthy existing lease');
 assert.equal(sent.filter(x=>x.type==='eufy_viewer/watch').length,1);
 api.stop();
});
