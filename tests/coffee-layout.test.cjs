const fs=require('fs');const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [width,height]of [[360,780],[412,915],[780,360],[915,412]]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#0e192a"><dialog class="coffee-detail"></dialog></body>'}));await page.goto('https://fixture.test');
 await page.addStyleTag({content:fs.readFileSync('home-screens.css','utf8')});
 await page.evaluate(()=>{window.haSocket={};window.mockStates={};const put=(id,state,attributes={})=>mockStates[id]={entity_id:id,state,attributes:{friendly_name:'Coffee Maker '+id.split('.').at(-1).replaceAll('_',' '),...attributes}};
 put('select.coffee_selected_program','consumer_products_coffee_maker_program_beverage_coffee',{options:['consumer_products_coffee_maker_program_beverage_coffee','consumer_products_coffee_maker_program_beverage_espresso']});
 put('number.coffee_fill_quantity','120',{min:80,max:200,step:40,unit_of_measurement:'mL'});put('select.coffee_bean_amount','consumer_products_coffee_maker_enum_type_bean_amount_normal',{options:['consumer_products_coffee_maker_enum_type_bean_amount_normal','consumer_products_coffee_maker_enum_type_bean_amount_strong']});put('select.coffee_temperature','94°C');put('switch.coffee_multiple_beverages','off');put('switch.coffee_power','on');put('switch.coffee_cup_warmer','off');put('switch.coffee_child_lock','off');put('binary_sensor.coffee_remote_start','on');put('sensor.coffee_operation_state','ready');put('event.coffee_water_tank_empty','unknown');window.mockCalls=[];window.mockRequest=async c=>{mockCalls.push(c);if(c.type==='config/entity_registry/list')return Object.keys(mockStates).map(entity_id=>({entity_id,device_id:'machine',platform:'home_connect'}));if(c.type==='get_services')return {home_connect:{set_program_and_options:{}}};if(c.type==='get_states')return Object.values(mockStates);throw Error('BSH.Common.Error.400.BadRequest: fixture rejection')};});
 await page.addScriptTag({content:fs.readFileSync('coffee-controls.js','utf8')});await page.evaluate(()=>{window.panel=createCoffeePanel({dialog:document.querySelector('dialog'),request:mockRequest,states:()=>mockStates,connected:()=>true});window.addEventListener('home-states-updated',panel.update);panel.open()});
 await page.getByRole('button',{name:'Review drink',exact:true}).waitFor();
 const check=async label=>{const result=await page.evaluate(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect(),f=d.querySelector('footer').getBoundingClientRect();return {width:d.scrollWidth,client:d.clientWidth,foot:f.bottom<=r.bottom+1,escaped:[...d.querySelectorAll('button')].filter(b=>{const q=b.getBoundingClientRect();return q.left<r.left||q.right>r.right+1}).map(b=>b.textContent)}});assert(result.width<=result.client+1,`${width} ${label} scroll overflow`);assert(result.foot,`${width} ${label} footer clipped`);assert.deepEqual(result.escaped,[],`${width} ${label} buttons clipped`)};
 await check('Drink');await page.getByRole('button',{name:'Caffè crema ▾',exact:true}).click();await check('Recipe chooser');await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByRole('button',{name:'Regular ▾',exact:true}).click();await check('Strength chooser');await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByRole('button',{name:'Review drink',exact:true}).click();await check('Review');await page.getByRole('button',{name:'Brew now',exact:true}).click();await page.getByText(/The machine did not confirm/).waitFor();await check('Brew error');
 for(const tab of ['Machine','Care']){await page.getByRole('button',{name:tab,exact:true}).click();await check(tab)}
 assert.equal(await page.evaluate(()=>mockCalls.filter(c=>c.type==='call_service').length),1);
 await page.close();console.log(`Coffee layout ${width}x${height}: all tabs, pickers, review and error fit`);
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
