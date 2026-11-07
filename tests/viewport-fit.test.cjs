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
  if(!nativeInsets){
   await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'));
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1sAAAAASUVORK5CYII=','base64');
   await page.route(/https:\/\/(groobox-marketing\.transforms\.svdcdn\.com|media\.riverford\.co\.uk|thumb\.wikimedia\.org)\//,route=>route.fulfill({contentType:'image/png',body:png}));
   let photoLookups=0;
   await page.route('https://en.wikipedia.org/w/api.php?**',route=>{
    photoLookups++;
    assert.equal(new URL(route.request().url()).searchParams.get('titles'),'kohlrabi');
    return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{query:{pages:[{
     pageimage:'Kohlrabi.jpg',thumbnail:{source:'https://thumb.wikimedia.org/wikipedia/commons/thumb/Kohlrabi.jpg'},
     terms:{description:['cultivar of cabbage, used as a vegetable']}
    }]}}});
   });
   await page.evaluate(()=>{
    haVerified=true;
    haStates['sensor.groobarbs_next_delivery']={entity_id:'sensor.groobarbs_next_delivery',state:'2026-11-10',attributes:{
     date:'2026-11-10',deadline:'2026-11-09T11:00:00Z',editable:true,swaps_enabled:true,resets_enabled:true,order_id:10,revision:'reviewed',
     items:[{id:1,title:'Veg box',contents_can_change:true,contents:[{id:2,product_id:1,title:'Potatoes',category_ids:[1]}]}],
     replacements:Array.from({length:18},(_,i)=>({id:i+3,title:['Uchiki Kuri Squash','Kohlrabi'][i]||'Produce '+(i+1),category_ids:[1]}))
    }};
    openGroobarbsDetails();
   });
   await page.locator('.groo-tile img:not([hidden])').waitFor();
   await page.getByRole('button',{name:'Swap Potatoes'}).click();
   const choices=page.locator('.groo-options');
   assert.equal(await choices.getByRole('button').count(),19);
   assert(await choices.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'All 18 swaps and Keep must fit one landscape grid');
   await choices.getByRole('button',{name:'Kohlrabi'}).locator('img:not([hidden])').waitFor();
   await choices.getByRole('button',{name:'Keep Potatoes'}).click();
   assert.equal(await choices.count(),0,'keeping the existing item closes the picker');
   await page.getByRole('button',{name:'Swap Potatoes'}).click();
   await choices.getByRole('button',{name:'Kohlrabi'}).locator('img:not([hidden])').waitFor();
   assert.equal(photoLookups,1,'new produce lookup is reused when the picker reopens');
   const close=page.locator('.groo-picker header').getByRole('button',{name:'Close',exact:true});
   assert.equal(await close.textContent(),'×');
   await close.click();
   await page.evaluate(()=>{
    const data=haStates['sensor.groobarbs_next_delivery'].attributes, item=data.items[0], content=item.contents[0];
    Object.assign(content,{product_id:30,title:'Red Cabbage',replaced_product_id:1,replaced_title:'Potatoes'});
    item.swap_count=1;
    window.restoreRequests=[];
    window.eufyWsCommand=async request=>{
     restoreRequests.push(request);
     Object.assign(content,{product_id:1,title:'Potatoes',replaced_product_id:null,replaced_title:null});
     item.swap_count=0;
     return {success:true};
    };
    openGroobarbsDetails();
   });
   await page.locator('.groo-tile img[src*="red-cabbage"]:not([hidden])').waitFor();
   await page.getByRole('button',{name:'Change Red Cabbage'}).click();
   await choices.getByRole('button',{name:'Keep Potatoes'}).click();
   await page.getByRole('button',{name:'Restore original item'}).click();
   await page.getByText('Original item restored.').waitFor();
   const requests=await page.evaluate(()=>restoreRequests);
   assert.deepEqual(requests,[{type:'call_service',domain:'groobarbs',service:'reset',service_data:{order_id:10,item_id:1,content_id:2,revision:'reviewed'}}]);
   await page.locator('.groo-tile img[src*="2018-34"]:not([hidden])').waitFor();
   await page.getByText('0 of 4 used · 4 remaining').waitFor();
   await page.locator('.groobarbs-detail').evaluate(el=>el.close());
   await page.evaluate(()=>{
    haVerified=false;
    petActivity.maia={state:'on',t:Date.parse('2026-11-07T11:37:00Z')};
    haStates['binary_sensor.maia']={entity_id:'binary_sensor.maia',state:'on'};
    document.getElementById('petOverlay').classList.remove('hidden');
    renderPets();
   });
   assert.match(await page.locator('#petEventMaia').textContent(),/Came in · .*11:37/);
   assert.equal(await page.locator('#petEventSolo').textContent(),'No last event recorded');
   const pet=page.locator('.pet-portrait-card[data-pet-portrait="Maia"]');
   await pet.locator('img').evaluate((image,data)=>{
    image.src=data;
    image.hidden=false;
   },'data:image/png;base64,'+png.toString('base64'));
   const photoBox=await pet.locator('img').boundingBox();
   const eventBox=await pet.locator('#petEventMaia').boundingBox();
   const cardBox=await pet.boundingBox();
   assert(photoBox.height>80,'landscape portrait has enough unobstructed height');
   assert(eventBox.y>=photoBox.y+photoBox.height-1&&eventBox.y+eventBox.height<=cardBox.y+cardBox.height+1,'last event fits beneath the photo');
   await page.locator('#petOverlay').evaluate(el=>el.classList.add('hidden'));
   assert.equal(await page.locator('.salus-target-controls > button').count(),2);
   assert.equal(await page.locator('.salus-target-controls > #salusCurrent').count(),1);
   assert.equal(await page.locator('.salus-setpoint-row > button').count(),0);
  }
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

async function checkPrivatePortrait(browser) {
 const page=await browser.newPage();
 await page.setContent('<article class="pet-portrait-card" data-pet-portrait="Maia"><img hidden></article><p id="petPhotoStatus"></p>');
 await page.evaluate(()=>{
  window.haVerified=true;
  window.haSocket={readyState:1};
  window.portraitCommands=[];
  window.eufyWsCommand=async command=>{portraitCommands.push(command);return {success:true,result:{value:null}}};
 });
 await page.addScriptTag({path:'pet-portraits.js'});
 const jpeg=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');
  canvas.width=300;canvas.height=400;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#222222';ctx.fillRect(0,0,300,400);
  ctx.fillStyle='#ff8800';ctx.fillRect(126,123,84,84);
  return canvas.toDataURL('image/jpeg').split(',')[1];
 });
 await page.locator('input[type=file]').setInputFiles({name:'maia.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg,'base64')});
 await page.getByText(/photo saved for this Home Assistant user/).waitFor();
 const portrait=await page.evaluate(async()=>{
  const image=document.querySelector('article img');
  await image.decode();
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0);
  return {size:image.naturalWidth,red:ctx.getImageData(128,128,1,1).data[0],commands:portraitCommands.map(c=>[c.type,c.key])};
 });
 assert.equal(portrait.size,256);
 assert(portrait.red>200,'portrait crop is centred on the face region');
 assert.deepEqual(portrait.commands.map(c=>c[0]),['frontend/get_user_data','frontend/get_user_data','frontend/set_user_data']);
 assert.equal(portrait.commands.at(-1)[1],'halo_pet_portrait_v1_maia');
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
  await checkPrivatePortrait(browser);
  console.log('Landscape safe widths passed for all overlays, dialogs and main screens, with bars on either side and with no bars.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
