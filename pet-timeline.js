/* Read-only daily presence timelines, using the same Recorder history as the activity table. */
(() => {
'use strict';
const zone='Europe/London',hour=3600000,lookback=7;
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const hourFormat=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'});
const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const dayFormat=new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'short',day:'numeric',month:'short'});
const ticks=[0,6,12,18,24];
const names={maia:'Maia',solo:'Solo'};
const labels={on:'Inside',off:'Outside',unknown:'No record'};
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*24*hour).toISOString().slice(0,10);
function atHour(day,h){
 if(h===24)return atHour(shift(day,1),0);
 const wall=Date.parse(day+'T'+String(h).padStart(2,'0')+':00:00Z');
 return wall-(Number(hourFormat.format(wall))-h)*hour;
}
function historyStart(now){return atHour(shift(dateFormat.format(now),-lookback),0)}
function intervals(points,start,end){
 let state='unknown',from=start;
 const parts=[];
 function add(until){
  if(until<=from)return;
  if(parts.at(-1)?.state===state)parts.at(-1).end=until;
  else parts.push({state,start:from,end:until});
 }
 for(const point of points){
  if(point.t>=end)break;
  if(point.t>start){add(point.t);from=point.t}
  state=point.state==='on'||point.state==='off'?point.state:'unknown';
 }
 add(end);
 return parts;
}
function timelineDay(day,{now,history=[],through=0,live=[],current=null}){
 const start=atHour(day,0),end=atHour(day,24),until=Math.min(now,end);
 const points=history.filter(p=>p.t<=through);
 const lastRecorded=points.at(-1);
 if(through>0&&through<until)points.push({state:'unknown',t:through});
 if(day===dateFormat.format(now)&&current){
  const changed=Date.parse(current.last_changed||'');
  points.push(...live.filter(p=>p.t>through));
  if(Number.isFinite(changed)){
   if(changed>(lastRecorded?.t??-Infinity))points.push({state:current.state,t:changed});
   if(changed<=through)points.push({state:current.state,t:through});
  }
 }
 points.sort((a,b)=>a.t-b.t);
 return {start,end,parts:intervals(points,start,until)};
}
if(typeof module!=='undefined')module.exports={atHour,historyStart,timelineDay};
if(typeof document==='undefined')return;

const portraits=document.querySelector('.pet-portraits');
if(!portraits)return;
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node};
const panel=el('section','pet-timeline');
panel.setAttribute('aria-label','Daily cat activity');
const head=el('div','pet-timeline-head');
const button=(text,action,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=action;return b};
const trigger=button('Today ▾',openPicker);
trigger.disabled=true;
trigger.setAttribute('aria-haspopup','dialog');
trigger.setAttribute('aria-expanded','false');
trigger.setAttribute('aria-controls','petDayPicker');
head.append(el('strong','','Daily timeline'),trigger);
const picker=el('dialog','pet-day-picker');
picker.id='petDayPicker';
picker.setAttribute('aria-label','Choose timeline day');
const pickerHead=el('header');
const close=button('×',()=>picker.close(),'halo-close');
close.setAttribute('aria-label','Close day picker');
pickerHead.append(el('strong','','Choose timeline day'),close);
const options=el('div','room-picker-options');
picker.append(pickerHead,options);
document.body.append(picker);
const chart=el('div','pet-timeline-chart');
const legend=el('div','pet-timeline-legend');
for(const state of Object.keys(labels))legend.append(el('span','pet-timeline-key is-'+state,labels[state]));
const detail=el('p','pet-timeline-detail');
detail.setAttribute('aria-live','polite');
panel.append(head,chart,legend,detail);
portraits.insertBefore(panel,document.getElementById('petPhotoStatus'));
let selection='',latest,previousDay='',signature='',selectedDetail='';
const dayLabel=(day,today)=>day===today?'Today':dayFormat.format(atHour(day,12));
function openPicker(){
 const dates=Array.from({length:lookback+1},(_,i)=>shift(previousDay,-i));
 options.replaceChildren(...dates.map(day=>{
  const option=button(dayLabel(day,previousDay),()=>{
   selection=day===previousDay?'':day;
   selectedDetail='';
   picker.close();
   render(latest);
  });
  option.setAttribute('aria-pressed',String(day===(selection||previousDay)));
  return option;
 }));
 picker.showModal();
 trigger.setAttribute('aria-expanded','true');
 options.querySelector('[aria-pressed="true"]').focus();
}
picker.addEventListener('close',()=>{
 trigger.setAttribute('aria-expanded','false');
 if(trigger.getClientRects().length)trigger.focus({preventScroll:true});
});
picker.addEventListener('keydown',event=>{
 if(event.key==='BrowserBack'){event.preventDefault();picker.close();return}
 const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-2,ArrowDown:2}[event.key];
 const buttons=[...options.children],index=buttons.indexOf(event.target);
 if(!step||index<0)return;
 event.preventDefault();
 buttons[Math.max(0,Math.min(buttons.length-1,index+step))].focus();
});
function render(data){
 latest=data;
 const now=data.now,today=dateFormat.format(now);
 if(previousDay!==today){
  selectedDetail='';
  previousDay=today;
  if(selection<shift(today,-lookback)||selection>=today)selection='';
  if(picker.open)picker.close();
 }
 const day=selection||today,label=dayLabel(day,today);
 trigger.disabled=false;
 trigger.textContent=label+' ▾';
 trigger.setAttribute('aria-label','Cat activity day: '+label);
 const week=Object.entries(names).map(([key,name])=>({name,...timelineDay(day,{
  now,history:data.history[key],through:data.through,live:data.live[key],current:data.current[key]
 })}));
 const next=JSON.stringify([day,week,data.loading]);
 if(next===signature)return;
 signature=next;
 const {start,end}=week[0],position=t=>(t-start)/(end-start)*100;
 const displayTime=t=>t===end?'24:00':timeFormat.format(t);
 chart.replaceChildren();
 for(const {name,parts} of week){
  const track=el('div','pet-timeline-track');
  track.setAttribute('role','img');
  const descriptions=parts.map(part=>labels[part.state]+' '+displayTime(part.start)+'–'+displayTime(part.end));
  track.setAttribute('aria-label',name+': '+(descriptions.join(', ')||'No record'));
  track.tabIndex=0;
  parts.forEach((part,i)=>{
   const segment=el('span','pet-timeline-segment is-'+part.state);
   segment.style.left=position(part.start)+'%';
   segment.style.width=(position(part.end)-position(part.start))+'%';
   segment.title=descriptions[i];
   segment.onclick=()=>{detail.textContent=selectedDetail=name+' · '+descriptions[i]};
   track.append(segment);
  });
  chart.append(el('span','pet-timeline-cat',name),track);
 }
 const axis=el('div','pet-timeline-axis');
 axis.setAttribute('aria-label','Hours of the day');
 for(const h of ticks){
  const tick=el('span','',String(h).padStart(2,'0'));
  tick.style.left=position(atHour(day,h))+'%';
  axis.append(tick);
 }
 chart.append(axis);
 const recorded=week.some(cat=>cat.parts.some(p=>p.state!=='unknown'));
 detail.textContent=selectedDetail||(recorded?'Tap a section for its time range.':data.loading?'Loading Home Assistant history…':'No recorded activity for this day.');
}
window.petTimeline={render,historyStart,reset:()=>{if(picker.open)picker.close();selection='';signature='';selectedDetail=''}};
})();
