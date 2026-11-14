/* Direct shortcut to the official installed VTech Android app.
   No camera requests, pairing credentials, snapshots or cloud tokens touch Halo. */
(()=>{
'use strict';
const APP='MyVTech Baby Pro';
const security=document.querySelector('.home-security');
const stack=security?.querySelector('.home-compact-stack');
if(!security||!stack)return;
for(const cls of ['kia-placeholder','coffee-card']){
  const el=security.querySelector('.'+cls);
  if(el)stack.append(el);
}
security.classList.add('with-baby-camera');

function bridge(){
  const native=window.AndroidLauncher;
  if(!native||typeof native.openApp!=='function'||typeof native.supportsBabyMonitorApp!=='function')return null;
  try{return native.supportsBabyMonitorApp()===true?native:null}catch{return null}
}
function installed(){
  const native=bridge();
  if(!native||typeof native.babyMonitorInstalled!=='function')return false;
  try{return native.babyMonitorInstalled()===true}catch{return false}
}
function logo(){
  const mark=document.createElement('span');
  mark.className='vtech-app-logo';
  mark.setAttribute('aria-hidden','true');
  mark.textContent='👶';
  const native=bridge();
  if(native&&typeof native.babyMonitorIcon==='function'){
    try{
      const icon=native.babyMonitorIcon();
      if(typeof icon==='string'&&icon.startsWith('data:image/png;base64,')&&icon.length<250000){
        const image=document.createElement('img');
        image.src=icon;
        image.alt='';
        image.onerror=()=>{image.remove();mark.textContent='👶'};
        mark.replaceChildren(image);
      }
    }catch{}
  }
  return mark;
}
function feedback(message){
  if(typeof window.notify==='function'){window.notify(message);return}
  const note=document.getElementById('notice');
  if(note){note.textContent=message;note.classList.remove('hidden');return}
  window.alert(message);
}
function openVtech(){
  const native=bridge();
  if(!native){
    feedback('To open VTech from Halo, install the updated Halo 4.1.4 Android app on this device.');
    return;
  }
  if(!installed()){
    feedback('MyVTech Baby Pro is not installed or launchable on this device. Install the official app from Google Play.');
    return;
  }
  try{native.openApp(APP)}
  catch{feedback('Could not open VTech. Check the installed app and try again.')}
}
const card=document.createElement('button');
card.type='button';
card.className='baby-camera-card vtech-app-card';
card.setAttribute('aria-label','Open MyVTech Baby Pro app');
card.append(logo());
const copy=document.createElement('span');
copy.className='vtech-app-copy';
const title=document.createElement('strong');
title.textContent='VTech Baby Pro';
const status=document.createElement('small');
status.className='baby-camera-status';
status.textContent=bridge()?(installed()?'Open installed app':'Install app on this device'):'Open in Halo Android app 4.1.4';
copy.append(title,status);
card.append(copy);
card.addEventListener('click',openVtech);
security.append(card);

})();
