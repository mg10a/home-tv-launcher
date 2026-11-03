/* Foreground refresh policy, deliberately separate from HA's server-side schedule. */
'use strict';
window.kiaRefreshDecision=function({now,hour,visible,ready,report,battery,record,buttonTime}){
 if(!ready||!visible)return 'Waiting for an open, connected dashboard';
 if(hour<7||hour>=22)return 'Paused overnight · 22:00–07:00';
 if(!Number.isFinite(battery)||battery<40)return 'Paused · 12V battery low or unavailable';
 if(record.failures>=2)return 'Paused after two failed requests today';
 if(record.count>=8)return 'Daily limit reached · 8 requests';
 const latest=Math.max(record.last||0,Number.isFinite(buttonTime)?buttonTime:0);
 if(now-latest<3600000)return 'Hourly request limit';
 if(Number.isFinite(report)&&now-report<3600000)return 'Vehicle report is under an hour old';
 return null;
};
window.createKiaRefresh=function({snapshot,send,onChange}){
 let running=false,status='Hourly while dashboard open',timer;
 const load=key=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}};
 const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
 function context(){const s=snapshot(),now=Date.now(),parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),part=k=>parts.find(x=>x.type===k)?.value,day=part('year')+'-'+part('month')+'-'+part('day'),key='kia-refresh-v1:'+s.deviceId,raw=load(key),record=raw.day===day?{last:0,count:0,failures:0,...raw}:{day,last:raw.last||0,count:0,failures:0,disabled:raw.disabled||false};return {s,now,hour:Number(part('hour')),key,record}}
 async function attempt(){if(running)return;running=true;try{const {s,now,hour,key,record}=context();if(record.disabled){status='Automatic refresh paused';return}const reason=window.kiaRefreshDecision({now,hour,visible:!document.hidden,ready:s.ready,report:Date.parse(s.reportAt),battery:s.battery,record,buttonTime:Date.parse(s.buttonAt)});if(reason){status=reason;return}record.last=now;record.count++;if(!save(key,record)){status='Paused · refresh limit could not be saved';return}status='Requesting a fresh vehicle report…';onChange();try{await send(s);status='Refresh requested · waiting for vehicle data'}catch(e){record.failures++;save(key,record);status='Refresh failed: '+e.message+(record.failures>=2?' · paused for today':' · next attempt no sooner than one hour')}}finally{running=false;onChange()}}
 async function check(){if(navigator.locks?.request){await navigator.locks.request('kia-dashboard-refresh',{ifAvailable:true},async lock=>{if(lock)await attempt()})}else await attempt()}
 function toggle(){const {key,record}=context();record.disabled=!record.disabled;save(key,record);status=record.disabled?'Automatic refresh paused':'Hourly while dashboard open';onChange()}
 const api={check,toggle,state:()=>({disabled:!!context().record.disabled,status,running})};timer=setInterval(check,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});return api;
};
