const {Window}=await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const w=new Window({url:'https://example.com'});w.haSocket={};let connected=true;
const states={},calls=[];
const put=(id,value,attrs={})=>states[id]={entity_id:id,state:value,attributes:{friendly_name:'Coffee Maker '+id.split('.').at(-1).replaceAll('_',' '),...attrs}};
const p='consumer_products_coffee_maker_program_beverage_';
put('select.coffee_selected_program',p+'coffee',{options:[p+'coffee',p+'espresso']});
put('select.coffee_bean_amount','strong',{options:['mild','strong']});
put('number.coffee_fill_quantity','120',{min:80,max:240,step:10,unit_of_measurement:'mL'});
put('switch.coffee_power','on');put('switch.coffee_cup_warmer','off');put('switch.coffee_multiple_beverages','off');
put('binary_sensor.coffee_remote_start','on');put('sensor.coffee_operation_state','ready');
const registry=Object.keys(states).map(entity_id=>({entity_id,platform:'home_connect',device_id:'machine'}));registry.push({entity_id:'event.coffee_water_tank_empty',platform:'home_connect',device_id:'machine',disabled_by:'integration'});
let fail=false;
async function request(c){calls.push(c);if(c.type==='config/entity_registry/list')return registry;if(c.type==='get_services')return {home_connect:{set_program_and_options:{}}};if(c.type==='get_states')return [...Object.values(states),...(registry.at(-1).disabled_by===null?[{entity_id:'event.coffee_water_tank_empty',state:'unknown',attributes:{friendly_name:'Coffee Maker Water tank empty'}}]:[])];if(fail)throw Error('Test error');if(c.domain==='select'){states[c.target.entity_id].state=c.service_data.option;if(c.target.entity_id.includes('selected_program')){states['number.coffee_fill_quantity'].attributes={min:20,max:80,step:5};states['number.coffee_fill_quantity'].state='40'}}if(c.domain==='number')states[c.target.entity_id].state=String(c.service_data.value);return {}}
w.eval(readFileSync(new URL('../coffee-controls.js',import.meta.url),'utf8'));
const d=w.document.createElement('dialog');w.document.body.append(d);const panel=w.createCoffeePanel({dialog:d,request,states:()=>states,connected:()=>connected});
const tick=()=>new Promise(r=>setTimeout(r,5));const click=text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,'Missing '+text);b.click()};
panel.open();await tick();assert.equal(calls.filter(c=>c.type==='call_service').length,0);
assert.equal(d.querySelector('input').max,'240');click('Caffè crema ▾');click('Espresso');await tick();assert.equal(calls.at(-1).service,'select_option');assert.equal(calls.at(-1).target.entity_id,'select.coffee_selected_program');assert.equal(d.querySelector('input').max,'80');assert.equal(calls.filter(c=>c.domain==='home_connect').length,0);
const slider=d.querySelector('input');slider.focus();slider.value='50';slider.dispatchEvent(new w.Event('input'));panel.update();assert.equal(d.querySelector('input'),slider);assert.equal(slider.value,'50');slider.dispatchEvent(new w.Event('change'));await tick();assert.equal(JSON.parse(w.localStorage.getItem('halo.coffee.sizes.v1'))['select.coffee_selected_program:'+p+'espresso'],50);slider.blur();
click('Review drink');assert(d.textContent.includes('Espresso'));states['select.coffee_bean_amount'].state='mild';panel.update();assert(!d.textContent.includes('Brew now'));click('Review drink');click('Brew now');await tick();assert.equal(calls.at(-1).service,'set_program_and_options');assert.equal(calls.at(-1).service_data.device_id,'machine');assert.equal(calls.at(-1).service_data.affects_to,'active_program');assert.equal(calls.at(-1).service_data.consumer_products_coffee_maker_option_fill_quantity,50);assert([...d.querySelectorAll('footer button')].find(b=>b.textContent==='Review drink').disabled);panel.open();assert([...d.querySelectorAll('footer button')].find(b=>b.textContent==='Review drink').disabled);
states['sensor.coffee_operation_state'].state='running';panel.update();states['sensor.coffee_operation_state'].state='ready';panel.update();assert(![...d.querySelectorAll('footer button')].find(b=>b.textContent==='Review drink').disabled);
click('Care');assert(d.textContent.includes('not exposed'));assert(!d.textContent.includes('All clear'));click('Enable 1 status alerts');await tick();assert.equal(calls.find(c=>c.type==='config/entity_registry/update').disabled_by,null);assert(states['event.coffee_water_tank_empty']);assert(d.textContent.includes('No event received yet'));
click('Machine');fail=true;click('Off');await tick();assert(d.textContent.includes('Test error'));assert.equal(states['switch.coffee_cup_warmer'].state,'off');
click('Drink');states['number.coffee_fill_quantity'].state='20';panel.update();assert.equal(d.querySelector('input').value,'50');click('Review drink');click('Brew now');await tick();assert(d.textContent.includes('did not confirm the brew'));assert([...d.querySelectorAll('button')].find(b=>b.textContent==='Review drink').disabled);connected=false;panel.update();click('Drink');assert([...d.querySelectorAll('footer button')].find(b=>b.textContent==='Review drink').disabled);await w.happyDOM.close();console.log('Coffee: no brew on open/selection, recipe-specific limits, confirmation invalidation, duplicate protection, disabled sensors, error and disconnect states passed.');

