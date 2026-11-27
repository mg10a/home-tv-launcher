const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
for(const file of ['index.html','dev/index.html']){
 const html=fs.readFileSync(file,'utf8');
 const begin=html.indexOf('function salusHistoryResult(');
 const code=html.slice(begin,html.indexOf('\nfunction ',begin+20));
 function render(result,success=true){
  const nodes=[];
  const make=()=>({attrs:{},style:{},hidden:false,textContent:'',setAttribute(k,v){this.attrs[k]=v},append(n){nodes.push(n)},addEventListener(){}});
  const label=make(),svg=make(),tip=make();
  const document={querySelector:s=>s.endsWith('span')?label:svg,createElementNS:make,getElementById:id=>id==='salusHistoryPeriod'?{value:'24h'}:tip};
  const ctx=vm.createContext({document});
  vm.runInContext(code,ctx);
  ctx.salusHistoryResult({success,result,error:{message:'History blocked'}});
  return {label,nodes};
 }
 const sensor='sensor.brereton_ds_room_temperature',climate='climate.brereton_ds';
 const samples=[{s:'20.5',lu:1795700000},{s:'21',lu:1795703600}];
 test(file+' keyed compressed sensor history',()=>{
  const r=render({[sensor]:samples});assert.equal(r.label.textContent,'');assert.equal(r.nodes.filter(n=>n.attrs.role==='button').length,2);
 });
 test(file+' climate fallback uses actual temperature',()=>{
  const r=render({[climate]:[{s:'heat',a:{current_temperature:19},lu:1795700000},{s:'auto',a:{current_temperature:20},lu:1795703600}]});
  assert.equal(r.label.textContent,'');assert(r.nodes.some(n=>String(n.attrs['aria-label']).includes('19.0 degrees')));
 });
 test(file+' prefers sensor over climate',()=>{
  const r=render({[sensor]:samples,[climate]:[{s:'heat',a:{current_temperature:99},lu:1795700000}]});
  assert.equal(r.nodes.filter(n=>n.attrs.role==='button').length,2);
 });
 test(file+' nested full history arrays',()=>{
  const r=render([[{entity_id:sensor,state:'18',last_updated:'2026-11-25T01:00:00Z'}]]);
  assert.equal(r.label.textContent,'');assert.equal(r.nodes.filter(n=>n.attrs.role==='button').length,1);
 });
 test(file+' flat full history arrays',()=>{
  assert.equal(render([{entity_id:sensor,state:'18',last_updated:'2026-11-25T01:00:00Z'}]).label.textContent,'');
 });
 test(file+' empty and unusable history',()=>{
  for(const payload of [null,{},[],{[sensor]:[{s:'unavailable',lu:1795700000},{s:null,lu:1795700000},{s:'20',lu:'invalid'}]}]){
   assert.match(render(payload).label.textContent,/No usable temperature samples/);
  }
 });
 test(file+' rejected history request',()=>assert.match(render(null,false).label.textContent,/History blocked/));
}
