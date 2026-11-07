/* Known public produce photographs, followed by a cached look-up for new names. */
(() => {
const known={
 "apples": "https://groobox-marketing.transforms.svdcdn.com/production/images/IMG_0450-min.JPG?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1660894932&s=8a065d36ae3fb11e5c5e5d0132297569",
 "aubergine": "https://media.riverford.co.uk/images/1692-e42e23338a90f943d196300dc8ca5046.jpg",
 "bananas": "https://media.riverford.co.uk/images/2249-15b0b9121c48b58dda40496945f25156.jpg",
 "beetroot": "https://media.riverford.co.uk/images/photo-1500x1500-078c162cac5c49dfb7b2cba21114b1ff.jpg",
 "broccoli": "https://media.riverford.co.uk/images/broccoli-calabrese-1500x1500-4dc36a29961e1e3216a2eadf2e555af5.jpg",
 "carrots": "https://groobox-marketing.transforms.svdcdn.com/production/images/gb_web_products_2018-63.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1543683435&s=f85273c8bc8e56336ee3eefa675877a6",
 "cauliflower": "https://groobox-marketing.transforms.svdcdn.com/production/images/Cauliflower-min.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1643290578&s=0395fe3aced3bea7eca57bbcc04fe6ac",
 "celery": "https://media.riverford.co.uk/images/celery-each-670x670-2d7ed609c56d7cfd270de098533aa4f5.jpg",
 "cherry vine tomatoes": "https://greentomato.club/cdn/shop/products/GT-Cherry-Vine.png?v=1652866365&width=400",
 "clementines": "https://media.riverford.co.uk/images/clementines-box-800x800-b683580d3da1e870c1a442281a5da96c.jpg",
 "courgettes": "https://media.riverford.co.uk/images/courgettes-1300x1300-60ad5713c034731eab78a4260ce50bb4.jpg",
 "golden beetroot": "https://media.riverford.co.uk/images/golden-beetroot-920x920-e46e3a72234f508f4790df283d72b73b.jpg",
 "harlequin squash": "https://groobox-marketing.transforms.svdcdn.com/production/images/Depositphotos_13659379_S.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1634210614&s=717f8acf2f1f9ca2e0e2f45d940c41ba",
 "leeks": "https://groobox-marketing.transforms.svdcdn.com/production/images/gb_web_products_2018-28-min.jpeg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1639569997&s=6b14266b144aa0de7c4a87caf9b41f2b",
 "lemons": "https://groobox-marketing.transforms.svdcdn.com/production/images/shutterstock_289188959.jpeg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1739451598&s=a7f00b935883d07e9b2eae12c4e8c206",
 "lettuce": "https://www.abelandcole.co.uk/media/5944_21656_z.jpg",
 "mushrooms": "https://media.riverford.co.uk/images/mushrooms-chestnut-200g-1500x1500-1a77b8a4cff701ab33634e42d973aca0.jpg",
 "onions": "https://agfstorage.blob.core.windows.net/misc/StockPhotos/Onions/Onions_FP_img_0013.jpg",
 "pak choi": "https://media.riverford.co.uk/images/pak-choi-350g-1500x1500-3fae680c900ded1ee2fee2b070da5d50.jpg",
 "parsnips": "https://media.riverford.co.uk/images/1683-ff4eff11bea34d574f5b52c12910085d.jpg",
 "pears": "https://media.riverford.co.uk/images/conference-pears-3000x3000-f1cd50378c16509de923908ec2590891.jpg",
 "peppers": "https://media.riverford.co.uk/images/red-pepper-1300x1300-a1c42c29ab91633ac9e0690f43896a26.jpg",
 "plums": "https://media.riverford.co.uk/images/plums-2500x2500-44dec9f865ec510351c29c80eadb6c0e.jpg",
 "potatoes": "https://groobox-marketing.transforms.svdcdn.com/production/images/gb_web_products_2018-34.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1543683495&s=11c01df8a7f364379e329f4c4eb2859c",
 "raspberries": "https://groobox-marketing.transforms.svdcdn.com/production/images/Depositphotos_213798268_S.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1654174485&s=0baa42c9636a5eebc7a2bf8843ed91c2",
 "red cabbage": "https://media.riverford.co.uk/images/red-cabbage-1300x1300-b2120cdfcc6e2a08ed41ed5fe2f99210.jpg",
 "red onions": "https://media.riverford.co.uk/images/onions-red-500g-1500x1500-9af669b506bde5bf41cbf6a4d2c98c15.jpg",
 "romanesco": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Romanesco_broccoli%2C_Close_up.jpg",
 "savoy cabbage": "https://groobox-marketing.transforms.svdcdn.com/production/images/IMG_0445-min.JPG?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1671015353&s=d55d4421486caaf5b9ce0d634e9e2ab0",
 "spaghetti squash": "https://groobox-marketing.transforms.svdcdn.com/production/images/IMG_3696.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1755177915&s=80be418a9cbf4d61774131607bc428d9",
 "spinach": "https://media.riverford.co.uk/images/2038-763167cc7bb44eb8302f8826473f551b.jpg",
 "sweet potatoes": "https://media.riverford.co.uk/images/sweet-potatoes-600g-1500x1500-7967d053144cfd2560ea99d42a6a62e3.jpg",
 "uchiki kuri squash": "https://groobox-marketing.transforms.svdcdn.com/production/images/Groobarbs_Jan_2022-213-min-min.jpg?w=400&h=225&auto=compress%2Cformat&fit=crop&dm=1730300903&s=317db2281636fdf565d4c002859a976f"
};
const cacheKey='halo-groobox-photos-v1',day=86400000;
const pending=new Map();
let queue=Promise.resolve(),cache=new Map();
try{cache=new Map(JSON.parse(localStorage.getItem(cacheKey)||'[]'))}catch{}
function remember(name,photo,ttl){
 cache.delete(name);
 cache.set(name,{photo,until:Date.now()+ttl});
 while(cache.size>100)cache.delete(cache.keys().next().value);
 try{localStorage.setItem(cacheKey,JSON.stringify([...cache]))}catch{}
}
function wikiImage(source){
 try{
  const url=new URL(source);
  return url.protocol==='https:'&&['upload.wikimedia.org','thumb.wikimedia.org'].includes(url.hostname)
   &&/\.(?:jpe?g|png|webp)$/i.test(url.pathname);
 }catch{return false}
}
function lookup(name){
 const stored=cache.get(name);
 if(stored?.until>Date.now()&&(!stored.photo||wikiImage(stored.photo.url)))return Promise.resolve(stored.photo);
 if(!pending.has(name)){
  const work=queue.then(async()=>{
   const params=new URLSearchParams({
    action:'query',format:'json',formatversion:'2',origin:'*',redirects:'1',titles:name,
    prop:'pageimages|pageprops|pageterms',ppprop:'disambiguation',wbptterms:'description',
    piprop:'thumbnail|name',pilicense:'free',pithumbsize:'320'
   });
   try{
    const response=await fetch('https://en.wikipedia.org/w/api.php?'+params,{
     credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(7000)
    });
    if(!response.ok)throw Error('Photo lookup unavailable');
    const result=await response.json();
    if(result.error)throw Error('Photo lookup rejected');
    const page=result.query?.pages?.[0],source=page?.thumbnail?.source;
    const description=page?.terms?.description?.join(' ')||'';
    const photo=page&&!page.missing&&!Object.hasOwn(page.pageprops||{},'disambiguation')
     &&/fruit|vegetable|edible|food|cultivar|plant|mushroom|fungus/i.test(description)&&wikiImage(source)
     ?{url:source,credit:'Wikimedia Commons · '+page.pageimage}:null;
    remember(name,photo,(photo?30:7)*day);
    return photo;
   }catch{remember(name,null,900000);return null}
  });
  queue=work.then(()=>{pending.delete(name)});
  pending.set(name,work);
 }
 return pending.get(name);
}
window.attachGrooboxPhoto=(parent,label)=>{
 const name=String(label||'').trim().toLowerCase();
 const show=photo=>{
  if(!photo)return;
  const image=document.createElement('img');
  image.className='groo-picture';image.alt='';image.hidden=true;
  image.referrerPolicy='no-referrer';image.decoding='async';
  if(photo.credit)image.title=photo.credit;
  image.addEventListener('load',()=>{image.hidden=false},{once:true});
  image.addEventListener('error',()=>{
   image.remove();
   if(!Object.hasOwn(known,name))remember(name,null,3600000);
  },{once:true});
  parent.prepend(image);
  image.src=photo.url;
 };
 if(Object.hasOwn(known,name))show({url:known[name]});
 else if(/^[\p{L}][\p{L}\p{M} ’'-]{1,59}$/u.test(name)){
  lookup(name).then(photo=>{if(parent.isConnected)show(photo)});
 }
};
})();
