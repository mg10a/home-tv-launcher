/* Read-only calendar display. Private selections live in HA user data, never here. */
(function(){
'use strict';
const zone='Europe/London', key='home_tv_family_calendars_v1';
const palette=['#83d6af','#e9b5ef','#a8caff','#ffd58a','#ffaaa6','#a5e3e4','#c5bbff','#d6dba5'];
function dayKey(value){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function monday(day){return addDays(day,-(new Date(day+'T12:00:00Z').getUTCDay()+6)%7)}
function midnight(day){const t=Date.parse(day+'T00:00:00Z');const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(t));return new Date(t-h*3600000).toISOString()}
function eventDay(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:dayKey(value)}
function onDay(event,day){if(!event.start||!event.end)return false;const allDay=/^\d{4}-\d{2}-\d{2}$/.test(event.start);return allDay?event.start<=day&&event.end>day:Date.parse(event.start)<Date.parse(midnight(addDays(day,1)))&&Date.parse(event.end)>Date.parse(midnight(day))}
function period(cursor,mode){const start=monday(mode==='month'?cursor.slice(0,7)+'-01':cursor);return {start,end:addDays(start,mode==='month'?42:7),count:mode==='month'?42:7}}
function shiftMonth(day,n){const d=new Date(day.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)}
function normalize(value){return {version:1,calendars:Array.isArray(value?.calendars)?value.calendars.filter(x=>/^calendar\.[a-z0-9_]+$/.test(x.id)&&['agenda','meal'].includes(x.role)).map((x,i)=>({id:x.id,role:x.role,label:String(x.label||x.id).slice(0,100),color:/^#[0-9a-f]{6}$/i.test(x.color)?x.color:palette[i%palette.length]})):[],placeholders:Array.isArray(value?.placeholders)?value.placeholders.map(x=>String(x).trim().slice(0,50)).filter(Boolean):[]}}
if(typeof module!=='undefined')module.exports={dayKey,addDays,monday,midnight,onDay,period,shiftMonth,normalize};
if(typeof document==='undefined')return;
const card=document.querySelector('.family-sections>.family-section'),overlay=document.getElementById('calendarOverlay');
if(!card||!overlay)return;
let config=null,settingsError='',socket=null,loadingSettings=false,requestEpoch=0,cursor=dayKey(Date.now()),mode='week',busy=false,lastFetch=0,loadedRange='',data=new Map(),errors=new Set(),hidden=new Set(),pending=new Map(),inventory='';
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
const button=(text,action)=>{const b=make('button','',text);b.type='button';b.onclick=action;return b};
const dateLabel=(day,options)=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:zone,...options});
const ready=()=>typeof haVerified!=='undefined'&&haVerified&&typeof haSocket!=='undefined'&&haSocket?.readyState===1;
card.querySelector('.empty-row').remove();card.querySelector('.calendar-layers').remove();
const actions=make('div','family-calendar-actions');actions.append(button('Calendars',()=>{openCalendar();settings.open=true;drawSettings()}),button('↻ Refresh',()=>refresh(true)));
const filters=make('div','family-calendar-filters');const status=make('p','family-calendar-status');status.setAttribute('role','status');const agenda=make('div','family-agenda');agenda.tabIndex=0;agenda.setAttribute('aria-label','This week’s events');card.append(actions,filters,status,agenda);
const dialog=overlay.querySelector('.calendar-dialog'),grid=document.getElementById('calendarFullGrid'),foot=overlay.querySelector('.calendar-dialog-foot');
const settings=make('details','family-calendar-settings');settings.append(make('summary','','Choose calendars'));const form=make('div');settings.append(form);dialog.insertBefore(settings,grid);
const fullFilters=make('div','family-calendar-filters');dialog.insertBefore(fullFilters,grid);
const mealBox=document.querySelector('.meal-days');mealBox.classList.add('family-meals');
const requests=(command)=>new Promise((resolve,reject)=>{if(!ready()||haSocket!==socket)return reject(Error('Home Assistant disconnected'));const id=haRequestId++;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Request timed out'))},25000);pending.set(id,{resolve,reject,timer});try{socket.send(JSON.stringify({id,...command}))}catch(e){clearTimeout(timer);pending.delete(id);reject(e)}});
function rejectPending(){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Home Assistant disconnected'))}pending.clear()}
function message(e){let msg;try{msg=JSON.parse(e.data)}catch{return}const p=pending.get(msg.id);if(msg.type!=='result'||!p)return;clearTimeout(p.timer);pending.delete(msg.id);msg.success?p.resolve(msg.result):p.reject(Error(msg.error?.message||'Request failed'))}
async function connect(){
 if(!ready()){if(socket){socket.removeEventListener('message',message);socket=null;rejectPending();requestEpoch++;config=null;data.clear();errors.clear();loadedRange='';busy=false;loadingSettings=false}draw();return}
 const ids=Object.values(haStates).filter(s=>s.entity_id.startsWith('calendar.')).map(s=>s.entity_id+'|'+s.state).join(';');if(socket===haSocket){if(ids!==inventory){inventory=ids;if(config)refresh(true)}else if(config&&Date.now()-lastFetch>300000)refresh();return}inventory=ids;
 if(socket)socket.removeEventListener('message',message);rejectPending();socket=haSocket;socket.addEventListener('message',message);const active=socket;requestEpoch++;config=null;data.clear();errors.clear();loadedRange='';busy=false;loadingSettings=true;settingsError='';draw();
 try{const result=await requests({type:'frontend/get_user_data',key});if(socket!==active)return;config=normalize(result?.value);hidden.clear()}
 catch(e){if(socket===active)settingsError='Could not load your calendar choices. Try Refresh.'}
 finally{if(socket===active){loadingSettings=false;draw();if(config)refresh(true)}}
}
function drawSettings(){
 if(!settings.open)return;form.replaceChildren();
 if(!ready()||!config){form.append(make('p','',settingsError||'Connect Home Assistant to choose calendars.'));return}
 form.append(make('p','','Choose where each calendar appears. Choices follow your Home Assistant account on your devices.'));
 const states=Object.values(haStates).filter(s=>s.entity_id.startsWith('calendar.')).sort((a,b)=>(a.attributes?.friendly_name||a.entity_id).localeCompare(b.attributes?.friendly_name||b.entity_id));
 const rows=[];states.forEach((s,i)=>{const saved=config.calendars.find(c=>c.id===s.entity_id);const row=make('label','family-calendar-setting');row.append(make('span','',s.attributes?.friendly_name||s.entity_id),make('small','',s.entity_id));const select=make('select');select.setAttribute('aria-label','Use '+s.entity_id);select.append(new Option('Excluded',''),new Option('Calendar','agenda'),new Option('Meal plan','meal'));select.value=saved?.role||'';const label=make('input');label.value=saved?.label||s.attributes?.friendly_name||s.entity_id;label.setAttribute('aria-label','Display name for '+s.entity_id);const color=make('input');color.type='color';color.value=saved?.color||palette[i%palette.length];color.setAttribute('aria-label','Colour for '+s.entity_id);row.append(select,label,color);form.append(row);rows.push({id:s.entity_id,select,label,color})});
 // Preserve unavailable selections rather than silently dropping them when saving.
 const missing=config.calendars.filter(c=>!states.some(s=>s.entity_id===c.id));if(missing.length)form.append(make('p','','Unavailable selections kept: '+missing.map(c=>c.label).join(', ')));
 const placeholder=make('input');placeholder.value=config.placeholders.join(', ');placeholder.placeholder='Future calendar names, separated by commas';placeholder.setAttribute('aria-label','Future calendars');form.append(placeholder);
 const result=make('p','family-calendar-status');const save=button('Save calendars',async()=>{save.disabled=true;result.textContent='Saving…';const next=normalize({calendars:[...rows.filter(r=>r.select.value).map(r=>({id:r.id,role:r.select.value,label:r.label.value,color:r.color.value})),...missing],placeholders:placeholder.value.split(',')});const active=socket;try{await requests({type:'frontend/set_user_data',key,value:next});if(socket!==active)return;config=next;hidden.clear();settings.open=false;loadedRange='';refresh(true)}catch(e){result.textContent='Could not save. Your previous choices are unchanged.'}finally{save.disabled=false}});form.append(save,result);
}
settings.addEventListener('toggle',()=>{if(settings.open)drawSettings()});
function drawFilters(target){const focus=document.activeElement?.dataset?.calendarFilter;target.replaceChildren();for(const c of config?.calendars.filter(c=>c.role==='agenda')||[]){const b=button(c.label,()=>{hidden.has(c.id)?hidden.delete(c.id):hidden.add(c.id);draw()});b.dataset.calendarFilter=c.id;b.setAttribute('aria-pressed',String(!hidden.has(c.id)));b.style.setProperty('--calendar-color',c.color);target.append(b)}for(const name of config?.placeholders||[])target.append(make('span','calendar-placeholder',name+' · not connected'));if(focus&&target.contains(document.activeElement)===false){const b=[...target.querySelectorAll('button')].find(b=>b.dataset.calendarFilter===focus);if(b&&target.getClientRects().length)b.focus()}}
function activeEvents(role){return (config?.calendars||[]).filter(c=>c.role===role&&(role!=='agenda'||!hidden.has(c.id))).flatMap(c=>(data.get(c.id)||[]).map(e=>({...e,calendar:c}))).sort((a,b)=>a.start.localeCompare(b.start)||String(a.summary).localeCompare(String(b.summary)))}
function eventNode(e,day,compact=false){const el=make('div','family-calendar-event');el.style.setProperty('--calendar-color',e.calendar.color);const allDay=/^\d{4}-\d{2}-\d{2}$/.test(e.start);const time=allDay?'All day':eventDay(e.start)<day?'Continues':new Date(e.start).toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'});el.append(make('small','',time+' · '+e.calendar.label),make('strong','',e.summary||'Untitled event'));if(!compact&&e.location)el.append(make('span','',e.location));return el}
function dayContent(parent,day,events,compact){events.filter(e=>onDay(e,day)).forEach(e=>parent.append(eventNode(e,day,compact)))}
function draw(){
 const today=dayKey(Date.now()),week=monday(today),range=period(cursor,mode);const connected=ready();const msg=!connected?'Connect Home Assistant to show calendars':loadingSettings?'Loading calendar choices…':settingsError||(!config?.calendars.length?'Choose your calendars to get started':busy?'Loading events…':errors.size?'Some calendars could not load: '+config.calendars.filter(c=>errors.has(c.id)).map(c=>c.label).join(', '):'');status.textContent=msg;foot.textContent=msg||'Times shown in UK time · '+(lastFetch?'Updated '+new Date(lastFetch).toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'}):'');
 drawFilters(filters);drawFilters(fullFilters);
 const strip=document.getElementById('calendarWeekStrip');strip.replaceChildren();for(let i=0;i<7;i++){const day=addDays(week,i);strip.append(make('span',day===today?'today':'',dateLabel(day,{weekday:'short',day:'numeric'})))}
 document.getElementById('calendarWeekLabel').textContent='This week · Mon–Sun ↗';
 const events=connected?activeEvents('agenda'):[];agenda.replaceChildren();if(connected&&config&&!busy){for(let i=0;i<7;i++){const day=addDays(week,i);const list=events.filter(e=>onDay(e,day));if(!list.length)continue;const group=make('section','family-agenda-day');group.append(make('h3','',dateLabel(day,{weekday:'short',day:'numeric',month:'short'})));list.forEach(e=>group.append(eventNode(e,day)));agenda.append(group)}if(!agenda.children.length&&config.calendars.some(c=>c.role==='agenda')&&!errors.size)agenda.append(make('p','',hidden.size?'No events in the visible calendars this week.':'No events this week.'))}
 grid.replaceChildren();for(const name of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])grid.append(make('div','cal-day',name));for(let i=0;i<range.count;i++){const day=addDays(range.start,i),cell=make('div','cal-cell'+(day===today?' today':'')+(mode==='month'&&day.slice(0,7)!==cursor.slice(0,7)?' muted':''));cell.append(make('strong','',day.slice(8)));if(!busy)dayContent(cell,day,events,true);grid.append(cell)}
 document.getElementById('calendarPeriodLabel').textContent=mode==='month'?dateLabel(cursor,{month:'long',year:'numeric'}):dateLabel(range.start,{day:'numeric',month:'short'})+' – '+dateLabel(addDays(range.end,-1),{day:'numeric',month:'short',year:'numeric'});
 mealBox.replaceChildren();const meals=connected?activeEvents('meal'):[];const mealSources=config?.calendars.filter(c=>c.role==='meal')||[];for(let i=0;i<7;i++){const day=addDays(week,i),row=make('div','family-meal-day');row.append(make('strong','',dateLabel(day,{weekday:'short'})));const titles=meals.filter(e=>onDay(e,day)).map(e=>e.summary||'Untitled meal');row.append(make('span','',!connected?'Not connected':busy?'Loading…':!mealSources.length?'Choose meal calendar':mealSources.some(c=>errors.has(c.id))?'Could not load':titles.join(' · ')||'Not planned'));mealBox.append(row)}
}
async function refresh(force=false){
 if(!ready())return connect();if(!config){if(!loadingSettings){socket?.removeEventListener('message',message);socket=null;return connect()}return}
 const range=period(cursor,mode),week=monday(dayKey(Date.now()));const start=range.start<week?range.start:week,end=range.end>addDays(week,7)?range.end:addDays(week,7);const signature=JSON.stringify([start,end,config.calendars.map(c=>c.id)]);if(!force&&signature===loadedRange&&Date.now()-lastFetch<300000)return;
 const epoch=++requestEpoch;busy=true;data.clear();errors.clear();draw();const active=socket;
 await Promise.all(config.calendars.map(async c=>{try{if(!haStates[c.id]||haStates[c.id].state==='unavailable')throw Error('Unavailable');const result=await requests({type:'call_service',domain:'calendar',service:'get_events',target:{entity_id:c.id},service_data:{start_date_time:midnight(start),end_date_time:midnight(end)},return_response:true});const events=result?.response?.[c.id]?.events;if(!Array.isArray(events))throw Error('No calendar response');if(epoch===requestEpoch&&socket===active)data.set(c.id,events.filter(e=>e.start&&e.end))}catch(e){if(epoch===requestEpoch&&socket===active)errors.add(c.id)}}));
 if(epoch!==requestEpoch||socket!==active)return;busy=false;lastFetch=Date.now();loadedRange=signature;draw();
}
window.renderCalendar=()=>{draw();refresh()};window.openCalendar=()=>{cursor=dayKey(Date.now());mode='week';document.getElementById('calendarView').value=mode;overlay.classList.remove('hidden');draw();refresh();overlay.querySelector('.calendar-dialog-head button').focus()};window.moveCalendar=n=>{cursor=mode==='month'?shiftMonth(cursor,n):addDays(cursor,n*7);draw();refresh()};window.resetCalendar=()=>{cursor=dayKey(Date.now());draw();refresh()};window.changeCalendarView=value=>{mode=value==='month'?'month':'week';draw();refresh()};
// Keep TV remote focus inside the calendar and leave native form editing intact.
document.addEventListener('keydown',e=>{
 if(overlay.classList.contains('hidden')){if(agenda.contains(e.target)&&['ArrowUp','ArrowDown'].includes(e.key))e.stopPropagation();return}
 if(['Escape','BrowserBack'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();closeCalendar();return}
 if(e.target.matches('input,select,textarea')){if(e.key!=='Tab')e.stopImmediatePropagation();return}
 const items=[...overlay.querySelectorAll('button:not(:disabled),select,input,summary')].filter(el=>el.getClientRects().length);
 if(e.key==='Tab'){e.stopImmediatePropagation();const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}return}
 if(e.key.startsWith('Arrow')){e.preventDefault();e.stopImmediatePropagation();const current=document.activeElement;const index=items.indexOf(current),step=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;items[Math.max(0,Math.min(items.length-1,index+step))]?.focus();return}
 if(e.key==='Enter'||e.key===' ')e.stopImmediatePropagation();
},true);
window.addEventListener('home-states-updated',connect);document.addEventListener('visibilitychange',()=>{if(!document.hidden){connect();refresh()}});setInterval(()=>{if(!document.hidden){connect();refresh()}},60000);connect();
})();
