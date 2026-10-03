const CACHE='pcpe-planner-v3';
const CORE=['./','./index.html','./styles.css?v=20261003-2','./data.js?v=20261003-2','./app.js?v=20261003-2','./manifest.webmanifest?v=20261003-2'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  event.respondWith((async()=>{
    try{
      const fresh=await fetch(event.request,{cache:'no-store'});
      if(fresh && fresh.ok){
        const cache=await caches.open(CACHE);
        cache.put(event.request,fresh.clone());
      }
      return fresh;
    }catch(err){
      const cached=await caches.match(event.request,{ignoreSearch:false});
      if(cached) return cached;
      return caches.match('./index.html');
    }
  })());
});