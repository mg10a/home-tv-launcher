/* Three-screen navigation. Existing HA controls and modal IDs stay intact. */
(function(){
'use strict';
const names=['Launcher','Smart Home','Family Organiser'],keys=['launcher','home','family'];
const launcher=document.querySelector('main.shell'),dashboard=document.getElementById('dashboardPage');
if(!launcher||!dashboard)return;
const nav=document.createElement('nav');nav.id='homeScreenNav';nav.setAttribute('aria-label','Home screens');
nav.innerHTML=names.map((n,i)=>'<button type="button" data-home-screen="'+keys[i]+'" aria-pressed="'+(i===0)+'">'+n+'</button>').join('');
document.body.prepend(nav);
let active=0;
function modalOpen(){return [...document.querySelectorAll('dialog[open],[role="dialog"]')].some(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')}
window.navigateHome=function(screen,focus=false){
const index=keys.indexOf(screen);if(index<0)return;
if(typeof hideDetailPages==='function')hideDetailPages();
active=index;document.body.dataset.homeScreen=screen;try{localStorage.setItem('home-active-screen',screen)}catch{}
launcher.classList.toggle('hidden',index!==0);dashboard.classList.toggle('hidden',index===0);
document.body.classList.toggle('dashboard-open',index!==0);
dashboard.setAttribute('aria-label',names[index]||'Smart Home');
nav.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
document.querySelector('.home-panel').setAttribute('aria-hidden',String(index!==1));
document.querySelector('.family-panel').setAttribute('aria-hidden',String(index!==2));
if(focus)nav.children[index].focus();
};
nav.addEventListener('click',e=>{const b=e.target.closest('[data-home-screen]');if(b)window.navigateHome(b.dataset.homeScreen,true)});
let start=null,ignoreClickUntil=0;
function ownsGesture(target){
if(modalOpen()||document.fullscreenElement||document.getElementById('photoStage')?.classList.contains('photo-fullscreen'))return true;
if(target.closest('input,textarea,select,video,audio,[role="slider"],.photo-stage,.week-strip,.cal-grid'))return true;
for(let el=target;el&&el!==document.body;el=el.parentElement){if(el.scrollWidth>el.clientWidth+8&&/auto|scroll/.test(getComputedStyle(el).overflowX))return true}
return !launcher.getClientRects().length&&!dashboard.getClientRects().length;
}
document.addEventListener('touchstart',e=>{if(e.touches.length!==1||ownsGesture(e.target)){start=null;return}const p=e.touches[0];start={x:p.clientX,y:p.clientY,time:Date.now()}},{passive:true});
document.addEventListener('touchend',e=>{if(!start)return;const p=e.changedTouches[0],dx=p.clientX-start.x,dy=p.clientY-start.y,elapsed=Date.now()-start.time;start=null;if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.5||elapsed>1200||modalOpen())return;const next=Math.max(0,Math.min(2,active+(dx<0?1:-1)));if(next!==active){ignoreClickUntil=Date.now()+400;window.navigateHome(keys[next])}},{passive:true});
document.addEventListener('touchcancel',()=>{start=null},{passive:true});
document.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
let restored='launcher';try{const saved=localStorage.getItem('home-active-screen');if(keys.includes(saved))restored=saved}catch{}
window.navigateHome(restored);
/* Account management stays on Groobarbs; no customer data is embedded here. */
const sections=dashboard.querySelector('.family-sections');
if(sections){
const box=document.createElement('section');box.className='family-section groobarbs-card';
box.innerHTML='<div class="family-title">🥕 Fruit &amp; veg box</div><p>View your next Groobarbs box, swap contents or skip a delivery.</p><a class="groobarbs-open" href="https://my.groobarbs.co.uk/" target="_blank" rel="noopener noreferrer">Manage box ↗</a><small class="groobarbs-status" role="status">Opens your Groobarbs account</small>';
box.querySelector('a').addEventListener('click',event=>{
if(window.AndroidLauncher){event.preventDefault();if(typeof window.AndroidLauncher.openGroobarbs==='function')window.AndroidLauncher.openGroobarbs();else box.querySelector('.groobarbs-status').textContent='Update the Android app to open Groobarbs, or visit my.groobarbs.co.uk in your browser.';}
});sections.append(box);
}
/* Read-only now-playing card, using the launcher's existing authenticated state stream. */
const music=document.querySelector('.music-strip');
if(music){
music.innerHTML='<div class="music-symbol" aria-hidden="true">♫</div><div class="now-playing"><strong>Sonos</strong><select id="sonosPlayer" aria-label="Sonos speaker"><option value="">Choose speaker</option></select><span id="sonosTrack">Connect Home Assistant to show now playing</span><small id="sonosArtist"></small></div>';
let selected='';try{selected=localStorage.getItem('home-sonos-player')||''}catch{}
const select=document.getElementById('sonosPlayer'),track=document.getElementById('sonosTrack'),artist=document.getElementById('sonosArtist');
select.addEventListener('change',()=>{selected=select.value;try{localStorage.setItem('home-sonos-player',selected)}catch{}renderMusic()});
function renderMusic(){
const states=typeof haStates!=='undefined'?haStates:{},connected=typeof haVerified!=='undefined'&&haVerified;
const players=Object.values(states).filter(s=>s.entity_id?.startsWith('media_player.'));
if(!selected){const sonos=players.filter(s=>/sonos/i.test(s.entity_id+' '+s.attributes?.friendly_name)||s.attributes?.sonos_group);if(sonos.length===1)selected=sonos[0].entity_id}
const ids=players.map(s=>s.entity_id+'|'+s.attributes?.friendly_name).join(';');
if(select.dataset.options!==ids){select.replaceChildren(new Option('Choose speaker',''),...players.map(s=>new Option(s.attributes?.friendly_name||s.entity_id,s.entity_id)));select.dataset.options=ids}
select.value=selected;select.disabled=!connected||!players.length;
const state=states[selected],a=state?.attributes||{};
track.textContent=!connected?'Connect Home Assistant to show now playing':!selected?'Choose your Sonos speaker':!state?'Selected speaker is unavailable':['unknown','unavailable'].includes(state.state)?'Speaker unavailable':a.media_title||({playing:'Playing',paused:'Paused',idle:'Nothing playing',off:'Off',standby:'Standby'}[state.state]||state.state);
artist.textContent=connected&&state?[a.media_artist||a.media_album_artist,a.media_album_name,state.state==='paused'?'Paused':''].filter(Boolean).join(' · '):'';
}
window.addEventListener('home-states-updated',renderMusic);document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderMusic()});renderMusic();
}
})();
