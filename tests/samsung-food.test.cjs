const {test}=require('node:test');
const assert=require('node:assert/strict');
const {snapshot}=require('../samsung-food.js');
test('old successful reads become stale even if HA still reports ok',()=>{
 const now=Date.parse('2026-11-04T12:00:00Z');
 assert.equal(snapshot({state:'ok',attributes:{last_success:'2026-11-04T11:50:00Z',days:[]}},now).stale,false);
 assert.equal(snapshot({state:'ok',attributes:{last_success:'2026-11-04T10:00:00Z',days:[]}},now).stale,true);
});
test('failed sync preserves available meals and flags them stale',()=>{
 const value=snapshot({state:'read_failed',attributes:{days:[{date:'2026-11-04',meals:[{title:'Test meal',slot:'Dinner'}]}]}});
 assert.equal(value.days[0].meals[0].title,'Test meal');assert.equal(value.stale,true);
});
test('malformed sensor data does not reach UI',()=>{
 assert.deepEqual(snapshot({attributes:{days:[null]}}).days,[]);
 assert.deepEqual(snapshot({attributes:{days:[{date:'bad',meals:[]}]}}).days,[]);
});
