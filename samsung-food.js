/* Read-only consumer of the private Home Assistant bridge; no Samsung credentials here. */
(function(){
'use strict';
const entity='sensor.samsung_food_meal_plan',origin='https://app.samsungfood.com';
function snapshot(state,now=Date.now()){
 const a=state?.attributes||{},stamp=Date.parse(a.last_success||'');
 const days=Array.isArray(a.days)?a.days.filter(d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&Array.isArray(d.meals)).map(d=>({date:d.date,meals:d.meals.filter(m=>m&&typeof m.title==='string'&&typeof m.slot==='string').map(m=>({title:m.title.slice(0,300),slot:m.slot.slice(0,40)}))})):[];
 return {days,stamp,stale:state?.state!=='ok'||!Number.isFinite(stamp)||now-stamp>35*60000,status:state?.state||'not_connected'};
}
if(typeof module!=='undefined')module.exports={snapshot};
if(typeof document==='undefined')return;
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
const dialog=el('dialog');dialog.setAttribute('aria-label','Samsung Food meal plan');
dialog.style.cssText='box-sizing:border-box;width:min(700px,94vw);max-height:88dvh;overflow:auto;background:#172b3e;color:#e9f1ff;border:1px solid #617a94;border-radius:18px;padding:18px';
document.body.append(dialog);
function show(data){
 dialog.replaceChildren();const close=el('button','Close');close.onclick=()=>dialog.close();close.style.cssText='float:right;background:#233b55;color:#edf5ff;border:1px solid #637e99;border-radius:8px;padding:6px 10px';dialog.append(close,el('h2','Samsung Food'));
 dialog.append(el('p',data.stale?'Sync needs attention — showing the last successful read.':'Read-only sync · '+new Date(data.stamp).toLocaleString('en-GB')));
 if(data.status==='login_required')dialog.append(el('p','Sign-in is needed in the Home Assistant Samsung Food add-on.'));
 for(const day of data.days){dialog.append(el('h3',new Date(day.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})));for(const meal of day.meals)dialog.append(el('p',meal.slot+' · '+meal.title));if(!day.meals.length)dialog.append(el('p','Not planned'));}
 dialog.append(el('p','Edit meals in Samsung Food for now. Changes appear after the next successful sync.'));
 for(const [label,path] of [['Open meal planner','/meal-plan'],['Shopping list / Sainsbury’s','/shopping-list']]){const a=el('a',label);a.href=origin+path;a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='display:inline-block;color:#a8caff;margin:8px 16px 8px 0';dialog.append(a);}
 if(!dialog.open)dialog.showModal();
}
let mealTarget=null,mealWeek='',mealSignature='';
window.renderSamsungFoodMeals=(target,week)=>{
 mealTarget=target;mealWeek=week;
 const state=typeof haStates!=='undefined'?haStates[entity]:null;if(!state)return false;
 const data=snapshot(state);mealSignature=JSON.stringify(data);target.replaceChildren();
 target.title=data.stale?'Samsung Food sync needs attention':'Samsung Food — last synced '+new Date(data.stamp).toLocaleString('en-GB');
 for(let i=0;i<7;i++){const date=new Date(week+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+i);const day=date.toISOString().slice(0,10),entry=data.days.find(d=>d.date===day);const row=el('button');row.className='family-meal-day';row.type='button';row.onclick=()=>show(data);const label=entry?entry.meals.map(m=>m.title).join(' · ')||'Not planned':'Not synced';row.append(el('strong',date.toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})),el('span',(data.stale?'⚠ ':'')+label));row.setAttribute('aria-label',day+': '+label+(data.stale?' — stale data':''));target.append(row);}
 return true;
};
function refreshMeals(){
 if(!mealTarget)return;
 const state=typeof haStates!=='undefined'?haStates[entity]:null;
 if(JSON.stringify(snapshot(state))===mealSignature)return;
 if(state)window.renderSamsungFoodMeals(mealTarget,mealWeek);
 else window.renderCalendar?.();
}
window.addEventListener('home-states-updated',refreshMeals);
setInterval(()=>{if(!document.hidden)refreshMeals()},60000);
})();
