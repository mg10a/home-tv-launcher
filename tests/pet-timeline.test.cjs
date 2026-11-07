const assert=require('node:assert/strict');
const {test}=require('node:test');
const {atHour,historyStart,timelineDay}=require('../pet-timeline');

const day='2026-11-07',start=atHour(day,0),hour=3600000;
const point=(offset,state)=>({t:start+offset*hour,state});

test('UK midnight and hour labels follow the spring and autumn clock changes',()=>{
 assert.equal(atHour('2026-03-29',24)-atHour('2026-03-29',0),23*hour);
 assert.equal(atHour('2026-10-25',24)-atHour('2026-10-25',0),25*hour);
 assert.equal(atHour('2026-03-29',6)-atHour('2026-03-29',0),5*hour);
 assert.equal(atHour('2026-10-25',6)-atHour('2026-10-25',0),7*hour);
 assert.equal(historyStart(start+12*hour),Date.parse('2026-10-31T00:00Z'));
});

test('carries in the preceding state, leaves a gap unclassified and stops at now',()=>{
 const result=timelineDay(day,{now:start+12*hour,through:start+12*hour,
  history:[point(-2,'on'),point(4,'off'),point(7,'unavailable'),point(9,'on')]});
 assert.deepEqual(result.parts.map(p=>[p.state,(p.start-start)/hour,(p.end-start)/hour]),[
  ['on',0,4],['off',4,7],['unknown',7,9],['on',9,12]
 ]);
});

test('live updates extend today and missing history stays unknown for earlier days',()=>{
 const input={now:start+12*hour,through:start+8*hour,
  history:[point(2,'off')],live:[point(9,'on'),point(11,'off')],
  current:{state:'off',last_changed:new Date(start+11*hour).toISOString()}};
 assert.deepEqual(timelineDay(day,input).parts.map(p=>[p.state,(p.start-start)/hour,(p.end-start)/hour]),[
  ['unknown',0,2],['off',2,8],['unknown',8,9],['on',9,11],['off',11,12]
 ]);
 assert.deepEqual(timelineDay('2026-11-06',input).parts.map(p=>p.state),['unknown']);
});
