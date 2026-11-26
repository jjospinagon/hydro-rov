/* HYDRO-ROV · Análisis — service worker
   Solo atiende las notificaciones push: el servidor envía un push vacío; aquí se piden los avisos pendientes
   (con la clave propia de este equipo, sin la sesión), se muestra la notificación y se pone el contador del ícono.
   No guarda páginas en caché: la app siempre carga la última versión publicada. */
'use strict';
const CONF = '/analisis/__push';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function conf() {
  try { const c = await caches.open('hr-push'); const r = await c.match(CONF); return r ? await r.json() : null; } catch (e) { return null; }
}
async function contador(n) {
  try { if (self.navigator.setAppBadge) { if (n > 0) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge(); } } catch (e) { /* sin soporte */ }
}
async function alPush() {
  let titulo = 'HYDRO-ROV', cuerpo = 'Hay novedades en la agenda.', url = './#agenda', tag = 'hydro-rov', n = null;
  try {
    const k = await conf();
    if (k && k.api) {
      const r = await fetch(k.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, credentials: 'omit', redirect: 'follow',
        body: JSON.stringify({ action: 'pushNovedades', sid: k.sid, clave: k.clave }) });
      const j = await r.json();
      if (j.ok) {
        n = j.noLeidos; const a = j.avisos[0];
        if (a) { titulo = a.ti; cuerpo = a.cu + (j.noLeidos > 1 ? `  (+${j.noLeidos - 1} más)` : ''); url = './' + (a.url || '#agenda'); tag = a.id; }
      }
    }
  } catch (e) { /* sin conexión: notificación genérica */ }
  if (n != null) await contador(n);
  const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  cl.forEach((c) => c.postMessage({ tipo: 'avisos' }));
  return self.registration.showNotification(titulo, { body: cuerpo, tag, renotify: true, icon: 'icono-192.png', badge: 'icono-badge.png', data: { url }, timestamp: Date.now() });
}
self.addEventListener('push', (e) => e.waitUntil(alPush()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#agenda', self.registration.scope).href;
  e.waitUntil((async () => {
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = cl.find((c) => c.url.startsWith(self.registration.scope));
    if (app) { await app.focus(); try { await app.navigate(url); } catch (err) { app.postMessage({ tipo: 'ir', url }); } return; }
    await self.clients.openWindow(url);
  })());
});
