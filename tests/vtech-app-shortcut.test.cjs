const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const source=readFileSync('baby-camera.js','utf8');
const html=readFileSync('index.html','utf8');
const layoutCSS=readFileSync('home-screens.css','utf8');
const iconCSS=readFileSync('vtech-app.css','utf8');

function mount(native){
  class Element {
    constructor(tag='div'){
      this.tag=tag;this.children=[];this.handlers={};this.attributes={};
      this.className='';this.textContent='';this.src='';this.parent=null;
      this.classList={add(...v){this.values??=new Set();v.forEach(x=>this.values.add(x))},remove(){}};
    }
    append(...items){for(const item of items){if(item.parent){const siblings=item.parent.children;const i=siblings.indexOf(item);if(i>=0)siblings.splice(i,1)}this.children.push(item);item.parent=this}}
    replaceChildren(...items){this.children=[];this.append(...items)}
    insertBefore(item,ref){this.append(item);if(ref){const items=this.children;items.splice(items.indexOf(item),1);items.splice(items.indexOf(ref),0,item)}}
    setAttribute(k,v){this.attributes[k]=v}
    addEventListener(event,handler){this.handlers[event]=handler}
    remove(){if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1)}}
    querySelector(selector){return null}
  }
  const security=new Element(),stack=new Element(),kia=new Element(),coffee=new Element(),head=new Element();
  head.append(new Element('h2'),new Element('button'));
  security.querySelector=(selector)=>({
    '.home-compact-stack':stack,'.kia-placeholder':kia,'.coffee-card':coffee
  })[selector]||null;
  head.querySelector=selector=>selector==='.launcher-link'?head.children[1]:null;
  const messages=[];
  const document={
    querySelector(selector){return selector==='.home-security'?security:
      selector==='.launcher-entertainment .section-head'?head:null},
    createElement(tag){return new Element(tag)},
    getElementById(){return null}
  };
  const window={AndroidLauncher:native,notify(msg){messages.push(msg)},alert(msg){messages.push(msg)}};
  vm.runInNewContext(source,{document,window});
  return {security,stack,head,messages};
}
test('production loads the shortcut and never uses a camera API',()=>{
  assert.match(html,/vtech-app\.css\?v=2/);
  assert.match(html,/baby-camera\.js\?v=3/);
  assert.doesNotMatch(source,/vtech-launcher-shortcut|launcher-entertainment/);
  assert.doesNotMatch(iconCSS,/vtech-launcher-shortcut/);
  for(const bad of ['camera_proxy','eufyApi','haStates','haVerified','getUserMedia','localStorage']){
    assert.equal(source.includes(bad),false,'Unexpected private-camera or storage access: '+bad);
  }
});
test('Smart Home VTech card opens official app without adding a TV-launcher button',()=>{
  const launched=[];
  const native={
    supportsBabyMonitorApp:()=>true,
    babyMonitorInstalled:()=>true,
    babyMonitorIcon:()=> 'data:image/png;base64,AAAA',
    openApp:(name)=>launched.push(name)
  };
  const {security,stack,head}=mount(native);
  assert.equal(stack.children.length,2,'existing adjacent device controls remain in compact stack');
  const card=security.children.find(x=>x.className.includes('vtech-app-card'));
  assert.ok(card,'Smart Home card remains present');
  assert.equal(head.children.length,2,'TV Launcher retains only its original heading and App settings');
  assert.equal(card.attributes['aria-label'],'Open MyVTech Baby Pro app');
  assert.equal(card.children[0].children[0].src,'data:image/png;base64,AAAA');
  card.handlers.click();
  assert.deepEqual(launched,['MyVTech Baby Pro']);
});
test('VTech occupies one Kia-sized grid row with the slot below unoccupied',()=>{
  const rules=layoutCSS.slice(layoutCSS.indexOf('/* Shared four-row rhythm:'));
  assert.match(rules,/#dashboardPage \.home-security\.with-baby-camera\{grid-template-rows:repeat\(4,minmax\(0,1fr\)\)!important;gap:6px\}/);
  assert.match(rules,/\.home-compact-stack\{grid-column:2;grid-row:1\/5;grid-template-rows:repeat\(4,minmax\(0,1fr\)\);gap:6px\}/);
  assert.match(rules,/\.doorbell-slot\{grid-column:1;grid-row:1\/3\}/);
  assert.match(rules,/\.baby-camera-card\{grid-column:1;grid-row:3\/4\}/);
  assert.doesNotMatch(source,/vtech-future-card|grid-row:4/);
});
test('an old Halo build shows upgrade message rather than silently doing nothing',()=>{
  const launched=[];
  const {security,messages}=mount({openApp:(name)=>launched.push(name)});
  security.children.at(-1).handlers.click();
  assert.equal(launched.length,0);
  assert.match(messages[0],/Halo 4\.1\.4/);
});
test('when VTech is absent the shortcut asks for the official app',()=>{
  const launched=[];
  const {security,messages}=mount({
    supportsBabyMonitorApp:()=>true,babyMonitorInstalled:()=>false,
    babyMonitorIcon:()=>'',openApp:(name)=>launched.push(name)
  });
  security.children.at(-1).handlers.click();
  assert.equal(launched.length,0);
  assert.match(messages[0],/not installed or launchable/);
});
test('Android production and DEV restrict the launch to VTech official package',()=>{
  for(const base of ['app/src/main','android-dev-app/app/src/main']){
    const manifest=readFileSync(base+'/AndroidManifest.xml','utf8');
    const path=base+'/java/'+(base.startsWith('app/')?'uk/homecinema/launcher':'io/github/mg10a/hometvdev')+'/MainActivity.java';
    const main=readFileSync(path,'utf8');
    assert.match(manifest,/com\.cams\.vtech\.mvb\.pro/);
    assert.match(main,/private static final String VTECH_PACKAGE="com\.cams\.vtech\.mvb\.pro"/);
    assert.match(main,/supportsBabyMonitorApp\(\)/);
    assert.match(main,/babyMonitorInstalled\(\)/);
    assert.match(main,/babyMonitorIcon\(\)/);
    assert.match(main,/getLaunchIntentForPackage\(VTECH_PACKAGE\)/);
    assert.match(main,/"MyVTech Baby Pro"\.equals\(name\)/);
    assert.match(main,/VTECH_PACKAGE\.equals\(match\.activityInfo\.packageName\)/);
  }
});
