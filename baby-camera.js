/* Baby camera: authenticated, on-demand snapshots; no footage stored in browser storage. */
(()=>{
'use strict';
const security=document.querySelector('.home-security'),stack=security?.querySelector('.home-compact-stack');
if(!security||!stack)return;
for(const cls of ['kia-placeholder','coffee-card']){const card=security.querySelector('.'+cls);if(card)stack.append(card)}
security.classList.add('with-baby-camera');
const card=document.createElement('button');card.type='button';card.className='baby-camera-card';card.setAttribute('aria-label','Open baby camera');
card.innerHTML='<strong>👶 Baby camera</strong><span class="baby-camera-preview">VTech RM7767HD</span><small class="baby-camera-status">Pairing required</small>';
security.append(card);
const dialog=document.createElement('dialog');dialog.className='baby-camera-dialog';dialog.setAttribute('aria-label','Baby camera');
dialog.innerHTML='<header><strong>👶 Baby camera</strong><button type="button" class="halo-close" aria-label="Close baby camera">✕</button></header><p class="baby-status" role="status"></p><img hidden alt="Baby camera snapshot"><button type="button" class="baby-refresh">Refresh picture</button><small>Snapshots refresh while this window is open. No audio.</small>';
document.body.append(dialog);
let controller=null,timer=null,url=null,epoch=0;
function entity(){const cameras=Object.values(typeof haStates==='undefined'?{}:haStates).filter(s=>s.entity_id?.startsWith('camera.')&&/vtech|rm7767/i.test(s.entity_id+' '+(s.attributes?.friendly_name||'')));return cameras.length===1?cameras[0]:null}
function ready(){return typeof haVerified!=='undefined'&&haVerified}
function update(){const cam=entity();card.querySelector('.baby-camera-status').textContent=!ready()?'Connect Home Assistant':!cam?'Pairing required':['unavailable','unknown'].includes(cam.state)?'Camera unavailable':'Open camera';}
function stop(){epoch++;clearTimeout(timer);controller?.abort();controller=null;if(url){URL.revokeObjectURL(url);url=null}const img=dialog.querySelector('img');img.hidden=true;img.removeAttribute('src')}
async function refresh(){
 clearTimeout(timer);controller?.abort();const current=++epoch,cam=entity(),status=dialog.querySelector('.baby-status');
 if(!dialog.open||document.hidden)return;
 if(!ready()||!cam){stop();status.textContent=!ready()?'Connect Home Assistant to view the camera.':'Complete VTech pairing in Home Assistant first.';return}
 if(['unavailable','unknown'].includes(cam.state)){stop();status.textContent='Camera unavailable. Check its connection in Home Assistant.';return}
 controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
 try{status.textContent='Getting picture…';const response=await eufyApi('/api/camera_proxy/'+encodeURIComponent(cam.entity_id),{signal:controller.signal});if(!response.ok)throw Error('Camera returned '+response.status);const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('No camera picture received');if(current!==epoch||!dialog.open)return;const next=URL.createObjectURL(blob),img=dialog.querySelector('img');if(url)URL.revokeObjectURL(url);url=next;img.src=next;img.hidden=false;status.textContent='Picture updated '+new Date().toLocaleTimeString();}
 catch(error){if(current===epoch){const img=dialog.querySelector('img');img.hidden=true;status.textContent=error.name==='AbortError'?'Camera response timed out.':error.message}}
 finally{clearTimeout(timeout);if(current===epoch&&dialog.open&&!document.hidden)timer=setTimeout(refresh,3000)}
}
card.onclick=()=>{dialog.showModal();refresh()};dialog.querySelector('.halo-close').onclick=()=>dialog.close();dialog.querySelector('.baby-refresh').onclick=refresh;dialog.addEventListener('close',()=>{stop();card.focus()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(dialog.open)refresh()});
window.addEventListener('home-states-updated',()=>{update();if(dialog.open&&!ready()){stop();dialog.querySelector('.baby-status').textContent='Home Assistant disconnected.'}});update();
})();
