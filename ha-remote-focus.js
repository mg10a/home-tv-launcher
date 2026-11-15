/* Keep Chromecast/Google TV D-pad focus inside the Home Assistant sign-in overlay.
   This script never reads the address or any Home Assistant credentials. */
(()=>{
  'use strict';
  const overlay=document.getElementById('haSetup');
  const address=document.getElementById('haBaseUrl');
  const connect=overlay?.querySelector('.ha-setup-actions button');
  const close=overlay?.querySelector('button[aria-label="Close Home Assistant setup"]');
  if(!overlay||!address||!connect||!close)return;

  const controls=[close,address,connect];
  let lastFocused=address;
  let repairing=false;
  const isOpen=()=>!overlay.classList.contains('hidden');
  function focus(control){
    if(control)control.focus({preventScroll:true});
  }
  function consume(event){
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  // Android IME "Next" can first blur the input and only later return focus to
  // the WebView. Keep the Connect button selected after the keyboard disappears.
  function recoverAfterKeyboard(){
    for(const delay of [0,120]){
      setTimeout(()=>{
        if(!isOpen())return;
        if(!overlay.contains(document.activeElement)||document.activeElement===address){
          focus(connect);
        }
      },delay);
    }
  }
  document.addEventListener('keydown',event=>{
    if(!isOpen()||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
    const key=event.key;
    const current=document.activeElement;
    const inAddress=current===address||event.target===address;
    const index=controls.indexOf(current);

    if(key==='Enter'||key==='NumpadEnter'||event.keyCode===66){
      consume(event);
      if(inAddress){
        lastFocused=connect;
        address.blur();
        focus(connect);
        recoverAfterKeyboard();
      }else if(current===connect||current===close){
        current.click();
      }else{
        focus(connect);
      }
      return;
    }
    if(key==='Tab'){
      consume(event);
      const next=event.shiftKey
        ?(index<=0?controls.length-1:index-1)
        :(index<0||index===controls.length-1?0:index+1);
      focus(controls[next]);
      return;
    }
    if(key==='ArrowDown'||key==='ArrowUp'||key==='ArrowLeft'||key==='ArrowRight'){
      // Preserve caret movement while typing a URL; Up/Down switch controls.
      if(inAddress&&(key==='ArrowLeft'||key==='ArrowRight')){
        event.stopImmediatePropagation();
        return;
      }
      consume(event);
      const direction=(key==='ArrowUp'||key==='ArrowLeft')?-1:1;
      const next=index<0?1:Math.min(controls.length-1,Math.max(0,index+direction));
      focus(controls[next]);
      return;
    }
    if(key==='Escape'||key==='BrowserBack'||key==='GoBack'
       ||(key==='Backspace'&&!inAddress)){
      consume(event);
      if(typeof window.closeHaSetup==='function')window.closeHaSetup();
      else close.click();
      return;
    }
    if(key===' '){
      if(current===connect||current===close){
        consume(event);
        current.click();
      }else{
        event.stopImmediatePropagation();
      }
      return;
    }
    // No key should reactivate a dashboard button while this overlay is open.
    event.stopImmediatePropagation();
  },true);

  document.addEventListener('focusin',event=>{
    if(!isOpen())return;
    if(overlay.contains(event.target)){
      if(controls.includes(event.target))lastFocused=event.target;
      return;
    }
    if(repairing)return;
    repairing=true;
    focus(controls.includes(lastFocused)?lastFocused:connect);
    repairing=false;
  },true);

  address.addEventListener('blur',()=>{
    if(!isOpen())return;
    // When the TV keyboard is dismissed without a keydown, move to Connect
    // instead of leaving focus on the dashboard behind the overlay.
    lastFocused=connect;
    recoverAfterKeyboard();
  });
})();
