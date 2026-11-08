const {test}=require('node:test');const assert=require('node:assert/strict');
const {preferredWeek}=require('../samsung-planner');const {safe}=require('../samsung-links');
const settings={enabled:true,weekday:6,time:'13:00'};
test('UK Sunday reset opens the upcoming week, not the week just cleared',()=>{
 assert.equal(preferredWeek(settings,new Date('2026-11-08T12:59:00Z')),'2026-11-02');
 assert.equal(preferredWeek(settings,new Date('2026-11-08T13:00:00Z')),'2026-11-09');
 assert.equal(preferredWeek(settings,new Date('2026-11-09T08:00:00Z')),'2026-11-09');
});
test('reset respects British Summer Time and disable setting',()=>{
 assert.equal(preferredWeek(settings,new Date('2026-07-05T12:00:00Z')),'2026-07-06');
 assert.equal(preferredWeek({...settings,enabled:false},new Date('2026-07-05T12:00:00Z')),'2026-06-29');
});
test('native external links accept only Samsung Food routes',()=>{
 assert.equal(safe('https://app.samsungfood.com/meal-plan'),true);
 assert.equal(safe('https://app.samsungfood.com/shopping-list/abc'),true);
 for(const url of ['javascript:alert(1)','https://evil.example/meal-plan','https://app.samsungfood.com.evil.example/meal-plan','https://user:secret@app.samsungfood.com/meal-plan','http://app.samsungfood.com/meal-plan','https://app.samsungfood.com:444/meal-plan'])assert.equal(safe(url),false);
});

test('the selected week distinguishes unsynced, stale and confirmed empty plans',()=>{
 const {mealWeekSync}=require('../samsung-planner');
 const now=Date.parse('2026-11-08T14:26:00Z');
 const emptyWeek={days:[{date:'2026-11-09',meals:[]}],last_success:'2026-11-08T14:22:00Z'};
 assert.deepEqual(mealWeekSync(emptyWeek,'ok',now),{cached:false,message:''});
 assert.match(mealWeekSync(undefined,'ok',now).message,/has not synced/);
 assert.equal(mealWeekSync(emptyWeek,'read_failed',now+3600000).cached,true);
 assert.match(mealWeekSync(emptyWeek,'login_required',now).message,/sign-in needs attention/);
});
