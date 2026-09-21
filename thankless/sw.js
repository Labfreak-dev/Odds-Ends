// Thankless service worker: the page installs to a home screen and plays offline.
// Navigations go network-first (a deploy shows up on the next load) with the cache as the
// offline fallback; everything else is served from cache and refreshed in the background.
const CACHE='thankless-v1';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  const url=new URL(req.url); if(url.origin!==location.origin)return;
  if(req.mode==='navigate'){
    e.respondWith((async()=>{const c=await caches.open(CACHE);try{const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),4000);const r=await fetch(req,{signal:ctl.signal});clearTimeout(t);if(r&&r.ok)c.put('./index.html',r.clone());return r}catch(err){return (await c.match('./index.html'))||(await c.match('./'))||Response.error()}})());
    return;
  }
  e.respondWith((async()=>{const c=await caches.open(CACHE);const hit=await c.match(req);const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r}).catch(()=>null);return hit||(await net)||Response.error()})());
});
