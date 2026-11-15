const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const script=fs.readFileSync('ha-remote-focus.js','utf8');
const html=fs.readFileSync('index.html','utf8');

function harness(){
  const listeners=new Map(),timers=[];
  let active=null,hidden=true,clicks=0,closed=0;
  const fire=(type,event)=>{
    for(const listener of listeners.get(type)||[])listener(event);
  };
  const el=(name)=>({
    name,
    listeners:new Map(),
    addEventListener(type,fn){this.listeners.set(type,fn)},
    focus(){active=this;fire('focusin',{target:this})},
    blur(){
      if(active===this){
        active=body;
        this.listeners.get('blur')?.({target:this});
      }
    },
    click(){clicks++},
  });
  const body=el('body'),address=el('address'),connect=el('connect'),close=el('close'),background=el('background');
  const overlay={
    classList:{contains(name){return name==='hidden'&&hidden}},
    contains(target){return [address,connect,close].includes(target)},
    querySelector(selector){return selector.includes('.ha-setup-actions')?connect:close},
  };
  const document={
    getElementById(name){return name==='haSetup'?overlay:name==='haBaseUrl'?address:null},
    get activeElement(){return active},
    addEventListener(type,fn){const l=listeners.get(type)||[];l.push(fn);listeners.set(type,l)},
  };
  const window={closeHaSetup(){closed++;hidden=true;active=background}};
  vm.runInNewContext(script,{document,window,setTimeout:fn=>{timers.push(fn);return timers.length}});
  function press(key,{shiftKey=false,keyCode=0}={}){
    const event={
      key,keyCode,shiftKey,target:active,altKey:false,ctrlKey:false,metaKey:false,isComposing:false,
      defaultPrevented:false,stopped:false,
      preventDefault(){this.defaultPrevented=true},
      stopImmediatePropagation(){this.stopped=true},
    };
    fire('keydown',event);
    return event;
  }
  const reveal=()=>{hidden=false;address.focus()};
  const flush=()=>{while(timers.length)timers.shift()()};
  return {reveal,press,flush,focus:el=>el.focus(),address,connect,close,background,overlay,
    active:()=>active,clicks:()=>clicks,closed:()=>closed,
    hide:()=>{hidden=true},fire};
}
test('index loads the TV focus handler, stays in modal and preserves IME next',()=>{
  assert.match(html,/ha-remote-focus\.js\?v=1/);
  assert.match(html,/id="haBaseUrl" type="url" inputmode="url" enterkeyhint="next"/);
  assert.match(html,/window\.HaloTVRemoteModalOpen\?\.\(\)/); // shared modal guard now covers all overlays
  assert.match(html,/function closeHaSetup\(\).*haSetupReturnFocus/);
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.equal(/haAccessToken|haStoredUrl|camera_proxy|localStorage|token/.test(script),false,
    'remote focus helper must not touch credentials, tokens or video');
});
test('TV keyboard Next/Enter selects Connect rather than a dashboard card',()=>{
  const h=harness();h.reveal();
  const event=h.press('Enter');
  assert.equal(event.defaultPrevented,true);
  assert.equal(event.stopped,true);
  assert.equal(h.active(),h.connect);
  assert.equal(h.clicks(),0,'IME Next must not prematurely begin OAuth');
  h.flush();assert.equal(h.active(),h.connect);
  h.press('Enter');assert.equal(h.clicks(),1,'second OK/Enter activates Connect');
});
test('D-pad Down from URL navigates to Connect and Up returns to URL',()=>{
  const h=harness();h.reveal();
  assert.equal(h.press('ArrowDown').stopped,true);
  assert.equal(h.active(),h.connect);
  h.press('ArrowUp');assert.equal(h.active(),h.address);
  h.press('ArrowUp');assert.equal(h.active(),h.close);
  h.press('ArrowDown');assert.equal(h.active(),h.address);
});
test('left/right keep text editing usable and Tab stays in dialog',()=>{
  const h=harness();h.reveal();
  const caret=h.press('ArrowLeft');
  assert.equal(h.active(),h.address);
  assert.equal(caret.stopped,true);
  assert.equal(caret.defaultPrevented,false,'do not block moving the URL caret');
  h.press('Tab');assert.equal(h.active(),h.connect);
  h.press('Tab');assert.equal(h.active(),h.close);
  h.press('Tab');assert.equal(h.active(),h.address);
  h.press('Tab',{shiftKey:true});assert.equal(h.active(),h.close);
});
test('focus escape caused by the TV keyboard is repaired inside the dialog',()=>{
  const h=harness();h.reveal();
  h.press('Enter'); // IME handoff targets Connect
  h.focus(h.background);
  assert.equal(h.active(),h.connect,'backdrop/dashboard cannot steal focus');
  h.focus(h.address);
  h.address.blur();h.flush();
  assert.equal(h.active(),h.connect,'dismissing keyboard returns focus to Connect');
});
test('Back closes the overlay, while Backspace edits the URL',()=>{
  const h=harness();h.reveal();
  const backspace=h.press('Backspace');
  assert.equal(h.closed(),0);
  assert.equal(backspace.defaultPrevented,false);
  h.press('ArrowDown');
  const back=h.press('BrowserBack');
  assert.equal(back.defaultPrevented,true);
  assert.equal(h.closed(),1);
  assert.equal(h.active(),h.background);
});
test('handler ignores keys when setup overlay is hidden',()=>{
  const h=harness();
  const e=h.press('Enter');
  assert.equal(e.stopped,false);
  assert.equal(e.defaultPrevented,false);
});
