/* Live Home Connect controls. Selecting a recipe never starts a programme. */
'use strict';
window.createCoffeePanel=function({dialog,request,states,connected}){
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b};
const usable=s=>s&&!['unknown','unavailable',''].includes(s.state);
const label=s=>s.attributes?.friendly_name||s.entity_id;
const match=(s,re)=>re.test(s.entity_id+' '+label(s));
const pretty=v=>String(v||'').replace(/^consumer_products_coffee_maker_(?:program_(?:beverage|coffee_world)|enum_type_(?:bean_amount|coffee_temperature|hot_water_temperature))_/, '').replace(/_/g,' ').replace(/(\d+) c$/i,'$1°C').replace(/^coffee$/i,'Coffee / crème').replace(/^./,c=>c.toUpperCase());
let tab='drink',page=0,picker=null,busy=false,message='',entities=[],device=null,services=null,loadedSocket=null,initializing=false,confirmation=null,brewSent=false,sawRunning=false;
const all=()=>Object.values(states()).filter(s=>entities.length?entities.some(e=>e.entity_id===s.entity_id):/coffee|coffeemaker|eq900|eq700/i.test(s.entity_id+' '+label(s)));
const find=(re,domain)=>all().find(s=>(!domain||s.entity_id.startsWith(domain+'.'))&&match(s,re));
const selected=()=>find(/selected.?program/i,'select');
const running=()=>/run|pause|action.?required/i.test(find(/operation.?state/i)?.state||'');
const power=()=>find(/\bpower\b|_power$/i,'switch');
const remote=()=>find(/remote.?start/i);
const options=()=>all().filter(s=>['select','number','switch'].includes(s.entity_id.split('.')[0])&&match(s,/bean.?amount|fill.?quantity|coffee.?temperature|hot.?water.?temperature|multiple.?beverages|coffee.?milk.?ratio|flow.?rate|bean.?container.?selection/i));
const optionLabel=s=>match(s,/bean.?amount/i)?'Strength':match(s,/fill.?quantity/i)?'Size':label(s).replace(/^Coffee Maker /i,'');
const editable=()=>connected()&&!busy&&!brewSent&&!running()&&power()?.state==='on';
const signature=()=>JSON.stringify([selected()?.state,...options().map(s=>[s.entity_id,s.state])]);
const canBrew=()=>editable()&&['ready','finished'].includes(find(/operation.?state/i)?.state)&&find(/child.?lock/i,'switch')?.state!=='on'&&remote()?.state==='on'&&usable(selected())&&device&&services?.home_connect?.start_selected_program;
const statusText=()=>!connected()?'Home Assistant disconnected':brewSent?'Brew requested · waiting for machine':running()?'Machine busy · '+pretty(find(/operation.?state/i)?.state):power()?.state!=='on'?'Switch the machine on to load drink options':remote()?.state!=='on'?'Enable remote start on the machine':'Choose a drink, then adjust its options';
async function init(){
 if(!connected()||!selected()||initializing||loadedSocket===haSocket)return;
 initializing=true;const socket=haSocket;
 try{const [registry,available]=await Promise.all([request({type:'config/entity_registry/list'}),request({type:'get_services'})]);if(socket!==haSocket)return;
 const seed=registry.find(e=>e.entity_id===selected()?.entity_id&&e.platform==='home_connect');device=seed?.device_id||null;entities=device?registry.filter(e=>e.device_id===device&&e.platform==='home_connect'):[];services=available;loadedSocket=socket;
 }catch(e){message=e.message}finally{initializing=false;render()}
}
let refreshPending=null,refreshTimer=null;
// Read HA's current state without waking, toggling or starting the machine.
// Never replace a newer push update with an older in-flight snapshot.
function refreshState(){
 if(!connected())return Promise.resolve();
 if(refreshPending)return refreshPending;
 const socket=haSocket,before=new Map(all().map(s=>[s.entity_id,{object:s,value:s.state,updated:s.last_updated}]));
 refreshPending=(async()=>{try{
  const result=await request({type:'get_states'});
  if(socket!==haSocket||!connected()||!Array.isArray(result))return;
  const current=states();let changed=false;
  for(const s of result){const old=before.get(s.entity_id),now=current[s.entity_id];
   if(old&&now===old.object&&now.state===old.value&&now.last_updated===old.updated){current[s.entity_id]=s;changed=true}
  }
  if(changed)window.dispatchEvent(new Event('home-states-updated'));
 }catch(_){/* The bounded command wait reports a missing confirmation. */}
 finally{refreshPending=null}})();
 return refreshPending;
}
async function command(domain,service,id,data={},expected){
 if(busy)return;busy=true;confirmation=null;picker=null;message='Sending…';render();
 try{await new Promise((resolve,reject)=>{
  let finished=false;
  const done=error=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(poll);window.removeEventListener('home-states-updated',check);error?reject(error):resolve()};
  const check=()=>{
   if(!connected()){done(Error('Home Assistant disconnected. Check the machine before trying again.'));return}
   const value=states()[id]?.state;
   if(expected!==undefined&&usable(states()[id])&&(value===expected||(domain==='number'&&Number(value)===Number(expected))))done();
  };
  const timer=setTimeout(()=>done(Error('Machine status not confirmed. Check the machine before trying again.')),20000);
  const poll=setInterval(()=>{check();if(!finished)refreshState()},3000);
  window.addEventListener('home-states-updated',check);
  // Send exactly once. Confirmation may arrive before the service reply.
  Promise.resolve().then(()=>request({type:'call_service',domain,service,...(id?{target:{entity_id:id}}:{}),service_data:data})).then(()=>{
   if(finished)return;
   if(expected===undefined){done();return}
   message='Command sent · waiting for machine status…';render();check();
   if(!finished)refreshState();
  },error=>{if(!finished){check();if(!finished)done(error)}});
 });message='Applied · confirmed by Home Assistant';
 }catch(e){message=e.message}finally{busy=false;render()}
}
function choose(s,title){picker={id:s.entity_id,title,page:0};render()}
function choiceView(body){const s=states()[picker.id],choices=s?.attributes?.options||[],head=node('div',null,'coffee-section-head');head.append(node('strong',picker.title),button('Back',()=>{picker=null;render()}));body.append(head);const list=node('div',null,'coffee-choices');for(const value of choices.slice(picker.page*6,picker.page*6+6)){const b=button(pretty(value),()=>{if(!editable())return;command('select','select_option',s.entity_id,{option:value},value)});b.disabled=!editable();b.setAttribute('aria-pressed',String(s.state===value));list.append(b)}body.append(list);pager(body,choices.length,6,picker.page,n=>{picker.page=n;render()})}
function pager(host,count,size,current,change){if(count<=size)return;const nav=node('div',null,'coffee-pager'),prev=button('‹',()=>change(current-1)),next=button('›',()=>change(current+1));prev.disabled=current===0;next.disabled=(current+1)*size>=count;prev.setAttribute('aria-label','Previous page');next.setAttribute('aria-label','Next page');nav.append(prev,node('span',`${current+1} / ${Math.ceil(count/size)}`),next);host.append(nav)}
function toggle(s,title){const b=button(usable(s)?pretty(s.state):'Unavailable',()=>{if(!connected()||busy||!usable(s))return;const next=s.state==='on'?'off':'on';command('switch','turn_'+next,s.entity_id,{},next)});b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(s?.state==='on'));b.disabled=!connected()||busy||!usable(s);return b}
function drink(body){
 const s=selected(),row=node('div',null,'coffee-recipe');row.append(node('small','YOUR DRINK'));const chooseDrink=button(usable(s)?pretty(s.state)+' ▾':'Choose drink ▾',()=>choose(s,'Choose your drink'));chooseDrink.disabled=!editable()||!s?.attributes?.options?.length;row.append(chooseDrink);body.append(row);
 const choices=options(),list=node('div',null,'coffee-options');page=Math.min(page,Math.max(0,Math.ceil(choices.length/4)-1));
 for(const item of choices.slice(page*4,page*4+4)){const field=node('div',null,'coffee-field'),title=optionLabel(item);field.append(node('span',title));
 if(item.entity_id.startsWith('select.')){const b=button(usable(item)?pretty(item.state)+' ▾':'Unavailable',()=>choose(item,title));b.disabled=!editable()||!usable(item)||!item.attributes?.options?.length;field.append(b)}
 else if(item.entity_id.startsWith('number.')){const a=item.attributes||{},valid=usable(item)&&Number.isFinite(Number(a.min))&&Number.isFinite(Number(a.max))&&Number(a.max)>=Number(a.min)&&Number(a.step)>0;const wrap=node('div',null,'coffee-size'),out=node('output',valid?item.state+' '+(a.unit_of_measurement||'mL'):'Unavailable');field.append(wrap);wrap.append(out);if(valid){const input=node('input');input.type='range';input.min=a.min;input.max=a.max;input.step=a.step;input.value=item.state;input.disabled=!editable();input.setAttribute('aria-label',title);input.oninput=()=>{out.textContent=input.value+' '+(a.unit_of_measurement||'mL')};input.onchange=()=>{if(editable())command('number','set_value',item.entity_id,{value:Number(input.value)},String(Number(input.value)))};wrap.append(input,node('small',`${a.min}–${a.max} ${a.unit_of_measurement||'mL'}`))}}
 else{const b=toggle(item,title);b.disabled=b.disabled||!editable();field.append(b)}list.append(field)}body.append(list);pager(body,choices.length,4,page,n=>{page=n;render()});
 if(!choices.length)body.append(node('p','Drink options will appear when reported by the machine.','coffee-note'));
}
function settings(body){const list=node('div',null,'coffee-options');for(const [re,title] of [[/\bpower\b|_power$/i,'Power'],[/cup.?warmer/i,'Cup warmer'],[/child.?lock/i,'Child lock']]){const s=find(re,'switch'),row=node('div',null,'coffee-field');row.append(node('span',title),toggle(s,title));list.append(row)}body.append(list);if(brewSent&&!running()&&!busy)body.append(button('Machine checked · allow another brew',()=>{brewSent=false;sawRunning=false;message='Ready for a new drink review';render()}));const data=[find(/operation.?state/i),remote(),find(/programme?.?progress/i)].filter(Boolean);body.append(node('p',data.map(s=>label(s).replace(/^Coffee Maker /,'')+': '+(usable(s)?pretty(s.state):'Unavailable')).join(' · '),'coffee-note'))}
const carePattern=/water.?tank.?empty|bean.?container.?empty|drip.?tray.?full|descal|clean|milk.?tank.?cool/i;
function care(body){const list=node('div',null,'coffee-care-list'),data=all().filter(s=>match(s,carePattern)&&['event','binary_sensor','sensor'].includes(s.entity_id.split('.')[0]));page=Math.min(page,Math.max(0,Math.ceil(data.length/4)-1));
 for(const s of data.slice(page*4,page*4+4)){const row=node('div',null,'coffee-field');let text='Not reported';if(usable(s)){if(s.entity_id.startsWith('event.')){const date=new Date(s.state);text=Number.isNaN(+date)?'Last event: '+pretty(s.attributes?.event_type||s.state):'Last reported '+date.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}else text=s.state==='on'?'Attention needed':s.state==='off'?'Not currently reported':pretty(s.state)}row.append(node('span',label(s).replace(/^Coffee Maker /i,'')),node('strong',text));row.classList.toggle('needs-attention',s.state==='on');list.append(row)}body.append(list);pager(body,data.length,4,page,n=>{page=n;render()});
 const disabled=entities.filter(e=>e.disabled_by&&carePattern.test(e.entity_id+' '+(e.original_name||'')));
 if(disabled.length){const enable=button(`Enable ${disabled.length} status alerts`,async()=>{if(busy)return;busy=true;message='Enabling status alerts…';render();try{for(const e of disabled){await request({type:'config/entity_registry/update',entity_id:e.entity_id,disabled_by:null});e.disabled_by=null}message='Alerts enabled. HA may take a moment to add them.'}catch(e){message=e.message}finally{busy=false;render()}});enable.disabled=busy||!connected();body.append(enable)}
 body.append(node('p','Water level in mL is not exposed. Alerts show what the machine reports; dated events are history, not an all-clear check.','coffee-note'));if(!data.length)body.prepend(node('p','No maintenance readings available yet.'));
}
function review(body){body.append(node('h3','Ready to brew?'),node('p',confirmation.label,'coffee-review-drink'),node('p',confirmation.details||'Machine defaults','coffee-note'),node('p','Place a cup under the spout. For milk drinks, connect the milk supply.','coffee-note'));const controls=node('div',null,'coffee-review-actions');const start=button('Brew now',async()=>{if(!canBrew()||confirmation.signature!==signature()){confirmation=null;message='Settings changed. Please review your drink again.';render();return}brewSent=true;busy=true;confirmation=null;message='Requesting brew…';render();try{await request({type:'call_service',domain:'home_connect',service:'start_selected_program',service_data:{device_id:device}});message='Brew requested. Waiting for machine status.'}catch(e){message=e.message+' Check the machine before requesting again.'}finally{busy=false;render()}});start.disabled=!canBrew();controls.append(button('Back',()=>{confirmation=null;render()}),start);body.append(controls)}
function render(){if(!dialog.open)return;if(dialog.querySelector('input:focus')&&!busy)return;dialog.replaceChildren();const head=node('header');head.append(node('h2','☕ Coffee machine'),button('Close',()=>dialog.close()));const tabs=node('nav',null,'coffee-tabs');for(const [id,title] of [['drink','Drink'],['settings','Machine'],['care','Care']]){const b=button(title,()=>{tab=id;page=0;picker=null;confirmation=null;render()});b.setAttribute('aria-pressed',String(id===tab));tabs.append(b)}const body=node('section',null,'coffee-panel-body');if(picker)choiceView(body);else if(confirmation)review(body);else if(tab==='drink')drink(body);else if(tab==='settings')settings(body);else care(body);
 const foot=node('footer',null,'coffee-panel-footer'),notice=node('p',message||statusText(),'coffee-command-status');notice.setAttribute('role','status');foot.append(notice);
 if(tab==='drink'&&!picker&&!confirmation){if(power()?.state==='off'){const on=button('Switch machine on',()=>command('switch','turn_on',power().entity_id,{},'on'));on.disabled=busy||!connected();foot.append(on)}else{const brew=button('Review drink',()=>{if(!canBrew())return;confirmation={signature:signature(),label:pretty(selected().state),details:options().filter(usable).map(s=>optionLabel(s)+': '+pretty(s.state)+(s.attributes?.unit_of_measurement?' '+s.attributes.unit_of_measurement:'')).join(' · ')};render()});brew.disabled=!canBrew();foot.append(brew)}}dialog.append(head,tabs,body,foot);
}
function update(){if(!connected()){loadedSocket=null;device=null;services=null}if(brewSent){if(running())sawRunning=true;else if(sawRunning){brewSent=false;sawRunning=false}}if(confirmation&&confirmation.signature!==signature()){confirmation=null;message='Machine settings changed. Review the updated drink.'}render();if(dialog.open)init()}
function open(){tab='drink';page=0;picker=null;confirmation=null;if(!busy)message='';if(!dialog.open)dialog.showModal();render();init();refreshState();clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(dialog.open&&!busy)refreshState();else if(!dialog.open){clearInterval(refreshTimer);refreshTimer=null}},10000)}
dialog.addEventListener('close',()=>{clearInterval(refreshTimer);refreshTimer=null});
dialog.addEventListener('keydown',e=>{if(e.key==='Escape'&&(picker||confirmation)){e.preventDefault();picker=null;confirmation=null;render()}});
return {open,update};
};

