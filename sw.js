// Network-first navigation avoids stale demo versions; cache only basic shell.
const CACHE='home-tv-shell-v1';
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/home-tv-launcher/')));return}});
