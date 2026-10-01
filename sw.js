/* Service worker : le carnet fonctionne hors connexion.
   - Fichiers de l'appli : servis depuis le cache, mis à jour en arrière-plan.
   - reglementation.json : toujours demandé au réseau d'abord (pour avoir les dernières valeurs légales). */
const CACHE = 'carnet-assmat-3.6.0-584f197b';
const FILES = ['./','./index.html','./app.css','./reg.js','./js/core.js','./js/contrats.js','./js/themes.js','./js/fiscal.js','./js/suivi.js','./js/docs.js','./js/io.js','./js/plus.js','./js/shell.js',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./reglementation.json'];
// la nouvelle version attend l'accord de l'utilisatrice (bandeau « Mettre à jour ») ; la toute première installation est immédiate
// cache:'reload' : on télécharge toujours les fichiers frais, jamais une copie gardée par le navigateur (sinon une
// nouvelle version pourrait être enregistrée avec un ancien fichier)
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(u=>new Request(u, {cache:'reload'}))))); });
self.addEventListener('message', e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);
  if(url.pathname.endsWith('reglementation.json')){
    e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(CACHE).then(c=>c.put('./reglementation.json', cp)); return r; }).catch(()=>caches.match('./reglementation.json')));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch:true}).then(hit=>{
    const net = fetch(req, {cache:'no-cache'}).then(r=>{ if(r && (r.ok || r.type==='opaque')){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req, cp)); } return r; }).catch(()=>hit);
    return hit || net;
  }));
});
