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
// The UI assumes on after one second, but never changes the HA state or resends.
{
 const f=await fixture();let rejectService;f.service(()=>new Promise((_,reject)=>{rejectService=reject}));
 f.start();await tick();assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);
 await f.fire(1000);assert.match(f.d.textContent,/On · checking in background/);assert.equal(f.states['switch.coffee_power'].state,'off');
 assert(f.d.querySelector('footer button').disabled);f.start();assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);
 f.panel.open();await tick();assert.match(f.d.textContent,/On · checking/);assert(f.d.querySelector('footer button').disabled);
 f.push('on');await tick();assert.match(f.d.textContent,/Power confirmed/);
 rejectService(Error('late reply'));await tick();assert.match(f.d.textContent,/Power confirmed/);await f.close();
}
// Accepted command with stale HA readings stays assumed on, including after refresh.
{
 const f=await fixture();f.start();await tick();await f.fire(1000);await f.fire(10000);
 assert.match(f.d.textContent,/On · checking/);assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);
 const saved=f.w.localStorage.getItem('halo.coffee.powerIntent.v1');assert.equal(JSON.parse(saved).target,'on');
 // A re-created panel (equivalent to a reload) restores the duplicate guard.
 const d2=f.w.document.createElement('dialog');f.w.document.body.append(d2);
 const panel2=f.w.createCoffeePanel({dialog:d2,request:()=>Promise.resolve([]),states:()=>f.states,connected:()=>true});panel2.open();
 assert.match(d2.textContent,/On · checking/);assert(d2.querySelector('footer button').disabled);await f.close();
}
// Off is explicit and works even when HA is still reporting the old off state.
{
 const f=await fixture();f.start();await tick();await f.fire(1000);
 const off=[...f.d.querySelectorAll('button')].find(b=>b.textContent==='Switch machine off');assert(!off.disabled);off.click();await tick();await f.fire(1000);
 const writes=f.calls.filter(c=>c.type==='call_service');assert.deepEqual(writes.map(c=>c.service),['turn_on','turn_off']);
 assert.match(f.d.textContent,/Off · checking/);assert(f.d.querySelector('footer button').disabled);
 f.states['switch.coffee_power']={...f.states['switch.coffee_power'],last_updated:new Date(Date.now()+1000).toISOString()};f.w.dispatchEvent(new f.w.Event('home-states-updated'));await tick();
 assert.match(f.d.textContent,/Power confirmed/);assert.equal(f.w.localStorage.getItem('halo.coffee.powerIntent.v1'),null);await f.close();
}
// Missed pushes are recovered by background reads without another power write.
{
 const f=await fixture();f.start();await tick();f.read(()=>Promise.resolve(Object.values(f.states).map(s=>({...s,state:s.entity_id.startsWith('switch.')?'on':'ready'}))));
 await f.fire(1000);await tick();assert.match(f.d.textContent,/Power confirmed/);assert.equal(f.states['sensor.coffee_operation_state'].state,'ready');
 assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);await f.close();
}
// Errors and disconnects show uncertainty, preserve the duplicate guard and never brew.
for(const mode of ['error','disconnect']){
 const f=await fixture();f.service(()=>mode==='error'?Promise.reject(Error('Rejected by HA')):new Promise(()=>{}));
 f.start();await tick();await f.fire(1000);if(mode==='disconnect')f.offline();await tick();
 assert.match(f.d.textContent,mode==='error'?/could not be confirmed/:/connection lost/);
 assert(f.d.querySelector('footer button').disabled);assert.equal(f.calls.filter(c=>c.type==='call_service').length,1);await f.close();
}
// An older read cannot clobber a newer live event. Closing stops idle reads.
{
 const f=await fixture();let resolveRead;const old=Object.values(f.states).map(s=>({...s}));f.read(()=>new Promise(r=>{resolveRead=r}));
 await f.fire(10000);f.push('on');resolveRead(old);await tick();assert.equal(f.states['switch.coffee_power'].state,'on');
 f.d.close();await tick();const count=f.calls.length;await f.fire(10000);assert.equal(f.calls.length,count);await f.close();
}
console.log('Coffee power: one-second assumed state, explicit off, persistent duplicate guard, delayed reply, readback, stale snapshot, errors and disconnect passed.');
