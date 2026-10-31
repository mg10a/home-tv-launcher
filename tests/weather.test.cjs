const {test}=require('node:test');const assert=require('node:assert/strict');const w=require('../weather.js');
test('null values stay missing, not zero',()=>{assert.equal(w.mean([null,undefined]),null);assert.equal(w.at({time:['x'],temperature:[null]},'temperature','x'),null);assert.equal(w.mean([null,10,20]),15)});
test('local hour respects location timezone and daylight saving',()=>{assert.equal(w.localNow('Europe/London',new Date('2026-07-01T22:30:00Z')),'2026-07-01T23:00');assert.equal(w.localNow('Europe/London',new Date('2026-10-30T01:30:00Z')),'2026-10-30T01:00')});
test('today includes current and future hours; future date keeps all',()=>{const times=['2026-10-30T01:00','2026-10-30T02:00','2026-10-31T00:00'];assert.deepEqual(w.remaining(times,'2026-10-30','2026-10-30T02:00'),[times[1]]);assert.deepEqual(w.remaining(times,'2026-10-31','2026-10-30T02:00'),[times[2]])});
test('comparison flags temperature and rain disagreement',()=>{const time=['a','b','c'];const a={time,temperature_2m:[10,10,10],precipitation:[1,1,1]},b={time,temperature_2m:[15,15,15],precipitation:[0,0,0]};assert.match(w.comparison(a,b,time),/temperature disagreement.*rain timing uncertain/);assert.match(w.comparison(a,null,time),/unavailable/)});
test('change summary finds rain arrival and cooling',()=>{const time=['2026-10-30T10:00','2026-10-30T11:00'];const h={time,temperature_2m:[15,10],precipitation:[0,.5]};assert.match(w.changes(h,time),/Rain may arrive around 11:00.*Cooling/)});
test('ensemble uses all members and does not invent missing days',()=>{const rows=w.outlookRows({time:['2026-11-01','2026-11-02'],temperature_2m_mean:[10,null],temperature_2m_mean_member01:[20,null],precipitation_sum:[1,null],precipitation_sum_member01:[3,null]});assert.equal(rows[0].temp,15);assert.equal(rows[0].rain,2);assert.equal(rows[0].low,11);assert.equal(rows[0].high,19);assert.equal(rows[1].temp,null);assert.equal(rows[1].members,0)});
test('90-day outlook uses identical near-term rows and date-aligned seasonal tail',()=>{
 const start='2026-10-31';const dates=Array.from({length:90},(_,i)=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)});
 const month=dates.slice(0,30).map(date=>({date,temp:12,rain:2,low:9,high:15}));
 const season=dates.map(date=>({date,temp:4,rain:7,low:1,high:8}));
 const rows=w.combinedOutlook(month,season,start);
 assert.deepEqual(rows.slice(0,30),month);assert.deepEqual(rows.slice(30),season.slice(30));assert.equal(new Set(rows.map(r=>r.date)).size,90);
 const partial=w.combinedOutlook(month.slice(1),season.slice(0,89),start);
 assert.equal(partial[0].temp,null);assert.equal(partial[1],month[1]);assert.equal(partial[89].temp,null);
});
test('reload restores only a saved location; removed or temporary selection returns home',()=>{
 const home={id:'home'},stratton={id:'stratton'};
 assert.equal(w.restoredPlace(stratton,[home,stratton],home),stratton);
 assert.equal(w.restoredPlace(stratton,[home],home),home);
 assert.equal(w.restoredPlace(null,[home],home),home);
});
test('period selection follows nearest visible page and clamps overscroll',()=>{
 assert.equal(w.activePeriod(0,300,3),0);assert.equal(w.activePeriod(300,300,3),1);assert.equal(w.activePeriod(600,300,3),2);
 assert.equal(w.activePeriod(-50,300,3),0);assert.equal(w.activePeriod(950,300,3),2);assert.equal(w.activePeriod(0,0,3),0);
});
