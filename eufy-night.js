(function(root){
 'use strict';
 // Inspect original pixels, never the displayed filter result or wall-clock time.
 function classify(pixels){
  let dark=0,grey=0,total=0,sum=0;
  for(let i=0;i<pixels.length;i+=4){
   const r=pixels[i],g=pixels[i+1],b=pixels[i+2],y=(r+g+b)/3;
   sum+=y;dark+=y<45;grey+=Math.max(r,g,b)-Math.min(r,g,b)<9;total++;
  }
  return total>0&&sum/total<78&&dark/total>.55&&grey/total>.94;
 }
 if(typeof module==='object'&&module.exports){module.exports={classify};return;}
 const ids=['eufyStill','eufyLiveVideo','eufyRecordingPreview','eufyPlayer'];
 const states=new WeakMap(),canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 let preference='auto';try{preference=localStorage.getItem('eufy-night-mode')||'auto';}catch{}
 if(!['auto','off','on'].includes(preference))preference='auto';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.setAttribute('aria-hidden','true');
 svg.innerHTML='<defs><filter id="eufy-night-tone" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="gamma" amplitude="0.75" exponent="0.32" offset="0"/><feFuncG type="gamma" amplitude="0.75" exponent="0.32" offset="0"/><feFuncB type="gamma" amplitude="0.75" exponent="0.32" offset="0"/></feComponentTransfer></filter></defs>';
 document.body.append(svg);
 const bar=document.createElement('div');bar.className='eufy-night-controls';
 bar.innerHTML='<label>Night view <select aria-label="Night enhancement"><option value="auto">Auto</option><option value="off">Off</option><option value="on">On</option></select></label><span role="status"></span>';
 const head=document.querySelector('#eufyOverlay .eufy-dialog-head');if(!head)return;head.after(bar);
 const select=bar.querySelector('select'),status=bar.querySelector('span');select.value=preference;
 select.addEventListener('change',()=>{preference=select.value;try{localStorage.setItem('eufy-night-mode',preference);}catch{}for(const id of ids)states.delete(document.getElementById(id));tick();});
 function reset(el){states.delete(el);el.style.filter='';}
 for(const id of ids){const el=document.getElementById(id);if(el){el.addEventListener('emptied',()=>reset(el));el.addEventListener('loadedmetadata',()=>reset(el));}}
 function tick(){
  const overlay=document.getElementById('eufyOverlay');
  if(document.hidden||!overlay||overlay.classList.contains('hidden'))return;
  let message=preference==='off'?'Original picture':'Waiting for picture';
  for(const id of ids){
   const el=document.getElementById(id);if(!el||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
   const video=el.tagName==='VIDEO',w=video?el.videoWidth:el.naturalWidth,h=video?el.videoHeight:el.naturalHeight;
   if(!w||!h||(video&&el.readyState<2))continue;
   const source=video?(el.currentSrc||el.srcObject):id==='eufyStill'?'live-jpeg':el.currentSrc;
   let s=states.get(el);if(!s||s.source!==source){s={source,active:false,night:0,day:0};states.set(el,s);}
   if(preference==='on'){el.style.filter='url(#eufy-night-tone)';message='Enhanced · manual';continue;}
   if(preference==='off'){el.style.filter='';continue;}
   try{
    // Exclude the bright left wall, PiP inset, timestamp, and lower parcel camera.
    const topHeight=h>w?h*.52:h;
    canvas.width=64; // Clear pixels and origin-clean state between sources.
    ctx.drawImage(el,w*.30,topHeight*.32,w*.48,topHeight*.60,0,0,64,48);
    const night=classify(ctx.getImageData(0,0,64,48).data);
    s.night=night?s.night+1:0;s.day=night?0:s.day+1;
    if(s.night>=2)s.active=true;if(s.day>=3)s.active=false;
    el.style.filter=s.active?'url(#eufy-night-tone)':'';
    message=s.active?'Enhanced · dark infrared scene':'Original · auto';
   }catch{
    const recorded=new Date(el.dataset.recordedAt||'');
    if(video&&Number.isFinite(recorded.getTime())){
     const hour=recorded.getHours(),night=hour>=21||hour<6;
     el.style.filter=night?'url(#eufy-night-tone)':'';
     message=night?'Enhanced · recording time fallback':'Original · recording time fallback';
    }else{el.style.filter='';message='Auto unavailable · choose On to preview';}
   }
  }
  if(status.textContent!==message)status.textContent=message;
 }
 setInterval(tick,1000);tick();
})(typeof window==='undefined'?globalThis:window);
