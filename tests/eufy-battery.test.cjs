const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const file of ['index.html','dev/index.html']){
 const html=fs.readFileSync(file,'utf8');
 const source=html.slice(html.indexOf('function eufyBattery(){'),html.indexOf('let eufyTileFrameAt='));
 const read=(states,camera='camera.doorbell')=>new Function('haStates','eufyCameraEntity',source+';return eufyBattery()')(states,()=>camera);
 const state=value=>({state:value,attributes:{}});
 test(file+': unavailable DEV battery cannot hide production reading',()=>{
  assert.equal(read({'sensor.doorbell_dev_battery':state('unavailable'),'sensor.doorbell_battery':state('73')}),'73%');
 });
 test(file+': prefer the selected bridge when both values exist',()=>{
  const states={'sensor.doorbell_dev_battery':state('50'),'sensor.doorbell_battery':state('73')};
  assert.equal(read(states),'73%');assert.equal(read(states,'camera.doorbell_dev'),'50%');
 });
 test(file+': reject missing or invalid values but preserve genuine zero',()=>{
  for(const value of ['unavailable','unknown','',null,undefined,'NaN','101','-1','charging'])assert.equal(read({'sensor.doorbell_battery':state(value)}),null);
  assert.equal(read({'sensor.doorbell_battery':state('0')}),'0%');
  assert.equal(read({'sensor.doorbell_battery':state('73.6')}),'74%');
 });
}
