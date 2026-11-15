const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const script=readFileSync('tv-remote.js','utf8');
const html=readFileSync('index.html','utf8');
const styles=readFileSync('tv-remote.css','utf8');

function harness(){
  const listeners=new Map(),modals=[],fires=[],timers=[];
  let active=null;
  const doc={body:{classList:{add(){},remove(){}}}};
  function emit(type,event){
    for(const fn of listeners.get(type)||[])fn(event);
  }
  function element(tag='BUTTON',id='',parent=null,{x=0,y=0,w=100,h=32}={}){
    const el={
      tagName:tag.toUpperCase(),id,parentElement:parent,children:[],open:false,hidden:false,disabled:false,
      tabIndex:0,type:'button',value:'',textContent:id,attributes:{},
      rect:{left:x,top:y,width:w,height:h},
      classList:{
        contains(key){return key==='hidden'&&!!el.hidden},
        add(key){if(key==='hidden')el.hidden=true},
        remove(key){if(key==='hidden')el.hidden=false}
      },
      getAttribute(name){return this.attributes[name]??null},
      setAttribute(name,value){this.attributes[name]=value},
      matches(selector){return selector==='dialog:modal'&&this.tagName==='DIALOG'&&this.open},
      getBoundingClientRect(){return {...this.rect}},
      closest(selector){
        if(selector==='[hidden],[inert],[aria-hidden="true"]'){
          for(let p=this;p;p=p.parentElement)if(p.hidden||p.attributes['aria-hidden']==='true')return p;
          return null;
        }
        if(selector==='dialog[open]'){
          for(let p=this;p;p=p.parentElement)if(p.tagName==='DIALOG'&&p.open)return p;
          return null;
        }
        return null;
      },
      contains(other){for(let p=other;p;p=p.parentElement)if(p===this)return true;return false},
      querySelectorAll(){const all=[];function walk(node){for(const child of node.children){if(child.focusable)all.push(child);walk(child)}}walk(el);return all},
      querySelector(selector){
        if(selector==='header button')return this.children.find(x=>x.tagName==='BUTTON')||null;
        return this.querySelectorAll().find(x=>/close|exit|back/i.test(x.attributes['aria-label']||x.textContent))||null;
      },
      focus(){active=this;emit('focusin',{target:this})},
      scrollIntoView(){},
      click(){fires.push('click:'+id);this.onclick?.()},
      close(){this.open=false;fires.push('close:'+id);this.onclose?.()},
      append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n)}},
    };
    if(parent)parent.children.push(el);
    if(tag.toUpperCase()!=='DIV'&&tag.toUpperCase()!=='DIALOG'&&tag.toUpperCase()!=='SECTION')el.focusable=true;
    return el;
  }
  const ha=element('DIV','haSetup');ha.hidden=true;
  const docRoot=element('DIV','root');
  const background=element('BUTTON','background',docRoot,{x:0,y:500});
  active=background;
  Object.defineProperty(doc,'activeElement',{get:()=>active});
  doc.getElementById=id=>id==='haSetup'?ha:modals.find(m=>m.id===id)||null;
  doc.querySelectorAll=()=>modals;
  doc.addEventListener=(type,fn)=>listeners.set(type,[...(listeners.get(type)||[]),fn]);
  const closeCalls=[];
  const window={
    closeEufyOverlay(){const m=modals.find(x=>x.id==='eufyOverlay');m.hidden=true;closeCalls.push('eufy');background.focus()},
    closePetDetails(){const m=modals.find(x=>x.id==='petOverlay');m.hidden=true;closeCalls.push('pets');background.focus()},
    closeSalusModal(){const m=modals.find(x=>x.id==='salusOverlay');m.hidden=true;closeCalls.push('salus');background.focus()},
    closeCalendar(){const m=modals.find(x=>x.id==='calendarOverlay');m.hidden=true;closeCalls.push('calendar');background.focus()},
    closePhotoFullscreen(){closeCalls.push('photos')}
  };
  vm.runInNewContext(script,{document:doc,window,getComputedStyle:e=>({display:e.hidden?'none':'block',visibility:'visible'}),setTimeout:fn=>timers.push(fn)});
  function createModal(id,tag='DIV'){
    const m=element(tag,id,null,{x:90,y:90,w:550,h:500});
    if(tag.toUpperCase()==='DIALOG')m.open=true;
    else m.hidden=false;
    modals.push(m);
    return m;
  }
  function press(key,{shiftKey=false,keyCode=0}={}){
    const event={key,keyCode,shiftKey,target:active,repeat:false,isComposing:false,altKey:false,ctrlKey:false,metaKey:false,
      prevented:false,stopped:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};
    emit('keydown',event);
    return event;
  }
  return {window,doc,ha,element,createModal,background,press,fires,closeCalls,modals,
    active:()=>active,flush:()=>{while(timers.length)timers.shift()()},focus:node=>node.focus()};
}
test('the HTML loads the remote handler and preserves the secure HA handler',()=>{
  assert.match(html,/tv-remote\.js\?v=1/);
  assert.match(html,/ha-remote-focus\.js\?v=1/);
  assert.match(html,/window\.HaloTVRemoteModalOpen\?\.\(\)/);
  assert.ok(html.includes('[role="button"][tabindex]'), 'Kia role-button is keyboard reachable');
  assert.match(styles,/kia-placeholder:focus-visible/);
  assert.doesNotThrow(()=>new vm.Script(script));
  for(const secret of ['haAccessToken','haStoredUrl','sessionStorage','camera_proxy','fetch('])
    assert.equal(script.includes(secret),false,'navigation controller must not access '+secret);
});
test('Eufy close X is actionable with OK and focus returns to dashboard',()=>{
  const h=harness();const e=h.createModal('eufyOverlay');
  const live=h.element('BUTTON','live',e,{x:100,y:100});
  const close=h.element('BUTTON','close',e,{x:410,y:100});
  close.onclick=()=>h.window.closeEufyOverlay();
  h.focus(close);assert.equal(h.window.HaloTVRemoteModalOpen(),true);
  const event=h.press('Enter');
  assert.equal(event.prevented,true);assert.equal(event.stopped,true);
  assert.deepEqual(h.closeCalls,['eufy']);
  assert.equal(h.active(),h.background);
  assert.equal(h.window.HaloTVRemoteModalOpen(),false);
  assert.ok(live);
});
test('D-pad moves between visible Eufy tabs and actions without selecting behind the overlay',()=>{
  const h=harness();const e=h.createModal('eufyOverlay');
  const live=h.element('BUTTON','live',e,{x:100,y:100});
  const recordings=h.element('BUTTON','recordings',e,{x:230,y:100});
  const snapshot=h.element('BUTTON','snapshot',e,{x:230,y:160});
  const close=h.element('BUTTON','close',e,{x:430,y:100});
  h.focus(live);
  assert.equal(h.press('ArrowRight').prevented,true);
  assert.equal(h.active(),recordings);
  h.press('ArrowDown');assert.equal(h.active(),snapshot);
  h.press('ArrowUp');assert.equal(h.active(),recordings);
  h.focus(h.background);assert.equal(h.active(),recordings,'background focus is repaired inside modal');
  h.press('ArrowRight');assert.equal(h.active(),close);
});
test('Back handles custom camera, pet, heating and calendar overlays',()=>{
  for(const [id,name] of [['eufyOverlay','eufy'],['petOverlay','pets'],['salusOverlay','salus'],['calendarOverlay','calendar']]){
    const h=harness(),m=h.createModal(id);
    const x=h.element('BUTTON','x',m);h.focus(x);
    const event=h.press('BrowserBack');
    assert.equal(event.prevented,true);
    assert.deepEqual(h.closeCalls,[name]);
    assert.equal(h.active(),h.background);
  }
});
test('native Kia and Coffee dialogs have TV accessible buttons and can be closed',()=>{
  for(const name of ['Kia','Coffee']){
    const h=harness(),dialog=h.createModal(name.toLowerCase(),'DIALOG');
    const first=h.element('BUTTON','close',dialog,{x:100,y:100});
    const next=h.element('BUTTON','next',dialog,{x:250,y:100});
    first.onclick=()=>dialog.close();
    h.focus(first);
    h.press('ArrowRight');assert.equal(h.active(),next);
    h.press('ArrowLeft');assert.equal(h.active(),first);
    h.press('Enter');assert.equal(dialog.open,false);
    assert.deepEqual(h.fires,['click:close','close:'+name.toLowerCase()]);
  }
});
test('remote Tab loops in the modal; input/select value controls keep native editing keys',()=>{
  const h=harness(),m=h.createModal('calendarOverlay');
  const close=h.element('BUTTON','close',m,{x:100,y:100});
  const field=h.element('INPUT','address',m,{x:100,y:160});field.type='text';
  const pick=h.element('SELECT','period',m,{x:100,y:220});
  h.focus(field);
  const caret=h.press('ArrowLeft');assert.equal(caret.prevented,false);assert.equal(caret.stopped,true);
  h.press('Tab');assert.equal(h.active(),pick);
  const choose=h.press('ArrowDown');assert.equal(choose.prevented,false);
  h.press('Tab');assert.equal(h.active(),close);
  h.press('Tab',{shiftKey:true});assert.equal(h.active(),pick);
  h.press('ArrowRight');assert.notEqual(h.active(),h.background);
});
test('native Escape is left to component-specific confirmation handling',()=>{
  const h=harness(),m=h.createModal('kia-detail','DIALOG');const close=h.element('BUTTON','close',m);
  h.focus(close);
  const event=h.press('Escape');
  assert.equal(event.stopped,false);
  assert.equal(m.open,true);
  h.press('BrowserBack');assert.equal(m.open,false);
});
test('hidden modals do not interfere with normal page keys and HA remains separate',()=>{
  const h=harness();
  h.createModal('eufyOverlay').hidden=true;
  const event=h.press('Enter');
  assert.equal(event.stopped,false);
  h.ha.hidden=false;
  assert.equal(h.window.HaloTVRemoteModalOpen(),true);
  assert.equal(h.press('ArrowDown').stopped,false,'HA Next handler owns its own keys');
});
test('lost keyboard focus in a modal is restored to the last selected control',()=>{
  const h=harness(),m=h.createModal('petOverlay');
  const a=h.element('BUTTON','close',m),b=h.element('BUTTON','activity',m,{x:220,y:100});
  h.focus(b);
  h.focus(h.background);
  assert.equal(h.active(),b);
  h.focus(a);h.focus(h.background);
  assert.equal(h.active(),a);
});
