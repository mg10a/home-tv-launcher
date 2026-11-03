/* Recover navigation if Android recreates its WebView; ordinary rotation only reflows CSS. */
(function(){
'use strict';
const key='home-view-resume-v1';let pending=null,restoring=false,resumeCover=null,primed=false;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Date.now()-saved.at<120000)pending=saved}catch{}
function dismissCover(){resumeCover?.remove();resumeCover=null;document.documentElement?.classList.remove('view-resume-boot')}
function primeView(){
 if(!pending||typeof document.createElement!=='function'){document.documentElement?.classList.remove('view-resume-boot');return}
 if(['launcher','home','family'].includes(pending.screen)){window.navigateHome(pending.screen);primed=true}
 const p=pending.panel;
 if(p?.kind==='doorbell')openEufyOverlay({mode:p.mode,date:p.date,deferLoad:true});
 else if(p&&!['weather','appSettings'].includes(p.kind)){
  const titles={room:p.name,calendar:'Calendar',calendarDay:'Calendar',birthdays:'Birthdays',heating:'Heating',pets:'Cat flap',history:'Sensor history',coffee:'Coffee machine',groobarbs:'Your Groobarbs delivery',photos:'Your photos',photoSettings:'Photo albums'};
  resumeCover=document.createElement('section');resumeCover.setAttribute('role','dialog');resumeCover.setAttribute('aria-label',titles[p.kind]||'Restoring view');
  resumeCover.style.cssText='position:fixed;inset:3dvh 3vw;z-index:99999;background:#192d43;color:#eef5ff;border:1px solid #607b98;border-radius:16px;padding:20px;box-shadow:0 0 0 100vmax #080d17dd';
  const h=document.createElement('h2');h.textContent=titles[p.kind]||'Restoring view';const status=document.createElement('p');status.textContent='Reconnecting…';status.setAttribute('role','status');const close=document.createElement('button');close.textContent='Close';close.style.cssText='float:right;background:#243b55;color:#eef5ff;border:1px solid #607b98;border-radius:8px;padding:8px 14px';close.onclick=()=>{pending=null;dismissCover();snapshot()};resumeCover.append(close,h,status);document.body.append(resumeCover);
 }
 document.documentElement?.classList.remove('view-resume-boot');
}
const shown=id=>{const e=document.getElementById(id);return e&&!e.classList.contains('hidden')&&e.getClientRects().length>0};
function snapshot(){
 if(pending||restoring)return;
 const state={at:Date.now(),screen:document.body.dataset.homeScreen||'launcher'};
 if(shown('eufyOverlay'))state.panel={kind:'doorbell',mode:document.getElementById('eufyRecordTab').getAttribute('aria-pressed')==='true'?'recordings':'live',date:document.getElementById('eufyDate').value};
 else if(document.querySelector('.room-detail[open]'))state.panel={kind:'room',name:document.querySelector('.room-detail h2')?.textContent};
 else if(document.querySelector('.coffee-detail[open]'))state.panel={kind:'coffee'};
 else if(document.querySelector('.groobarbs-detail[open]'))state.panel={kind:'groobarbs'};
 else if(document.querySelector('.calendar-day-dialog[open] h2')?.textContent==='Birthdays')state.panel={kind:'birthdays'};
 else if(window.getFamilyDetailView?.())state.panel=window.getFamilyDetailView();
 else if(document.getElementById('photoSettings')?.open)state.panel={kind:'photoSettings'};
 else if(document.getElementById('launchSettings')?.open)state.panel={kind:'appSettings'};
 else if(document.getElementById('photoStage')?.classList.contains('photo-fullscreen'))state.panel={kind:'photos'};
 else if(shown('calendarOverlay'))state.panel={kind:'calendar'};
 else if(shown('salusOverlay'))state.panel={kind:'heating'};
 else if(shown('petOverlay'))state.panel={kind:'pets'};
 else if(shown('historyPage'))state.panel={kind:'history'};
 else if(document.getElementById('weatherModal')?.open)state.panel={kind:'weather'};
 try{localStorage.setItem(key,JSON.stringify(state))}catch{}
}
async function restore(){
 if(!pending)return;const p=pending.panel;
 if(p&&!['weather','appSettings'].includes(p.kind)&&(typeof haVerified==='undefined'||!haVerified||typeof haStatesReady==='undefined'||!haStatesReady))return;
 if(['birthdays','calendarDay'].includes(p?.kind)&&!window.familyViewReady?.())return;
 const saved=pending;pending=null;restoring=true;
 try{
 if(!primed&&['launcher','home','family'].includes(saved.screen))window.navigateHome(saved.screen);
 if(p?.kind==='doorbell')openEufyOverlay({mode:p.mode,date:/^\d{4}-\d{2}-\d{2}$/.test(p.date)?p.date:undefined});
 else if(p?.kind==='room'&&typeof p.name==='string')await window.openRoomDetails(p.name);
 else if(p?.kind==='calendar')window.openCalendar();
 else if(p?.kind==='heating')openSalusModal();
 else if(p?.kind==='pets')showPetDetails();
 else if(p?.kind==='history')showHistory();
 else if(p?.kind==='weather')window.openHomeWeather();
 else if(p?.kind==='coffee')window.openCoffeeDetails();
 else if(p?.kind==='groobarbs')window.openGroobarbsDetails();
 else if(p?.kind==='birthdays')await window.openBirthdayDetails();
 else if(p?.kind==='calendarDay')await window.restoreCalendarDay(p);
 else if(p?.kind==='photos')await openPhotoFullscreen();
 else if(p?.kind==='photoSettings')openPhotoSettings();
 else if(p?.kind==='appSettings')openLaunchSettings();
 }finally{restoring=false;dismissCover();snapshot()}
}
// Save before a reload, and after navigation without retaining any HA credentials.
for(const event of ['pagehide','beforeunload','resize','orientationchange'])window.addEventListener(event,snapshot);
document.addEventListener('visibilitychange',snapshot);
document.addEventListener('click',e=>{if(e.isTrusted&&pending&&(!primed||e.target.closest?.('#homeScreenNav button,#eufyClose'))){pending=null;dismissCover();}else if(pending?.panel?.kind==='doorbell')setTimeout(()=>{if(pending?.panel?.kind==='doorbell'){pending.panel.mode=document.getElementById('eufyRecordTab').getAttribute('aria-pressed')==='true'?'recordings':'live';pending.panel.date=document.getElementById('eufyDate').value}},0);setTimeout(snapshot,0)},true);
document.addEventListener('change',()=>{if(pending?.panel?.kind==='doorbell')pending.panel.date=document.getElementById('eufyDate').value;setTimeout(snapshot,0)},true);
document.addEventListener('close',snapshot,true);
window.addEventListener('home-states-updated',restore);
primeView();if(primed)restore();else setTimeout(restore,0);const retry=setInterval(()=>{restore();if(!pending)clearInterval(retry)},500);
setTimeout(()=>{pending=null;clearInterval(retry);dismissCover();snapshot()},60000);
})();
