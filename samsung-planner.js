/* Two-way meal planning through the existing authenticated HA event connection. */
(function(){
'use strict';
const origin='https://app.samsungfood.com',mealEntity='sensor.samsung_food_meal_plan',controlEntity='sensor.samsung_food_control';
function localDate(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
function shift(day,amount){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10)}
function monday(day){const d=new Date(day+'T12:00:00Z');return shift(day,-((d.getUTCDay()+6)%7))}
function preferredWeek(settings,date=new Date()){
 const day=localDate(date),start=monday(day),parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
 const weekday=(new Date(day+'T12:00:00Z').getUTCDay()+6)%7;
 return settings?.enabled&&(weekday>settings.weekday||(weekday===settings.weekday&&parts.hour+':'+parts.minute>=settings.time))?shift(start,7):start;
}
function mealWeekSync(week,status,now=Date.now()){
 const hasDays=Array.isArray(week?.days)&&week.days.length>0;
 if(status==='login_required')return {cached:hasDays,message:'Samsung Food sign-in needs attention in Home Assistant.'};
 if(!hasDays)return {cached:false,message:'This week has not synced yet. Select Refresh from Samsung Food.'};
 const stamp=Date.parse(week.last_success||'');
 if(!Number.isFinite(stamp)||now-stamp>35*60000)return {cached:true,message:'Showing the last available meal plan. Select Refresh from Samsung Food for the latest.'};
 return {cached:false,message:''};
}
if(typeof module!=='undefined')module.exports={localDate,shift,monday,preferredWeek,mealWeekSync};
if(typeof document==='undefined')return;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b};
const state=id=>typeof haStates!=='undefined'?haStates[id]:null;
const controls=()=>state(controlEntity)?.attributes||{};
const connected=()=>typeof haVerified!=='undefined'&&haVerified&&typeof haSocket!=='undefined'&&haSocket?.readyState===1;
const weeks=()=>state(mealEntity)?.attributes?.weeks||{};
const recipes=()=>{const a=state('sensor.samsung_food_saved_recipes')?.attributes?.recipes;return Array.isArray(a)?a.filter(r=>r&&/^[a-zA-Z0-9-]{10,100}$/.test(r.id)&&typeof r.title==='string'):[]};
const label=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/London'});
const dialog=el('dialog',undefined,'sf-planner');dialog.setAttribute('aria-label','Plan meals in Samsung Food');document.body.append(dialog);
let selectedWeek='',busy=false,pending='',notice='',review=null,showSettings=false,draftSettings=null,target=null,calendarWeek='',lastSignature='',query='';
const choices=new Map();
function request(data){return new Promise((resolve,reject)=>{
 if(!connected())return reject(Error('Connect Home Assistant first.'));
 const socket=haSocket,id=haRequestId++;let timer;
 const cleanup=()=>{clearTimeout(timer);socket.removeEventListener('message',receive);socket.removeEventListener('close',closed)};
 const closed=()=>{cleanup();reject(Error('Home Assistant disconnected. Check the command status before retrying.'))};
 const receive=event=>{let result;try{result=JSON.parse(event.data)}catch{return}if(result.id!==id||result.type!=='result')return;cleanup();result.success?resolve():reject(Error(result.error?.message||'Home Assistant rejected the request.'))};
 socket.addEventListener('message',receive);socket.addEventListener('close',closed);timer=setTimeout(()=>{cleanup();reject(Error('Home Assistant did not acknowledge the request.'))},15000);
 socket.send(JSON.stringify({id,type:'fire_event',event_type:'samsung_food_command',event_data:data}));
})}
async function send(action,extra={}){
 if(busy)return;
 if(!controls().version||!controls().commands_connected){notice='Samsung Food controls are not connected yet. The bridge update must finish first.';render();return}
 const command={id:crypto.randomUUID(),created:Date.now()/1000,action,week:selectedWeek,revision:weeks()[selectedWeek]?.revision,...extra};
 pending=command.id;busy=true;review=null;notice='Saving in Samsung Food…';render();
 try{await request(command)}catch(error){busy=false;pending='';notice=error.message;render();return}
 const started=Date.now();
 const poll=setInterval(()=>{
  const result=controls().results?.[command.id];
  if(result&&['saved','uncertain'].includes(result.status)){
   clearInterval(poll);busy=false;pending='';notice=result.message||result.status;if(result.status==='saved'&&action==='add_meal')choices.delete(extra.date);render();renderCompact();
  }else if(Date.now()-started>240000){clearInterval(poll);busy=false;pending='';notice='The result is not confirmed yet. Refresh and check Samsung Food before trying again.';render()}
 },700);
}
function link(parent,text,path){const a=el('a',text);a.href=path.startsWith('https:')?path:origin+path;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);return a}
function open(){selectedWeek=selectedWeek||preferredWeek(controls().settings);review=null;showSettings=false;render();if(!dialog.open)dialog.showModal()}
window.openSamsungMealPlanner=open;
function renderCompact(){
 if(!target)return;
 const current=state(mealEntity);if(!current)return;
 const week=preferredWeek(controls().settings),thisWeek=monday(localDate()),data=weeks()[week]||(week===thisWeek?current.attributes:null);
 const sync=mealWeekSync(data,current.state),period=week===thisWeek?'This week':'Next week';
 target.replaceChildren();target.title=label(week)+' – '+label(shift(week,6))+' · '+(sync.message||'Tap a day to plan meals');
 const title=target.parentElement.querySelector('.family-title');
 if(title)title.replaceChildren(el('span','🍽 Weekly meal plan'),el('span',period+(sync.cached?' · cached':'')));
 for(let i=0;i<7;i++){
  const date=shift(week,i),entry=data?.days?.find(d=>d.date===date),row=button('',()=>{selectedWeek=week;open()});row.className='family-meal-day';
  row.append(el('strong',new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})),el('span',entry?entry.meals.map(m=>m.title).join(' · ')||'Not planned':'Not synced'));
  row.setAttribute('aria-label','Plan meals for '+label(date));target.append(row);
 }
}
window.renderSamsungFoodMeals=(mount,week)=>{target=mount;calendarWeek=week;if(!state(mealEntity))return false;renderCompact();return true};
function render(){
 if(!selectedWeek)selectedWeek=preferredWeek(controls().settings);
 dialog.replaceChildren();const head=el('header'),titles=el('div');titles.append(el('h2','Plan your meals'),el('p','Saved recipes → weekly plan → shopping list'));head.append(titles,button('Close',()=>dialog.close()));dialog.append(head);
 const nav=el('nav',undefined,'sf-toolbar');
 for(const [text,week] of [['This week',monday(localDate())],['Next week',shift(monday(localDate()),7)]]){const b=button(text,()=>{selectedWeek=week;review=null;showSettings=false;notice='';render()});b.setAttribute('aria-pressed',String(selectedWeek===week));b.disabled=busy;nav.append(b)}
 const refresh=button('Refresh from Samsung Food',()=>send('refresh'));refresh.disabled=busy;nav.append(refresh);
 const settings=button('Weekly reset',()=>{showSettings=!showSettings;draftSettings={enabled:true,weekday:6,time:'13:00',...controls().settings};render()});settings.disabled=busy;nav.append(settings);dialog.append(nav);
 if(showSettings){renderSettings();return}
 const week=weeks()[selectedWeek],catalogue=recipes(),sync=mealWeekSync(week,state(mealEntity)?.state);
 const summary=el('div',undefined,'sf-week-summary');summary.append(el('strong',label(selectedWeek)+' – '+label(shift(selectedWeek,6))));
 if(week?.last_success)summary.append(el('small','Synced '+new Date(week.last_success).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})));
 dialog.append(summary);
 if(!connected()||!controls().version||!week?.days?.length){
  dialog.append(el('p',!connected()?'Connect Home Assistant to plan meals.':!controls().version?'Two-way controls are waiting for the Home Assistant bridge update.':sync.message));
  const links=el('div',undefined,'sf-toolbar');link(links,'Open in Samsung Food','/meal-plan');dialog.append(links);
 }
 else{
  if(sync.message)dialog.append(el('p',sync.message,'sf-status'));
  const search=el('input');search.type='search';search.placeholder='Filter your saved recipes';search.setAttribute('aria-label','Filter saved recipes');search.value=query;search.oninput=()=>{query=search.value;renderDays(list,week,catalogue)};dialog.append(search);
  const list=el('section',undefined,'sf-days');dialog.append(list);renderDays(list,week,catalogue);
  const actions=el('footer',undefined,'sf-toolbar');
  const generate=button('Generate shopping list',()=>{review={action:'generate'};render()});generate.className='sf-primary';generate.disabled=busy||!week.days?.some(d=>d.meals.length);actions.append(generate);
  const clear=button('Clear this week',()=>{review={action:'clear_week'};render()});clear.disabled=busy||!week.days?.some(d=>d.meals.length);actions.append(clear);link(actions,'Open in Samsung Food','/meal-plan');dialog.append(actions);
  if(review){const box=el('section',undefined,'sf-review');
   box.append(el('strong',review.action==='generate'?'Create a shopping list for this week?':review.action==='clear_day'?'Clear all meals for '+label(review.date)+'?':'Clear all meals for '+label(selectedWeek)+' – '+label(shift(selectedWeek,6))+'?'));
   box.append(el('p',review.action==='generate'?'Samsung Food will use the recipe servings to create a new dated list. Existing shopping lists are preserved. Repeating the same submission reopens its existing list.':'This changes Samsung Food too. Saved recipes and shopping lists are kept.'));
   box.append(button(review.action==='generate'?'Confirm and generate':'Confirm clear',()=>send(review.action,review.date?{date:review.date}:{})),button('Cancel',()=>{review=null;render()}));dialog.append(box);
  }
 }
 const status=el('p',notice||controls().reset_error||'Choose a recipe and meal type, then Add. Each change is saved to Samsung Food.','sf-status');status.setAttribute('role','status');dialog.append(status);
}
function renderDays(list,week,catalogue){
 list.replaceChildren();
 for(const day of week.days||[]){
  const row=el('article',undefined,'sf-day'),heading=el('div',undefined,'sf-day-title');heading.append(el('h3',label(day.date)));
  const clear=button('Clear day',()=>{review={action:'clear_day',date:day.date};render()});clear.setAttribute('aria-label','Clear meals for '+label(day.date));clear.disabled=busy||!day.meals.length;heading.append(clear);row.append(heading);
  const meals=el('div',undefined,'sf-existing');if(day.meals.length)for(const meal of day.meals)meals.append(el('p',meal.slot+' · '+meal.title));else meals.append(el('p','Not planned'));row.append(meals);
  const edit=el('div',undefined,'sf-day-edit'),choice=choices.get(day.date)||{recipe:'',slot:'Dinner'};
  const select=el('select');select.setAttribute('aria-label','Saved recipe for '+label(day.date));select.append(new Option('Choose saved recipe…',''));
  for(const recipe of catalogue.filter(r=>r.title.toLowerCase().includes(query.toLowerCase())||r.id===choice.recipe)){
   const copies=catalogue.filter(r=>r.title===recipe.title),number=copies.findIndex(r=>r.id===recipe.id)+1;
   select.append(new Option(recipe.title+(copies.length>1?' · saved copy '+number:''),recipe.id));
  }
  select.value=choice.recipe;select.disabled=busy;select.onchange=()=>{choice.recipe=select.value;choices.set(day.date,choice);add.disabled=busy||!choice.recipe};
  const type=el('select');type.setAttribute('aria-label','Meal type for '+label(day.date));for(const slot of ['Dinner','Lunch','Breakfast','Snacks'])type.append(new Option(slot,slot));type.value=choice.slot;type.disabled=busy;type.onchange=()=>{choice.slot=type.value;choices.set(day.date,choice)};
  const add=button('Add',()=>send('add_meal',{date:day.date,recipe_id:choice.recipe,slot:choice.slot}));add.disabled=busy||!choice.recipe;add.setAttribute('aria-label','Add meal to '+label(day.date));edit.append(select,type,add);row.append(edit);list.append(row);
 }
}
function renderSettings(){
 const box=el('section',undefined,'sf-reset');box.append(el('h3','Automatic weekly reset'),el('p','Clear the finishing week’s scheduled meals and show next week for planning. Saved recipes, next week’s meals and all shopping lists are kept. Times use Europe/London, including daylight-saving changes.'));
 const enabled=el('input');enabled.type='checkbox';enabled.checked=draftSettings.enabled;enabled.onchange=()=>draftSettings.enabled=enabled.checked;const enabledLabel=el('label','Enable weekly reset ');enabledLabel.append(enabled);box.append(enabledLabel);
 const day=el('select');day.setAttribute('aria-label','Weekly reset day');['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].forEach((name,i)=>day.append(new Option(name,String(i))));day.value=String(draftSettings.weekday);day.onchange=()=>draftSettings.weekday=Number(day.value);
 const time=el('input');time.type='time';time.value=draftSettings.time;time.setAttribute('aria-label','Weekly reset time');time.onchange=()=>draftSettings.time=time.value;box.append(day,time);
 const save=button('Save reset schedule',()=>{if(!/^\d{2}:\d{2}$/.test(draftSettings.time)){notice='Choose a valid time.';render();return}send('settings',{settings:{...draftSettings}})});save.disabled=busy;box.append(save);
 box.append(el('p','Changing a schedule to a time already passed this week can run the reset shortly after saving.'));
 if(controls().last_reset)box.append(el('small','Last reset week: '+controls().last_reset));box.append(el('p',notice,'sf-status'));dialog.append(box);
}
function update(){
 const signature=JSON.stringify([connected(),state(mealEntity)?.state,state(mealEntity)?.attributes,controls(),state('sensor.samsung_food_saved_recipes')?.attributes?.last_success]);
 if(signature===lastSignature)return;lastSignature=signature;renderCompact();if(dialog.open&&!showSettings)render();
}
window.addEventListener('home-states-updated',update);setInterval(renderCompact,60000);
const style=el('style');style.textContent=`
.sf-planner{box-sizing:border-box;width:min(1100px,96vw);height:94dvh;max-height:94dvh;padding:16px;background:#172b3e;color:#edf5ff;border:1px solid #68839b;border-radius:18px;font:14px/1.35 system-ui;overflow:hidden}
.sf-planner[open]{display:flex;flex-direction:column;gap:10px}.sf-planner::backdrop{background:#050b17cc}
.sf-planner header,.sf-week-summary,.sf-day-title{display:flex;justify-content:space-between;align-items:center;gap:10px;flex:none}.sf-planner h2,.sf-planner h3,.sf-planner p{margin:0}.sf-planner h2{font-size:25px}.sf-planner header p,.sf-week-summary small,.sf-status{color:#bcd0e2;font-size:12px}
.sf-planner button,.sf-planner select,.sf-planner input,.sf-planner a{box-sizing:border-box;min-height:36px;border:1px solid #64829a;border-radius:8px;background:#233e55;color:#edf5ff;padding:7px 10px;font:inherit;text-decoration:none}.sf-planner button,.sf-planner a{cursor:pointer}.sf-planner button:disabled{opacity:.45;cursor:default}.sf-planner button[aria-pressed=true],.sf-planner .sf-primary{background:#2c6054;border-color:#85c5ac}.sf-planner :focus-visible{outline:3px solid #b5d7f7;outline-offset:1px}
.sf-toolbar{display:flex;gap:6px;flex-wrap:wrap;flex:none}.sf-days{overflow:auto;min-height:0;flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start}.sf-day{padding:10px;border:1px solid #3d5d75;border-radius:10px;background:#1c3349}.sf-day h3{font-size:16px}.sf-day-title button{font-size:12px;padding:4px 7px;min-height:28px}.sf-existing{margin:7px 0;min-height:20px}.sf-existing p{font-size:13px;overflow-wrap:anywhere}.sf-day-edit{display:grid;grid-template-columns:minmax(0,1fr) 110px auto;gap:5px}.sf-day-edit select{min-width:0;font-size:12px;padding:5px}.sf-review{flex:none;background:#30483f;border:1px solid #91bea2;border-radius:10px;padding:10px}.sf-review p{margin:6px 0}.sf-review button{margin-right:8px}.sf-status{flex:none;max-height:60px;overflow:auto}.sf-reset{overflow:auto;display:flex;flex-direction:column;gap:15px}.sf-reset label{display:flex;align-items:center;gap:12px}.sf-reset input[type=checkbox]{width:24px}.sf-reset select,.sf-reset input[type=time]{max-width:300px}
@media(orientation:portrait){.sf-days{grid-template-columns:1fr}.sf-planner{padding:12px}.sf-planner h2{font-size:22px}.sf-toolbar button,.sf-toolbar a{font-size:12px}.sf-week-summary{align-items:flex-start;flex-direction:column;gap:3px}}
@media(max-height:550px){.sf-planner{padding:9px;gap:6px}.sf-planner h2{font-size:19px}.sf-planner header p{display:none}.sf-planner button,.sf-planner select,.sf-planner input,.sf-planner a{min-height:29px;padding:4px 7px;font-size:12px}.sf-day{padding:7px}.sf-day-edit{grid-template-columns:minmax(0,1fr) 85px auto}.sf-review p{font-size:11px}}
`;document.head.append(style);
})();
