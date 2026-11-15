const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const root=process.cwd();
function resolveLocal(url){
  const relative=decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '')||'index.html';
  const abs=path.resolve(root,relative);
  if(!abs.startsWith(root+path.sep))return null;
  return fs.existsSync(abs)&&fs.statSync(abs).isFile()?abs:null;
}
async function open(browser){
  const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block',
    userAgent:'Mozilla/5.0 (Linux; Android 14; Chromecast Build/STTE.240) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36'});
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(!url.startsWith('https://halo.test/'))return route.abort();
    const file=resolveLocal(url);
    return file?route.fulfill({path:file}):route.abort();
  });
  await page.goto('https://halo.test/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.navigateHome==='function'&&typeof window.HaloTVRemoteModalOpen==='function');
  await page.evaluate(()=>window.navigateHome('home'));
  return page;
}
test('Chromecast D-pad reaches Kia and opens/closes its real dialog', {timeout:120000},async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await open(browser);
    await page.locator('.kia-placeholder').waitFor();
    const report=await page.evaluate(()=>{
      const target=document.querySelector('.kia-placeholder'),buttons=visibleControls();
      const start=document.querySelector('#homeScreenNav button[data-home-screen="home"]');
      if(!start||!target)return {reachable:false,reason:'missing start or Kia card'};
      const explored=new Set([start]),queue=[start],keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
      for(let i=0;i<queue.length&&i<100;i++){
        const current=queue[i];
        for(const key of keys){
          current.focus();
          document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
          const next=document.activeElement;
          if(!explored.has(next)&&buttons.includes(next)){explored.add(next);queue.push(next)}
        }
      }
      return {reachable:explored.has(target),focusable:buttons.includes(target),seen:explored.size,all:buttons.length,
        kiaRole:target.getAttribute('role'),kiaTabIndex:target.tabIndex};
    });
    assert.equal(report.focusable,true,'Kia omitted from visibleControls: '+JSON.stringify(report));
    assert.equal(report.reachable,true,'Kia inaccessible by D-pad from Smart Home navigation: '+JSON.stringify(report));
    await page.locator('.kia-placeholder').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('dialog.kia-detail[open]').count(),1,'Kia should open with remote OK');
    await page.locator('dialog.kia-detail button').first().focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('dialog.kia-detail')),true,'Tab must stay inside Kia modal');
    const close=page.locator('dialog.kia-detail header button').first(); // modal-controls normalises 'Close' to ×
    await close.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('dialog.kia-detail[open]').count(),0,'Kia Close should work from remote');
    await page.close();
  }finally{await browser.close()}
});
test('Eufy X, pet, heating, calendar and standard app dialogs keep remote focus', {timeout:120000},async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await open(browser);
    await page.evaluate(()=>openEufyOverlay({deferLoad:true}));
    assert.equal(await page.locator('#eufyOverlay:not(.hidden)').count(),1);
    await page.locator('#eufyConnectionCheck').focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#eufyConnectionResult').textContent(),/Home Assistant:/,
      'Read-only Eufy connection check must work from the remote');
    await page.locator('#eufyClose').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(()=>document.getElementById('eufyOverlay').contains(document.activeElement)),true,
      'Eufy remote focus escaped to underlying Smart Home');
    await page.locator('#eufyClose').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#eufyOverlay.hidden').count(),1,'Eufy X did not close via OK');
    for(const [id,selector] of [
      ['petOverlay','#petOverlay header button'],
      ['salusOverlay','.salus-close'],
      ['calendarOverlay','.calendar-dialog-head button']
    ]){
      await page.evaluate(id=>document.getElementById(id).classList.remove('hidden'),id);
      await page.locator(selector).focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(id=>document.getElementById(id).contains(document.activeElement),id),true,
        id+' D-pad escaped the modal');
      await page.locator(selector).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#'+id+'.hidden').count(),1,id+' failed to close');
    }
    await page.evaluate(()=>openLaunchSettings());
    assert.equal(await page.locator('#launchSettings[open]').count(),1);
    await page.locator('#launchSettings .settings-head button').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#launchSettings[open]').count(),0);
    await page.close();
  }finally{await browser.close()}
});

test('coffee, room, household and photo dialogs open and close without touchscreen', {timeout:120000},async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await open(browser);
    const cases=[
      {name:'Coffee',open:()=>document.querySelector('.coffee-details').click(),selector:'dialog.coffee-detail[open]',close:'header button'},
      {name:'Room details',open:()=>window.openRoomDetails('Kitchen'),selector:'dialog.room-detail[open]',close:'header button'},
      {name:'Groobarbs',open:()=>window.openGroobarbsDetails(),selector:'dialog.groobarbs-detail[open]',close:'header button'},
      {name:'Household tasks',open:()=>window.openFamilyTasks(),selector:'dialog.family-task-list-dialog[open]',close:'header button'},
      {name:'Photo settings',open:()=>openPhotoSettings(),selector:'#photoSettings[open]',close:'.settings-head button'}
    ];
    for(const scenario of cases){
      await page.evaluate(scenario.open);
      const modal=page.locator(scenario.selector);
      await modal.waitFor({state:'visible',timeout:10000});
      const close=modal.locator(scenario.close).first();
      assert.equal(await close.count(),1,scenario.name+' has no close button');
      await close.focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(selector=>document.querySelector(selector)?.contains(document.activeElement),scenario.selector),true,
        scenario.name+' remote focus escaped the modal');
      await close.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(scenario.selector).count(),0,scenario.name+' did not close with OK');
    }
    await page.close();
  }finally{await browser.close()}
});
