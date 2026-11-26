/* HYDRO-ROV · Análisis — avisos: campana con contador, contador en el ícono de la app instalada y notificaciones push.
   El servidor guarda los avisos de cada creador (agenda nueva, reprogramada, confirmada o cancelada; cotización aprobada).
   Push: suscripción Web Push con la clave VAPID del servidor; el service worker (sw.js) muestra la notificación. */
'use strict';
(function () {
const HR = window.HR, U = HR.ui, C = HR.C;
const { $, ico } = U;
const esc = HR.esc;
const V = { lista: [], noLeidos: 0, timer: null, abierto: false };
const CONF = '/analisis/__push';
const soportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let regSW = null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((r) => { regSW = r; }).catch(() => { /* sin service worker */ });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.tipo === 'avisos') cargar(); if (e.data && e.data.tipo === 'ir') location.href = e.data.url; });
}

/* ============================================================ avisos y contador */
async function cargar() {
  if (!HR.S.user || !U.esCreador()) return;
  try { const r = await HR.apiOk('avisos'); V.lista = r.avisos; V.noLeidos = r.noLeidos; pintar(); } catch (e) { /* reintenta en el próximo ciclo */ }
}
function contadorIcono(n) {
  try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) { /* sin soporte */ }
}
function pintar() {
  const n = $('#avisos-n'); if (!n) return;
  n.textContent = V.noLeidos > 99 ? '99+' : String(V.noLeidos); n.classList.toggle('hide', !V.noLeidos);
  $('#b-avisos').setAttribute('aria-label', V.noLeidos ? `Avisos: ${V.noLeidos} sin leer` : 'Avisos');
  contadorIcono(V.noLeidos);
  if (V.abierto) pintarPanel();
}
async function leidos(seccion, ids) {
  if (!U.esCreador()) return;
  if (!V.lista.some((x) => !x.leido && (seccion ? x.sec === seccion : ids ? ids.includes(x.id) : true))) return;
  try { const r = await HR.apiOk('avisosLeidos', seccion ? { seccion } : ids ? { ids } : { todos: true }); V.lista = r.avisos; V.noLeidos = r.noLeidos; pintar(); } catch (e) { /* nada */ }
}
function iniciar() {
  clearInterval(V.timer);
  if (!U.esCreador()) return;
  cargar(); V.timer = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 60000);
  asegurarSuscripcion();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && HR.S.user) cargar(); });

/* ============================================================ panel de la campana */
const hace = (iso) => U.hace(iso);
function pintarPanel() {
  let p = $('#avisos-panel');
  if (!p) { p = document.createElement('div'); p.id = 'avisos-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Avisos'); document.body.appendChild(p); }
  const pushTxt = estadoPushTxt();
  p.innerHTML = `<div class="ap-h"><b>Avisos</b>${V.noLeidos ? `<button class="btn xs fant" data-av="todos">Marcar todo como leído</button>` : ''}<button class="btn xs fant" data-av="cerrar" aria-label="Cerrar">${ico('x')}</button></div>
    <div class="ap-l">${V.lista.length ? V.lista.slice(0, 25).map((a) => `<button type="button" class="ap-i${a.leido ? '' : ' nuevo'}" data-av="ir" data-id="${esc(a.id)}" data-url="${esc(a.url || '')}">
      <i class="${esc(a.sec)}"></i><span><b>${esc(a.ti)}</b><small>${esc(a.cu)}</small><em>${esc(hace(a.t))}</em></span></button>`).join('') : '<p class="ap-vacio">Sin avisos. Aquí aparece lo que agende o cambie el otro creador.</p>'}</div>
    ${pushTxt ? `<div class="ap-push">${pushTxt}</div>` : ''}`;
  p.classList.add('on');
}
function estadoPushTxt() {
  if (!soportaPush()) return esIOS() && !instalada() ? 'Para recibir notificaciones en el iPhone: abra esta página en Safari → Compartir → <b>Agregar a inicio</b>, y actívelas desde la app.' : '';
  if (Notification.permission === 'denied') return 'Las notificaciones están bloqueadas en este navegador. Actívelas en los ajustes del sitio.';
  if (Notification.permission !== 'granted' || !V.suscrito) return `<button class="btn sm pri" data-av="activar">${ico('campana')}Activar notificaciones en este equipo</button>`;
  return '';
}
function cerrarPanel() { V.abierto = false; const p = $('#avisos-panel'); if (p) p.classList.remove('on'); }
document.addEventListener('click', async (e) => {
  if (e.target.closest('#b-avisos')) { e.preventDefault(); V.abierto = !V.abierto; if (V.abierto) { pintarPanel(); cargar(); } else cerrarPanel(); return; }
  const b = e.target.closest('[data-av]');
  if (!b) { if (V.abierto && !e.target.closest('#avisos-panel')) cerrarPanel(); return; }
  const a = b.dataset.av;
  if (a === 'cerrar') return cerrarPanel();
  if (a === 'todos') return leidos();
  if (a === 'activar') return activar();
  if (a === 'ir') { cerrarPanel(); leidos(null, [b.dataset.id]); if (b.dataset.url) location.hash = b.dataset.url.replace(/^#/, ''); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && V.abierto) cerrarPanel(); });

/* ============================================================ push */
const b64aU8 = (s) => { const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function registro() { if (!regSW) regSW = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; return regSW; }
async function guardarConf(o) { const c = await caches.open('hr-push'); await c.put(CONF, new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })); }
async function leerConf() { try { const c = await caches.open('hr-push'); const r = await c.match(CONF); return r ? await r.json() : null; } catch (e) { return null; } }
const nombreEquipo = () => { const u = navigator.userAgent; return (/iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Equipo') + (instalada() ? ' · app instalada' : ' · navegador'); };
async function suscribir() {
  const reg = await registro(); await navigator.serviceWorker.ready;
  const { clave } = await HR.apiOk('pushClave');
  let sub = await reg.pushManager.getSubscription();
  if (sub) { const k = new Uint8Array(sub.options && sub.options.applicationServerKey || []); if (k.length && btoa(String.fromCharCode(...k)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== clave) { await sub.unsubscribe(); sub = null; } }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aU8(clave) });
  const r = await HR.apiOk('pushSuscribir', { sub: sub.toJSON(), ua: nombreEquipo() });
  await guardarConf({ api: C.API, sid: r.sid, clave: r.clave, email: HR.S.user.email });
  V.suscrito = true;
  return sub;
}
async function activar() {
  if (!soportaPush()) { HR.toast(esIOS() && !instalada() ? 'En iPhone primero agregue la app a la pantalla de inicio (Safari → Compartir → Agregar a inicio) y actívelas desde ahí.' : 'Este navegador no admite notificaciones push.', 'err', 9000); return; }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { HR.toast('No se dio el permiso de notificaciones.', 'err'); return; }
  const pr = HR.progreso('Activando las notificaciones…'); pr.set(0.4);
  try {
    await suscribir(); pr.set(0.8);
    const r = await HR.apiOk('pushProbar');
    HR.toast(r.enviados ? 'Notificaciones activadas. Le llegará una de prueba en unos segundos.' : 'Notificaciones activadas en este equipo.', 'ok', 7000);
    cargar(); pintarPanel(); document.querySelectorAll('.ag-push').forEach((b) => b.classList.add('hide'));
    if (HR.push.alCambiar) HR.push.alCambiar();
  } catch (e) { HR.toast('No se pudieron activar: ' + esc(e.message), 'err', 9000); } finally { pr.fin(); }
}
async function desactivar() {
  try {
    const reg = await registro(), sub = await reg.pushManager.getSubscription();
    if (sub) { await HR.apiOk('pushQuitar', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
    const c = await caches.open('hr-push'); await c.delete(CONF); V.suscrito = false; contadorIcono(0);
    HR.toast('Notificaciones desactivadas en este equipo.', 'ok');
  } catch (e) { HR.toast(esc(e.message), 'err'); }
}
/* al entrar: si el permiso ya está dado, mantiene viva la suscripción y la clave del equipo (sin preguntar nada) */
async function asegurarSuscripcion() {
  V.suscrito = false;
  if (!soportaPush() || Notification.permission !== 'granted') return;
  try {
    const reg = await registro(), sub = await reg.pushManager.getSubscription(), k = await leerConf();
    if (sub && k && k.email === HR.S.user.email && k.api === C.API) { V.suscrito = true; return; }
    await suscribir();
  } catch (e) { /* se reintenta en el próximo ingreso */ }
}
function ofrecer(btn) {
  if (!btn || !U.esCreador()) return;
  const mostrar = () => btn.classList.toggle('hide', !(soportaPush() ? Notification.permission === 'default' || (Notification.permission === 'granted' && !V.suscrito) : esIOS() && !instalada()));
  mostrar(); btn.onclick = () => (soportaPush() ? activar() : HR.toast('En iPhone: abra hydro-rov.com/analisis en Safari → Compartir → <b>Agregar a inicio</b>. Luego active las notificaciones desde la app.', '', 10000));
  setTimeout(mostrar, 1500);
}
async function tarjeta(box) {
  if (!box || !U.esCreador()) return;
  const pinta = async () => {
    const sop = soportaPush(), perm = sop ? Notification.permission : 'no';
    let est = '', acc = '';
    if (!sop) est = esIOS() && !instalada() ? 'En iPhone las notificaciones funcionan solo con la app agregada a la pantalla de inicio desde Safari (Compartir → Agregar a inicio).' : 'Este navegador no admite notificaciones push.';
    else if (perm === 'denied') est = 'Bloqueadas en este navegador. Permítalas en los ajustes del sitio y vuelva aquí.';
    else if (perm === 'granted' && V.suscrito) { est = '<b style="color:var(--ok)">Activas en este equipo.</b> Le llegan los avisos de la agenda y las cotizaciones aprobadas que registre el otro creador, y el ícono de la app muestra cuántos tiene sin leer.'; acc = `<button class="btn sm" data-pu="probar">${ico('campana')}Enviar una de prueba</button><button class="btn sm fant peligro" data-pu="quitar">Desactivar</button>`; }
    else { est = 'Reciba en este equipo un aviso cuando el otro creador agende, reprograme o cancele una visita o un trabajo, o apruebe una cotización.'; acc = `<button class="btn sm pri" data-pu="activar">${ico('campana')}Activar notificaciones</button>`; }
    box.innerHTML = `<div class="card" style="max-width:560px"><h3>${ico('campana')}Notificaciones</h3><p style="color:var(--mut);margin-bottom:12px">${est}</p><div class="fila-acc" style="margin-bottom:14px">${acc}</div></div>`;
  };
  HR.push.alCambiar = pinta;
  await asegurarSuscripcion(); pinta();
  box.onclick = async (e) => {
    const b = e.target.closest('[data-pu]'); if (!b) return;
    if (b.dataset.pu === 'activar') await activar();
    if (b.dataset.pu === 'probar') { try { const r = await HR.apiOk('pushProbar'); HR.toast(r.enviados ? 'Enviada. Debe llegar en unos segundos.' : 'No hay equipos suscritos que la reciban.', r.enviados ? 'ok' : 'err'); cargar(); } catch (err) { HR.toast(esc(err.message), 'err'); } }
    if (b.dataset.pu === 'quitar') await desactivar();
    pinta();
  };
}
HR.avisos = { cargar, leidos, iniciar, detener: () => { clearInterval(V.timer); contadorIcono(0); } };
HR.push = { activar, desactivar, ofrecer, tarjeta };
})();
