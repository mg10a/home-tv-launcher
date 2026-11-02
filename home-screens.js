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
if(window.AndroidLauncher){event.preventDefault();if(typeof window.AndroidLauncher.openGroobarbs==='function')window.AndroidLauncher.openGroobarbs();else box.querySelector('.groobarbs-status').textContent='Update the Home TV app to open Groobarbs here. In the meantime, open my.groobarbs.co.uk in your browser.';}
else {event.preventDefault();window.location.assign('https://my.groobarbs.co.uk/');}
});sections.append(box);
const summary=document.createElement('div');summary.className='groobarbs-summary';box.insertBefore(summary,box.querySelector('a'));
const contents=document.createElement('button');contents.type='button';contents.className='groobarbs-open';contents.textContent='View contents';contents.hidden=true;summary.after(contents);
const detail=document.createElement('dialog');detail.className='groobarbs-detail';detail.setAttribute('aria-label','Groobarbs delivery contents');document.body.append(detail);
function addText(parent,tag,text){const el=document.createElement(tag);el.textContent=text;parent.append(el);return el}
function grooState(){return typeof haVerified!=='undefined'&&haVerified&&typeof haStates!=='undefined'?haStates['sensor.groobarbs_next_delivery']:null}
function renderGroo(){const state=grooState(),a=state?.attributes;const live=state&&!['unknown','unavailable'].includes(state.state);contents.hidden=!live;summary.textContent=live?'Next delivery: '+(a.date||state.state):'';box.querySelector('p').hidden=!!live;box.querySelector('.groobarbs-status').textContent=live?'Live from HA · updates every 30 minutes':state?'Groobarbs temporarily unavailable':'Opens your Groobarbs account';const sig=JSON.stringify([live,a?.revision,a?.swap_count,a?.items,a?.editable]);if(detail.open&&sig!==lastGroo&&!saving)renderDetail();lastGroo=sig}
let choice=null, saving=false, message='', lastGroo='';
function button(parent,label,action){const b=addText(parent,'button',label);b.type='button';b.addEventListener('click',action);return b}
function niceDate(value,withTime=false){if(!value)return '';const d=new Date(value.length===10?value+'T12:00:00Z':value);return Number.isNaN(+d)?value:new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(d)}
function renderDetail(){
 const state=grooState();detail.replaceChildren();
 const head=addText(detail,'header','');head.className='groo-head';const title=addText(head,'div','');addText(title,'h2','Your fruit & veg box');button(head,'Close',()=>detail.close());
 if(!state||['unknown','unavailable'].includes(state.state)){addText(detail,'p','Live data unavailable. Reconnect Home Assistant to continue.');return}
 const a=state.attributes,editable=a.editable&&(!a.deadline||Date.now()<Date.parse(a.deadline));
 addText(title,'p',niceDate(a.date)+' · '+(editable?'Changes until '+niceDate(a.deadline,true):'Changes closed'));
 const body=addText(detail,'div','');body.className='groo-body';
 const boxes=(a.items||[]).filter(i=>i.contents_can_change||i.max_swaps),extras=(a.items||[]).filter(i=>!boxes.includes(i));
 for(const item of boxes){
  const section=addText(body,'section','');section.className='groo-box';
  const meta=addText(section,'div','');meta.className='groo-box-head';addText(meta,'strong',item.title);
  const limit=Math.min(4,Number(item.max_swaps)||4),used=Number(item.swap_count)||0,remaining=Math.max(0,limit-used);
  const badge=addText(meta,'span',used+' of '+limit+' used · '+remaining+' remaining');badge.className='groo-allowance';badge.setAttribute('role','status');
  const grid=addText(section,'div','');grid.className='groo-produce';
  for(const c of item.contents||[]){const tile=addText(grid,'div','');tile.className='groo-tile'+(c.replaced_product_id?' is-swapped':'');const text=addText(tile,'div','');addText(text,'strong',c.title);if(c.replaced_title)addText(text,'small','Instead of '+c.replaced_title);
   if(a.swaps_enabled&&editable){const b=button(tile,c.replaced_product_id?'Change':'Swap',()=>{choice={itemId:item.id,contentId:c.id,replacement:null,page:0};message='';renderDetail()});b.disabled=saving||(!c.replaced_product_id&&remaining===0);b.setAttribute('aria-label',(c.replaced_product_id?'Change ':'Swap ')+c.title)}
  }
 }
 if(extras.length){const extra=addText(detail,'div','Extras: '+extras.map(i=>i.title+' × '+i.qty).join(' · '));extra.className='groo-extras'}
 const foot=addText(detail,'footer',message||'Tap Swap to choose a replacement. Changing an existing swap does not use another slot.');foot.className='groo-note';foot.setAttribute('role','status');
 if(choice){
  const item=boxes.find(i=>i.id===choice.itemId),c=item?.contents?.find(c=>c.id===choice.contentId);
  if(!item||!c||!editable){choice=null;return}
  const panel=addText(detail,'section','');panel.className='groo-picker';panel.setAttribute('aria-label','Choose replacement');
  const bar=addText(panel,'header','');button(bar,'Back',()=>{if(!saving){choice=null;renderDetail()}});addText(bar,'h3','Replace '+c.title);
  const options=(a.replacements||[]).filter(r=>r.id!==(c.replaced_product_id||c.product_id)&&r.id!==c.product_id&&(r.category_ids||[]).some(id=>(c.category_ids||[]).includes(id)));
  const choices=addText(panel,'div','');choices.className='groo-options';
  const pages=Math.max(1,Math.ceil(options.length/6));choice.page=Math.min(choice.page,pages-1);
  for(const r of options.slice(choice.page*6,choice.page*6+6)){const b=button(choices,r.title,()=>{choice.replacement=r;renderDetail()});b.setAttribute('aria-pressed',String(choice.replacement?.id===r.id));b.disabled=saving}
  if(!options.length)addText(choices,'p','No replacements available.');
  if(pages>1){const pager=addText(panel,'div','');pager.className='groo-pages';button(pager,'Previous',()=>{choice.page=Math.max(0,choice.page-1);renderDetail()}).disabled=saving||choice.page===0;addText(pager,'span',(choice.page+1)+' / '+pages);button(pager,'Next',()=>{choice.page=Math.min(pages-1,choice.page+1);renderDetail()}).disabled=saving||choice.page===pages-1}
  const review=addText(panel,'div','');review.className='groo-review';addText(review,'strong',choice.replacement?c.title+' → '+choice.replacement.title:'Choose a replacement above');addText(review,'small',item.bespoke?'Bespoke surcharge already included.':'This makes your box bespoke: £1 extra.');
  const save=button(panel,saving?'Saving…':'Save swap to Groobarbs',async()=>{
   if(!choice?.replacement||saving)return;const request={order_id:a.order_id,item_id:item.id,content_id:c.id,replacement_id:choice.replacement.id,revision:a.revision};saving=true;renderDetail();
   try{await eufyWsCommand({type:'call_service',domain:'groobarbs',service:'swap',service_data:request},65000);choice=null;message='Saved to Groobarbs. Contents and allowance updated.'}
   catch(error){choice=null;message='Could not confirm the change. '+(error?.message||'Check Groobarbs before trying again.')}
   finally{saving=false;renderDetail()}
  });save.className='groo-save';save.disabled=saving||!choice.replacement;
 }
}
contents.addEventListener('click',()=>{choice=null;message='';renderDetail();detail.showModal()});window.addEventListener('home-states-updated',renderGroo);renderGroo();
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
