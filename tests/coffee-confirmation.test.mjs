const {Window}=await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../coffee-controls.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
async function fixture(){
 const w=new Window({url:'https://example.com'});w.haSocket={};
 const timers=new Map();let sequence=0,online=true;
 w.setTimeout=(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms,repeat:false});return id};
 w.setInterval=(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms,repeat:true});return id};
 w.clearTimeout=w.clearInterval=id=>timers.delete(id);
 const make=(id,state)=>({entity_id:id,state,attributes:{friendly_name:'Coffee '+id.split('.')[1]}});
 const states={'switch.coffee_power':make('switch.coffee_power','off'),'sensor.coffee_operation_state':make('sensor.coffee_operation_state','inactive')};
 const calls=[];let service=()=>Promise.resolve({}),read=()=>Promise.resolve(Object.values(states).map(s=>({...s})));
 const request=c=>{calls.push(c);return c.type==='get_states'?read():service(c)};
 w.eval(source);const d=w.document.createElement('dialog');w.document.body.append(d);
 const panel=w.createCoffeePanel({dialog:d,request,states:()=>states,connected:()=>online});
 w.addEventListener('home-states-updated',panel.update);panel.open();await tick();
 const start=()=>{[...d.querySelectorAll('button')].find(b=>b.textContent==='Switch machine on').click()};
 const push=state=>{states['switch.coffee_power']=make('switch.coffee_power',state);w.dispatchEvent(new w.Event('home-states-updated'))};
 const fire=async ms=>{for(const [id,t]of [...timers])if(t.ms===ms&&timers.has(id)){if(!t.repeat)timers.delete(id);t.fn()}await tick()};
 return {w,d,states,calls,panel,start,push,fire,timers,service:fn=>service=fn,read:fn=>read=fn,offline:()=>{online=false;w.dispatchEvent(new w.Event('home-states-updated'))},close:()=>w.happyDOM.close()};
}
// A real state event finishes the UI even while the service result is delayed.
{
 const f=await fixture();let rejectService;f.service(()=>new Promise((_,reject)=>{rejectService=reject}));
 f.start();await tick();f.push('on');await tick();assert.match(f.d.textContent,/Applied.*confirmed/);
 assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);
 assert(![...f.timers.values()].some(t=>t.ms===20000||t.ms===3000));
 rejectService(Error('late reply'));await tick();assert.match(f.d.textContent,/Applied/);await f.close();
}
// A missed push is repaired by a read, including operation state; no retry write.
{
 const f=await fixture();f.read(()=>Promise.resolve(Object.values(f.states).map(s=>({...s,state:s.entity_id.startsWith('switch.')?'on':'ready'}))));
 f.start();await tick();await tick();assert.match(f.d.textContent,/Applied/);assert.equal(f.states['sensor.coffee_operation_state'].state,'ready');
 assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);await f.close();
}
// A service acknowledgement alone is not confirmation. The wait is bounded.
{
 const f=await fixture();f.start();await tick();assert.match(f.d.textContent,/waiting for machine status/);
 await f.fire(20000);assert.match(f.d.textContent,/not confirmed/);assert.doesNotMatch(f.d.textContent,/Applied|Sending/);
 assert.equal(f.states['switch.coffee_power'].state,'off');assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);await f.close();
}
// No reply at all, rejection, and disconnection all release the pending UI.
for(const mode of ['no reply','error','disconnect']){
 const f=await fixture();f.service(()=>mode==='error'?Promise.reject(Error('Rejected by HA')):new Promise(()=>{}));
 f.start();await tick();if(mode==='disconnect')f.offline();else if(mode==='no reply')await f.fire(20000);await tick();
 assert.match(f.d.textContent,mode==='error'?/Rejected by HA/:mode==='disconnect'?/disconnected/:/not confirmed/);
 assert(![...f.timers.values()].some(t=>t.ms===20000||t.ms===3000));await f.close();
}
// An older read cannot clobber a newer live event. Closing stops idle reads.
{
 const f=await fixture();let resolveRead;const old=Object.values(f.states).map(s=>({...s}));f.read(()=>new Promise(r=>{resolveRead=r}));
 await f.fire(10000);f.push('on');resolveRead(old);await tick();assert.equal(f.states['switch.coffee_power'].state,'on');
 f.d.close();await tick();const count=f.calls.length;await f.fire(10000);assert.equal(f.calls.length,count);await f.close();
}
console.log('Coffee confirmation: delayed/missing reply, readback, stale snapshot, errors, disconnect, timeout and no duplicate writes passed.');
