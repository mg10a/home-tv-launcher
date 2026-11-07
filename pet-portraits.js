/* Portrait thumbnails are shared through private HA user data. */
(() => {
 const profiles={
  Maia:{ratio:3/4,x:.421,y:.309,size:.278},
  Solo:{ratio:9/16,x:.376,y:.404,size:.382}
 };
 const key=name=>'halo_pet_portrait_v1_'+name.toLowerCase();
 const isPortrait=value=>typeof value==='string'&&value.length<120000&&/^data:image\/jpeg;base64,[a-z0-9+/]+=*$/i.test(value);
 const portraits={};
 let socket;
 const status=document.getElementById('petPhotoStatus');
 if(!status)return;
 function show(name,url){
  portraits[name]=url;
  for(const card of document.querySelectorAll('[data-pet-portrait="'+name+'"]')){
   const image=card.querySelector('img');
   image.hidden=!url;
   if(url)image.src=url;
   else image.removeAttribute('src');
  }
  if(window.AndroidLauncher)status.textContent=Object.keys(profiles).every(name=>portraits[name])?'':
   'Set portraits in Halo in your phone browser using the same Home Assistant sign-in.';
 }
 async function get(name){
  const reply=await eufyWsCommand({type:'frontend/get_user_data',key:key(name)});
  if(!reply.success)throw Error('Home Assistant could not read the portrait.');
  return isPortrait(reply.result?.value)?reply.result.value:null;
 }
 function sync(){
  const active=haVerified&&haSocket?.readyState===1?haSocket:null;
  if(active===socket)return;
  socket=active;
  for(const name of Object.keys(profiles)){
   show(name,null);
   if(active)get(name).then(url=>{if(socket===active)show(name,url)}).catch(()=>{});
  }
 }
 async function crop(file,profile){
  if(file.size>25000000)throw Error('Choose a photo under 25 MB.');
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();
   image.src=url;
   try{await image.decode()}catch{throw Error('Choose a JPEG or PNG photo.')}
   const width=image.naturalWidth,height=image.naturalHeight;
   const preset=Math.abs(width/height-profile.ratio)<.025;
   const size=preset?Math.round(width*profile.size):Math.min(width,height);
   const x=preset?Math.round(width*profile.x):(width-size)/2;
   const y=preset?Math.round(height*profile.y):(height-size)/2;
   const canvas=document.createElement('canvas');
   canvas.width=canvas.height=256;
   canvas.getContext('2d').drawImage(image,x,y,size,size,0,0,256,256);
   return canvas.toDataURL('image/jpeg',.82);
  }finally{URL.revokeObjectURL(url)}
 }
 for(const [name,profile] of Object.entries(profiles)){
  const card=document.querySelector('.pet-portrait-card[data-pet-portrait="'+name+'"]');
  if(!card)continue;
  if(window.AndroidLauncher)continue; // Existing WebViews do not implement a file chooser.
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';input.hidden=true;
  input.setAttribute('aria-label','Choose '+name+' photo');
  const button=document.createElement('button');
  button.type='button';button.textContent='Choose photo';button.setAttribute('aria-label','Choose '+name+' photo');
  button.onclick=()=>input.click();
  input.onchange=async()=>{
   const file=input.files?.[0],active=socket;
   input.value='';
   if(!file)return;
   if(!active){status.textContent='Connect Home Assistant before choosing a photo.';return}
   button.disabled=true;
   try{
    const image=await crop(file,profile);
    if(socket!==active||!isPortrait(image))throw Error('Could not prepare this photo.');
    const reply=await eufyWsCommand({type:'frontend/set_user_data',key:key(name),value:image});
    if(!reply.success||socket!==active)throw Error('Home Assistant could not save the photo.');
    show(name,image);
    status.textContent=name+'’s photo saved for this Home Assistant user.';
   }catch(error){status.textContent=error.message}
   finally{button.disabled=false}
  };
  card.append(button,input);
 }
 window.addEventListener('home-states-updated',sync);
 sync();
})();
