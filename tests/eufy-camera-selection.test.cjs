const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const file of ['index.html','dev/index.html']){
 const html=fs.readFileSync(file,'utf8');
 const source=html.slice(html.indexOf('let eufySelectedCamera=null;'),html.indexOf('function eufyCameraOptions(){'));
 function setup(states){return new Function('haStates',source+';return {choices:eufyCameraChoices,selected:eufyCameraEntity,select:id=>eufySelectedCamera=id}')(states);}
 test(file+': stopped DEV does not hide or override the working doorbell',()=>{
  const states={'camera.doorbell':{state:'idle',attributes:{viewer_card:true}},'camera.doorbell_dev':{state:'unavailable',attributes:{viewer_card:true,viewer_dev_bridge:true}}};
  const api=setup(states);api.select('camera.doorbell_dev');
  assert.deepEqual(api.choices(),['camera.doorbell']);assert.equal(api.selected(),'camera.doorbell');
  states['camera.doorbell'].state='unavailable';assert.equal(api.selected(),null);
 });
 test(file+': available DEV deduplicates, other available cameras remain selectable',()=>{
  const states={'camera.doorbell':{state:'idle',attributes:{viewer_card:true}},'camera.doorbell_dev':{state:'idle',attributes:{viewer_card:true,viewer_dev_bridge:true}},'camera.garden':{state:'idle',attributes:{viewer_card:true}}};
  const api=setup(states);assert.deepEqual(api.choices(),['camera.doorbell_dev','camera.garden']);
  api.select('camera.garden');assert.equal(api.selected(),'camera.garden');
 });
 test(file+': legacy snapshot fallback skips unavailable cameras',()=>{
  const api=setup({'camera.doorbell_old':{state:'unavailable',attributes:{}},'camera.front_door':{state:'idle',attributes:{}}});
  assert.equal(api.selected(),'camera.front_door');
 });
}
