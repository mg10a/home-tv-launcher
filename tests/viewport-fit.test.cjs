const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

async function checkPage(browser,path,{nativeInsets=false,left=56,right=56,width=780}={}) {
 const page=await browser.newPage({
  viewport:{width,height:360},hasTouch:true,isMobile:true,serviceWorkers:'block',
  userAgent:'Mozilla/5.0 (Linux; Android 16; Samsung) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36'
 });
 await page.addInitScript(native=>{window.AndroidLauncher=native?{managesViewportInsets:()=>true}:{}},nativeInsets);
 await page.route('https://halo.test/**',route=>{
  const file=new URL(route.request().url()).pathname.slice(1);
  return fs.existsSync(file)?route.fulfill({path:file}):route.abort();
 });
 await page.goto('https://halo.test/'+path);
 await page.evaluate(({nativeInsets,left,right})=>{
  if(nativeInsets){
   document.documentElement.style.setProperty('--halo-safe-left',left+'px');
   document.documentElement.style.setProperty('--halo-safe-right',right+'px');
  }
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 },{nativeInsets,left,right});
 assert.equal(await page.locator('html').evaluate(root=>root.classList.contains('halo-legacy-android')),!nativeInsets);
 const fits=async selector=>{
  const box=await page.locator(selector).boundingBox();
  assert(box&&box.x>=left-1&&box.x+box.width<=width-right+1,selector+' overlaps a navigation edge: '+JSON.stringify(box));
 };
 for(const [overlay,panel] of [
  ['#eufyOverlay','.eufy-dialog'],['#salusOverlay','.salus-dialog'],
  ['#petOverlay','.pet-dialog'],['#calendarOverlay','.calendar-dialog'],
  ['#haSetup','.ha-setup-panel']
 ]){
  await page.locator(overlay).evaluate(el=>el.classList.remove('hidden'));
  await fits(overlay+' '+panel);
  if(overlay==='#eufyOverlay'){
   await fits('#eufyClose');
   await fits('#eufyLiveButton');
   await page.locator('#eufyLiveFrame').evaluate(el=>el.classList.add('eufy-expanded'));
   await fits('.eufy-exit-fullscreen');
   await page.locator('#eufyLiveFrame').evaluate(el=>el.classList.remove('eufy-expanded'));
  }
  await page.locator(overlay).evaluate(el=>el.classList.add('hidden'));
 }
 if(path==='index.html'){
  await page.locator('#photoStage').evaluate(el=>el.classList.add('photo-fullscreen'));
  await fits('#photoExit');
  await page.locator('#photoStage').evaluate(el=>el.classList.remove('photo-fullscreen'));
  await page.evaluate(()=>openRoomDetails('Living Room'));
  await fits('dialog.room-detail');
  await fits('dialog.room-detail header button');
  await page.locator('dialog.room-detail').evaluate(el=>el.close());
  await page.evaluate(()=>openKiaDetails());
  await fits('dialog.kia-detail');
  await fits('dialog.kia-detail header button');
  await page.locator('dialog.kia-detail').evaluate(el=>el.close());
  for(const [key,screen] of [['launcher','main.shell'],['home','#dashboardPage'],['family','#dashboardPage']]){
   await page.evaluate(key=>navigateHome(key),key);
   const padding=await page.locator(screen).evaluate(el=>[parseFloat(getComputedStyle(el).paddingLeft),parseFloat(getComputedStyle(el).paddingRight)]);
   assert(padding[0]>=left&&padding[1]>=right,key+' does not reserve both edges: '+padding.join(', '));
  }
  await page.locator('#historyPage').evaluate(el=>el.classList.remove('hidden'));
  await fits('#historyPage');
  await page.locator('#historyPage').evaluate(el=>el.classList.add('hidden'));
 }
 for(const dialog of await page.locator('dialog').all()){
  await dialog.evaluate(el=>el.showModal());
  const box=await dialog.boundingBox();
  assert(box&&box.x>=left-1&&box.x+box.width<=width-right+1,'Native dialog overlaps a navigation edge');
  await dialog.evaluate(el=>el.close());
 }
 if(!nativeInsets){
  await page.setViewportSize({width:360,height:780});
  assert.equal(await page.locator('html').evaluate(root=>getComputedStyle(root).getPropertyValue('--halo-safe-right').trim()),'0px');
 }
 await page.close();
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HALO_CHROMIUM,args:['--no-sandbox']});
 try{
  await checkPage(browser,'index.html');
  await checkPage(browser,'dev/index.html');
  await checkPage(browser,'index.html',{nativeInsets:true,left:0,right:48});
  await checkPage(browser,'index.html',{nativeInsets:true,left:48,right:0});
  await checkPage(browser,'index.html',{nativeInsets:true,left:0,right:0});
  console.log('Landscape safe widths passed for all overlays, dialogs and main screens, with bars on either side and with no bars.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
