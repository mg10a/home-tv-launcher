// Run against the compiled DEV bridge. Verify camera IDs are distinct from the
// installed original integration but still route to the REAL camera internally.
// All camera identifiers in this test are synthetic; no Eufy login or footage.
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import WebSocket from 'ws';
import { createBridge, devCameraSerial } from './dist/server.js';

const token = 'ci-test-only-dev-bridge-token-1234567890';
const realSerial = 'T8213_FAKE_BRIDGE_TEST_01';
const expectedPublic = devCameraSerial(realSerial);
const camera = {
  serial:realSerial, name:'Test Doorbell',model:'T8213',hardware:'test',software:'test',
  battery:46,snapshot_received_at:'2026-10-25T00:00:00Z',
  capabilities:{snapshot:{available:true},live:{available:true},recordings:{available:true}}
};
let recordingSerial=null,liveSerial=null,mediaSerial=null;
const eufy=new EventEmitter();
Object.assign(eufy,{
  backendName:'mega',migrationError:null,
  auth:{state:'connected'},liveStreamsPerStation:1,liveMaxSecondsMains:120,
  inventory:()=>[camera],hasCamera:s=>s===realSerial,
  stations:{inventory:()=>[],metrics:{}},
  notifications:{metrics:{}},
  metrics:{start_requests:0},hub:{
    active:0,quarantined:0,recoveryMetrics:{},
    remaining:()=>100000,
    attach:(serial,_peer)=>{liveSerial=serial;return false},
    detach:()=>{},tick:()=>{}
  },
  media:{
    grant:s=>{mediaSerial=s;return 'a'.repeat(64)},revoke:()=>{},
    active:()=>false,serve:()=>false,serveAudio:()=>false,
    lateAudioSupported:()=>false
  },
  pictures:new Map([[realSerial,{mime:'image/jpeg',data:Buffer.from([0xff,0xd8,0xff])}]]),
  recordings:{
    busy:false,metrics:{},
    list:async s=>{recordingSerial=s;return []},
    timeline:async ids=>{recordingSerial=ids[0];return []},
    calendar:async ids=>{recordingSerial=ids[0];return []},
  },
  diagnostics:{mark:()=>{}},
  supportReport:()=>({})
});
const server=createBridge(eufy,token,'home-tv-dev-unit-test');
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
const headers={Authorization:'Bearer '+token};
const request=async url=>fetch(base+url,{headers});
try{
 const stateResponse=await request('/v1/state');
 assert.equal(stateResponse.status,200);
 const state=await stateResponse.json();
 assert.equal(state.bridge_id,'home-tv-dev-unit-test');
 assert.equal(state.cameras.length,1);
 assert.equal(state.cameras[0].serial,expectedPublic,'public DEV camera identity must be distinct');
 assert.notEqual(state.cameras[0].serial,realSerial);
 assert.match(state.cameras[0].name,/DEV/);
 assert.match(expectedPublic,/^dev_[a-f0-9]{32}$/);
 assert.ok(expectedPublic.length<=64);
 assert.equal((await request('/v1/snapshot/'+expectedPublic)).status,200);
 assert.equal((await request('/v1/snapshot/'+realSerial)).status,404,'no bypass with old serial');
 assert.equal((await request('/v1/recordings/'+expectedPublic+'?date=2026-10-25')).status,200);
 assert.equal(recordingSerial,realSerial,'recordings reach the real camera');
 assert.equal((await request('/v1/recordings?date=2026-10-25&cameras='+expectedPublic)).status,200);
 assert.equal(recordingSerial,realSerial,'recording timeline uses real ID');
 const websocket=new WebSocket(base.replace('http:','ws:')+'/v1/live/'+expectedPublic+'?transport=webrtc',
  {headers});
 try{
  await Promise.race([
   once(websocket,'open'),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('WebSocket was not admitted')),2500))
  ]);
  assert.equal(liveSerial,realSerial,'viewer must start from real camera');
  assert.equal(mediaSerial,realSerial,'media reader keyed by real camera');
 } finally {
  websocket.close();
  await new Promise(r=>setTimeout(r,100));
 }
 // One isolated DEV camera can coexist with the upstream camera identity
 // without changes to HA's installed production custom integration.
 console.log('PASS: DEV camera has independent HA registry ID while live, snapshot and recordings use real serial internally');
}finally{
 server.emit('shutdown');
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
