const SHELL='trascrivi-studio-shell-v1';const ASSETS=['./','./index.html','./app.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',ev=>{ev.waitUntil(caches.open(SHELL).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',ev=>{ev.waitUntil(self.clients.claim())});
self.addEventListener('fetch',ev=>{if(ev.request.method!=='GET')return;
const url=new URL(ev.request.url);const isApp=url.origin===self.location.origin;const isCDN=url.hostname==='cdn.jsdelivr.net';
if(!isApp&&!isCDN)return;ev.respondWith(caches.match(ev.request).then(hit=>hit||fetch(ev.request).then(res=>{if(res.ok||res.type==='opaque'){const clone=res.clone();caches.open(SHELL).then(c=>c.put(ev.request,clone)).catch(()=>{})}return res})))
});
