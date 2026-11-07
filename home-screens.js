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
window.addEventListener('resize',()=>{start=null});window.addEventListener('orientationchange',()=>{start=null});
document.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
let restored='launcher';try{const saved=localStorage.getItem('home-active-screen');if(keys.includes(saved))restored=saved}catch{}
window.navigateHome(restored);
/* Account management stays on Groobarbs; no customer data is embedded here. */
const sections=dashboard.querySelector('.family-sections');
if(sections){
const box=document.createElement('section');box.className='family-section groobarbs-card';
box.innerHTML='<div class="family-title">🥕 Fruit &amp; veg box</div><p>View your next Groobarbs box, swap contents or skip a delivery.</p><a class="groobarbs-open" href="https://my.groobarbs.co.uk/" target="_blank" rel="noopener noreferrer">Groobarbs website ↗</a><small class="groobarbs-status" role="status">Opens your Groobarbs account</small>';
box.querySelector('a').addEventListener('click',event=>{
event.preventDefault();
if(!window.AndroidLauncher){window.location.assign('https://my.groobarbs.co.uk/');return}
if(typeof window.AndroidLauncher.openGroobarbs==='function'){try{window.AndroidLauncher.openGroobarbs();return}catch{}}
const help=document.createElement('dialog');help.className='groobarbs-link-help';
const title=document.createElement('h2');title.textContent='Open Groobarbs website';const note=document.createElement('p');note.textContent='This installed version of Home TV cannot open external websites. Copy this address into your phone browser. Manage box works here in the dashboard.';
const address=document.createElement('input');address.readOnly=true;address.value='https://my.groobarbs.co.uk/';address.setAttribute('aria-label','Groobarbs website address');address.onclick=()=>address.select();
const copy=document.createElement('button');copy.textContent='Copy address';copy.onclick=async()=>{try{await navigator.clipboard.writeText(address.value);copy.textContent='Copied'}catch{address.select();copy.textContent='Select and copy the address above'}};
const close=document.createElement('button');close.textContent='Close';close.onclick=()=>help.close();help.append(title,note,address,copy,close);document.body.append(help);help.addEventListener('close',()=>help.remove());help.showModal();
});sections.append(box);
box.querySelector('.family-title').after(box.querySelector('.groobarbs-status'));
const summary=document.createElement('div');summary.className='groobarbs-summary';box.insertBefore(summary,box.querySelector('a'));
const contents=document.createElement('button');contents.type='button';contents.className='groobarbs-open';contents.textContent='Manage box';contents.hidden=false;summary.after(contents);
const detail=document.createElement('dialog');detail.className='groobarbs-detail';detail.setAttribute('aria-label','Groobarbs delivery contents');document.body.append(detail);
function addText(parent,tag,text){const el=document.createElement(tag);el.textContent=text;parent.append(el);return el}
function grooState(){return typeof haVerified!=='undefined'&&haVerified&&typeof haStates!=='undefined'?haStates['sensor.groobarbs_next_delivery']:null}
function grooWindow(a,now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const local=parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
 if(!a?.date||!/^\d{4}-\d{2}-\d{2}$/.test(a.date))return false;
 const delivery=new Date(a.date+'T12:00:00Z');if(delivery.getUTCDay()!==2)return false;
 const day=offset=>{const d=new Date(delivery);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
 return local>=day(-4)+'T00:00'&&local<day(-1)+'T11:00';
}
function renderGroo(){const state=grooState(),a=state?.attributes;const live=state&&!['unknown','unavailable'].includes(state.state);contents.hidden=false;summary.textContent=live?'Delivery: '+niceDate(a.date||state.state):'';box.querySelector('p').hidden=!!live;box.querySelector('.groobarbs-status').textContent=live?((grooWindow(a)&&a.editable&&(!a.deadline||Date.now()<Date.parse(a.deadline)))?'Changes open until 11am Mon':'Changes closed'):state?'Groobarbs temporarily unavailable':'Opens your Groobarbs account';const sig=JSON.stringify([live,a?.revision,a?.swap_count,a?.items,a?.editable,grooWindow(a)]);if(detail.open&&sig!==lastGroo&&!saving)renderDetail();lastGroo=sig}
let choice=null, saving=false, message='', lastGroo='';
function button(parent,label,action){const b=addText(parent,'button',label);b.type='button';b.addEventListener('click',action);return b}
function niceDate(value,withTime=false){if(!value)return '';const d=new Date(value.length===10?value+'T12:00:00Z':value);return Number.isNaN(+d)?value:new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(d)}
function renderDetail(){
 const state=grooState();detail.replaceChildren();
 const head=addText(detail,'header','');head.className='groo-head';const title=addText(head,'div','');addText(title,'h2','Your fruit & veg box');button(head,'Close',()=>detail.close());
 if(!state||['unknown','unavailable'].includes(state.state)){addText(detail,'p','Live data unavailable. Reconnect Home Assistant to continue.');return}
 const a=state.attributes,editable=grooWindow(a)&&a.editable&&(!a.deadline||Date.now()<Date.parse(a.deadline));
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
   if(a.swaps_enabled&&editable){const b=button(tile,c.replaced_product_id?'Change':'Swap',()=>{choice={itemId:item.id,contentId:c.id,replacement:null};message='';renderDetail()});b.disabled=saving||(!c.replaced_product_id&&remaining===0);b.setAttribute('aria-label',(c.replaced_product_id?'Change ':'Swap ')+c.title)}
  }
 }
 if(extras.length){const extra=addText(detail,'div','Extras: '+extras.map(i=>i.title+' × '+i.qty).join(' · '));extra.className='groo-extras'}
 const foot=addText(detail,'footer',message||'Tap Swap to choose a replacement. Changing an existing swap does not use another slot.');foot.className='groo-note';foot.setAttribute('role','status');
 if(choice){
  const item=boxes.find(i=>i.id===choice.itemId),c=item?.contents?.find(c=>c.id===choice.contentId);
  if(!item||!c||!editable){choice=null;return}
  const panel=addText(detail,'section','');panel.className='groo-picker';panel.setAttribute('aria-label','Choose replacement');
  for(const sibling of detail.children)if(sibling!==panel)sibling.inert=true;
  const bar=addText(panel,'header','');
  button(bar,'Back',()=>{if(!saving){choice=null;renderDetail()}}).disabled=saving;
  addText(bar,'h3','Replace '+c.title);
  button(bar,'Close',()=>detail.close());
  const options=(a.replacements||[]).filter(r=>r.id!==(c.replaced_product_id||c.product_id)&&r.id!==c.product_id&&(r.category_ids||[]).some(id=>(c.category_ids||[]).includes(id)));
  if(choice.replacement&&!options.some(r=>r.id===choice.replacement.id))choice.replacement=null;
  const choices=addText(panel,'div','');
  choices.className='groo-options';
  const columns=Math.min(options.length||1,Math.max(3,Math.ceil(Math.sqrt(options.length*1.7))));
  choices.style.setProperty('--groo-columns',columns);
  choices.style.setProperty('--groo-portrait-columns',Math.min(columns,3));
  for(const r of options){
   const b=button(choices,'',()=>{
    choice.replacement=r;
    renderDetail();
    detail.querySelector('.groo-options [aria-pressed="true"]')?.focus({preventScroll:true});
   });
   const photo=window.haloGrooboxImages?.[String(r.title).trim().toLowerCase()];
   if(photo){
    const image=document.createElement('img');
    image.alt='';image.src=photo;image.referrerPolicy='no-referrer';image.decoding='async';
    image.addEventListener('error',()=>image.remove(),{once:true});
    b.append(image);
   }
   addText(b,'span',r.title);
   b.setAttribute('aria-pressed',String(choice.replacement?.id===r.id));
   b.disabled=saving;
  }
  if(!options.length)addText(choices,'p','No replacements available.');
  const review=addText(panel,'div','');review.className='groo-review';addText(review,'strong',choice.replacement?c.title+' → '+choice.replacement.title:'Choose a replacement above');addText(review,'small',item.bespoke?'Bespoke surcharge already included.':'This makes your box bespoke: £1 extra.');
  const save=button(panel,saving?'Saving…':'Save swap to Groobarbs',async()=>{
   if(!choice?.replacement||saving)return;const request={order_id:a.order_id,item_id:item.id,content_id:c.id,replacement_id:choice.replacement.id,revision:a.revision};saving=true;renderDetail();
   try{await eufyWsCommand({type:'call_service',domain:'groobarbs',service:'swap',service_data:request},65000);choice=null;message='Saved to Groobarbs. Contents and allowance updated.'}
   catch(error){choice=null;message='Could not confirm the change. '+(error?.message||'Check Groobarbs before trying again.')}
   finally{saving=false;renderDetail()}
  });save.className='groo-save';save.disabled=saving||!choice.replacement;
 }
}
window.openGroobarbsDetails=()=>{choice=null;message='';renderDetail();if(!detail.open)detail.showModal()};contents.addEventListener('click',window.openGroobarbsDetails);window.addEventListener('home-states-updated',renderGroo);setInterval(renderGroo,60000);renderGroo();
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

// Shared household card: keep the existing meal renderer and task controls intact.
(function(){
const card=document.querySelector('.tasks-card'),meal=document.querySelector('.family-section.meal-plan'),tabs=card?.querySelector('[role="tablist"]');
if(!card||!meal||!tabs)return;
meal.id='familyMealPanel';meal.setAttribute('role','tabpanel');meal.setAttribute('aria-labelledby','familyMealTab');meal.hidden=true;
const tab=document.createElement('button');tab.type='button';tab.id='familyMealTab';tab.setAttribute('role','tab');tab.setAttribute('aria-controls',meal.id);tab.setAttribute('aria-selected','false');tab.textContent='🍽 Meals';tab.onclick=()=>window.showFamilyList('meal');
tabs.insertBefore(tab,document.getElementById('familyShoppingTab'));card.append(meal);
const choices=[['todo','Todo'],['meal','Meal'],['shopping','Shopping']];
window.showFamilyList=function(which){
 if(!choices.some(([key])=>key===which))return;
 for(const [key,name] of choices){const active=key===which,b=document.getElementById('family'+name+'Tab');b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;document.getElementById('family'+name+'Panel').hidden=!active}
 try{localStorage.setItem('family-active-list',which)}catch{}
};
tabs.addEventListener('keydown',event=>{
 const index=choices.findIndex(([,name])=>'family'+name+'Tab'===event.target.id);if(index<0)return;
 let next=index;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;
 event.preventDefault();window.showFamilyList(choices[next][0]);document.getElementById('family'+choices[next][1]+'Tab').focus();
});
let selected='todo';try{selected=localStorage.getItem('family-active-list')||'todo'}catch{}
window.showFamilyList(choices.some(([key])=>key===selected)?selected:'todo');
})();
