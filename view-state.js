/* Recover navigation if Android recreates its WebView; ordinary rotation only reflows CSS. */
(function(){
'use strict';
const key='home-view-resume-v1';let pending=null,restoring=false;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Date.now()-saved.at<120000)pending=saved}catch{}
const shown=id=>{const e=document.getElementById(id);return e&&!e.classList.contains('hidden')&&e.getClientRects().length>0};
function snapshot(){
 if(pending||restoring)return;
 const state={at:Date.now(),screen:document.body.dataset.homeScreen||'launcher'};
 if(shown('eufyOverlay'))state.panel={kind:'doorbell',mode:document.getElementById('eufyRecordTab').getAttribute('aria-pressed')==='true'?'recordings':'live',date:document.getElementById('eufyDate').value};
 else if(document.querySelector('.room-detail[open]'))state.panel={kind:'room',name:document.querySelector('.room-detail h2')?.textContent};
 else if(shown('calendarOverlay'))state.panel={kind:'calendar'};
 else if(shown('salusOverlay'))state.panel={kind:'heating'};
 else if(shown('petOverlay'))state.panel={kind:'pets'};
 else if(shown('historyPage'))state.panel={kind:'history'};
 else if(document.getElementById('weatherModal')?.open)state.panel={kind:'weather'};
 try{localStorage.setItem(key,JSON.stringify(state))}catch{}
}
function restore(){
 if(!pending)return;const p=pending.panel;
 if(p&&p.kind!=='weather'&&(typeof haVerified==='undefined'||!haVerified))return;
 const saved=pending;pending=null;restoring=true;
 try{
 if(['launcher','home','family'].includes(saved.screen))window.navigateHome(saved.screen);
 if(p?.kind==='doorbell')openEufyOverlay({mode:p.mode,date:/^\d{4}-\d{2}-\d{2}$/.test(p.date)?p.date:undefined});
 else if(p?.kind==='room'&&typeof p.name==='string')window.openRoomDetails(p.name);
 else if(p?.kind==='calendar')window.openCalendar();
 else if(p?.kind==='heating')openSalusModal();
 else if(p?.kind==='pets')openPetDetails();
 else if(p?.kind==='history')showHistory();
 else if(p?.kind==='weather')document.querySelector('[aria-label*="Open weather details"]')?.click();
 }finally{restoring=false;snapshot()}
}
// Save before a reload, and after navigation without retaining any HA credentials.
for(const event of ['pagehide','beforeunload','resize','orientationchange'])window.addEventListener(event,snapshot);
document.addEventListener('visibilitychange',snapshot);
document.addEventListener('click',e=>{if(e.isTrusted&&pending)pending=null;setTimeout(snapshot,0)},true);
document.addEventListener('change',()=>setTimeout(snapshot,0),true);
document.addEventListener('close',snapshot,true);
window.addEventListener('home-states-updated',restore);
setTimeout(restore,0);const retry=setInterval(()=>{restore();if(!pending)clearInterval(retry)},500);
setTimeout(()=>{pending=null;clearInterval(retry);snapshot()},60000);
})();
