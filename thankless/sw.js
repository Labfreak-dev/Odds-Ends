// Thankless service worker: the page installs to a home screen and plays offline.
// Navigations race the network against a timer: a fresh page wins when it arrives in time, the cached copy
// serves when it does not, and the network response still updates the cache when it lands later, so a slow
// connection never gets stuck on an old page. Everything else is cache-first, refreshed in the background.
const CACHE='thankless-v2';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  const url=new URL(req.url); if(url.origin!==location.origin)return;
  if(url.searchParams.has('check'))return;   // the page's own update probe goes straight to the network
  if(req.mode==='navigate'){
    e.respondWith((async()=>{const c=await caches.open(CACHE);
      const net=fetch(new Request(req,{cache:'no-cache'})).then(r=>{if(r&&r.ok)c.put('./index.html',r.clone());return r}).catch(()=>null);
      const timer=new Promise(res=>setTimeout(()=>res('timeout'),6000));
      const first=await Promise.race([net,timer]);
      if(first&&first!=='timeout')return first;
      const hit=(await c.match('./index.html'))||(await c.match('./'));
      if(hit){e.waitUntil(net);return hit}
      return (await net)||Response.error()})());
    return;
  }
  e.respondWith((async()=>{const c=await caches.open(CACHE);const hit=await c.match(req);const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r}).catch(()=>null);if(hit){e.waitUntil(net);return hit}return (await net)||Response.error()})());
});
