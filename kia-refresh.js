/* Foreground refresh policy, deliberately separate from HA's server-side schedule. */
'use strict';
window.kiaRefreshDecision=function({now,hour,visible,ready,report,battery,record,buttonTime,parkedUnsecured}){
 if(!ready||!visible)return 'Waiting for an open, connected dashboard';
 if(hour<7||hour>=22)return 'Paused overnight · 22:00–07:00';
 if(!Number.isFinite(battery)||battery<40)return 'Paused · 12V battery low or unavailable';
 if(record.failures>=2)return 'Paused after two failed requests today';
 if(record.count>=8)return 'Daily limit reached · 8 requests';
 const latest=Math.max(record.last||0,Number.isFinite(buttonTime)?buttonTime:0);
 if(now-latest<3600000)return 'Hourly request limit';
 const maxAge=parkedUnsecured?600000:3600000;
 if(Number.isFinite(report)&&now-report<maxAge)return 'Waiting for a newer vehicle report';
 return null;
};
window.createKiaRefresh=function({snapshot,send,onChange}){
 let running=false,status='While dashboard is open';
 const load=key=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}};
 const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
 function context(){const s=snapshot(),now=Date.now(),parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),part=k=>parts.find(x=>x.type===k)?.value,day=part('year')+'-'+part('month')+'-'+part('day'),key='kia-refresh-v1:'+s.deviceId,raw=load(key),record=raw.day===day?{last:0,count:0,failures:0,...raw}:{day,last:raw.last||0,count:0,failures:0,disabled:raw.disabled||false};return {s,now,hour:Number(part('hour')),key,record}}
 function wakeReason({s,now,hour,record}){
  const checkedCloud=!record.cacheFailed&&now-(record.lastCache||0)<300000;
  return window.kiaRefreshDecision({now,hour,visible:!document.hidden,
   ready:s.ready&&s.wakeAvailable!==false,report:Date.parse(s.reportAt),
   battery:s.battery,record,buttonTime:Date.parse(s.buttonAt),
   parkedUnsecured:s.cacheAvailable&&s.parkedUnsecured&&checkedCloud});
 }
 async function attempt(){
  if(running)return;
  running=true;
  try{
   let current=context();
   const {s,now,hour,key,record}=current;
   if(record.disabled){status='Automatic refresh paused';return}
   if(!s.ready||document.hidden){status='Waiting for an open, connected dashboard';return}
   if(hour<7||hour>=22){status='Paused overnight · 22:00–07:00';return}

   const reason=wakeReason(current);
   const recentReport=now-Date.parse(s.reportAt)<3600000;
   const cacheInterval=recentReport&&!record.cacheFailed?120000:600000;
   let cacheStatus;
   // Active cars get faster cloud checks. A parked car checks the cloud first
   // whenever the existing wake policy would otherwise ask the car directly.
   if(s.cacheAvailable&&(s.active||!reason)&&now-(record.lastCache||0)>=cacheInterval){
    record.lastCache=now;
    if(!save(key,record)){status='Paused · refresh limit could not be saved';return}
    try{
     await send(s,'cache');
     cacheStatus='Kia cloud checked · showing latest available data';
     save(key,{...load(key),cacheFailed:false});
    }catch(e){
     cacheStatus='Kia cloud check failed: '+e.message;
     save(key,{...load(key),cacheFailed:true});
    }
    current=context();
    if(current.key!==key||current.s.socket!==s.socket||current.record.disabled)return;
   }

   const wait=wakeReason(current);
   if(wait){status=cacheStatus||wait;return}
   const next=current.record;
   next.last=current.now;
   next.count++;
   if(!save(key,next)){status='Paused · refresh limit could not be saved';return}
   status='Requesting a fresh vehicle report…';
   onChange();
   try{
    await send(current.s,'wake');
    status='Refresh requested · showing latest available vehicle data';
   }catch(e){
    const latest=load(key);
    latest.failures=(latest.failures||0)+1;
    save(key,latest);
    status='Refresh failed: '+e.message+(latest.failures>=2?' · paused for today':' · next attempt no sooner than one hour');
   }
  }finally{running=false;onChange()}
 }
 async function check(){if(navigator.locks?.request){await navigator.locks.request('kia-dashboard-refresh',{ifAvailable:true},async lock=>{if(lock)await attempt()})}else await attempt()}
 function toggle(){const {key,record}=context();record.disabled=!record.disabled;save(key,record);status=record.disabled?'Automatic refresh paused':'While dashboard is open';onChange()}
 const api={check,toggle,state:()=>({disabled:!!context().record.disabled,status,running})};setInterval(check,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});return api;
};
