const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const html=readFileSync('index.html','utf8');
const src=html.slice(html.indexOf('function eufyRecordingCommandUnavailable('),html.indexOf('let eufyWaitingForStates='));
test('older clip preview is requested on selection and stale responses cannot replace it',async()=>{
 const elements={};for(const id of ['eufyRecordingPreview','eufyPreviewNote','eufyPlaySelected','eufyRecordingGrid'])elements[id]={classList:{add(){},remove(){}},value:'13'};
 const pending=[],records=Array.from({length:20},(_,i)=>({id:String(i),entity_id:'camera.doorbell_dev',thumbnail:true}));
 const ctx={document:{getElementById:id=>elements[id]},eufyPreviewRequest:0,eufyRecords:records,eufyThumbUrls:[],eufyAbort:new AbortController(),closeEufyPlayer(){},eufyClearThumbs(){},eufyWsCommand:msg=>new Promise(resolve=>pending.push({msg,resolve})),URL:{createObjectURL:()=> 'blob:preview'},Blob,Uint8Array,atob};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const first=vm.runInContext('eufySelectRecording()',ctx);
 assert.equal(pending[0].msg.recording_id,'13');
 elements.eufyRecordingGrid.value='19';
 const second=vm.runInContext('eufySelectRecording()',ctx);
 pending[0].resolve({success:true,result:{content_type:'image/jpeg',jpeg:'/9j/2Q=='}});
 await first;assert.equal(elements.eufyRecordingPreview.src,undefined);
 pending[1].resolve({success:true,result:{content_type:'image/jpeg',jpeg:'/9j/2Q=='}});
 await second;assert.equal(elements.eufyRecordingPreview.src,'blob:preview');
});

test('stock Eufy JPEG fallback discards previews from a previous selection',async()=>{
 const elements={};
 for(const id of ['eufyRecordingPreview','eufyPreviewNote','eufyPlaySelected','eufyRecordingGrid'])elements[id]={classList:{add(){},remove(){}},value:'0'};
 const pending=[],records=['a','b'].map(id=>({id:id.repeat(32),entity_id:'camera.doorbell_dev',thumbnail:true}));
 const ctx={document:{getElementById:id=>elements[id]},eufyPreviewRequest:0,eufyRecords:records,eufyThumbUrls:[],
  eufyAbort:new AbortController(),closeEufyPlayer(){},eufyClearThumbs(){},Blob,Uint8Array,atob,
  URL:{createObjectURL:()=> 'blob:preview'},
  eufyWsCommand:async()=>({success:false,error:{code:'unknown_command'}}),
  eufyApi:(path,{signal})=>new Promise(resolve=>pending.push({path,signal,resolve}))
 };
 vm.createContext(ctx);vm.runInContext(src,ctx);
 const first=ctx.eufySelectRecording();
 await new Promise(setImmediate);
 assert.equal(pending[0].path,'/api/eufy_viewer/recordings/camera.doorbell_dev/'+records[0].id+'/thumbnail');
 assert.equal(pending[0].signal,ctx.eufyAbort.signal);
 elements.eufyRecordingGrid.value='1';
 const second=ctx.eufySelectRecording();
 await new Promise(setImmediate);
 const jpeg={ok:true,status:200,arrayBuffer:async()=>new Uint8Array([255,216,255,217]).buffer};
 pending[0].resolve(jpeg);
 await first;
 assert.equal(elements.eufyRecordingPreview.src,undefined);
 pending[1].resolve(jpeg);
 await second;
 assert.equal(elements.eufyRecordingPreview.src,'blob:preview');
});
