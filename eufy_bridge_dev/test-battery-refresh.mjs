import test from 'node:test';
import assert from 'node:assert/strict';
import { BatteryRefresh } from './dist/battery-refresh.js';
test('missed battery push is recovered without replacing live device state', async () => {
 const task=new BatteryRefresh(100), devices=new Map([['a',{id:'a',kind:'camera',battery:23,availability:'online'}]]);
 let calls=0,events=0;
 const fetch=async()=>{calls++;return {devices:[{id:'a',kind:'camera',battery:4,availability:'offline'},{id:'other',kind:'camera',battery:5}]}};
 await task.run(0,false,devices,fetch,()=>events++);
 assert.equal(calls,0);
 await task.run(0,true,devices,fetch,()=>events++);
 assert.equal(devices.get('a').battery,4);assert.equal(devices.get('a').availability,'online');assert.equal(devices.size,1);assert.equal(events,1);
 await task.run(99,true,devices,fetch,()=>events++);assert.equal(calls,1);
 await task.run(100,true,devices,fetch,()=>events++);assert.equal(calls,2);assert.equal(events,1);
});
test('failed refresh backs off; invalid readings preserve battery', async()=>{
 const task=new BatteryRefresh(100),devices=new Map([['a',{id:'a',kind:'camera',battery:4}]]);let calls=0;
 const bad=async()=>{calls++;throw Error('offline')};
 await assert.rejects(task.run(0,true,devices,bad,()=>{}));
 await task.run(50,true,devices,bad,()=>{});assert.equal(calls,1);
 await task.run(100,true,devices,async()=>({devices:[{id:'a',kind:'camera',battery:null}]}),()=>{throw Error('unexpected change')});
 assert.equal(devices.get('a').battery,4);
});
