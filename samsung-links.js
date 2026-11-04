/* Open only Samsung Food URLs; native credentials remain in Home Assistant. */
(function(){
'use strict';
function safe(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='app.samsungfood.com'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&/^\/(meal-plan|shopping-list|recipe-box|recipes)(\/|$)/.test(u.pathname)}catch{return false}}
if(typeof module!=='undefined')module.exports={safe};
if(typeof document==='undefined')return;
window.openSamsungFood=function(url){
 if(!safe(url))return;
 if(window.AndroidLauncher?.openSamsungFood){window.AndroidLauncher.openSamsungFood(url);return}
 if(!window.AndroidLauncher){window.location.assign(url);return}
 const d=document.createElement('dialog');d.className='sf-link-help';
 const h=document.createElement('h2');h.textContent='Open Samsung Food';
 const p=document.createElement('p');p.textContent='Your installed launcher needs the Samsung Food link update. Until then, copy this address and open it in your browser or open the Samsung Food app.';
 const input=document.createElement('input');input.readOnly=true;input.value=url;input.setAttribute('aria-label','Samsung Food address');input.onclick=()=>input.select();
 const copy=document.createElement('button');copy.textContent='Copy address';copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='Copied'}catch{input.select();copy.textContent='Select and copy the address above'}};
 const close=document.createElement('button');close.textContent='Close';close.onclick=()=>d.close();d.append(h,p,input,copy,close);document.body.append(d);d.onclose=()=>d.remove();d.showModal();
};
document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(a&&safe(a.href)){event.preventDefault();window.openSamsungFood(a.href)}},true);
const style=document.createElement('style');style.textContent='.sf-link-help{box-sizing:border-box;width:min(560px,94vw);background:#192d43;color:#eef5ff;border:1px solid #607b98;border-radius:14px;padding:20px}.sf-link-help input{width:100%;box-sizing:border-box;margin-bottom:12px}.sf-link-help button{padding:8px 12px;margin-right:10px}.sf-link-help::backdrop{background:#000a}';document.head.append(style);
})();
