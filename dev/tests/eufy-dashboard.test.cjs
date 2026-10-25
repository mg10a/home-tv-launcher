const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const html=readFileSync('dev/index.html','utf8');
const liveSource=html.slice(html.indexOf('/* DEV live view:'),html.indexOf("document.addEventListener('visibilitychange'"));
assert.ok(liveSource.includes('eufyRtcReady'), 'DEV WebRTC implementation must exist');

test('all inline scripts parse without JavaScript errors',()=>{
 const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=2);
 for(const [i,s] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(s[1],{filename:'inline-'+i+'.js'}));
});
test('visible DEV version and original snapshot path preserved',()=>{
 assert.match(html,/v3\.73-dev/);
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
  setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},Date};
 const fn=new Function(...Object.keys(deps),
  "let haRequestId=900;"+liveSource+
  ';return {start:eufyStartLive,event:eufyLiveEvent,stop:eufyStopLive,id:()=>eufyLiveSubscription};');
 return {api:fn(...Object.values(deps)),sent,elements,Peer};
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
