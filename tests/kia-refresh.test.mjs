const {Window}=await import(process.env.HAPPY_DOM_MODULE||'happy-dom');
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const w=new Window({url:'https://example.com'});w.eval(readFileSync(new URL('../kia-refresh.js',import.meta.url),'utf8'));const decide=w.kiaRefreshDecision,now=Date.now(),base={now,hour:12,visible:true,ready:true,report:now-5*3600000,battery:67,record:{last:0,count:0,failures:0},buttonTime:NaN};assert.equal(decide(base),null);assert(decide({...base,hour:23}).includes('overnight'));assert(decide({...base,battery:39}).includes('battery'));assert(decide({...base,battery:NaN}).includes('battery'));assert(decide({...base,visible:false}));assert(decide({...base,ready:false}));assert(decide({...base,report:now-1000}));assert(decide({...base,buttonTime:now-1000}));assert(decide({...base,record:{last:now-1000,count:1,failures:0}}));assert(decide({...base,record:{count:8,failures:0}}).includes('limit'));assert(decide({...base,record:{count:2,failures:2}}).includes('failed'));
let calls=0;w.kiaRefreshDecision=()=>null;const api=w.createKiaRefresh({snapshot:()=>({deviceId:'test',ready:true,battery:67}),send:async()=>{calls++;throw Error('API unavailable')},onChange:()=>{}});await api.check();const stored=JSON.parse(w.localStorage.getItem('kia-refresh-v1:test'));assert.equal(stored.count,1);assert.equal(stored.failures,1);assert(stored.last>0);assert(api.state().status.includes('API unavailable'));api.toggle();await api.check();assert.equal(calls,1);assert(api.state().disabled);await w.happyDOM.close();console.log('Kia refresh: quiet hours, battery guard, freshness, throttling, daily cap, failure accounting and pause passed.');

const simulated=new Window({url:'https://example.com'});
simulated.eval(readFileSync(new URL('../kia-refresh.js',import.meta.url),'utf8'));
let clock=Date.parse('2026-11-07T12:00:00Z');
simulated.Date.now=()=>clock;
const vehicle={deviceId:'sorento',ready:true,active:true,cacheAvailable:true,battery:67};
vehicle.reportAt=new Date(clock-60000).toISOString();
const requests=[];
let cloudReportsLocked=false,cloudUnavailable=false;
const refresh=simulated.createKiaRefresh({
 snapshot:()=>({...vehicle}),
 send:async(s,kind)=>{
  requests.push(kind);
  if(kind==='cache'&&cloudUnavailable)throw Error('Cloud offline');
  if(kind==='cache'&&cloudReportsLocked){
   vehicle.reportAt=new Date(clock).toISOString();
   vehicle.active=false;
   vehicle.parkedUnsecured=false;
  }
 },
 onChange:()=>{}
});
await refresh.check();
clock+=60000;
await refresh.check();
assert.deepEqual(requests,['cache'],'no wake or repeated cloud call during driving');
clock+=60000;
await refresh.check();
assert.deepEqual(requests,['cache','cache'],'cloud data is rechecked while active');

vehicle.parkedUnsecured=true;
clock+=10*60000;
cloudReportsLocked=true;
await refresh.check();
assert.deepEqual(requests,['cache','cache','cache'],'a new locked report avoids a wake');

vehicle.active=vehicle.parkedUnsecured=true;
clock+=11*60000;
cloudReportsLocked=false;
cloudUnavailable=true;
await refresh.check();
assert.equal(requests.at(-1),'cache','a failed cloud check does not trigger an early wake');
clock+=10*60000;
cloudUnavailable=false;
await refresh.check();
assert.deepEqual(requests.slice(-2),['cache','wake'],'a stale parked-unlocked report can trigger one wake after checking the cloud');
clock+=2*60000;
await refresh.check();
assert.equal(requests.filter(x=>x==='wake').length,1,'wakes still observe the hourly limit');
refresh.toggle();
const beforePause=requests.length;
clock+=2*60000;
await refresh.check();
assert.equal(requests.length,beforePause,'pause suppresses cloud checks and wakes');
await simulated.happyDOM.close();
