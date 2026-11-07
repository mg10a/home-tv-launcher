/* Keep each modal's existing close action and give it the same visible control. */
(() => {
 const containers='dialog, [role="dialog"], #historyPage, .room-picker';
 function decorate(root) {
  for(const button of root.querySelectorAll('button:not(.halo-close)')){
   const text=button.textContent.trim();
   if(!['Close','×','✕'].includes(text)||!button.closest(containers))continue;
   button.classList.add('halo-close');
   if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Close');
   button.textContent='×';
  }
 }
 decorate(document.body);
 new MutationObserver(records=>{
  const changed=new Set();
  for(const record of records){
   for(const node of record.addedNodes){
    if(node.nodeType!==1||(!node.matches('button')&&!node.querySelector('button')))continue;
    const modal=record.target.closest?.(containers);
    if(modal)changed.add(modal);
    else if(node.matches(containers)||node.querySelector(containers))changed.add(node);
   }
  }
  for(const node of changed)decorate(node);
 }).observe(document.body,{childList:true,subtree:true});
})();
