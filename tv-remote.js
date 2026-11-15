/* Shared Android TV / Chromecast D-pad navigation. Never reads credentials or media. */
(()=>{
'use strict';
const closeNames={
  eufyOverlay:'closeEufyOverlay',
  petOverlay:'closePetDetails',
  salusOverlay:'closeSalusModal',
  calendarOverlay:'closeCalendar'
};
const modalSelector='dialog[open],[role="dialog"],#photoStage.photo-fullscreen,#photoStage:fullscreen';
const interactive='button:not([disabled]),a[href],input:not([type="hidden"]),select,textarea,video[controls],[role="button"][tabindex],[role="tab"][tabindex],[tabindex]:not([tabindex="-1"])';
const lastControl=new WeakMap();
let lastModal=null,repairing=false;
const isVisible=element=>{
  if(!element||element.hidden||element.disabled||element.getAttribute?.('aria-disabled')==='true')return false;
  if(element.closest?.('[hidden],[inert],[aria-hidden="true"]'))return false;
  const box=element.getBoundingClientRect?.(),style=getComputedStyle(element);
  return !!box&&box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden';
};
const controlsFor=modal=>[...modal.querySelectorAll(interactive)].filter(isVisible);
const isTextControl=target=>{
  const tag=target?.tagName?.toLowerCase();
  if(tag==='textarea')return true;
  if(tag!=='input')return false;
  return !['button','checkbox','radio','range','submit','reset','color','file','date','time','datetime-local','month','week'].includes(target.type);
};
const isValueControl=target=>{
  const tag=target?.tagName?.toLowerCase();
  return tag==='select'||tag==='textarea'||tag==='video'||tag==='input';
};
function availableModals(){
  return [...document.querySelectorAll(modalSelector)].filter(isVisible).filter(node=>node.id!=='haSetup');
}
function activeModal(){
  const candidates=availableModals();
  if(!candidates.length)return null;
  const focus=document.activeElement;
  const focused=candidates.filter(node=>node.contains(focus));
  if(focused.length)return focused.at(-1);
  if(lastModal&&candidates.includes(lastModal))return lastModal;
  const native=candidates.filter(node=>node.matches?.('dialog:modal'));
  return native.at(-1)||candidates.at(-1);
}
const haIsOpen=()=>{const ha=document.getElementById('haSetup');return !!ha&&!ha.classList.contains('hidden')};
window.HaloTVRemoteModalOpen=()=>haIsOpen()||!!activeModal();
function focusControl(node){
  if(!node)return;
  try{node.focus({preventScroll:true})}catch{node.focus()}
  try{node.scrollIntoView({block:'nearest',inline:'nearest'})}catch{}
}
function restore(modal){
  const list=controlsFor(modal);
  if(!list.length){if(modal.tabIndex>=0)focusControl(modal);return}
  const saved=lastControl.get(modal);
  focusControl(saved&&list.includes(saved)?saved:list[0]);
}
function stop(event){event.preventDefault();event.stopImmediatePropagation()}
function move(modal,key){
  const items=controlsFor(modal);
  if(!items.length)return;
  const current=document.activeElement;
  if(!items.includes(current)){restore(modal);return}
  const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  const [dx,dy]=directions[key],from=current.getBoundingClientRect();
  const ax=from.left+from.width/2,ay=from.top+from.height/2;
  let chosen=null,score=Infinity;
  for(const item of items){
    if(item===current)continue;
    const rect=item.getBoundingClientRect(),x=rect.left+rect.width/2-ax,y=rect.top+rect.height/2-ay;
    const forward=dx*x+dy*y,side=Math.abs(dx*y-dy*x);
    if(forward<=2)continue;
    const next=forward+side*2.8+(side>Math.max(from.width,from.height)*1.5?side:0);
    if(next<score){score=next;chosen=item}
  }
  // Prefer reaching every control to stranding the remote at a grid edge.
  if(!chosen){
    const delta=(dx+dy)>0?1:-1;
    chosen=items[(items.indexOf(current)+delta+items.length)%items.length];
  }
  focusControl(chosen);
}
function closeModal(modal){
  if(modal.id==='photoStage'){window.closePhotoFullscreen?.();return}
  if(modal.classList?.contains('room-picker')){
    const exit=modal.querySelector('header button');
    if(exit){exit.click();return}
  }
  const method=closeNames[modal.id];
  if(method&&typeof window[method]==='function'){window[method]();return}
  if(modal.tagName?.toLowerCase()==='dialog'&&modal.open){modal.close();return}
  const native=modal.closest?.('dialog[open]');
  if(native){native.close();return}
  const exit=controlsFor(modal).find(el=>/close|exit|back/i.test(el.getAttribute?.('aria-label')||el.textContent||''));
  exit?.click();
}
document.addEventListener('keydown',event=>{
  if(haIsOpen()||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
  const modal=activeModal();
  if(!modal)return;
  lastModal=modal;
  const key=event.key,current=document.activeElement;
  const isInput=isTextControl(current),tag=current?.tagName?.toLowerCase();
  // Preserve native Escape: some dialogs use it to dismiss confirmations first.
  if(key==='Escape'&&modal.tagName?.toLowerCase()==='dialog')return;
  if(key==='Escape'&&modal.id==='photoStage')return;
  if(['Escape','BrowserBack','GoBack'].includes(key)||(key==='Backspace'&&!isInput)){
    stop(event);closeModal(modal);return;
  }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)){
    // Caret movement and input adjustments remain native.
    if((isInput&&(key==='ArrowLeft'||key==='ArrowRight'))||
       (tag==='select'&&(key==='ArrowUp'||key==='ArrowDown'))||
       (tag==='input'&&current.type==='range'&&(key==='ArrowLeft'||key==='ArrowRight'))||
       (tag==='textarea')){
      event.stopImmediatePropagation();return;
    }
    stop(event);move(modal,key);return;
  }
  if(key==='Tab'){
    const items=controlsFor(modal);if(!items.length)return;
    stop(event);
    const index=items.indexOf(current),delta=event.shiftKey?-1:1;
    const target=items[(index<0?(delta===1?0:items.length-1):(index+delta+items.length)%items.length)];
    focusControl(target);return;
  }
  if(key==='Enter'||key==='NumpadEnter'||key===' '||event.keyCode===23){
    if(isValueControl(current)&&modal.contains(current)){
      event.stopImmediatePropagation();return;
    }
    stop(event);
    if(event.repeat)return;
    if(modal.contains(current)&&typeof current?.click==='function')current.click();
    else restore(modal);
    return;
  }
  // A modal never lets a key trigger the dashboard behind it.
  event.stopImmediatePropagation();
},true);
document.addEventListener('focusin',event=>{
  if(haIsOpen())return; // HA has its own keyboard-Next focus controller.
  const candidates=availableModals();
  if(!candidates.length){lastModal=null;return}
  const inModal=candidates.filter(m=>m.contains(event.target));
  if(inModal.length){
    const modal=inModal.at(-1);
    lastModal=modal;
    if(controlsFor(modal).includes(event.target))lastControl.set(modal,event.target);
    return;
  }
  if(repairing)return;
  repairing=true;
  const modal=lastModal&&candidates.includes(lastModal)?lastModal:candidates.at(-1);
  restore(modal);
  repairing=false;
},true);
document.addEventListener('focusout',()=>{
  if(haIsOpen())return;
  setTimeout(()=>{
    const modal=activeModal();
    if(modal&&!modal.contains(document.activeElement)&&!document.hidden)restore(modal);
  },0);
},true);
})();
