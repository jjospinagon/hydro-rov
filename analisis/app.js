/* HYDRO-ROV · Análisis — aplicación
   Informes de inspección CCTV: video y fotos del tramo, hallazgos, perfil, PDF y Word. Todo se guarda en Drive. */
'use strict';
(function () {
const C = window.HR_CONFIG || {};
const { esc, nf, fmtT, fFecha, leerGMS, aGMS, camOk, camTxt, GRADOS, CATALOGO, COD, ESTADOS, perfilSVG } = window.HRC;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ico = (n, cls = 'i') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pn = (s) => { if (s == null) return null; const t = String(s).trim().replace(/\s/g, '').replace(',', '.'); if (t === '') return null; const n = Number(t); return isFinite(n) ? n : null; };
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const pT = (t) => { t = String(t || '').trim(); if (!t) return null; const p = t.split(':').map(Number); if (p.some(isNaN)) return null; return p.reduce((a, b) => a * 60 + b, 0); };
const hace = (iso) => { const d = (Date.now() - new Date(iso)) / 1000; if (!(d >= 0)) return ''; if (d < 60) return 'hace un momento'; if (d < 3600) return 'hace ' + Math.floor(d / 60) + ' min'; if (d < 86400) return 'hace ' + Math.floor(d / 3600) + ' h'; return fFecha(iso); };

const GEN = [
  { k: 'proyecto', l: 'Proyecto u objeto de la inspección', w: 'w4', ph: 'Ej.: Inspección CCTV de redes de alcantarillado sanitario, barrio Comuneros' },
  { k: 'cliente', l: 'Cliente o entidad contratante', w: 'w2' }, { k: 'contrato', l: 'Contrato u orden de servicio' },
  { k: 'tipo', l: 'Tipo de inspección', t: 'sel', o: ['CCTV con equipo robotizado', 'CCTV con cámara de empuje (sonda)', 'Inspección de pozos', 'Inspección combinada'] },
  { k: 'municipio', l: 'Municipio' }, { k: 'departamento', l: 'Departamento' }, { k: 'sector', l: 'Sector, barrio o dirección', w: 'w2' },
  { k: 'fechaInspeccion', l: 'Fecha de inspección', t: 'date' }, { k: 'fechaInforme', l: 'Fecha del informe', t: 'date' },
  { k: 'clima', l: 'Condición del clima', t: 'sel', o: ['', 'Seco', 'Lluvia reciente', 'Lluvia durante la inspección'] },
  { k: 'limpieza', l: 'Limpieza previa de la red', t: 'sel', o: ['', 'Sí', 'No', 'Parcial'] },
  { k: 'equipo', l: 'Equipo de inspección', w: 'w2' }, { k: 'metodoLimpieza', l: 'Método de limpieza', w: 'w2', ph: 'Ej.: hidrosucción, varillado' },
  { k: 'operador', l: 'Operador del equipo', w: 'w2' }, { k: 'auxiliar', l: 'Auxiliar de campo', w: 'w2' },
  { k: 'notasCampo', l: 'Observaciones de campo', t: 'area', w: 'w4', ph: 'Condiciones del sitio, tránsito, accesos, novedades durante la jornada…' }];
const TR = [
  { k: 'pozoIni', l: 'Pozo inicial', ph: 'PZ-01' }, { k: 'pozoFin', l: 'Pozo final', ph: 'PZ-02' },
  { k: 'sentido', l: 'Sentido de inspección', t: 'sel', o: ['Aguas abajo', 'Aguas arriba'] },
  { k: 'red', l: 'Tipo de red', t: 'sel', o: ['Sanitaria', 'Pluvial', 'Combinada'] },
  { k: 'material', l: 'Material', t: 'sel', o: ['', 'PVC', 'Concreto', 'Concreto reforzado', 'Gres', 'GRP / PRFV', 'Polietileno (PEAD)', 'Asbesto-cemento', 'Ladrillo', 'Hierro dúctil', 'Otro'] },
  { k: 'diametro', l: 'Diámetro nominal (mm)', t: 'num' }, { k: 'longitud', l: 'Longitud del tramo (m)', t: 'num' }, { k: 'inspeccionada', l: 'Longitud inspeccionada (m)', t: 'num' },
  { k: 'profIni', l: 'Profundidad pozo inicial (m)', t: 'num' }, { k: 'profFin', l: 'Profundidad pozo final (m)', t: 'num' },
  { k: 'fecha', l: 'Fecha de inspección', t: 'date' },
  { k: 'condicion', l: 'Condición general (criterio del inspector)', t: 'sel', o: ['', 'Buena', 'Regular', 'Mala', 'Crítica', 'No evaluada'] },
  { k: 'ubicacion', l: 'Ubicación o dirección', w: 'w4' },
  { k: 'finAnticipado', l: 'Motivo de fin anticipado (si no se completó)', w: 'w4' },
  { k: 'conclusion', l: 'Conclusión del tramo', t: 'area', w: 'w4' }, { k: 'recomendacion', l: 'Recomendación para el tramo', t: 'area', w: 'w4' }];

/* ============================================================ estado */
const S = { token: null, user: null, recordar: false, informes: [], inf: null, carpeta: null, tab: 'general', tramoSel: null,
  fotos: {}, cola: [], subiendoFotos: false, dirty: false, guardando: false, otra: false, timer: null,
  videos: {}, subidasVideo: {}, filtro: '', q: '', clavePrevia: null, focoObs: null };
window.HR = { S, C, GRADOS, CATALOGO, COD, ESTADOS, fmtT, nf, fFecha, esc, aGMS, camOk, camTxt, perfilSVG: null, api: null, toast: null, asegurarFotos: null, progreso: null };

/* ============================================================ avisos, modal, progreso */
function toast(html, tipo = '', ms = 4200) {
  const t = document.createElement('div'); t.className = 'toast ' + tipo; t.innerHTML = html;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms); return t;
}
function abrirModal(html, ancho) {
  /* contenedor nuevo en cada apertura: así no se acumulan oyentes de modales anteriores */
  const viejo = $('#modal-doc'), d = viejo.cloneNode(false); viejo.replaceWith(d);
  d.className = 'doc' + (ancho ? ' ancho' : ''); d.innerHTML = html;
  $('#modal').classList.add('on'); document.body.classList.add('con-modal'); return d;
}
function cerrarModal() { document.body.classList.remove('con-modal'); $('#modal').classList.remove('on'); $('#modal-doc').innerHTML = ''; }
function confirmar(titulo, texto, boton = 'Confirmar', peligro = false) {
  return new Promise((res) => {
    const d = abrirModal(`<div class="mh"><h3>${esc(titulo)}</h3></div><div class="mb"><p style="color:var(--mut)">${texto}</p></div>
      <div class="mf"><button class="btn" data-r="0">Cancelar</button><button class="btn ${peligro ? 'peligro' : 'pri'}" data-r="1">${esc(boton)}</button></div>`);
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; cerrarModal(); res(b.dataset.r === '1'); });
  });
}
function progreso(texto) {
  let el = document.createElement('div'); el.className = 'progreso'; el.innerHTML = `<div class="t">${esc(texto)}</div><div class="b"><i></i></div>`;
  document.body.appendChild(el);
  return { set(p, t) { el.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'; if (t) el.querySelector('.t').textContent = t; }, fin() { el.remove(); } };
}
const modalFijo = () => !!$('#modal-doc .lienzo, #modal-doc .ficha');
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !modalFijo()) cerrarModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').classList.contains('on') && !modalFijo()) cerrarModal(); });

/* ============================================================ servidor */
async function api(action, data = {}, opt = {}) {
  if (!C.API) throw new Error('El servidor todavía no está conectado (falta la dirección del servidor en config.js).');
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), opt.timeout || 60000);
  let r;
  try {
    const res = await fetch(C.API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, credentials: 'omit', redirect: 'follow',
      body: JSON.stringify(Object.assign({ action, token: S.token }, data)), signal: ctl.signal });
    r = await res.json();
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'El servidor tardó demasiado en responder.' : 'Sin conexión con el servidor.'); }
  finally { clearTimeout(to); }
  if (r && r.codigo === 'NO_AUTH' && action !== 'login') { cerrarLocal(); mostrarLogin('Su sesión terminó. Ingrese de nuevo.'); throw new Error(r.error); }
  if (r && r.codigo === 'CAMBIAR') { mostrarCambio(); throw new Error(r.error); }
  return r || { ok: false, error: 'Respuesta vacía del servidor.' };
}
async function apiOk(action, data, opt) { const r = await api(action, data, opt); if (!r.ok) throw new Error(r.error || 'Operación no completada.'); return r; }
HR.api = api; HR.apiOk = apiOk; HR.toast = toast; HR.progreso = progreso;

/* ============================================================ sesión */
const SKEY = 'hr_ses';
function guardarSes() {
  const v = JSON.stringify({ t: S.token, r: S.recordar ? 1 : 0 });
  try { (S.recordar ? localStorage : sessionStorage).setItem(SKEY, v); (S.recordar ? sessionStorage : localStorage).removeItem(SKEY); } catch (e) { /* modo privado */ }
}
function leerSes() { try { return JSON.parse(sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
function cerrarLocal() { S.token = null; S.user = null; try { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); } catch (e) { /* nada */ } }

/* ============================================================ ingreso */
let hudTimer = null;
function hud() {
  if (hudTimer) return;
  const tramos = ['PZ-01 → PZ-02 · Ø 315 mm PVC', 'PZ-14 → PZ-15 · Ø 450 mm CONCRETO', 'PZ-07 → PZ-08 · Ø 250 mm GRES', 'PZ-22 → PZ-23 · Ø 600 mm GRP'];
  let d = 0, k = 0;
  hudTimer = setInterval(() => {
    d += 0.07; if (d > 58) { d = 0; k = (k + 1) % tramos.length; $('#hud-tramo').textContent = tramos[k]; }
    $('#hud-dist').textContent = d.toFixed(2).replace('.', ',').padStart(6, '0');
    const n = new Date(); $('#hud-hora').textContent = n.toLocaleTimeString('es-CO', { hour12: false });
    $('#hud-fecha').textContent = n.toLocaleDateString('es-CO');
  }, 100);
}
function mostrarLogin(msg) {
  $('#boot').classList.add('hide'); $('#app').classList.add('hide'); $('#login').classList.remove('hide');
  $$('.paso').forEach((p) => p.classList.toggle('on', p.id === 'paso-login'));
  $('#l-msg').textContent = msg || ''; $('#l-msg').className = 'msg' + (msg ? ' err' : '');
  if (!C.API) { $('#l-msg').textContent = 'El servidor aún no está conectado. Falta publicar el servidor y pegar su dirección en config.js.'; $('#l-msg').className = 'msg err'; }
  hud(); setTimeout(() => { if (!$('#f-login').contains(document.activeElement)) $('#l-email').focus(); }, 50);
}
function mostrarCambio() {
  $('#boot').classList.add('hide'); $('#app').classList.add('hide'); $('#login').classList.remove('hide');
  $$('.paso').forEach((p) => p.classList.toggle('on', p.id === 'paso-cambio'));
  $('#c-quien').textContent = (S.user ? S.user.nombre + ' · ' : '') + 'por seguridad, la clave inicial se reemplaza en el primer ingreso.';
  $('#c-user').value = S.user ? S.user.email : '';
  $('#c-actual-w').classList.toggle('hide', !!S.clavePrevia);
  hud(); reglas(); setTimeout(() => { if (!$('#f-cambio').contains(document.activeElement)) (S.clavePrevia ? $('#c-nueva') : $('#c-actual')).focus(); }, 50);
}
function reglas() {
  const a = $('#c-nueva').value, b = $('#c-nueva2').value;
  const ok = { len: a.length >= 8, mix: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(a) && /\d/.test(a), ini: a.length > 0 && !/^(0+|1234.*|0123.*)$/.test(a) && a !== (S.clavePrevia || ''), igual: a.length > 0 && a === b };
  $$('#c-reglas li').forEach((li) => li.classList.toggle('si', ok[li.dataset.r]));
  let f = 0; if (a.length >= 8) f++; if (a.length >= 12) f++; if (/[A-Z]/.test(a) && /[a-z]/.test(a)) f++; if (/\d/.test(a)) f++; if (/[^A-Za-z0-9]/.test(a)) f++;
  const fz = $('#c-fuerza'); fz.style.width = (f * 20) + '%'; fz.style.background = f <= 2 ? 'var(--err)' : f === 3 ? 'var(--warn)' : 'var(--ok)';
  return Object.values(ok).every(Boolean);
}
$$('[data-ver]').forEach((b) => b.addEventListener('click', () => { const i = $('#' + b.dataset.ver); i.type = i.type === 'password' ? 'text' : 'password'; }));
$('#c-nueva').addEventListener('input', reglas); $('#c-nueva2').addEventListener('input', reglas);
$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#l-email').value.trim(), clave = $('#l-clave').value, btn = $('#l-btn'), msg = $('#l-msg');
  if (!email || !clave) { msg.textContent = 'Escriba su correo y su contraseña.'; msg.className = 'msg err'; return; }
  btn.disabled = true; btn.textContent = 'Verificando…'; msg.textContent = '';
  try {
    const r = await api('login', { email, clave, recordar: $('#l-recordar').checked });
    if (!r.ok) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    S.token = r.token; S.user = r.usuario; S.recordar = $('#l-recordar').checked; guardarSes();
    $('#l-clave').value = '';
    if (r.usuario.debeCambiar) { S.clavePrevia = clave; mostrarCambio(); } else entrar();
  } catch (err) { msg.textContent = err.message; msg.className = 'msg err'; }
  finally { btn.disabled = false; btn.textContent = 'Ingresar'; }
});
$('#f-cambio').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#c-msg'), btn = $('#c-btn');
  if (!reglas()) { msg.textContent = 'Revise las condiciones de la contraseña.'; msg.className = 'msg err'; return; }
  const actual = S.clavePrevia || $('#c-actual').value;
  if (!actual) { msg.textContent = 'Escriba la contraseña con la que ingresó.'; msg.className = 'msg err'; return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api('cambiarClave', { actual, nueva: $('#c-nueva').value });
    if (!r.ok) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    S.clavePrevia = null; S.user = r.usuario; $('#c-nueva').value = ''; $('#c-nueva2').value = ''; $('#c-actual').value = '';
    toast('Contraseña creada. Bienvenido a HYDRO-ROV Análisis.', 'ok');
    entrar();
  } catch (err) { msg.textContent = err.message; msg.className = 'msg err'; }
  finally { btn.disabled = false; btn.textContent = 'Guardar y entrar'; }
});

/* ============================================================ aplicación */
const esCreador = () => S.user && S.user.rol === 'CREADOR';
const esLector = () => S.user && S.user.rol === 'LECTOR';
function entrar() {
  clearInterval(hudTimer); hudTimer = null;
  $('#boot').classList.add('hide'); $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  document.body.classList.toggle('es-creador', esCreador()); document.body.classList.toggle('es-lector', esLector());
  pintarUsuario();
  $('#ver').textContent = 'v' + (C.VERSION || '');
  route();
  if (HR.avisos) HR.avisos.iniciar();
}
function pintarUsuario() {
  const n = S.user.nombre || S.user.email;
  $('#yo-av').textContent = n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  $('#yo-n').textContent = n.split(/\s+/).slice(0, 2).join(' '); $('#yo-r').textContent = S.user.rol;
}
function menu(on) { document.body.classList.toggle('menu', on == null ? !document.body.classList.contains('menu') : on); }
$('#burger').addEventListener('click', () => menu());
$('#velo').addEventListener('click', () => menu(false));
$('#side').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-v]'); if (!a) return;
  e.preventDefault(); menu(false);
  const v = a.dataset.v;
  if (v === 'salir') return salir();
  if (v === 'nuevo') return nuevoInforme();
  location.hash = v;
});
$('#b-tema').addEventListener('click', () => { const l = !document.body.classList.contains('light'); document.body.classList.toggle('light', l); try { localStorage.setItem('hr_tema', l ? 'light' : 'dark'); } catch (e) { /* nada */ } });
async function salir() {
  await guardarAhora();
  if (S.cola.length || Object.values(S.subidasVideo).some((x) => x.estado === 'subiendo')) {
    if (!(await confirmar('Hay archivos subiendo', 'Si sale ahora se pierden las fotos o el video que aún no terminan de subir a Drive.', 'Salir de todos modos', true))) return;
  }
  const t = S.token; cerrarLocal(); S.inf = null; if (HR.avisos) HR.avisos.detener();
  try { await fetch(C.API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'logout', token: t }) }); } catch (e) { /* nada */ }
  location.hash = ''; mostrarLogin();
}
window.addEventListener('hashchange', route);
async function route() {
  if (!S.user) return;
  const p = (location.hash.replace(/^#/, '') || 'informes').split('/');
  if (S.recienCreado && !(p[0] === 'informe' && decodeURIComponent(p[1] || '') === S.recienCreado)) S.recienCreado = null;
  const M = window.HRMod || {};
  if (M.salir && !(p[0] === 'cotizacion' && p[1])) await M.salir();
  if (p[0] === 'informe' && p[1]) return abrirInforme(decodeURIComponent(p[1]), p[2]);
  if (S.inf) await guardarAhora();
  if (p[0] === 'cotizacion' && p[1] && M.abrirCot) { ver('cotizacion'); return M.abrirCot(decodeURIComponent(p[1]), p[2]); }
  if (p[0] === 'cotizaciones' || p[0] === 'agenda') return ver(p[0]);
  if ((p[0] === 'usuarios' || p[0] === 'auditoria') && esCreador()) return ver(p[0]);
  if (p[0] === 'cuenta') return ver('cuenta');
  return ver('informes');
}
function ver(v) {
  $$('#side a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === v || (v === 'editor' && a.dataset.v === 'informes') || (v === 'cotizacion' && a.dataset.v === 'cotizaciones')));
  $$('.vista').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
  const t = { informes: 'Informes de inspección', usuarios: 'Usuarios', auditoria: 'Registro de actividad', cuenta: 'Mi cuenta', cotizaciones: 'Cotizaciones', cotizacion: 'Cotización', agenda: 'Agenda de visitas y trabajos' }[v];
  if (t) $('#ctx-t').textContent = t;
  window.scrollTo(0, 0);
  if (v === 'informes') cargarLista();
  if (v === 'usuarios') verUsuarios();
  if (v === 'auditoria') verAuditoria();
  if (v === 'cuenta') verCuenta();
  const M = window.HRMod || {};
  if (v === 'cotizaciones' && M.listaCot) M.listaCot();
  if (v === 'agenda' && M.agenda) M.agenda();
}

/* ============================================================ lista de informes */
async function cargarLista() {
  const L = $('#lista');
  if (!S.informes.length) L.innerHTML = '<div class="vacio"><div class="spin" style="margin:0 auto"></div></div>';
  try { const r = await apiOk('listar'); S.informes = r.informes; if (r.usuario) S.user = Object.assign(S.user, r.usuario); pintarLista(); }
  catch (e) { L.innerHTML = `<div class="vacio"><h3>No se pudo cargar la lista</h3><p>${esc(e.message)}</p></div>`; }
}
/* clientes: se agrupan sin distinguir mayúsculas, tildes ni espacios sobrantes */
const claveCli = (c) => String(c || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
/* entre variantes del mismo nombre, la más cuidada (mayúsculas y tildes) */
const cuidado = (t) => (t.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length + 2 * (t.match(/[áéíóúñÁÉÍÓÚÑ]/g) || []).length;
function clientes() {
  const m = new Map();
  S.informes.forEach((x) => { const k = claveCli(x.cliente); const o = m.get(k) || { k, n: 0, nombres: {} }; o.n++; const nom = String(x.cliente || '').trim() || 'Sin cliente'; o.nombres[nom] = (o.nombres[nom] || 0) + 1; m.set(k, o); });
  return [...m.values()].map((o) => ({ k: o.k, n: o.n, nombre: Object.entries(o.nombres).sort((a, b) => b[1] - a[1] || cuidado(b[0]) - cuidado(a[0]))[0][0] }))
    .sort((a, b) => (a.k === '' ? 1 : b.k === '' ? -1 : a.nombre.localeCompare(b.nombre, 'es')));
}
function pintarClientes() {
  const sel = $('#f-cliente'); if (!sel) return;
  const C = clientes();
  if (S.cliente != null && S.cliente !== '*' && !C.some((c) => c.k === S.cliente)) S.cliente = '*';
  sel.innerHTML = `<option value="*">Todos los clientes</option>` + C.map((c) => `<option value="${esc(c.k)}"${S.cliente === c.k ? ' selected' : ''}>${esc(c.nombre)} (${c.n})</option>`).join('');
  sel.value = S.cliente == null ? '*' : S.cliente;
}
const deCliente = (x) => S.cliente == null || S.cliente === '*' || claveCli(x.cliente) === S.cliente;
function pintarLista() {
  pintarClientes();
  const q = S.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* los indicadores no cuentan el informe de muestra de la web y siguen el cliente elegido */
  const I = S.informes.filter((x) => !x.muestra && deCliente(x));
  const tramos = I.reduce((a, x) => a + (x.tramos || 0), 0), ml = I.reduce((a, x) => a + (Number(x.ml) || 0), 0), sitios = I.filter((x) => x.lat != null).length;
  $('#kpis').innerHTML = `<div class="kpi kpi-ml"><div class="l">ML inspeccionados</div><div class="v">${nf(ml, ml >= 1000 ? 0 : 1)}<small> m</small></div><div class="s">metros lineales de tubería recorridos</div></div>`
    + [['Informes', I.length], ['Emitidos', I.filter((x) => x.estado === 'EMITIDO').length], ['En borrador', I.filter((x) => x.estado === 'BORRADOR').length], ['Tramos', tramos]]
      .map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')
    + `<button type="button" class="kpi kpi-mapa" data-vista-l="mapa"><div class="l">Mapa de inspecciones</div><div class="v">${sitios}<small> sitio${sitios === 1 ? '' : 's'}</small></div><div class="s">${ico('gps')}Ver en el mapa</div></button>`;
  if (S.vistaLista === 'mapa') pintarMapaGlobal();
  const F = S.informes.filter((x) => deCliente(x) && (!S.filtro || x.estado === S.filtro) && (!q || [x.id, x.titulo, x.cliente, x.municipio].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
  if (!S.informes.length) {
    $('#lista').innerHTML = `<div class="vacio" style="grid-column:1/-1"><h3>Aún no hay informes</h3><p>Cree el primero: cargue el video del tramo, capture los hallazgos y exporte el informe.</p>${esLector() ? '' : '<p style="margin-top:14px"><button class="btn pri" data-accion="nuevo">' + ico('mas') + 'Nuevo informe</button></p>'}</div>`;
    return;
  }
  if (!F.length) { $('#lista').innerHTML = '<div class="vacio" style="grid-column:1/-1"><h3>Sin resultados</h3><p>Ningún informe coincide con la búsqueda.</p></div>'; return; }
  const tarjeta = (x) => `<article class="inf${x.muestra ? ' es-muestra' : ''}" data-id="${esc(x.id)}" tabindex="0">
    <div class="ph">${x.portada ? `<img data-fid="${esc(x.portada)}" alt="">` : '<div class="rg"><span style="width:60px;height:60px"></span><span style="width:110px;height:110px"></span><span style="width:170px;height:170px"></span></div>'}
      <span class="cod">${esc(x.id)}</span><span class="est est ${esc(x.estado)}">${esc(ESTADOS[x.estado] || x.estado)}</span>${x.muestra ? '<span class="muestra-tag" title="Informe de muestra publicado en la web. No suma en los indicadores ni en el mapa.">Muestra · no se contabiliza</span>' : ''}</div>
    <div class="bd"><h3>${esc(x.titulo)}</h3><div class="me">${esc([x.cliente, x.municipio].filter(Boolean).join(' · ') || 'Sin cliente')}${x.fecha ? ' · ' + esc(fFecha(x.fecha)) : ''}</div>
      <div class="me">${x.tramos || 0} tramo${x.tramos === 1 ? '' : 's'} · <b style="color:var(--tx)">${nf(x.ml || 0, 1)} m</b> inspeccionados · ${x.obs || 0} hallazgo${x.obs === 1 ? '' : 's'}${x.lat != null ? ' · ' + ico('gps', 'i mini') : ''}</div>
      <div class="ft"><span class="gbar" title="Grado máximo registrado">${[1, 2, 3, 4, 5].map((g) => `<i style="${g <= (x.gradoMax || 0) ? 'background:' + GRADOS[x.gradoMax].c : ''}"></i>`).join('')}</span>
        <span>${esc(hace(x.actualizado))}${x.actualizadoPor ? ' · ' + esc(x.actualizadoPor.split('@')[0]) : ''}</span>
        <button type="button" class="btn xs fant peligro solo-editor" data-accion="eliminar" data-id="${esc(x.id)}" title="Eliminar informe">${ico('basura')}</button></div></div></article>`;
  if (S.agrupar) {
    /* agrupado por cliente: encabezado con cantidad y metros de cada cliente (sin contar la muestra) */
    const grupos = new Map();
    F.forEach((x) => { const k = claveCli(x.cliente); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); });
    const nombres = new Map(clientes().map((c) => [c.k, c.nombre]));
    const orden = [...grupos.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (nombres.get(a) || a).localeCompare(nombres.get(b) || b, 'es')));
    $('#lista').innerHTML = orden.map((k) => {
      const L = grupos.get(k), cuenta = L.filter((x) => !x.muestra), mlg = cuenta.reduce((a, x) => a + (Number(x.ml) || 0), 0);
      return `<div class="grupo-cli"><h3>${ico('user')}${esc(nombres.get(k) || 'Sin cliente')}</h3><span>${cuenta.length ? `${cuenta.length} informe${cuenta.length === 1 ? '' : 's'} · ${nf(mlg, 1)} m inspeccionados` : 'Informe de muestra · no se contabiliza'}</span></div>` + L.map(tarjeta).join('');
    }).join('');
  } else $('#lista').innerHTML = F.map(tarjeta).join('');
  portadas(F.filter((x) => x.portada));
}
async function portadas(lst) {
  for (const x of lst) {
    if (!S.fotos[x.portada]) { try { const r = await apiOk('obtenerFotos', { id: x.id, ids: [x.portada] }); Object.assign(S.fotos, r.fotos); } catch (e) { continue; } }
    $$(`img[data-fid="${x.portada}"]`).forEach((im) => { if (S.fotos[x.portada]) { im.src = S.fotos[x.portada]; im.onload = () => im.classList.add('ok'); } });
  }
}
$('#lista').addEventListener('click', (e) => { if (e.target.closest('[data-accion]')) return; const c = e.target.closest('.inf'); if (c) location.hash = 'informe/' + c.dataset.id; });
$('#lista').addEventListener('keydown', (e) => { const c = e.target.closest('.inf'); if (c && e.key === 'Enter') location.hash = 'informe/' + c.dataset.id; });
$('#q').addEventListener('input', (e) => { S.q = e.target.value; pintarLista(); });
$('#f-cliente').addEventListener('change', (e) => { S.cliente = e.target.value; pintarLista(); if (S.vistaLista === 'mapa') pintarMapaGlobal(); });
$('#agrupar').addEventListener('click', () => { S.agrupar = !S.agrupar; $('#agrupar').classList.toggle('on', S.agrupar); $('#agrupar').setAttribute('aria-pressed', S.agrupar ? 'true' : 'false'); try { localStorage.setItem('hr_agrupar', S.agrupar ? '1' : ''); } catch (err) { /* sin almacenamiento */ } pintarLista(); });
try { S.agrupar = localStorage.getItem('hr_agrupar') === '1'; } catch (err) { S.agrupar = false; }
if (S.agrupar) { $('#agrupar').classList.add('on'); $('#agrupar').setAttribute('aria-pressed', 'true'); }
$('#filtros').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; S.filtro = b.dataset.f; $$('#filtros .chip').forEach((c) => c.classList.toggle('on', c === b)); pintarLista(); });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-accion]'); if (!b) return;
  const a = b.dataset.accion;
  if (a === 'nuevo') nuevoInforme();
  else if (a === 'volver') location.hash = 'informes';
  else if (a === 'pdf' || a === 'docx') exportar(a);
  else if (a === 'drive') abrirDrive();
  else if (a === 'eliminar') eliminarInforme(b.dataset.id || (S.inf && S.inf.id));
});

const ROLES_FIRMA = ['Elaboró', 'Revisó', 'Aprobó', 'Vo. Bo.'];
function firmasBase() { return [{ rol: 'Elaboró', nombre: '', cargo: 'Ingeniero civil', matricula: '' }, { rol: 'Revisó', nombre: '', cargo: '', matricula: '' }]; }
function migrarFirmas(I) {
  if (Array.isArray(I.firmas)) return;
  const g = I.general || {};
  I.firmas = [{ rol: 'Elaboró', nombre: g.responsable || '', cargo: 'Ingeniero responsable', matricula: g.matricula || '' }, { rol: 'Revisó', nombre: g.reviso || '', cargo: '', matricula: '' }];
}
function nuevoTramo(n) {
  return { id: uid('t'), pozoIni: '', pozoFin: '', sentido: 'Aguas abajo', red: 'Sanitaria', material: '', diametro: null, longitud: null, inspeccionada: null,
    profIni: null, profFin: null, fecha: hoy(), condicion: '', ubicacion: '', cIni: null, cFin: null, finAnticipado: '', conclusion: '', recomendacion: '', video: null, obs: [] };
}
async function nuevoInforme() {
  if (esLector()) return;
  const p = progreso('Creando el informe y su carpeta en Drive…'); p.set(0.4);
  try {
    const r = await apiOk('crear', { informe: { estado: 'BORRADOR', general: { tipo: 'CCTV con equipo robotizado', departamento: 'Quindío', equipo: C.EQUIPO_DEFECTO,
      fechaInspeccion: hoy(), fechaInforme: hoy() }, tramos: [nuevoTramo()], conclusiones: '', recomendaciones: '', alcance: '', firmas: firmasBase() } });
    S.inf = null; S.recienCreado = r.informe.id; location.hash = 'informe/' + r.informe.id;
    toast(`Informe <b>${esc(r.informe.id)}</b> creado en Drive.`, 'ok');
  } catch (e) { toast(esc(e.message), 'err'); }
  finally { p.fin(); }
}

/* ============================================================ editor */
const tramoActual = () => S.inf && (S.inf.tramos.find((t) => t.id === S.tramoSel) || S.inf.tramos[0]);
const obsPorId = (id) => { for (const t of S.inf.tramos) for (const o of t.obs) if (o.id === id) return o; return null; };
const etiquetaTramo = (t) => (t.pozoIni || '¿?') + ' → ' + (t.pozoFin || '¿?');

async function abrirInforme(id, tab) {
  if (!S.inf || S.inf.id !== id) {
    if (S.inf) await guardarAhora();
    ver('editor'); $('#e-tit').textContent = 'Abriendo…'; $('#e-cod').textContent = id;
    $('#p-general').innerHTML = $('#p-tramos').innerHTML = $('#p-conclusiones').innerHTML = '';
    try { const r = await apiOk('obtener', { id }); S.inf = r.informe; S.carpeta = r.carpeta; }
    catch (e) { toast(esc(e.message), 'err'); location.hash = 'informes'; return; }
    if (!S.inf.tramos.length) S.inf.tramos.push(nuevoTramo());
    S.inf.tramos.forEach((t) => {
      t.obs = t.obs || [];
      if (!t.cIni && t.coord) { const m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(t.coord); if (m) t.cIni = { lat: +m[1], lon: +m[2] }; }
    });
    migrarFirmas(S.inf);
    S.tramoSel = S.inf.tramos[0].id; S.dirty = false; setSync('ok', 'Guardado');
    pintarEditor();
    precargarFotos();
  } else ver('editor');
  avisoNuevo();
  $$('#side a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === 'informes'));
  setTab(tab || S.tab || 'general', true);
}
function pintarEditor() {
  const I = S.inf;
  $('#e-cod').textContent = I.id + ' · rev. ' + I.rev;
  $('#e-tit').textContent = I.general.proyecto || 'Informe sin título';
  $('#ctx-t').textContent = I.id;
  $('#e-estado').value = I.estado || 'BORRADOR';
  $('#e-estado').disabled = esLector();
  pintarGeneral(); pintarTramos(); pintarConclusiones();
  bloquearLector();
  avisoNuevo();
}
function avisoNuevo() {
  const n = !!(S.inf && S.recienCreado === S.inf.id), el = $('#e-nuevo');
  el.classList.toggle('hide', !n);
  $('#e-borrar').title = n ? 'Descartar este informe' : 'Eliminar informe';
  if (n) el.innerHTML = `<span>${ico('doc')}<b>Informe nuevo.</b> Si lo creó por error o ya no lo necesita, descártelo ahora: se borra su carpeta de Drive sin dejar rastro. Al salir del informe solo podrá eliminarse.</span><button type="button" class="btn sm" data-accion="eliminar">${ico('x')}Descartar informe</button>`;
}
function bloquearLector() {
  if (!esLector()) return;
  $$('#e-fs input, #e-fs select, #e-fs textarea').forEach((x) => { if (x.tagName === 'SELECT') x.disabled = true; else x.readOnly = true; });
}
function setTab(t, sinHash) {
  S.tab = t;
  $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  $$('#v-editor .panel').forEach((p) => p.classList.toggle('on', p.id === 'p-' + t));
  if (t === 'vista') pintarVista();
  if (t === 'general' && mapaU) setTimeout(() => mapaU.invalidateSize(), 60);
  if (t === 'tramos' && mapaT) setTimeout(() => { const tr = tramoActual(); if (tr) dibujarTramo(tr, true); }, 60);
  if (t === 'tramos') pintarPerfil();
  if (!sinHash) history.replaceState(null, '', '#informe/' + S.inf.id + '/' + t);
}
$('.tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { setTab(b.dataset.tab); window.scrollTo({ top: 0 }); } });
$('#e-estado').addEventListener('change', (e) => { S.inf.estado = e.target.value; marcarSucio(); });

function campo(d, val, scope) {
  const id = 'f_' + scope + '_' + d.k, b = `data-b="${scope}:${d.k}"`;
  let inp;
  if (d.t === 'sel') inp = `<select id="${id}" ${b}>${d.o.map((o) => `<option value="${esc(o)}"${o === (val || '') ? ' selected' : ''}>${esc(o || '—')}</option>`).join('')}${val && d.o.indexOf(val) < 0 ? `<option selected>${esc(val)}</option>` : ''}</select>`;
  else if (d.t === 'area') inp = `<textarea id="${id}" ${b} placeholder="${esc(d.ph || '')}">${esc(val || '')}</textarea>`;
  else if (d.t === 'num') inp = `<input id="${id}" ${b} data-n="1" inputmode="decimal" value="${esc(val == null ? '' : String(val).replace('.', ','))}" placeholder="${esc(d.ph || '')}">`;
  else inp = `<input id="${id}" ${b} type="${d.t === 'date' ? 'date' : 'text'}" value="${esc(val || '')}" placeholder="${esc(d.ph || '')}">`;
  if (d.gps) inp = `<div style="display:flex;gap:6px">${inp}<button type="button" class="btn sm solo-ed" data-ta="gps" title="Usar mi ubicación">${ico('gps')}</button></div>`;
  return `<label class="campo ${d.w || ''}" for="${id}"><span>${esc(d.l)}</span>${inp}</label>`;
}
function pintarGeneral() {
  const g = S.inf.general;
  $('#p-general').innerHTML = `<div class="card"><h3><span class="n">01</span>Identificación del trabajo</h3><div class="frm">${GEN.slice(0, 10).map((d) => campo(d, g[d.k], 'g')).join('')}</div></div>
    <div class="card"><h3><span class="n">02</span>Equipo, personal y condiciones</h3><div class="frm">${GEN.slice(10).map((d) => campo(d, g[d.k], 'g')).join('')}</div></div>
    <div class="card"><h3><span class="n">03</span>Alcance y metodología</h3><div class="frm">
      <label class="campo w4"><span>Alcance de la inspección y metodología empleada</span><textarea data-b="i:alcance" rows="5" placeholder="Describa qué se inspeccionó, con qué procedimiento y bajo qué criterio de calificación de defectos.">${esc(S.inf.alcance || '')}</textarea></label></div></div>
    ${ubicacionHTML()}`;
  montarUbicacion();
}
function pintarConclusiones() {
  $('#p-conclusiones').innerHTML = `<div class="card"><h3><span class="n">01</span>Conclusiones generales</h3><div class="frm">
      <label class="campo w4"><span>Conclusiones</span><textarea data-b="i:conclusiones" rows="8">${esc(S.inf.conclusiones || '')}</textarea></label></div></div>
    <div class="card"><h3><span class="n">02</span>Recomendaciones</h3><div class="frm">
      <label class="campo w4"><span>Recomendaciones</span><textarea data-b="i:recomendaciones" rows="8">${esc(S.inf.recomendaciones || '')}</textarea></label></div></div>
    <div class="card"><h3><span class="n">03</span>Anexos y notas finales</h3><div class="frm">
      <label class="campo w4"><span>Anexos (relación de videos, planos, registros entregados)</span><textarea data-b="i:anexos" rows="4">${esc(S.inf.anexos || '')}</textarea></label></div></div>
    <div class="card" id="firmas"><h3><span class="n">04</span>Firmas del informe <span class="der solo-ed"><button type="button" class="btn sm" data-fa="mia" title="Poner mis datos en la primera firma">${ico('user')}<span class="tx">Usar mis datos</span></button><button type="button" class="btn sm" data-fa="nueva">${ico('mas')}Agregar firma</button></span></h3>
      <p class="ayuda">Quien firma puede ser usted u otra persona. Lo que escriba aquí es lo que sale al pie del PDF y del Word.</p>
      ${S.inf.firmas.map((f, i) => `<div class="frm" data-firma="${i}" style="border-top:1px dashed var(--line);padding-top:12px">
        <label class="campo"><span>Firma ${i + 1} · rol</span><input data-b="f:rol" list="roles-firma" value="${esc(f.rol)}"></label>
        <label class="campo"><span>Nombre de quien firma</span><input data-b="f:nombre" value="${esc(f.nombre)}" placeholder="Nombre completo"></label>
        <label class="campo"><span>Cargo o profesión</span><input data-b="f:cargo" value="${esc(f.cargo)}" placeholder="Ej.: Ingeniero civil"></label>
        <label class="campo"><span>Matrícula profesional</span><div style="display:flex;gap:6px"><input data-b="f:matricula" value="${esc(f.matricula)}" placeholder="Opcional">${S.inf.firmas.length > 1 ? `<button type="button" class="btn sm peligro solo-ed" data-fa="quitar" title="Quitar esta firma">${ico('basura')}</button>` : ''}</div></label></div>`).join('')}
      <datalist id="roles-firma">${ROLES_FIRMA.map((r) => `<option value="${r}">`).join('')}</datalist></div>`;
  bloquearLector();
}
$('#p-conclusiones').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fa]'); if (!b || esLector()) return;
  const F = S.inf.firmas, a = b.dataset.fa;
  if (a === 'nueva') { if (F.length >= 4) return toast('Máximo cuatro firmas.'); F.push({ rol: ROLES_FIRMA[Math.min(F.length, 3)], nombre: '', cargo: '', matricula: '' }); }
  else if (a === 'quitar') F.splice(Number(b.closest('[data-firma]').dataset.firma), 1);
  else if (a === 'mia') F[0].nombre = S.user.nombre || '';
  pintarConclusiones(); marcarSucio();
  if (a === 'nueva') { const u = $$('#firmas [data-b="f:nombre"]').pop(); if (u) u.focus(); }
});

/* ------------------------------------------------------------ tramos */
function colorTramo(t) { const m = Math.max(0, ...t.obs.map((o) => Number(o.grado) || 0)); return GRADOS[m].c; }
function pintarListaTramos() {
  const box = $('#tr-lista'); if (!box) return;
  box.innerHTML = S.inf.tramos.map((t, i) => `<button type="button" class="tr-it${t.id === S.tramoSel ? ' on' : ''}" data-tramo="${t.id}">
      <div><div class="pz">${esc(etiquetaTramo(t))}</div><div class="me">Tramo ${i + 1} · ${t.obs.length} obs.${t.longitud ? ' · ' + nf(t.longitud) + ' m' : ''}${t.video && t.video.id ? ' · video' : ''}</div></div><span class="gd" style="background:${colorTramo(t)}"></span></button>`).join('')
    + '<button type="button" class="tr-it tr-nuevo solo-ed" data-ta="nuevo">' + ico('mas') + 'Agregar tramo</button>'
    + '<button type="button" class="tr-it tr-nuevo solo-ed" data-ta="importar">' + ico('doc') + 'Importar tramos de Excel</button>';
}
function pintarTramos() {
  const t = tramoActual();
  $('#p-tramos').innerHTML = `<div class="tr-lay"><div class="tr-lista" id="tr-lista"></div><div id="tr-det">
    ${consolaHTML(t)}
    <div class="perfil"><h4><span>Perfil del tramo · ubicación de hallazgos</span><span class="leyenda">${GRADOS.slice(1).map((g) => `<span><i style="background:${g.c}"></i>${g.g} ${g.n}</span>`).join('')}</span></h4><div id="perfil"></div></div>
    <div class="card"><h3><span class="n">OBS</span>Observaciones del tramo <span class="der solo-ed">
      <button type="button" class="btn sm" data-ta="ordenar" title="Ordenar por distancia">${ico('orden')}<span class="tx">Ordenar</span></button>
      <button type="button" class="btn sm" data-ta="fotos">${ico('foto')}Fotos</button>
      <button type="button" class="btn sm" data-ta="sinfoto">${ico('mas')}Observación</button></span></h3>
      <div class="obs-l" id="obs-l"></div></div>
    ${camarasHTML(t)}
    <div class="card"><h3><span class="n">FT</span>Ficha técnica del tramo <span class="der solo-ed">
      <button type="button" class="btn sm" data-ta="duplicar" title="Duplicar ficha para el tramo siguiente">${ico('dup')}<span class="tx">Siguiente tramo</span></button>
      <button type="button" class="btn sm peligro" data-ta="borrar">${ico('basura')}<span class="tx">Eliminar</span></button></span></h3>
      <div class="frm">${TR.map((d) => campo(d, t[d.k], 't')).join('')}</div></div>
  </div></div>`;
  pintarListaTramos(); pintarObs(); pintarPerfil(); montarVideo(t); montarMapaTramo(t); bloquearLector();
}

/* ------------------------------------------------------------ consola de video */
function consolaHTML(t) {
  const v = t.video, sv = S.subidasVideo[t.id];
  return `<div class="consola" id="consola" tabindex="0" aria-label="Consola de video del tramo">
    <div class="barra"><span>TRAMO <b id="cv-tramo">${esc(etiquetaTramo(t))}</b></span><span id="cv-info">${v ? esc(v.nombre) + (v.tamano ? ' · ' + nf(v.tamano / 1048576, 0) + ' MB' : '') : 'Sin video'}</span>
      <span class="der"><button type="button" class="cz solo-ed" data-vc="zona" title="Marcar dónde está el contador de metros en el video">${ico('lapiz')}<span id="cv-zona">${zonaOCR() ? 'Contador: listo' : 'Marcar contador'}</span></button><span id="cv-drive">${estadoVideoTxt(t)}</span>
      ${v ? `<button type="button" class="solo-ed" data-ta="quitarVideo" title="Quitar video del tramo" style="background:none;border:0;color:#9fb6cc;display:grid;place-items:center">${ico('x')}</button>` : ''}</span></div>
    <div class="subida"><i id="cv-barra" style="width:${sv && sv.estado === 'subiendo' ? Math.round(sv.p * 100) : 0}%"></i></div>
    <div class="pantalla" id="pantalla"><video id="vid" playsinline preload="metadata"></video><div class="zona-ocr hide" id="zona-ocr"></div><div class="zona-sel hide" id="zona-sel"><div class="zona-tip">Arrastre un recuadro sobre los metros del contador (por ejemplo «12.34M»)</div></div><div class="hudv" id="vhud"></div><div class="flash" id="flash"></div>
      <div class="soltar" id="soltar"><div><div class="ojo">${ico('video')}</div>
        <h4>${v && v.id ? 'Video guardado en Drive' : 'Cargue el video del tramo'}</h4>
        <p>${v && v.id ? 'Ábralo desde Drive o cárguelo desde este equipo para capturar fotogramas.' : 'Arrástrelo aquí o elíjalo. Mientras lo revisa, se guarda en Drive. También puede trabajar solo con fotos.'}</p>
        <div class="acts">${v && v.id ? '<button type="button" class="btn sm" data-ta="videoDrive">' + ico('drive') + 'Abrir desde Drive</button>' : ''}
          <button type="button" class="btn sm pri solo-ed" data-ta="video">${ico('video')}${v && v.id ? 'Desde este equipo' : 'Elegir video'}</button>
          <button type="button" class="btn sm solo-ed" data-ta="fotos">${ico('foto')}Cargar fotos</button></div></div></div></div>
    <div class="linea" id="linea"><div class="riel"></div><div class="av" id="l-av"></div><div id="l-mk"></div><div class="cab" id="l-cab" style="left:0"></div></div>
    <div class="ctrls">
      <button type="button" class="cb" data-vc="-10" title="Atrás 10 s">−10s</button>
      <button type="button" class="cb" data-vc="-f" title="Fotograma anterior (←)">◀︎│</button>
      <button type="button" class="cb" data-vc="play" title="Reproducir / pausar (espacio)" id="vc-play">${ico('play')}</button>
      <button type="button" class="cb" data-vc="+f" title="Fotograma siguiente (→)">│▶︎</button>
      <button type="button" class="cb" data-vc="+10" title="Adelante 10 s">+10s</button>
      <span class="tiempo" id="vc-t">00:00 / 00:00</span>
      <button type="button" class="cb" data-vc="vel" id="vc-vel" title="Velocidad">1×</button>
      <button type="button" class="cb" data-vc="full" title="Pantalla completa">${ico('pant')}</button>
      <span class="esp"></span>
      <button type="button" class="capturar solo-ed" data-vc="cap" title="Capturar fotograma como observación (C)">${ico('cam')}Capturar hallazgo</button>
    </div>
    <div class="guia solo-ed"><b>Cómo se trabaja:</b> reproduzca el video y, donde vea un daño, toque <b>Capturar hallazgo</b> (o la tecla <b>C</b>). El video se detiene y se abre la ficha: distancia, código, grado, posición horaria y descripción. Al guardar, el video sigue. Con <b>Fotos</b> cada imagen abre su ficha, una tras otra. Puede combinar video y fotos en el mismo tramo.</div></div>`;
}
function estadoVideoTxt(t) {
  const sv = S.subidasVideo[t.id], v = t.video;
  if (sv && sv.estado === 'subiendo') return '<span style="color:#fbd36b">Guardando en Drive ' + Math.round(sv.p * 100) + '%</span>';
  if (sv && sv.estado === 'error') return '<span style="color:#f87171">No se guardó en Drive · <a href="#" data-ta="reintentarVideo" style="color:#5cc8e4">reintentar</a></span>';
  if (v && v.id) return '<span style="color:#5ee0aa">● En Drive</span>';
  return '';
}
function montarVideo(t) {
  const vid = $('#vid'), lv = S.videos[t.id];
  $('#soltar').classList.toggle('hide', !!lv);
  if (lv) { vid.src = lv.url; vid.playbackRate = lv.vel || 1; $('#vc-vel').textContent = (lv.vel || 1) + '×'; }
  vid.addEventListener('timeupdate', actualizarTiempo);
  vid.addEventListener('loadedmetadata', () => { actualizarTiempo(); pintarMarcas(); pintarZona(); });
  window.addEventListener('resize', pintarZona);
  vid.addEventListener('play', () => { $('#vc-play').innerHTML = ico('pausa'); });
  vid.addEventListener('pause', () => { $('#vc-play').innerHTML = ico('play'); });
  const so = $('#soltar');
  so.addEventListener('dragover', (e) => { e.preventDefault(); so.classList.add('sobre'); });
  so.addEventListener('dragleave', () => so.classList.remove('sobre'));
  so.addEventListener('drop', (e) => {
    e.preventDefault(); so.classList.remove('sobre'); if (esLector()) return;
    const fs = Array.from(e.dataTransfer.files || []);
    const v = fs.find((f) => /^video\//.test(f.type) || /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name));
    if (v) cargarVideoLocal(v); else if (fs.length) cargarFotos(fs);
  });
  $('#linea').addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(); if (vid.duration) vid.currentTime = ((e.clientX - r.left) / r.width) * vid.duration; });
}
function actualizarTiempo() {
  const vid = $('#vid'); if (!vid) return;
  const d = vid.duration || 0, c = vid.currentTime || 0;
  $('#vc-t').textContent = fmtT(c) + ' / ' + fmtT(d);
  const p = d ? (c / d) * 100 : 0; $('#l-av').style.width = p + '%'; $('#l-cab').style.left = p + '%';
  $('#vhud').textContent = d ? 'T ' + fmtT(c) + '.' + String(Math.floor((c % 1) * 10)) : '';
}
function pintarMarcas() {
  const vid = $('#vid'), box = $('#l-mk'); if (!vid || !box) return;
  const d = vid.duration || 0, t = tramoActual();
  box.innerHTML = d ? t.obs.filter((o) => o.tiempo != null).map((o) => `<span class="mk" style="left:${(o.tiempo / d) * 100}%;background:${GRADOS[o.grado || 0].c}" title="${esc(fmtT(o.tiempo) + ' · ' + (o.codigo || 'obs.'))}"></span>`).join('') : '';
}
function cargarVideoLocal(file) {
  const t = tramoActual();
  if (S.videos[t.id]) URL.revokeObjectURL(S.videos[t.id].url);
  S.videos[t.id] = { url: URL.createObjectURL(file), file, vel: 1 };
  $('#soltar').classList.add('hide');
  const vid = $('#vid'); vid.src = S.videos[t.id].url;
  $('#cv-info').textContent = file.name + ' · ' + nf(file.size / 1048576, 0) + ' MB';
  $('#consola').focus();
  if (!(t.video && t.video.id && t.video.nombre === file.name && t.video.tamano === file.size)) subirVideo(t, file);
}
document.getElementById('f-video').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) cargarVideoLocal(f); });

async function blobB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
function refrescarEstadoVideo(tid) {
  const t = tramoActual(); if (!t || t.id !== tid) return;
  const sv = S.subidasVideo[tid]; if ($('#cv-drive')) $('#cv-drive').innerHTML = estadoVideoTxt(t);
  if ($('#cv-barra')) $('#cv-barra').style.width = (sv && sv.estado === 'subiendo' ? Math.round(sv.p * 100) : 0) + '%';
}
async function subirVideo(t, file) {
  if (esLector()) return;
  const inf = S.inf, sv = S.subidasVideo[t.id] = { p: 0, estado: 'subiendo', file };
  refrescarEstadoVideo(t.id);
  const ext = (file.name.match(/\.[a-z0-9]{2,4}$/i) || ['.mp4'])[0];
  const nombre = (inf.id + ' ' + etiquetaTramo(t).replace(/[→]/g, '-') + ext).replace(/\s+/g, ' ');
  try {
    const r = await apiOk('videoIniciar', { id: inf.id, nombre, tamano: file.size, mime: file.type || 'video/mp4', tramo: etiquetaTramo(t) });
    let off = 0, fallos = 0, fin = null;
    while (!fin) {
      try {
        const b64 = await blobB64(file.slice(off, off + r.trozo));
        const rr = await apiOk('videoTrozo', { subida: r.subida, inicio: off, b64 }, { timeout: 240000 });
        fallos = 0;
        if (rr.fin) fin = rr; else off = rr.siguiente;
      } catch (e) {
        if (/expir/i.test(e.message) || ++fallos > 6) throw e;
        await sleep(1500 * fallos);
        try { const q = await apiOk('videoTrozo', { subida: r.subida, consultar: true }); if (q.fin) fin = q; else off = q.siguiente; } catch (e2) { /* se reintenta */ }
      }
      sv.p = fin ? 1 : off / file.size; refrescarEstadoVideo(t.id);
    }
    t.video = { id: fin.fileId, nombre: file.name, tamano: file.size, subido: new Date().toISOString() };
    sv.estado = 'ok'; delete sv.file;
    if (S.inf === inf) { marcarSucio(); refrescarEstadoVideo(t.id); pintarListaTramos(); }
    else await parcheVideo(inf.id, t.id, t.video);
    toast(`Video del tramo <b>${esc(etiquetaTramo(t))}</b> guardado en Drive.`, 'ok');
  } catch (e) {
    sv.estado = 'error'; refrescarEstadoVideo(t.id);
    toast('El video no se guardó en Drive: ' + esc(e.message), 'err', 8000);
  }
}
async function parcheVideo(infId, tid, video) {
  for (let i = 0; i < 3; i++) {
    const r = await apiOk('obtener', { id: infId }); const tt = r.informe.tramos.find((x) => x.id === tid); if (!tt) return;
    tt.video = video; const g = await api('guardar', { informe: r.informe }); if (g.ok) return;
  }
}
async function videoDesdeDrive(t) {
  const v = t.video; if (!v || !v.id) return;
  const p = progreso('Descargando el video desde Drive…'), partes = [];
  try {
    let ini = 0, total = v.tamano || 1, mime = 'video/mp4';
    do {
      const r = await apiOk('videoLeer', { id: S.inf.id, fileId: v.id, inicio: ini, largo: 4194304 }, { timeout: 180000 });
      const bin = atob(r.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      partes.push(u); ini += u.length; total = r.total; mime = r.mime || mime; p.set(ini / total, `Descargando el video desde Drive… ${Math.round((ini / total) * 100)}%`);
      if (!u.length) break;
    } while (ini < total);
    const file = new File(partes, v.nombre || 'video.mp4', { type: mime });
    if (tramoActual().id === t.id) { S.videos[t.id] = { url: URL.createObjectURL(file), file, vel: 1 }; $('#soltar').classList.add('hide'); $('#vid').src = S.videos[t.id].url; }
  } catch (e) { toast(esc(e.message), 'err'); }
  finally { p.fin(); }
}
function capturar() {
  if (esLector()) return;
  const vid = $('#vid'), t = tramoActual();
  if (!vid || !vid.videoWidth) { toast('Cargue primero el video del tramo.'); return; }
  vid.pause();
  const k = Math.min(1, 1600 / vid.videoWidth), c = document.createElement('canvas');
  c.width = Math.round(vid.videoWidth * k); c.height = Math.round(vid.videoHeight * k);
  c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.88);
  $('#flash').classList.remove('on'); void $('#flash').offsetWidth; $('#flash').classList.add('on');
  const o = nuevaObs(t, { tiempo: Math.round(vid.currentTime * 10) / 10 });
  ponerFoto(o, url);
  const recorte = recorteZona(vid);   // el contador se lee del fotograma capturado
  pintarObs(); pintarMarcas(); pintarPerfil(); pintarListaTramos(); marcarSucio();
  fichaHallazgo([o.id], 0, { video: true });
  if (recorte) leerDistancia(o, recorte);
}
function nuevaObs(t, extra) {
  const o = Object.assign({ id: uid('o'), dist: null, tiempo: null, codigo: '', desc: '', hIni: '', hFin: '', grado: 0, continuo: false, distFin: null, foto: null }, extra || {});
  t.obs.push(o); return o;
}
function ponerFoto(o, dataUrl) {
  const k = uid('k'); S.fotos[k] = dataUrl;
  if (o.foto && o.foto.id && !o.foto.original) o.foto.original = o.foto.id;
  o.foto = Object.assign({}, o.foto || {}, { id: null, k });
  S.cola.push({ o, k, infId: S.inf.id, nombre: (S.inf.id + ' ' + etiquetaTramo(tramoActual()) + ' ' + (o.codigo || 'obs')).replace(/[→]/g, '-') });
  procesarCola();
}
async function procesarCola() {
  if (S.subiendoFotos) return; S.subiendoFotos = true;
  try {
    while (S.cola.length) {
      const it = S.cola[0]; setSync('pend', `Subiendo ${S.cola.length} foto${S.cola.length > 1 ? 's' : ''}…`);
      let ok = false;
      for (let i = 0; i < 4 && !ok; i++) {
        try {
          const r = await apiOk('subirFoto', { id: it.infId, b64: S.fotos[it.k], nombre: it.nombre });
          if (it.o.foto && it.o.foto.k === it.k) { it.o.foto.id = r.fileId; delete it.o.foto.k; }
          S.fotos[r.fileId] = S.fotos[it.k]; ok = true;
          $$(`[data-obs="${it.o.id}"] .pend`).forEach((x) => x.remove());
        } catch (e) { if (/sesión|permiso/i.test(e.message)) throw e; await sleep(1500 * (i + 1)); }
      }
      S.cola.shift();
      if (!ok) toast('Una foto no se pudo subir a Drive. Revise la conexión y vuelva a capturarla.', 'err', 8000);
      if (S.inf && S.inf.id === it.infId) marcarSucio();
    }
  } catch (e) { toast(esc(e.message), 'err'); }
  finally { S.subiendoFotos = false; if (!S.dirty && !S.cola.length) setSync('ok', 'Guardado'); }
}
async function comprimir(file, max = 1600, q = 0.86) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen ' + file.name)); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}
async function cargarFotos(files) {
  const t = tramoActual(), ims = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)), ids = [];
  const p = ims.length > 2 ? progreso('Preparando las fotos…') : null;
  for (let k = 0; k < ims.length; k++) {
    try { const url = await comprimir(ims[k]); const o = nuevaObs(t, {}); ponerFoto(o, url); ids.push(o.id); }
    catch (e) { toast(esc(e.message), 'err'); }
    if (p) p.set((k + 1) / ims.length, `Preparando las fotos… ${k + 1} de ${ims.length}`);
  }
  if (p) p.fin();
  pintarObs(); pintarPerfil(); pintarListaTramos(); marcarSucio();
  if (ids.length) fichaHallazgo(ids, 0, { fotos: true });
}
$('#p-tramos').addEventListener('keydown', (e) => {
  if (!e.target.closest('#consola') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const vid = $('#vid'); if (!vid) return;
  if (e.key === ' ') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
  else if (e.key.toLowerCase() === 'c') { e.preventDefault(); capturar(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); vid.pause(); vid.currentTime = Math.max(0, vid.currentTime - (e.shiftKey ? 5 : 1 / 30)); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); vid.pause(); vid.currentTime += e.shiftKey ? 5 : 1 / 30; }
});


/* ------------------------------------------------------------ lectura automática del contador de metros (OCR)
   El equipo imprime los metros recorridos sobre el video. Se marca una vez dónde está ese contador; en cada captura
   se recorta esa zona del fotograma y se lee con Tesseract (en el navegador, sin enviar nada a terceros). */
const ZKEY = 'hr_ocr_zona';
function zonaOCR() {
  const z = S.inf && S.inf.general && S.inf.general.ocrZona;
  if (z && z.w > 0) return z;
  try { const g = JSON.parse(localStorage.getItem(ZKEY) || 'null'); if (g && g.w > 0) return g; } catch (e) { /* nada */ }
  return null;
}
function marcoVideo(vid) { /* rectángulo real del video dentro del elemento (object-fit: contain) */
  const r = vid.getBoundingClientRect(), vw = vid.videoWidth || 16, vh = vid.videoHeight || 9, k = Math.min(r.width / vw, r.height / vh);
  return { x: r.left + (r.width - vw * k) / 2, y: r.top + (r.height - vh * k) / 2, w: vw * k, h: vh * k, k };
}
function pintarZona() {
  const vid = $('#vid'), z = zonaOCR(), el = $('#zona-ocr'); if (!vid || !el) return;
  if (!z || !vid.videoWidth) { el.classList.add('hide'); return; }
  const m = marcoVideo(vid), pr = $('#pantalla').getBoundingClientRect();
  Object.assign(el.style, { left: (m.x - pr.left + z.x * m.w) + 'px', top: (m.y - pr.top + z.y * m.h) + 'px', width: z.w * m.w + 'px', height: z.h * m.h + 'px' });
  el.classList.remove('hide');
}
function marcarZona() {
  const vid = $('#vid'); if (!vid || !vid.videoWidth) { toast('Cargue primero el video del tramo.'); return; }
  vid.pause();
  const sel = $('#zona-sel'); sel.classList.remove('hide'); $('#zona-ocr').classList.add('hide');
  let ini = null, caja = null;
  const fin = () => { sel.classList.add('hide'); sel.onpointerdown = sel.onpointermove = sel.onpointerup = null; if (caja) caja.remove(); pintarZona(); };
  sel.onpointerdown = (e) => { sel.setPointerCapture(e.pointerId); ini = [e.clientX, e.clientY]; caja = document.createElement('div'); caja.className = 'zona-ocr'; sel.appendChild(caja); };
  sel.onpointermove = (e) => {
    if (!ini) return; const pr = sel.getBoundingClientRect();
    Object.assign(caja.style, { left: Math.min(ini[0], e.clientX) - pr.left + 'px', top: Math.min(ini[1], e.clientY) - pr.top + 'px', width: Math.abs(e.clientX - ini[0]) + 'px', height: Math.abs(e.clientY - ini[1]) + 'px' });
  };
  sel.onpointerup = (e) => {
    if (!ini) return fin();
    const m = marcoVideo(vid), x0 = Math.min(ini[0], e.clientX), y0 = Math.min(ini[1], e.clientY), w = Math.abs(e.clientX - ini[0]), h = Math.abs(e.clientY - ini[1]);
    if (w < 12 || h < 8) { toast('Recuadro muy pequeño. Arrastre sobre todo el número del contador.'); return fin(); }
    const z = { x: Math.max(0, (x0 - m.x) / m.w), y: Math.max(0, (y0 - m.y) / m.h), w: Math.min(1, w / m.w), h: Math.min(1, h / m.h) };
    S.inf.general.ocrZona = z; try { localStorage.setItem(ZKEY, JSON.stringify(z)); } catch (er) { /* nada */ }
    marcarSucio(); fin(); $('#cv-zona').textContent = 'Contador: listo';
    const r = recorteZona(vid);
    if (r) calibrarZona(r);
  };
}
function recorteZona(vid) {
  const z = zonaOCR(); if (!z || !vid || !vid.videoWidth) return null;
  const sx = z.x * vid.videoWidth, sy = z.y * vid.videoHeight, sw = Math.max(4, z.w * vid.videoWidth), sh = Math.max(4, z.h * vid.videoHeight);
  const k = Math.max(1, Math.min(4, 110 / sh)), c = document.createElement('canvas');
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(vid, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
let ocrMotor = null;
function motorOCR() {
  if (ocrMotor) return ocrMotor;
  const base = new URL('lib/ocr/', location.href).href;
  ocrMotor = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'lib/ocr/tesseract.min.js';
    s.onerror = () => rej(new Error('No se pudo cargar el lector del contador'));
    s.onload = async () => {
      try {
        const w = await window.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''), gzip: true, cacheMethod: 'none' });
        await w.setParameters({ tessedit_char_whitelist: '0123456789.,', tessedit_pageseg_mode: '7' });
        res(w);
      } catch (e) { rej(e); }
    };
    document.head.appendChild(s);
  });
  ocrMotor.catch(() => { ocrMotor = null; });
  return ocrMotor;
}
function binarizar(src, claro) { /* deja el texto negro sobre blanco; claro=true para contadores de letras claras (lo usual) */
  const w = src.width, h = src.height, im = src.getContext('2d').getImageData(0, 0, w, h), d = im.data;
  let mx = 0, mn = 255; const L = new Float32Array(w * h);
  for (let i = 0; i < L.length; i++) { const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; L[i] = v; if (v > mx) mx = v; if (v < mn) mn = v; }
  const umbral = claro ? Math.max(150, mx - 45) : Math.min(105, mn + 45);
  for (let i = 0; i < L.length; i++) { const tinta = claro ? L[i] >= umbral : L[i] <= umbral, x = tinta ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = x; d[i * 4 + 3] = 255; }
  const c = document.createElement('canvas'), pad = 16; c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.putImageData(im, pad, pad);
  return c;
}
function numeroDe(txt) {
  const m = String(txt || '').replace(/\s+/g, '').replace(/,/g, '.').match(/\d{1,4}(?:\.\d{1,3})?/g);
  if (!m) return null;
  const n = m.map(Number).filter((x) => x >= 0 && x <= 2000).sort((a, b) => String(b).length - String(a).length)[0];
  return n == null ? null : Math.round(n * 100) / 100;
}
async function ocrUna(c, claro) {
  const w = await motorOCR(), r = await w.recognize(binarizar(c, claro)), n = numeroDe(r.data.text);
  const cs = (r.data.symbols || []).map((x) => x.confidence).sort((a, b) => a - b), conf = cs.length ? cs[Math.floor(cs.length / 2)] : 0;
  return n != null && conf >= 55 ? { n, conf, claro } : null;
}
async function leerCanvas(c) {
  const z = zonaOCR();
  if (z && typeof z.claro === 'boolean') { const r = await ocrUna(c, z.claro); return r ? r.n : null; }
  const rs = (await Promise.all([ocrUna(c, true), ocrUna(c, false)])).filter(Boolean).sort((a, b) => b.conf - a.conf);
  return rs.length ? rs[0].n : null;
}
async function calibrarZona(c) { /* el inspector confirma una vez qué número muestra el contador; así se fija cómo leerlo */
  const p = progreso('Leyendo el contador…'); p.set(0.5);
  let cands = [];
  try { cands = (await Promise.all([ocrUna(c, true), ocrUna(c, false)])).filter(Boolean); } catch (e) { console.warn(e); }
  p.fin();
  const unicos = cands.filter((x, i) => cands.findIndex((y) => y.n === x.n) === i);
  const guardar = (claro) => { const z = Object.assign({}, zonaOCR(), { claro }); S.inf.general.ocrZona = z; try { localStorage.setItem(ZKEY, JSON.stringify(z)); } catch (e) { /* nada */ } marcarSucio(); };
  if (!unicos.length) { toast('Zona guardada, pero no se pudo leer un número ahí. Ajuste el recuadro para que encierre solo los metros del contador.', 'err', 8000); return; }
  const d = abrirModal(`<div class="mh"><h3>¿Qué distancia muestra el contador?</h3></div><div class="mb"><p style="color:var(--mut);margin-bottom:12px">Se confirma una sola vez por equipo. Toque el valor que se ve ahora en el video.</p>
    <img src="${c.toDataURL()}" alt="Recorte del contador" style="max-width:100%;border-radius:8px;border:1px solid var(--line2);margin-bottom:14px;background:#000">
    <div style="display:flex;gap:8px;flex-wrap:wrap">${unicos.map((x, i) => `<button class="btn pri" data-cal="${i}" style="font-family:var(--mono);font-size:16px">${nf(x.n)} m</button>`).join('')}<button class="btn" data-cal="no">Ninguno · marcar de nuevo</button></div></div>`);
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cal]'); if (!b) return; cerrarModal();
    if (b.dataset.cal === 'no') { marcarZona(); return; }
    guardar(unicos[Number(b.dataset.cal)].claro);
    toast('Listo: desde ahora cada captura llena la distancia leyendo el contador.', 'ok', 6000);
  });
}
S.ocr = {};
function notaOCR(o) {
  const st = S.ocr[o.id];
  if (st && st.e === 'leyendo') return `<span class="spin mini"></span>Leyendo el contador del video…`;
  if (st && st.e === 'ok') return `${ico('cam', 'i mini')}Leído del contador: <b>${nf(st.v)} m</b>. Confírmelo; si no coincide, corríjalo.`;
  if (st && st.e === 'falla') return `No se pudo leer el contador en esta captura: escriba la distancia.`;
  if (o.tiempo != null && !zonaOCR()) return `Para que la distancia se llene sola, marque una vez el contador del video con <b>Marcar contador</b>.`;
  return '';
}
async function leerDistancia(o, recorte) {
  S.ocr[o.id] = { e: 'leyendo' }; refrescarNotaOCR(o);
  let v = null;
  try { v = await leerCanvas(recorte); } catch (e) { console.warn(e); }
  S.ocr[o.id] = v != null ? { e: 'ok', v } : { e: 'falla' };
  if (v != null && o.dist == null) {
    o.dist = v; marcarSucio(); pintarPerfil();
    const i = $('#fx-dist'); if (i && $('#fx-ocr') && $('#fx-ocr').dataset.o === o.id && !i.value) { i.value = String(v).replace('.', ','); i.classList.add('leido'); }
  }
  refrescarNotaOCR(o);
}
HR.ocr = { recorteZona, binarizar, motorOCR, numeroDe };   /* para diagnóstico desde la consola */
function refrescarNotaOCR(o) { const n = $('#fx-ocr'); if (n && n.dataset.o === o.id) n.innerHTML = notaOCR(o); }


/* ------------------------------------------------------------ importar tramos desde Excel o CSV */
let xlsxListo = null;
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxListo) xlsxListo = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'lib/xlsx-0.20.3.min.js'; s.onload = res; s.onerror = () => { xlsxListo = null; rej(new Error('No se pudo cargar el lector de Excel')); }; document.head.appendChild(s); });
  return xlsxListo;
}
const CAMPOS_IMP = [['', '— no importar —'], ['pozoIni', 'Pozo inicial'], ['pozoFin', 'Pozo final'], ['red', 'Tipo de red'], ['material', 'Material'], ['diametro', 'Diámetro (mm)'],
  ['longitud', 'Longitud del tramo (m)'], ['inspeccionada', 'Longitud inspeccionada (m)'], ['profIni', 'Prof. pozo inicial (m)'], ['profFin', 'Prof. pozo final (m)'], ['ubicacion', 'Dirección / ubicación'],
  ['sentido', 'Sentido'], ['latIni', 'Latitud cámara inicial'], ['lonIni', 'Longitud (coord.) cámara inicial'], ['latFin', 'Latitud cámara final'], ['lonFin', 'Longitud (coord.) cámara final'], ['condicion', 'Condición'], ['fecha', 'Fecha']];
function campoDeEncabezado(h) {
  const t = norm(h).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); if (!t) return '';
  const ini = /\b(ini|inicial|inicio|desde|aguas arriba|a)\b/.test(t), fin = /\b(fin|final|hasta|llegada|aguas abajo|b)\b/.test(t);
  const coordCtx = /(camara|pozo|coord|gms|grados|oeste|norte|\bini|\bfin|inicial|final|desde|hasta)/.test(t);
  if (/\blat/.test(t)) return fin ? 'latFin' : 'latIni';
  if (/\b(lon|lng|long)\b/.test(t) || (/longitud/.test(t) && coordCtx && !/tramo|\(m\)|\bm\b|metros|inspecc/.test(t))) return fin ? 'lonFin' : 'lonIni';
  if (/inspeccionad/.test(t)) return 'inspeccionada';
  if (/longitud|largo|distancia/.test(t)) return 'longitud';
  if (/prof/.test(t)) return fin ? 'profFin' : 'profIni';
  if (/(pozo|camara|pz|nodo|desde|hasta)/.test(t)) return fin ? 'pozoFin' : ini ? 'pozoIni' : '';
  if (/diam/.test(t)) return 'diametro';
  if (/material/.test(t)) return 'material';
  if (/(tipo de red|\bred\b|sistema)/.test(t)) return 'red';
  if (/(direcc|ubicac|calle|sector|barrio)/.test(t)) return 'ubicacion';
  if (/sentido/.test(t)) return 'sentido';
  if (/(condicion|estado)/.test(t)) return 'condicion';
  if (/fecha/.test(t)) return 'fecha';
  return '';
}
function opcionCercana(v, ops) { const n = norm(v).trim(); if (!n) return ''; const o = ops.find((x) => x && (norm(x) === n || norm(x).startsWith(n) || n.startsWith(norm(x)))) || ops.find((x) => x && n.length >= 5 && norm(x).slice(0, 6) === n.slice(0, 6)); return o || String(v).trim(); }
function coordDe(v, tipo) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const r = leerGMS(v); if (!r) return null;
  const neg = r.h === 'S' || r.h === 'W' || r.h === 'O' || r.h === '-' || (r.h == null && tipo === 'lon');   // sin hemisferio: Colombia (N y O)
  const x = r.v * (neg ? -1 : 1);
  return (tipo === 'lat' ? Math.abs(x) <= 90 : Math.abs(x) <= 180) ? Math.round(x * 1e6) / 1e6 : null;
}
function fechaDe(v) {
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(String(v || '').trim()); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
}
function abrirImportar() {
  const d = abrirModal(`<div class="mh"><h3>Importar tramos desde Excel</h3><button class="btn xs fant" data-im="x">${ico('x')}</button></div>
    <div class="mb"><p style="color:var(--mut);margin-bottom:12px">Suba el listado de tramos del catastro o del contrato (.xlsx, .xls o .csv). Cada fila crea un tramo con sus pozos, diámetro, material, longitud y coordenadas de las cámaras (en grados-minutos-segundos o decimales).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-im="elegir">${ico('doc')}Elegir archivo</button><button class="btn" data-im="plantilla">${ico('word')}Descargar plantilla</button></div>
      <input type="file" id="f-excel" accept=".xlsx,.xls,.csv" class="hide"><div id="im-prev" style="margin-top:14px"></div></div>
    <div class="mf"><button class="btn" data-im="x">Cancelar</button><button class="btn pri" data-im="ok" id="im-ok" disabled>Importar</button></div>`, true);
  let filas = [], mapa = [];
  $('#f-excel').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#im-prev').innerHTML = '<div class="spin"></div>';
    try {
      await cargarXLSX();
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const hoja = wb.Sheets[wb.SheetNames.find((n) => !/instruc/i.test(n)) || wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '' });
      let hi = 0, mejor = -1;
      for (let i = 0; i < Math.min(12, aoa.length); i++) { const n = aoa[i].map(campoDeEncabezado).filter(Boolean).length; if (n > mejor) { mejor = n; hi = i; } }
      if (mejor < 2) throw new Error('No se reconocieron los encabezados. Use la plantilla o asigne las columnas a mano.');
      const enc = aoa[hi].map((x) => String(x || '').trim());
      mapa = enc.map(campoDeEncabezado);
      filas = aoa.slice(hi + 1).map((r, i) => Object.assign(r, { _fila: hi + 2 + i })).filter((r) => r.some((x) => String(x).trim() !== ''));
      pintarPrev(enc);
    } catch (er) { $('#im-prev').innerHTML = `<div class="msg err">${esc(er.message)}</div>`; }
  });
  function construir() {
    const tramos = [], avisos = [];
    filas.forEach((r) => { const i = r._fila - 1;
      const v = {}; mapa.forEach((k, c) => { if (k) v[k] = r[c]; });
      if (!String(v.pozoIni || '').trim() && !String(v.pozoFin || '').trim()) { avisos.push(`Fila ${i + 1}: sin pozos, se omite.`); return; }
      const t = nuevoTramo();
      t.pozoIni = String(v.pozoIni || '').trim(); t.pozoFin = String(v.pozoFin || '').trim();
      if (v.red) t.red = opcionCercana(v.red, ['Sanitaria', 'Pluvial', 'Combinada']);
      if (v.material) t.material = opcionCercana(v.material, TR.find((x) => x.k === 'material').o);
      if (v.sentido) t.sentido = /arriba/i.test(v.sentido) ? 'Aguas arriba' : 'Aguas abajo';
      if (v.condicion) t.condicion = opcionCercana(v.condicion, ['Buena', 'Regular', 'Mala', 'Crítica', 'No evaluada']);
      ['diametro', 'longitud', 'inspeccionada', 'profIni', 'profFin'].forEach((k) => { if (v[k] !== undefined && v[k] !== '') t[k] = typeof v[k] === 'number' ? v[k] : pn(String(v[k]).replace(/[^\d.,-]/g, '')); });
      if (v.ubicacion) t.ubicacion = String(v.ubicacion).trim();
      if (v.fecha) t.fecha = fechaDe(v.fecha) || t.fecha;
      const la1 = coordDe(v.latIni, 'lat'), lo1 = coordDe(v.lonIni, 'lon'), la2 = coordDe(v.latFin, 'lat'), lo2 = coordDe(v.lonFin, 'lon');
      if (la1 != null && lo1 != null) t.cIni = { lat: la1, lon: lo1 }; else if (v.latIni || v.lonIni) avisos.push(`Fila ${i + 1}: coordenadas de la cámara inicial no válidas.`);
      if (la2 != null && lo2 != null) t.cFin = { lat: la2, lon: lo2 }; else if (v.latFin || v.lonFin) avisos.push(`Fila ${i + 1}: coordenadas de la cámara final no válidas.`);
      tramos.push(t);
    });
    /* la cámara final de un tramo es la inicial del siguiente cuando comparten pozo */
    const porPozo = {}; tramos.forEach((t) => { if (camOk(t.cIni)) porPozo[norm(t.pozoIni)] = t.cIni; if (camOk(t.cFin)) porPozo[norm(t.pozoFin)] = t.cFin; });
    tramos.forEach((t) => { if (!camOk(t.cIni) && porPozo[norm(t.pozoIni)]) t.cIni = Object.assign({}, porPozo[norm(t.pozoIni)]); if (!camOk(t.cFin) && porPozo[norm(t.pozoFin)]) t.cFin = Object.assign({}, porPozo[norm(t.pozoFin)]); });
    return { tramos, avisos };
  }
  function pintarPrev(enc) {
    const { tramos, avisos } = construir();
    $('#im-prev').innerHTML = `<p style="margin-bottom:8px"><b>${tramos.length}</b> tramo${tramos.length === 1 ? '' : 's'} listo${tramos.length === 1 ? '' : 's'} para importar. Revise que cada columna esté asignada al dato correcto.</p>
      <div class="tw" style="max-height:46vh;overflow:auto"><table class="tabla im-t"><thead><tr>${enc.map((h, c) => `<th><div style="font-weight:600;color:var(--tx)">${esc(h || 'Columna ' + (c + 1))}</div><select class="inp" data-col="${c}" style="height:30px;margin-top:4px;font-size:12px">${CAMPOS_IMP.map(([k, l]) => `<option value="${k}"${mapa[c] === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></th>`).join('')}</tr></thead>
      <tbody>${filas.slice(0, 8).map((r) => `<tr>${enc.map((_, c) => `<td>${esc(r[c] instanceof Date ? r[c].toLocaleDateString('es-CO') : r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${filas.length > 8 ? `<p class="ayuda" style="margin-top:6px">…y ${filas.length - 8} fila(s) más.</p>` : ''}
      ${avisos.length ? `<div class="msg err" style="margin-top:8px">${avisos.slice(0, 6).map(esc).join('<br>')}${avisos.length > 6 ? '<br>…' : ''}</div>` : ''}`;
    $('#im-ok').disabled = !tramos.length; $('#im-ok').textContent = `Importar ${tramos.length} tramo${tramos.length === 1 ? '' : 's'}`;
    $$('#im-prev select[data-col]').forEach((sl) => sl.addEventListener('change', () => { mapa[Number(sl.dataset.col)] = sl.value; pintarPrev(enc); }));
  }
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-im]'); if (!b) return;
    if (b.dataset.im === 'x') cerrarModal();
    else if (b.dataset.im === 'elegir') $('#f-excel').click();
    else if (b.dataset.im === 'plantilla') plantillaExcel().catch((er) => toast(esc(er.message), 'err'));
    else if (b.dataset.im === 'ok') {
      const { tramos } = construir(); if (!tramos.length) return;
      const vacio = (t) => !t.pozoIni && !t.pozoFin && !t.obs.length && !t.video && t.longitud == null;
      S.inf.tramos = S.inf.tramos.filter((t) => !vacio(t)).concat(tramos);
      S.tramoSel = tramos[0].id; cerrarModal(); pintarTramos(); marcarSucio();
      toast(`${tramos.length} tramo${tramos.length === 1 ? '' : 's'} importado${tramos.length === 1 ? '' : 's'}.`, 'ok');
    }
  });
}
async function plantillaExcel() {
  await cargarXLSX();
  const enc = ['Pozo inicial', 'Pozo final', 'Tipo de red', 'Material', 'Diámetro (mm)', 'Longitud del tramo (m)', 'Profundidad pozo inicial (m)', 'Profundidad pozo final (m)', 'Dirección', 'Sentido',
    'Latitud cámara inicial', 'Longitud (coord.) cámara inicial', 'Latitud cámara final', 'Longitud (coord.) cámara final'];
  const ej = [['PZ-01', 'PZ-02', 'Sanitaria', 'PVC', 315, 42.5, 1.8, 2.1, 'Calle 12 entre carreras 4 y 5', 'Aguas abajo', `4°33'55,8" N`, `75°45'03,6" O`, `4°33'57,0" N`, `75°45'02,8" O`],
    ['PZ-02', 'PZ-03', 'Sanitaria', 'PVC', 315, 30, 2.1, 2.4, 'Calle 12 entre carreras 5 y 6', 'Aguas abajo', '', '', `4°33'58,1" N`, `75°45'01,9" O`]];
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([enc, ...ej]);
  ws['!cols'] = enc.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Tramos');
  const ins = XLSX.utils.aoa_to_sheet([['Instrucciones · HYDRO-ROV Análisis'], [''],
    ['1. Una fila por tramo. Pozo inicial y pozo final son obligatorios; lo demás es opcional.'],
    ['2. Coordenadas de las cámaras en grados-minutos-segundos (4°33\'55,8" N, 75°45\'03,6" O) o en decimales (4.565500, -75.751000).'],
    ['3. Sin hemisferio se asume Colombia: latitud norte (N) y longitud oeste (O).'],
    ['4. Si un pozo se repite, sus coordenadas se usan en todos los tramos que lo comparten (no hace falta repetirlas).'],
    ['5. Tipo de red: Sanitaria, Pluvial o Combinada. Material: PVC, Concreto, Gres, GRP / PRFV, Polietileno (PEAD), Asbesto-cemento…']]);
  ins['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ins, 'Instrucciones');
  XLSX.writeFile(wb, 'Plantilla tramos HYDRO-ROV.xlsx');
}

/* ------------------------------------------------------------ observaciones */
function opcionesCodigo(v) {
  return '<option value="">— Código —</option>' + CATALOGO.map((g) => `<optgroup label="${esc(g.grupo)}">${g.items.map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${k} · ${esc(n)}</option>`).join('')}</optgroup>`).join('')
    + (v && !COD[v] ? `<option selected value="${esc(v)}">${esc(v)}</option>` : '');
}
const horas = (v) => '<option value="">—</option>' + Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => `<option${h === v ? ' selected' : ''}>${h}</option>`).join('');
function fotoSrc(o) { if (!o.foto) return null; return S.fotos[o.foto.id] || S.fotos[o.foto.k] || null; }
function pintarObs() {
  const t = tramoActual(), box = $('#obs-l'); if (!box) return;
  if (!t.obs.length) { box.innerHTML = '<div class="vacio" style="padding:26px"><p>Sin observaciones. Capture un fotograma del video, cargue fotos o agregue una observación sin foto.</p></div>'; return; }
  box.innerHTML = t.obs.map((o, i) => {
    const src = fotoSrc(o);
    return `<div class="ob${S.focoObs === o.id ? ' foco' : ''}" data-obs="${o.id}">
      <div class="ft" data-oa="anotar" title="${o.foto ? 'Ver o anotar la foto' : 'Agregar foto'}">${src ? `<img src="${src}" alt="">` : o.foto && o.foto.id ? '<span>Cargando…</span>' : '<span>' + ico('foto') + '<br>Sin foto</span>'}
        <span class="nro">#${i + 1}${o.tiempo != null ? ' · ' + fmtT(o.tiempo) : ''}</span>${(o.dist == null || !o.codigo) && !(o.foto && !o.foto.id) ? '<span class="falta">Completar ficha</span>' : ''}${o.foto && !o.foto.id ? '<span class="pend">Subiendo a Drive…</span>' : ''}</div>
      <div class="cps">
        <label><span>Distancia (m)</span><input data-b="o:dist" data-n="1" inputmode="decimal" value="${o.dist == null ? '' : String(o.dist).replace('.', ',')}" placeholder="0,00"></label>
        <label title="Solo sirve para volver a ese punto del video; no sale en el informe"><span>Minuto (solo app)</span><input data-b="o:tiempo" data-tiempo="1" value="${esc(fmtT(o.tiempo))}" placeholder="mm:ss"></label>
        <label class="w2"><span>Código del hallazgo</span><select data-b="o:codigo">${opcionesCodigo(o.codigo)}</select></label>
        <label class="w4"><span>Descripción</span><textarea data-b="o:desc" placeholder="Qué se observa, extensión, condición…">${esc(o.desc || '')}</textarea></label>
        <label class="c12"><span>Posición horaria</span><div class="hr"><select data-b="o:hIni">${horas(o.hIni)}</select><span style="color:var(--mut2)">a</span><select data-b="o:hFin">${horas(o.hFin)}</select></div></label>
        <label class="c3"><span>Continuo hasta (m)</span><input data-b="o:distFin" data-n="1" inputmode="decimal" value="${o.distFin == null ? '' : String(o.distFin).replace('.', ',')}" placeholder="—"></label>
        <div class="c4"><span style="display:block;font-size:11px;color:var(--mut2);margin-bottom:4px">Grado de severidad</span><div class="grados">${GRADOS.map((g) => `<button type="button" data-grado="${g.g}" class="${Number(o.grado || 0) === g.g ? 'on' : ''}" style="${Number(o.grado || 0) === g.g ? 'background:' + g.c : ''}" title="${g.n}">${g.g || '—'}</button>`).join('')}</div></div>
      </div>
      <div class="acc">${o.tiempo != null ? `<button type="button" class="btn xs fant" data-oa="ir" title="Ir a este punto del video">${ico('ir')}</button>` : ''}
        <button type="button" class="btn xs fant solo-ed" data-oa="ficha" title="Abrir la ficha del hallazgo">${ico('lapiz')}</button>
        <button type="button" class="btn xs fant solo-ed" data-oa="borrar" title="Eliminar observación">${ico('basura')}</button></div></div>`;
  }).join('');
}
function enfocarObs(id, editar) {
  S.focoObs = id;
  $$('.ob').forEach((x) => x.classList.toggle('foco', x.dataset.obs === id));
  const el = $(`.ob[data-obs="${id}"]`); if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (editar) setTimeout(() => { const i = el.querySelector('[data-b="o:dist"]'); if (i) i.focus({ preventScroll: true }); }, 350);
}
async function precargarFotos() {
  const ids = []; S.inf.tramos.forEach((t) => t.obs.forEach((o) => { if (o.foto && o.foto.id && !S.fotos[o.foto.id]) ids.push(o.foto.id); }));
  await asegurarFotos(ids, () => { pintarObsSoloFotos(); });
}
async function asegurarFotos(ids, cada) {
  ids = ids.filter((x) => x && !S.fotos[x]);
  const inf = S.inf;
  for (let i = 0; i < ids.length; i += 8) {
    try { const r = await apiOk('obtenerFotos', { id: inf.id, ids: ids.slice(i, i + 8) }); Object.assign(S.fotos, r.fotos); if (cada) cada(); }
    catch (e) { console.warn(e); }
  }
}
HR.asegurarFotos = asegurarFotos;
function pintarObsSoloFotos() {
  $$('.ob').forEach((el) => {
    const o = obsPorId(el.dataset.obs); const src = o && fotoSrc(o); const ft = el.querySelector('.ft');
    if (src && !ft.querySelector('img')) { const sp = ft.querySelector('span:not(.nro):not(.pend)'); if (sp) sp.remove(); const im = document.createElement('img'); im.src = src; im.alt = ''; ft.prepend(im); }
  });
}

HR.perfilSVG = perfilSVG;
function pintarPerfil() { const b = $('#perfil'); if (b && S.inf) b.innerHTML = perfilSVG(tramoActual()); }
$('#p-tramos').addEventListener('click', (e) => { const g = e.target.closest('#perfil [data-obs]'); if (g) enfocarObs(g.dataset.obs); });

/* ------------------------------------------------------------ edición: enlaces de datos */
function onInput(e) {
  const el = e.target, b = el.dataset && el.dataset.b; if (!b || !S.inf) return;
  const [sc, k] = b.split(':');
  let obj = sc === 'g' ? S.inf.general : sc === 't' ? tramoActual() : sc === 'i' ? S.inf : null;
  if (sc === 'o') obj = obsPorId(el.closest('[data-obs]').dataset.obs);
  if (sc === 'f') obj = S.inf.firmas[Number(el.closest('[data-firma]').dataset.firma)];
  if (!obj) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.n) v = pn(v);
  if (el.dataset.tiempo) { if (e.type !== 'change') return; v = pT(v); el.value = fmtT(v); }
  obj[k] = v;
  if (sc === 'g' && k === 'proyecto') $('#e-tit').textContent = v || 'Informe sin título';
  if (sc === 't' && /pozo|longitud|inspeccionada|sentido/.test(k)) { pintarListaTramos(); pintarPerfil(); $('#cv-tramo').textContent = etiquetaTramo(obj); }
  if (sc === 'o' && /dist|codigo|tiempo/.test(k)) { pintarPerfil(); pintarMarcas(); }
  if (sc === 'o' && k === 'codigo' && COD[v] && COD[v].grupo === 'Inspección' && e.type === 'change') { obj.grado = 0; pintarObs(); pintarListaTramos(); }
  marcarSucio();
}
$('#e-fs').addEventListener('input', onInput);
$('#e-fs').addEventListener('change', onInput);
$('#p-tramos').addEventListener('click', async (e) => {
  const gb = e.target.closest('[data-grado]');
  if (gb && !esLector()) { const o = obsPorId(gb.closest('[data-obs]').dataset.obs); o.grado = Number(gb.dataset.grado); $$('[data-grado]', gb.parentNode).forEach((x) => { const on = x === gb; x.classList.toggle('on', on); x.style.background = on ? GRADOS[o.grado].c : ''; }); pintarPerfil(); pintarMarcas(); pintarListaTramos(); marcarSucio(); return; }
  const tb = e.target.closest('[data-tramo]');
  if (tb) { S.tramoSel = tb.dataset.tramo; S.focoObs = null; pintarTramos(); return; }
  const vc = e.target.closest('[data-vc]');
  if (vc) {
    const vid = $('#vid'), a = vc.dataset.vc, lv = S.videos[tramoActual().id];
    if (a === 'cap') return capturar();
    if (a === 'zona') return marcarZona();
    if (!vid || !vid.src) { if (a !== 'cap') toast('Cargue primero el video del tramo.'); return; }
    if (a === 'play') vid.paused ? vid.play() : vid.pause();
    else if (a === '-10' || a === '+10') vid.currentTime = Math.max(0, vid.currentTime + Number(a));
    else if (a === '-f' || a === '+f') { vid.pause(); vid.currentTime = Math.max(0, vid.currentTime + (a === '+f' ? 1 : -1) / 30); }
    else if (a === 'vel') { const vs = [0.5, 1, 2, 4], n = vs[(vs.indexOf(vid.playbackRate) + 1) % vs.length]; vid.playbackRate = n; if (lv) lv.vel = n; vc.textContent = n + '×'; }
    else if (a === 'full') { const p = $('#pantalla'); (p.requestFullscreen || p.webkitRequestFullscreen || (() => vid.webkitEnterFullscreen && vid.webkitEnterFullscreen())).call(p); }
    return;
  }
  const oa = e.target.closest('[data-oa]');
  if (oa) {
    const o = obsPorId(oa.closest('[data-obs]').dataset.obs), a = oa.dataset.oa;
    if (a === 'ir') { const vid = $('#vid'); if (vid && vid.src) { vid.currentTime = o.tiempo; vid.pause(); $('#consola').scrollIntoView({ behavior: 'smooth', block: 'start' }); } else toast('Cargue el video del tramo para ir a este punto.'); }
    else if (a === 'borrar') {
      if (!(await confirmar('Eliminar observación', 'La observación y su foto se retiran del informe.', 'Eliminar', true))) return;
      const t = tramoActual(); t.obs = t.obs.filter((x) => x !== o);
      if (o.foto && o.foto.id) api('borrarFoto', { id: S.inf.id, fileId: o.foto.id }).catch(() => {});
      pintarObs(); pintarPerfil(); pintarMarcas(); pintarListaTramos(); marcarSucio();
    } else if (a === 'anotar' || a === 'ficha') {
      if (esLector()) { if (fotoSrc(o)) anotar(o); }
      else fichaHallazgo([o.id], 0, {});
    }
    return;
  }
  const ta = e.target.closest('[data-ta]');
  if (!ta) return;
  e.preventDefault();
  const t = tramoActual(), a = ta.dataset.ta;
  if (a === 'nuevo') { const n = nuevoTramo(); const u = S.inf.tramos[S.inf.tramos.length - 1]; if (u) Object.assign(n, { pozoIni: u.pozoFin, cIni: camOk(u.cFin) ? Object.assign({}, u.cFin) : null, red: u.red, material: u.material, diametro: u.diametro, sentido: u.sentido }); S.inf.tramos.push(n); S.tramoSel = n.id; pintarTramos(); marcarSucio(); }
  else if (a === 'duplicar') { const n = nuevoTramo(); Object.assign(n, { pozoIni: t.pozoFin, cIni: camOk(t.cFin) ? Object.assign({}, t.cFin) : null, red: t.red, material: t.material, diametro: t.diametro, sentido: t.sentido, ubicacion: t.ubicacion }); S.inf.tramos.splice(S.inf.tramos.indexOf(t) + 1, 0, n); S.tramoSel = n.id; pintarTramos(); marcarSucio(); toast('Nuevo tramo con la ficha del anterior. Ajuste el pozo final y la longitud.'); }
  else if (a === 'borrar') {
    if (S.inf.tramos.length < 2) { toast('El informe necesita al menos un tramo.'); return; }
    if (!(await confirmar('Eliminar tramo', `Se retira el tramo <b>${esc(etiquetaTramo(t))}</b> con sus ${t.obs.length} observaciones. Las fotos y el video siguen en la carpeta de Drive.`, 'Eliminar tramo', true))) return;
    S.inf.tramos = S.inf.tramos.filter((x) => x !== t); S.tramoSel = S.inf.tramos[0].id; pintarTramos(); marcarSucio();
  }
  else if (a === 'video') $('#f-video').click();
  else if (a === 'importar') abrirImportar();
  else if (a === 'fotos') { S.fotoPara = null; S.trasFoto = null; $('#f-fotos').setAttribute('multiple', ''); $('#f-fotos').click(); }
  else if (a === 'sinfoto') { const o = nuevaObs(t, {}); const vid = $('#vid'); if (vid && vid.src && vid.duration) o.tiempo = Math.round(vid.currentTime * 10) / 10; pintarObs(); pintarPerfil(); pintarListaTramos(); marcarSucio(); enfocarObs(o.id, true); }
  else if (a === 'ordenar') { t.obs.sort((x, y) => (x.dist == null ? 1e9 : x.dist) - (y.dist == null ? 1e9 : y.dist)); pintarObs(); pintarPerfil(); marcarSucio(); }
  else if (a === 'gps') {
    if (!navigator.geolocation) return toast('Este equipo no ofrece ubicación.');
    navigator.geolocation.getCurrentPosition((p) => { t.coord = p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6); const i = $('[data-b="t:coord"]'); if (i) i.value = t.coord; marcarSucio(); toast('Coordenadas tomadas (precisión ±' + Math.round(p.coords.accuracy) + ' m).'); },
      (err) => toast('No se obtuvo la ubicación: ' + esc(err.message), 'err'), { enableHighAccuracy: true, timeout: 15000 });
  }
  else if (a === 'videoDrive') videoDesdeDrive(t);
  else if (a === 'reintentarVideo') { const sv = S.subidasVideo[t.id]; const f = (sv && sv.file) || (S.videos[t.id] && S.videos[t.id].file); if (f) subirVideo(t, f); }
  else if (a === 'quitarVideo') { if (!(await confirmar('Quitar video del tramo', 'El video deja de estar asociado al tramo. El archivo sigue en la carpeta de Drive.', 'Quitar'))) return; t.video = null; if (S.videos[t.id]) { URL.revokeObjectURL(S.videos[t.id].url); delete S.videos[t.id]; } pintarTramos(); marcarSucio(); }
});
/* fotos: varias como observaciones nuevas, o una para una observación existente */
document.getElementById('f-fotos').addEventListener('change', async (e) => {
  const fs = Array.from(e.target.files || []); e.target.value = '';
  if (!fs.length) return;
  if (S.fotoPara) {
    const o = S.fotoPara; S.fotoPara = null;
    try { ponerFoto(o, await comprimir(fs[0])); pintarObs(); marcarSucio(); } catch (err) { toast(esc(err.message), 'err'); }
    if (S.trasFoto) { const f = S.trasFoto; S.trasFoto = null; f(); }
    return;
  }
  cargarFotos(fs);
});



/* ------------------------------------------------------------ cámaras (pozos) del tramo: coordenadas GMS y mapa */
let mapaT = null, camModo = null;
function camBloque(t, k) {
  const c = t[k] || {}, nom = k === 'cIni' ? (t.pozoIni || 'Cámara inicial') : (t.pozoFin || 'Cámara final');
  const hla = c.lat != null && c.lat < 0 ? 'S' : 'N', hlo = c.lon != null && c.lon > 0 ? 'E' : 'O';
  return `<div class="cam" data-cam="${k}"><div class="cam-t"><span class="cam-p ${k}">${k === 'cIni' ? 'A' : 'B'}</span><b>${esc(nom)}</b><span class="ayuda" style="margin:0">${k === 'cIni' ? 'cámara inicial' : 'cámara final'}</span></div>
    <div class="cam-f"><label><span>Latitud</span><div class="gms"><input class="mono" data-cc="lat" value="${esc(aGMS(c.lat, 'lat', true))}" placeholder="4°32'02&quot;" autocomplete="off"><select data-ch="lat"><option${hla === 'N' ? ' selected' : ''}>N</option><option${hla === 'S' ? ' selected' : ''}>S</option></select></div></label>
      <label><span>Longitud</span><div class="gms"><input class="mono" data-cc="lon" value="${esc(aGMS(c.lon, 'lon', true))}" placeholder="75°14'36&quot;" autocomplete="off"><select data-ch="lon"><option value="O"${hlo === 'O' ? ' selected' : ''}>O</option><option value="E"${hlo === 'E' ? ' selected' : ''}>E</option></select></div></label></div>
    <div class="cam-d mono" data-cd>${camOk(c) ? c.lat.toFixed(6) + ', ' + c.lon.toFixed(6) : 'sin coordenadas'}</div>
    <div class="cam-b solo-ed"><button type="button" class="btn xs" data-ca="gps">${ico('gps')}GPS aquí</button><button type="button" class="btn xs" data-ca="mapa">${ico('lapiz')}Marcar en el mapa</button>${camOk(c) ? '<button type="button" class="btn xs fant" data-ca="quitar">' + ico('x') + 'Quitar</button>' : ''}</div></div>`;
}
function camarasHTML(t) {
  return `<div class="card" id="camaras"><h3><span class="n">CÁM</span>Ubicación de las cámaras y del tramo</h3>
    <p class="ayuda">Escriba las coordenadas en grados, minutos y segundos, por ejemplo <b class="mono">75°14'36"</b> o <b class="mono">75 14 36</b> (también sirve en decimales). Con ambas cámaras el tramo se dibuja en el mapa y sale en el informe.</p>
    <div class="cams">${camBloque(t, 'cIni')}${camBloque(t, 'cFin')}</div>
    <div class="mapa-t" id="mapa-t"></div><div class="ayuda" id="cam-modo" style="margin:8px 0 12px"></div></div>`;
}
const iconoCam = (letra, nom) => L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0],
  html: `<div class="camk"><span class="camk-n">${esc(nom)}</span><span class="camk-p">${letra}</span></div>` });
async function montarMapaTramo(t) {
  const box = $('#mapa-t'); if (!box) return;
  try { await cargarLeaflet(); } catch (e) { box.innerHTML = '<div class="vacio">' + esc(e.message) + '</div>'; return; }
  if (!document.body.contains(box) || tramoActual() !== t) return;
  if (mapaT) { try { mapaT.remove(); } catch (e) { /* nada */ } }
  mapaT = L.map(box, { zoomControl: true }); capaOSM(mapaT); mapaT._capa = L.layerGroup().addTo(mapaT);
  mapaT.on('click', (e) => { if (camModo && !esLector()) { fijarCam(t, camModo, e.latlng.lat, e.latlng.lng); camModo = null; $('#cam-modo').textContent = ''; } });
  dibujarTramo(t, true);
}
function dibujarTramo(t, encuadrar) {
  if (!mapaT) return;
  const cap = mapaT._capa; cap.clearLayers();
  const a = camOk(t.cIni) ? [t.cIni.lat, t.cIni.lon] : null, b = camOk(t.cFin) ? [t.cFin.lat, t.cFin.lon] : null;
  S.inf.tramos.forEach((o) => { if (o !== t && camOk(o.cIni) && camOk(o.cFin)) L.polyline([[o.cIni.lat, o.cIni.lon], [o.cFin.lat, o.cFin.lon]], { color: '#7d8aa0', weight: 4, opacity: 0.8 }).bindTooltip(esc(etiquetaTramo(o))).addTo(cap); });
  if (a && b) { L.polyline([a, b], { color: '#0A2A4A', weight: 11, opacity: 0.9 }).addTo(cap); L.polyline([a, b], { color: '#36B5D6', weight: 6 }).bindTooltip(esc(etiquetaTramo(t))).addTo(cap); }
  [[a, 'cIni', 'A', t.pozoIni || 'Inicial'], [b, 'cFin', 'B', t.pozoFin || 'Final']].forEach(([p, k, l, n]) => {
    if (!p) return;
    const mk = L.marker(p, { icon: iconoCam(l, n), draggable: !esLector() }).addTo(cap);
    mk.on('dragend', () => { const q = mk.getLatLng(); fijarCam(t, k, q.lat, q.lng, true); });
  });
  if (encuadrar) {
    setTimeout(() => {
      mapaT.invalidateSize();
      if (a && b) mapaT.fitBounds([a, b], { padding: [50, 50], maxZoom: 19 }); else if (a || b) mapaT.setView(a || b, 18);
      else { const g = S.inf.general; mapaT.setView(g.lat != null ? [g.lat, g.lon] : [4.53, -75.68], g.lat != null ? 17 : 9); }
    }, 80);
  }
}
function fijarCam(t, k, lat, lon, sinEncuadre) {
  t[k] = { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
  const blk = $(`.cam[data-cam="${k}"]`); if (blk) blk.outerHTML = camBloque(t, k);
  dibujarTramo(t, !sinEncuadre); marcarSucio();
}
$('#p-tramos').addEventListener('change', (e) => {
  const el = e.target.closest('[data-cc],[data-ch]'); if (!el || esLector()) return;
  const blk = el.closest('[data-cam]'), k = blk.dataset.cam, t = tramoActual(), tipo = el.dataset.cc || el.dataset.ch;
  const inp = blk.querySelector(`[data-cc="${tipo}"]`), sel = blk.querySelector(`[data-ch="${tipo}"]`);
  const r = leerGMS(inp.value);
  if (!inp.value.trim()) { if (t[k]) { t[k][tipo] = null; if (t[k].lat == null && t[k].lon == null) t[k] = null; } blk.querySelector('[data-cd]').textContent = 'sin coordenadas'; dibujarTramo(t, false); marcarSucio(); return; }
  if (!r || (tipo === 'lat' && r.v > 90) || (tipo === 'lon' && r.v > 180)) { inp.classList.add('mal'); blk.querySelector('[data-cd]').textContent = 'Formato no reconocido: escriba 75°14\'36" o 75 14 36'; return; }
  inp.classList.remove('mal');
  if (r.h === 'S' || r.h === 'N') sel.value = r.h; else if (r.h === 'W' || r.h === 'O') sel.value = 'O'; else if (r.h === 'E') sel.value = 'E'; else if (r.h === '-') sel.value = tipo === 'lat' ? 'S' : 'O';
  const val = r.v * ((sel.value === 'S' || sel.value === 'O') ? -1 : 1);
  t[k] = Object.assign({ lat: null, lon: null }, t[k] || {}, { [tipo]: Math.round(val * 1e6) / 1e6 });
  inp.value = aGMS(t[k][tipo], tipo, true);
  blk.querySelector('[data-cd]').textContent = camOk(t[k]) ? t[k].lat.toFixed(6) + ', ' + t[k].lon.toFixed(6) : 'falta ' + (t[k].lat == null ? 'la latitud' : 'la longitud');
  dibujarTramo(t, camOk(t[k])); marcarSucio();
});
$('#p-tramos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ca]'); if (!b || esLector()) return;
  const k = b.closest('[data-cam]').dataset.cam, t = tramoActual(), nom = k === 'cIni' ? (t.pozoIni || 'cámara inicial') : (t.pozoFin || 'cámara final');
  if (b.dataset.ca === 'mapa') { camModo = k; $('#cam-modo').innerHTML = `<b style="color:var(--acc)">Toque el mapa donde está ${esc(nom)}.</b> También puede arrastrar los marcadores.`; $('#mapa-t').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else if (b.dataset.ca === 'quitar') { t[k] = null; const blk = $(`.cam[data-cam="${k}"]`); blk.outerHTML = camBloque(t, k); dibujarTramo(t, false); marcarSucio(); }
  else if (b.dataset.ca === 'gps') {
    if (!navigator.geolocation) return toast('Este equipo no ofrece ubicación.');
    b.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => { fijarCam(t, k, p.coords.latitude, p.coords.longitude); toast(`${esc(nom)}: ubicación tomada (±${Math.round(p.coords.accuracy)} m).`); },
      (er) => { b.disabled = false; toast('No se obtuvo la ubicación: ' + esc(er.message), 'err'); }, { enableHighAccuracy: true, timeout: 20000 });
  }
});

/* ------------------------------------------------------------ ficha del hallazgo
   Se abre al capturar un fotograma (el video queda en pausa y sigue al guardar) o al cargar fotos (se recorren una por una). */
const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function relojSVG(o) {
  const C = 80, R = 58, ang = (h) => ((Number(h) % 12) * 30 - 90) * Math.PI / 180, P = (h, r) => [C + r * Math.cos(ang(h)), C + r * Math.sin(ang(h))];
  const col = GRADOS[Number(o.grado) || 0].c;
  let arco = '';
  if (o.hIni) {
    const a = Number(o.hIni), b = Number(o.hFin || o.hIni);
    if (a === b) { const [x, y] = P(a, R); arco = `<circle cx="${x}" cy="${y}" r="9" fill="${col}" opacity=".9"/>`; }
    else {
      const sw = ((b - a + 12) % 12) * 30, [x1, y1] = P(a, R), [x2, y2] = P(b, R);
      arco = `<path d="M${x1} ${y1} A${R} ${R} 0 ${sw > 180 ? 1 : 0} 1 ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" opacity=".9"/>`;
    }
  }
  let h = `<svg viewBox="0 0 160 160" class="reloj" role="group" aria-label="Posición horaria"><circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--line2)" stroke-width="14"/>${arco}
    <circle cx="${C}" cy="${C}" r="40" fill="var(--in)" stroke="var(--line)"/><path d="M${C - 30} ${C + 22} Q${C} ${C + 12} ${C + 30} ${C + 22}" stroke="var(--mut2)" stroke-width="2" fill="none"/>
    <text x="${C}" y="${C + 4}" text-anchor="middle" font-size="10" fill="var(--mut2)">${o.hIni ? esc(o.hIni + (o.hFin && o.hFin !== o.hIni ? '–' + o.hFin : '')) : 'toque'}</text>`;
  for (let k = 1; k <= 12; k++) {
    const [x, y] = P(k, R), on = String(k).padStart(2, '0') === o.hIni || String(k).padStart(2, '0') === o.hFin;
    h += `<g data-h="${k}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="11" fill="${on ? col : 'var(--card)'}" stroke="${on ? col : 'var(--line2)'}"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="10" font-weight="600" fill="${on ? '#06121c' : 'var(--tx)'}">${k}</text></g>`;
  }
  return h + '</svg>';
}
function fichaHallazgo(ids, idx, op) {
  op = op || {};
  const t = tramoActual();
  let i = Math.max(0, Math.min(idx || 0, ids.length - 1)), grupo = null, filtro = '';
  const ob = () => obsPorId(ids[i]);
  function codigosHTML() {
    const o = ob(), q = norm(filtro), out = [];
    const raiz = q.length >= 4 ? q.slice(0, q.length - 1) : q;   /* raíz/raíces, grieta/grietas, conexión/conexiones */
    const coincide = (k, n) => { const t = norm(k + ' ' + n); return t.includes(q) || (q.length >= 4 && t.split(/\s+/).some((w) => w.startsWith(raiz))); };
    CATALOGO.forEach((g) => { if (!q && g.grupo !== grupo) return; g.items.forEach(([k, n]) => { if (!q || coincide(k, n)) out.push([k, n]); }); });
    if (q) { /* primero el código exacto, luego los que empiezan igual, luego por nombre */
      const peso = ([k, n]) => (norm(k) === q ? 0 : norm(k).startsWith(q) ? 1 : norm(n).startsWith(q) ? 2 : 3);
      out.sort((a, b) => peso(a) - peso(b));
    }
    return out.map(([k, n]) => `<button type="button" class="cod${o.codigo === k ? ' on' : ''}" data-cod="${k}"><b>${k}</b>${esc(n)}</button>`).join('') || '<span class="ayuda" style="margin:0">Sin coincidencias.</span>';
  }
  function gradosHTML() {
    const g0 = Number(ob().grado) || 0;
    return GRADOS.map((g) => `<button type="button" data-fg="${g.g}" class="${g0 === g.g ? 'on' : ''}" style="${g0 === g.g ? 'background:' + g.c + ';border-color:' + g.c : '--gc:' + g.c}"><b>${g.g || '—'}</b><span>${g.n}</span></button>`).join('');
  }
  function render() {
    const o = ob(); if (!o) { terminar(); return; }
    const n = t.obs.indexOf(o) + 1, src = fotoSrc(o);
    grupo = grupo || (COD[o.codigo] ? COD[o.codigo].grupo : CATALOGO[0].grupo);
    const ultimo = i >= ids.length - 1;
    const d = abrirModal(`<div class="mh"><h3>Hallazgo #${n} <span style="color:var(--mut);font-weight:500">· tramo ${esc(etiquetaTramo(t))}${ids.length > 1 ? ' · foto ' + (i + 1) + ' de ' + ids.length : ''}</span></h3><button class="btn xs fant" data-fx="cerrar" aria-label="Cerrar">${ico('x')}</button></div>
      <div class="mb"><div class="ficha">
        <div class="fi-izq">
          <div class="fi-img">${src ? `<img src="${src}" alt="">` : `<div class="sin">${ico('foto')}<span>Sin foto</span></div>`}
            ${o.foto && !o.foto.id ? '<span class="pend">Subiendo a Drive…</span>' : ''}</div>
          <div class="fi-acc">${o.tiempo != null ? `<span class="fi-t" title="Punto del video donde se capturó (solo en la app; no sale en el informe)">${ico('ir')}${fmtT(o.tiempo)} del video</span>` : ''}${src ? `<button type="button" class="btn sm" data-fx="anotar">${ico('lapiz')}Marcar sobre la foto</button>` : ''}<button type="button" class="btn sm" data-fx="foto">${ico('foto')}${src ? 'Cambiar foto' : 'Agregar foto'}</button></div>
        </div>
          <div class="fi-hr"><div><span class="lbl">Posición horaria</span><div id="fx-reloj">${relojSVG(o)}</div></div>
            <p class="ayuda" style="margin:0">Toque la hora donde empieza el daño y luego donde termina, mirando aguas abajo (12 = clave, 6 = solera). Un solo toque marca un punto.<br><button type="button" class="btn xs" data-fx="hlimpiar" style="margin-top:8px">Borrar posición</button></p></div>
        <div class="fi-der">
          <div class="fi-fila">
            <label class="campo"><span>Distancia desde el pozo (m)</span><input id="fx-dist" inputmode="decimal" autocomplete="off" value="${o.dist == null ? '' : String(o.dist).replace('.', ',')}" placeholder="Ej.: 12,40"></label>
            <label class="campo"><span>Continúa hasta (m) · opcional</span><input id="fx-fin" inputmode="decimal" autocomplete="off" value="${o.distFin == null ? '' : String(o.distFin).replace('.', ',')}" placeholder="—"></label>
          </div>
          <div class="ocr-nota" id="fx-ocr" data-o="${o.id}">${notaOCR(o)}</div>
          <div class="campo"><span>Código del hallazgo · <b id="fx-codn" style="color:var(--acc)">${o.codigo ? esc(o.codigo + ' — ' + (COD[o.codigo] ? COD[o.codigo].n : '')) : 'sin elegir'}</b></span>
            <div class="chips" id="fx-grp">${CATALOGO.map((g) => `<button type="button" class="chip${g.grupo === grupo ? ' on' : ''}" data-grp="${esc(g.grupo)}">${esc(g.grupo)}</button>`).join('')}</div>
            <input id="fx-q" class="inp" autocomplete="off" placeholder="Buscar: raíz, grieta, conexión, RA…" style="height:38px;margin:8px 0">
            <div class="cods" id="fx-cods">${codigosHTML()}</div></div>
          <div class="campo"><span>Grado de severidad</span><div class="fi-grados" id="fx-grados">${gradosHTML()}</div></div>
          <label class="campo"><span>Descripción del hallazgo</span><textarea id="fx-desc" rows="3" placeholder="Qué se observa, extensión, condición…">${esc(o.desc || '')}</textarea></label>
        </div></div></div>
      <div class="mf"><button class="btn peligro" data-fx="descartar">${ico('basura')}Descartar</button><span style="flex:1"></span>
        ${i > 0 ? '<button class="btn" data-fx="ant">← Anterior</button>' : ''}
        ${op.video ? '<button class="btn" data-fx="cerrar">Guardar y quedarme</button><button class="btn pri" data-fx="seguir">' + ico('play') + 'Guardar y seguir el video</button>'
          : !ultimo ? '<button class="btn" data-fx="cerrar">Guardar y cerrar</button><button class="btn pri" data-fx="sig">Guardar · siguiente foto →</button>'
          : '<button class="btn pri" data-fx="cerrar">Guardar</button>'}</div>`, true);
    enlazar(d);
    setTimeout(() => { const x = $('#fx-dist'); if (x && !matchMedia('(pointer:coarse)').matches) x.focus(); }, 60);
  }
  function enlazar(d) {
    const o = ob();
    const numero = (el, k) => el.addEventListener('input', () => { o[k] = pn(el.value); pintarPerfil(); marcarSucio(); });
    numero($('#fx-dist'), 'dist'); numero($('#fx-fin'), 'distFin');
    $('#fx-desc').addEventListener('input', (e) => { o.desc = e.target.value; marcarSucio(); });
    $('#fx-q').addEventListener('input', (e) => { filtro = e.target.value; $$('#fx-grp .chip').forEach((x) => x.classList.toggle('on', !filtro && x.dataset.grp === grupo)); $('#fx-cods').innerHTML = codigosHTML(); });
    $('#fx-dist').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#fx-q').focus(); } });
    $('#fx-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = $('#fx-cods .cod'); if (b) b.click(); } });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); terminar(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const b = d.querySelector('.mf .btn.pri'); if (b) b.click(); }
    });
    d.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cod]'), g = e.target.closest('[data-grp]'), fg = e.target.closest('[data-fg]'), h = e.target.closest('[data-h]'), fx = e.target.closest('[data-fx]');
      if (c) {
        o.codigo = c.dataset.cod; if (COD[o.codigo] && COD[o.codigo].grupo === 'Inspección') { o.grado = 0; $('#fx-grados').innerHTML = gradosHTML(); }
        $('#fx-codn').textContent = o.codigo + ' — ' + COD[o.codigo].n; $$('#fx-cods .cod').forEach((x) => x.classList.toggle('on', x === c));
        pintarPerfil(); marcarSucio(); if (!o.desc) $('#fx-desc').focus();
      } else if (g) { grupo = g.dataset.grp; filtro = ''; $('#fx-q').value = ''; $$('#fx-grp .chip').forEach((x) => x.classList.toggle('on', x === g)); $('#fx-cods').innerHTML = codigosHTML(); }
      else if (fg) { o.grado = Number(fg.dataset.fg); $('#fx-grados').innerHTML = gradosHTML(); $('#fx-reloj').innerHTML = relojSVG(o); pintarPerfil(); marcarSucio(); }
      else if (h) {
        const v = String(h.dataset.h).padStart(2, '0');
        if (!o.hIni || (o.hIni && o.hFin)) { o.hIni = v; o.hFin = ''; } else o.hFin = v;
        $('#fx-reloj').innerHTML = relojSVG(o); marcarSucio();
      } else if (fx) accion(fx.dataset.fx);
    });
  }
  function terminar(seguir) {
    cerrarModal();
    pintarObs(); pintarPerfil(); pintarMarcas(); pintarListaTramos(); marcarSucio();
    const o = ob(); if (o) enfocarObs(o.id);
    if (seguir) { const v = $('#vid'); if (v && v.src) { $('#consola').scrollIntoView({ behavior: 'smooth', block: 'start' }); v.play(); } }
    const incompletas = ids.map(obsPorId).filter((x) => x && (x.dist == null || !x.codigo)).length;
    if (incompletas) toast(`${incompletas} hallazgo${incompletas > 1 ? 's quedan' : ' queda'} sin distancia o sin código: aparece${incompletas > 1 ? 'n' : ''} marcado${incompletas > 1 ? 's' : ''} con «Completar ficha».`);
  }
  async function accion(a) {
    const o = ob();
    if (a === 'cerrar') terminar();
    else if (a === 'seguir') terminar(true);
    else if (a === 'sig') { i++; grupo = null; filtro = ''; render(); }
    else if (a === 'ant') { i--; grupo = null; filtro = ''; render(); }
    else if (a === 'hlimpiar') { o.hIni = ''; o.hFin = ''; $('#fx-reloj').innerHTML = relojSVG(o); marcarSucio(); }
    else if (a === 'anotar') { cerrarModal(); anotar(o, () => fichaHallazgo(ids, i, op)); }
    else if (a === 'foto') { S.fotoPara = o; S.trasFoto = () => fichaHallazgo(ids, i, op); $('#f-fotos').removeAttribute('multiple'); $('#f-fotos').click(); }
    else if (a === 'descartar') {
      t.obs = t.obs.filter((x) => x !== o);
      if (o.foto && o.foto.id) api('borrarFoto', { id: S.inf.id, fileId: o.foto.id }).catch(() => {});
      S.cola = S.cola.filter((q) => q.o !== o);
      ids.splice(i, 1); marcarSucio();
      if (!ids.length) { cerrarModal(); pintarObs(); pintarPerfil(); pintarMarcas(); pintarListaTramos(); toast('Hallazgo descartado.'); }
      else { i = Math.min(i, ids.length - 1); grupo = null; render(); }
    }
  }
  render();
}

/* ------------------------------------------------------------ anotación de fotos */
function anotar(o, alCerrar) {
  const salir = () => { cerrarModal(); if (alCerrar) alCerrar(); };
  const src = fotoSrc(o), lect = esLector();
  const d = abrirModal(`<div class="mh"><h3>Foto · ${esc(o.codigo ? o.codigo + ' — ' + (COD[o.codigo] ? COD[o.codigo].n : '') : 'observación')}${o.dist != null ? ' · ' + nf(o.dist) + ' m' : ''}</h3><button class="btn xs fant" data-m="x">${ico('x')}</button></div>
    <div class="mb">${lect ? '' : `<div class="herr">
      <button class="cb on" data-h="circ">◯ Círculo</button><button class="cb" data-h="flecha">↗ Flecha</button><button class="cb" data-h="trazo">✎ Trazo</button><button class="cb" data-h="texto">T Texto</button>
      <input class="inp" id="an-txt" placeholder="Texto a ubicar" style="height:34px;width:170px">
      <span style="width:8px"></span>${['#ff3b30', '#ffd60a', '#36b5d6', '#ffffff'].map((c, i) => `<button class="col${i ? '' : ' on'}" data-c="${c}" style="background:${c}" aria-label="Color"></button>`).join('')}
      <span style="flex:1"></span><button class="cb" data-h="deshacer">↶ Deshacer</button></div>`}
      <div class="lienzo"><canvas id="an-c"></canvas></div>
      <p class="ayuda" style="margin:10px 0 0">${lect ? '' : 'Marque el hallazgo sobre la foto. Al guardar se crea una copia anotada en Drive; la original se conserva.'}</p></div>
    <div class="mf"><button class="btn" data-m="x">Cerrar</button>${lect ? '' : '<button class="btn" data-m="cambiar">' + ico('foto') + 'Reemplazar foto</button><button class="btn pri" data-m="ok">Guardar anotación</button>'}</div>`, true);
  const cv = $('#an-c'), cx = cv.getContext('2d'), img = new Image();
  let herr = 'circ', color = '#ff3b30', formas = [], act = null;
  img.onload = () => { cv.width = img.naturalWidth; cv.height = img.naturalHeight; dibujar(); };
  img.src = src;
  function dibujar() {
    cx.drawImage(img, 0, 0); const lw = Math.max(3, cv.width / 220);
    [...formas, act].filter(Boolean).forEach((f) => {
      cx.strokeStyle = cx.fillStyle = f.c; cx.lineWidth = lw; cx.lineCap = cx.lineJoin = 'round';
      if (f.t === 'circ') { cx.beginPath(); cx.ellipse((f.a.x + f.b.x) / 2, (f.a.y + f.b.y) / 2, Math.abs(f.b.x - f.a.x) / 2 || 1, Math.abs(f.b.y - f.a.y) / 2 || 1, 0, 0, Math.PI * 2); cx.stroke(); }
      else if (f.t === 'flecha') { const an = Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x), h = lw * 5; cx.beginPath(); cx.moveTo(f.a.x, f.a.y); cx.lineTo(f.b.x, f.b.y); cx.stroke(); cx.beginPath(); cx.moveTo(f.b.x, f.b.y); cx.lineTo(f.b.x - h * Math.cos(an - 0.45), f.b.y - h * Math.sin(an - 0.45)); cx.lineTo(f.b.x - h * Math.cos(an + 0.45), f.b.y - h * Math.sin(an + 0.45)); cx.closePath(); cx.fill(); }
      else if (f.t === 'trazo') { cx.beginPath(); f.p.forEach((q, i) => (i ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y))); cx.stroke(); }
      else if (f.t === 'texto') { const fs = Math.max(18, cv.width / 30); cx.font = `700 ${fs}px "IBM Plex Sans",Arial,sans-serif`; cx.lineWidth = fs / 6; cx.strokeStyle = 'rgba(0,0,0,.75)'; cx.strokeText(f.s, f.a.x, f.a.y); cx.fillText(f.s, f.a.x, f.a.y); }
    });
  }
  const pto = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }; };
  if (!lect) {
    cv.addEventListener('pointerdown', (e) => {
      const p = pto(e); cv.setPointerCapture(e.pointerId);
      if (herr === 'texto') { const s = ($('#an-txt').value || '').trim(); if (!s) { toast('Escriba el texto y luego toque la foto.'); return; } formas.push({ t: 'texto', a: p, s, c: color }); dibujar(); return; }
      act = herr === 'trazo' ? { t: 'trazo', p: [p], c: color } : { t: herr, a: p, b: p, c: color };
    });
    cv.addEventListener('pointermove', (e) => { if (!act) return; const p = pto(e); if (act.t === 'trazo') act.p.push(p); else act.b = p; dibujar(); });
    cv.addEventListener('pointerup', () => { if (act) { formas.push(act); act = null; dibujar(); } });
  }
  d.addEventListener('click', async (e) => {
    const h = e.target.closest('[data-h]'), c = e.target.closest('[data-c]'), m = e.target.closest('[data-m]');
    if (h) { if (h.dataset.h === 'deshacer') { formas.pop(); dibujar(); return; } herr = h.dataset.h; $$('.herr [data-h]', d).forEach((x) => x.classList.toggle('on', x === h)); }
    if (c) { color = c.dataset.c; $$('.herr .col', d).forEach((x) => x.classList.toggle('on', x === c)); }
    if (m && m.dataset.m === 'x') salir();
    if (m && m.dataset.m === 'cambiar') { cerrarModal(); S.trasFoto = alCerrar || null; S.fotoPara = o; $('#f-fotos').removeAttribute('multiple'); $('#f-fotos').click(); }
    if (m && m.dataset.m === 'ok') {
      if (!formas.length) { salir(); return; }
      ponerFoto(o, cv.toDataURL('image/jpeg', 0.9)); salir(); pintarObs(); marcarSucio(); toast('Anotación guardada. La foto original se conserva en Drive.', 'ok');
    }
  });
}

/* ============================================================ guardado automático */
function setSync(c, t) { const s = $('#sync'); s.className = c; $('#sync-t').textContent = t; }
/* utilidades compartidas con los módulos Cotizaciones y Agenda (cotizar.js, agenda.js) */
HR.ui = { $, $$, ico, uid, sleep, pn, hoy, hace, abrirModal, cerrarModal, confirmar, setSync, ver,
  esCreador: () => esCreador(), esLector: () => esLector(),
  crearInforme: async (general) => {
    const r = await apiOk('crear', { informe: { estado: 'BORRADOR', general: Object.assign({ tipo: 'CCTV con equipo robotizado', departamento: 'Quindío', equipo: C.EQUIPO_DEFECTO, fechaInspeccion: hoy(), fechaInforme: hoy() }, general),
      tramos: [nuevoTramo()], conclusiones: '', recomendaciones: '', alcance: '', firmas: firmasBase() } });
    S.inf = null; S.recienCreado = r.informe.id; location.hash = 'informe/' + r.informe.id; return r.informe.id;
  } };
function marcarSucio() {
  if (!S.inf || esLector()) return;
  S.dirty = true; setSync('pend', 'Cambios sin guardar');
  try { localStorage.setItem('hr_respaldo_' + S.inf.id, JSON.stringify({ t: Date.now(), inf: S.inf })); } catch (e) { /* lleno */ }
  clearTimeout(S.timer); S.timer = setTimeout(guardarAhora, 2500);
}
async function guardarAhora(forzar) {
  clearTimeout(S.timer);
  if (!S.inf || !S.dirty || esLector()) return;
  if (S.guardando) { S.otra = true; return; }
  S.guardando = true; S.dirty = false; setSync('pend', 'Guardando en Drive…');
  const inf = S.inf;
  try {
    const r = await api('guardar', { informe: inf, forzar: !!forzar });
    if (r.ok) {
      inf.rev = r.rev; inf.actualizado = r.actualizado; inf.actualizadoPor = r.actualizadoPor;
      if (S.inf === inf) $('#e-cod').textContent = inf.id + ' · rev. ' + inf.rev;
      try { localStorage.removeItem('hr_respaldo_' + inf.id); } catch (e) { /* nada */ }
      setSync(S.dirty ? 'pend' : 'ok', S.dirty ? 'Cambios sin guardar' : 'Guardado ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    } else if (r.codigo === 'CONFLICTO') {
      S.dirty = true; setSync('err', 'Conflicto de versiones'); conflicto(r);
    } else { S.dirty = true; setSync('err', 'No guardado'); toast(esc(r.error), 'err'); }
  } catch (e) {
    S.dirty = true; setSync('err', 'Sin conexión · reintento');
    clearTimeout(S.timer); S.timer = setTimeout(guardarAhora, 10000);
  } finally {
    S.guardando = false;
    if (S.otra) { S.otra = false; guardarAhora(); }
  }
}
async function conflicto(r) {
  const d = abrirModal(`<div class="mh"><h3>Otra persona editó este informe</h3></div><div class="mb"><p style="color:var(--mut)">${esc(r.error)} Puede traer la versión guardada (se pierden sus cambios recientes) o guardar la suya encima.</p></div>
    <div class="mf"><button class="btn" data-r="traer">Traer la versión guardada</button><button class="btn pri" data-r="mia">Guardar mi versión</button></div>`);
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return; cerrarModal();
    if (b.dataset.r === 'mia') { S.dirty = true; guardarAhora(true); }
    else { const id = S.inf.id; S.inf = null; S.dirty = false; abrirInforme(id, S.tab); }
  });
}
window.addEventListener('beforeunload', (e) => {
  const sube = S.cola.length || Object.values(S.subidasVideo).some((x) => x.estado === 'subiendo');
  if (S.dirty || sube) { guardarAhora(); e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarAhora(); });

/* ============================================================ vista previa */
function filaKV(pares) {
  const p = pares.filter(([, v]) => v != null && v !== ''); let h = '';
  for (let i = 0; i < p.length; i += 2) h += `<tr><td>${esc(p[i][0])}</td><td>${esc(p[i][1])}</td>${p[i + 1] ? `<td>${esc(p[i + 1][0])}</td><td>${esc(p[i + 1][1])}</td>` : '<td></td><td></td>'}</tr>`;
  return `<table class="kv">${h}</table>`;
}
function pintarVista() {
  const I = S.inf, g = I.general;
  let fN = 0;
  const html = `<div class="exp-op"><button class="btn pri" data-accion="pdf">${ico('pdf')}Exportar PDF</button><button class="btn" data-accion="docx">${ico('word')}Exportar Word</button>
      <button class="btn fant" data-accion="drive">${ico('drive')}Carpeta en Drive</button><span class="ayuda" style="margin:0">Cada exportación se descarga y queda guardada en la carpeta «exportados» del informe.</span></div>
    <div class="papel">
      <div class="enc"><div class="marca"><svg><use href="#logo"/></svg><div><div class="w"><span class="h">HYDRO</span><span class="r" style="color:#0a2a4a">-ROV</span></div><small style="color:#6b7684">${esc(C.LEMA)}</small></div></div>
        <div class="d"><b style="color:#0a2a4a">INFORME DE INSPECCIÓN DE REDES</b><br>${esc(I.id)} · ${esc(fFecha(g.fechaInforme))}</div></div>
      <div style="font-size:10.5px;letter-spacing:.14em;color:#137a99;font-weight:700">INFORME TÉCNICO DE INSPECCIÓN CCTV</div>
      <h1>${esc(g.proyecto || 'Sin título')}</h1>
      <div style="color:#5b6573">${esc([g.cliente, g.municipio, g.departamento].filter(Boolean).join(' · '))}</div>
      <h2>1. Información general</h2>
      ${filaKV([['Cliente', g.cliente], ['Contrato', g.contrato], ['Municipio', g.municipio], ['Departamento', g.departamento], ['Sector', g.sector], ['Tipo de inspección', g.tipo], ['Fecha de inspección', fFecha(g.fechaInspeccion)], ['Fecha del informe', fFecha(g.fechaInforme)], ['Equipo', g.equipo], ['Clima', g.clima], ['Limpieza previa', g.limpieza], ['Método de limpieza', g.metodoLimpieza], ['Operador', g.operador], ['Auxiliar de campo', g.auxiliar], ['Coordenadas', g.lat != null ? camTxt({ lat: Number(g.lat), lon: Number(g.lon) }) : '']])}
      ${g.notasCampo ? `<p style="white-space:pre-wrap">${esc(g.notasCampo)}</p>` : ''}
      <h2>2. Alcance y metodología</h2>${I.alcance ? `<p style="white-space:pre-wrap">${esc(I.alcance)}</p>` : '<p style="color:#9aa3ae">Sin texto de alcance.</p>'}
      <h3>Grados de severidad empleados</h3><table><tr><th>Grado</th><th>Severidad</th></tr>${GRADOS.slice(1).map((x) => `<tr><td><span class="gtag" style="background:${x.c}">${x.g}</span></td><td>${x.n}</td></tr>`).join('')}</table>
      <h2>3. Resultados por tramo</h2>
      ${I.tramos.map((t, ti) => `<h3>3.${ti + 1} Tramo ${esc(etiquetaTramo(t))}</h3>
        ${filaKV([['Sentido', t.sentido], ['Tipo de red', t.red], ['Material', t.material], ['Diámetro', t.diametro ? nf(t.diametro, 0) + ' mm' : ''], ['Longitud del tramo', t.longitud != null ? nf(t.longitud) + ' m' : ''], ['Longitud inspeccionada', t.inspeccionada != null ? nf(t.inspeccionada) + ' m' : ''], ['Prof. pozo inicial', t.profIni != null ? nf(t.profIni) + ' m' : ''], ['Prof. pozo final', t.profFin != null ? nf(t.profFin) + ' m' : ''], ['Ubicación', t.ubicacion], ['Cámara inicial', camTxt(t.cIni)], ['Cámara final', camTxt(t.cFin)], ['Fecha', fFecha(t.fecha)], ['Condición general', t.condicion], ['Video', t.video ? t.video.nombre : ''], ['Fin anticipado', t.finAnticipado]])}
        ${camOk(t.cIni) || camOk(t.cFin) ? `<div class="pv-mapa" data-pvmapa="${ti}"><span>Generando el recorte del mapa…</span></div>` : ''}
        <div style="border:1px solid #e3e8ee;border-radius:4px;padding:6px;margin:8px 0">${perfilSVG(t, { claro: true })}</div>
        ${t.obs.length ? `<table><tr><th>#</th><th>Dist. (m)</th><th>Código</th><th>Descripción</th><th>Hora</th><th>Grado</th></tr>${t.obs.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(nf(o.dist))}${o.distFin != null ? ' – ' + esc(nf(o.distFin)) : ''}</td><td><b>${esc(o.codigo)}</b>${COD[o.codigo] ? '<br><span style="color:#6b7684">' + esc(COD[o.codigo].n) + '</span>' : ''}</td><td>${esc(o.desc)}</td><td>${o.hIni ? esc(o.hIni + (o.hFin ? ' a ' + o.hFin : '')) : ''}</td><td>${o.grado ? `<span class="gtag" style="background:${GRADOS[o.grado].c}">${o.grado}</span>` : '—'}</td></tr>`).join('')}</table>` : '<p style="color:#9aa3ae">Sin observaciones registradas.</p>'}
        ${t.obs.some(fotoSrc) ? `<div class="fotos">${t.obs.map((o, i) => (fotoSrc(o) ? `<figure><img src="${fotoSrc(o)}" alt=""><figcaption><b>Foto ${++fN}</b> · Obs. ${i + 1}${o.dist != null ? ' · ' + esc(nf(o.dist)) + ' m' : ''}${o.codigo ? ' · ' + esc(o.codigo) : ''}${o.grado ? ' · Grado ' + o.grado : ''}${o.desc ? '<br>' + esc(o.desc) : ''}</figcaption></figure>` : '')).join('')}</div>` : ''}
        ${t.conclusion ? `<p><b>Conclusión del tramo.</b> ${esc(t.conclusion)}</p>` : ''}${t.recomendacion ? `<p><b>Recomendación.</b> ${esc(t.recomendacion)}</p>` : ''}`).join('')}
      <h2>4. Conclusiones</h2><p style="white-space:pre-wrap">${esc(I.conclusiones || '—')}</p>
      <h2>5. Recomendaciones</h2><p style="white-space:pre-wrap">${esc(I.recomendaciones || '—')}</p>
      ${I.anexos ? `<h2>6. Anexos</h2><p style="white-space:pre-wrap">${esc(I.anexos)}</p>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px 48px;margin-top:56px">${(I.firmas || []).filter((f) => f.nombre || f.cargo).map((f) => `<div><div style="font-size:10px;letter-spacing:.12em;color:#6b7684;text-transform:uppercase;margin-bottom:34px">${esc(f.rol)}</div><div style="border-top:1.5px solid #0a2a4a;padding-top:6px"><b>${esc(f.nombre || ' ')}</b><br><span style="color:#6b7684">${esc([f.cargo, f.matricula ? 'M.P. ' + f.matricula : ''].filter(Boolean).join(' · '))}</span></div></div>`).join('')}</div>
    </div>`;
  $('#p-vista').innerHTML = html;
  (async () => {
    for (const el of $$('#p-vista [data-pvmapa]')) {
      try { const m = await window.HRExport.mapaPNG([I.tramos[Number(el.dataset.pvmapa)]], I.tramos); el.innerHTML = `<img src="${m.url}" alt="Mapa del tramo">`; }
      catch (e) { el.innerHTML = '<span>No se pudo generar el mapa.</span>'; }
    }
  })();
}



/* ============================================================ mapas (OpenStreetMap con Leaflet, cargado solo cuando se usa) */
let leafletListo = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletListo) return leafletListo;
  leafletListo = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'lib/leaflet/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'lib/leaflet/leaflet.js'; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el mapa')); document.head.appendChild(s);
  });
  return leafletListo;
}
function capaOSM(m) {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
}
const pinHR = (grado, grande) => L.divIcon({ className: '', iconSize: grande ? [34, 42] : [26, 32], iconAnchor: grande ? [17, 40] : [13, 30], popupAnchor: [0, grande ? -36 : -26],
  html: `<svg class="pin" viewBox="0 0 34 42" width="${grande ? 34 : 26}" height="${grande ? 42 : 32}"><path d="M17 41C17 41 32 26 32 16A15 15 0 0 0 2 16C2 26 17 41 17 41Z" fill="#0A2A4A" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16" r="8.5" fill="none" stroke="${grado ? GRADOS[grado].c : '#36B5D6'}" stroke-width="3.5"/><circle cx="17" cy="14.5" r="2.6" fill="#fff"/></svg>` });

/* mapa mundi de todos los informes */
let mapaG = null;
async function pintarMapaGlobal() {
  const box = $('#mapa-global'); if (!box) return;
  try { await cargarLeaflet(); } catch (e) { box.innerHTML = '<div class="vacio">' + esc(e.message) + '</div>'; return; }
  if (!mapaG || !document.body.contains(mapaG.getContainer())) {
    box.innerHTML = '';
    mapaG = L.map(box, { worldCopyJump: true, zoomControl: true, minZoom: 2 }).setView([4.5, -74.5], 3);
    capaOSM(mapaG); mapaG._capa = L.layerGroup().addTo(mapaG);
  }
  mapaG._capa.clearLayers();
  const q = norm(S.q), I = S.informes.filter((x) => x.lat != null && !x.muestra && deCliente(x) && (!S.filtro || x.estado === S.filtro) && (!q || norm([x.id, x.titulo, x.cliente, x.municipio].join(' ')).includes(q)));
  const lim = [];
  I.forEach((x) => {
    (x.lin || []).forEach((l) => { L.polyline([[l[0], l[1]], [l[2], l[3]]], { color: '#36B5D6', weight: 5, opacity: 0.95 }).bindTooltip(esc(x.id + ' · ' + (l[4] || 'tramo'))).addTo(mapaG._capa); lim.push([l[0], l[1]], [l[2], l[3]]); });
    (x.pts || []).forEach((p) => { L.circleMarker([p[0], p[1]], { radius: 4, color: '#fff', weight: 1, fillColor: '#36B5D6', fillOpacity: 0.95 }).bindTooltip(esc(x.id + ' · ' + (p[2] || 'tramo'))).addTo(mapaG._capa); lim.push([p[0], p[1]]); });
    L.marker([x.lat, x.lon], { icon: pinHR(x.gradoMax, true), title: x.id }).bindPopup(`<div class="pop"><div class="mono" style="color:#137a99;font-size:11px">${esc(x.id)} · ${esc(ESTADOS[x.estado] || x.estado)}</div><b>${esc(x.titulo)}</b><div style="color:#5b6573">${esc([x.cliente, x.municipio].filter(Boolean).join(' · '))}</div>
      <div style="margin:6px 0">${x.tramos || 0} tramos · <b>${nf(x.ml || 0, 1)} m</b> inspeccionados · ${x.obs || 0} hallazgos</div><a href="#informe/${encodeURIComponent(x.id)}" class="btn xs pri" style="text-decoration:none">Abrir informe</a></div>`, { minWidth: 250 }).addTo(mapaG._capa);
    lim.push([x.lat, x.lon]);
  });
  setTimeout(() => {
    mapaG.invalidateSize();
    if (lim.length === 1) mapaG.setView(lim[0], 15); else if (lim.length) mapaG.fitBounds(lim, { padding: [40, 40], maxZoom: 16 }); else mapaG.setView([4.5, -74.5], 3);
  }, 60);
  $('#mapa-nota').textContent = I.length ? `${I.length} informe${I.length === 1 ? '' : 's'} con ubicación · ${nf(I.reduce((a, x) => a + (Number(x.ml) || 0), 0), 1)} m inspeccionados` : 'Ningún informe tiene ubicación todavía. Póngala en «Datos generales → Ubicación de la inspección».';
}
function vistaLista(v) {
  S.vistaLista = v;
  $$('#vista-l .chip').forEach((c) => c.classList.toggle('on', c.dataset.vistaL === v));
  $('#lista').classList.toggle('hide', v === 'mapa'); $('#mapa-w').classList.toggle('hide', v !== 'mapa');
  if (v === 'mapa') pintarMapaGlobal();
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-vista-l]'); if (b) { vistaLista(b.dataset.vistaL); if (b.classList.contains('kpi')) $('#mapa-w').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });

/* ubicación del informe: mapa para elegir el punto, GPS y búsqueda de dirección */
let mapaU = null, pinU = null;
function ubicacionHTML() {
  const g = S.inf.general;
  return `<div class="card" id="ubic"><h3><span class="n">04</span>Ubicación de la inspección <span class="der solo-ed"><button type="button" class="btn sm" data-ub="gps">${ico('gps')}Usar mi ubicación (GPS)</button></span></h3>
    <p class="ayuda">Toque el mapa o arrastre el marcador hasta el sitio inspeccionado. Esta ubicación es la que aparece en el mapa general de informes. Las líneas azules son los tramos con sus cámaras ubicadas.</p>
    <div class="ub-buscar solo-ed"><input class="inp" id="ub-q" placeholder="Buscar dirección o lugar: «Calle 12 Montenegro Quindío»" autocomplete="off"><button type="button" class="btn sm" data-ub="buscar">${ico('buscar')}Buscar</button></div>
    <div class="ub-res" id="ub-res"></div>
    <div class="mapa-u" id="mapa-u"></div>
    <div class="frm" style="margin-top:12px"><label class="campo"><span>Latitud</span><input id="ub-lat" class="mono" inputmode="decimal" value="${g.lat == null ? '' : esc(g.lat)}" placeholder="4,5339"></label>
      <label class="campo"><span>Longitud</span><input id="ub-lon" class="mono" inputmode="decimal" value="${g.lon == null ? '' : esc(g.lon)}" placeholder="-75,6811"></label>
      <div class="campo w2"><span>&nbsp;</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm solo-ed" data-ub="quitar">${ico('x')}Quitar ubicación</button>${g.lat != null ? `<a class="btn sm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=18/${g.lat}/${g.lon}">Abrir en OpenStreetMap</a>` : ''}</div></div></div></div>`;
}
async function montarUbicacion() {
  const box = $('#mapa-u'); if (!box) return;
  try { await cargarLeaflet(); } catch (e) { box.innerHTML = '<div class="vacio">' + esc(e.message) + '</div>'; return; }
  if (!document.body.contains(box)) return;
  const g = S.inf.general, tiene = g.lat != null && g.lon != null;
  if (mapaU) { try { mapaU.remove(); } catch (e) { /* ya no estaba */ } }
  mapaU = L.map(box, { zoomControl: true }).setView(tiene ? [g.lat, g.lon] : [4.53, -75.68], tiene ? 17 : 9);
  capaOSM(mapaU);
  S.inf.tramos.forEach((t) => { if (camOk(t.cIni) && camOk(t.cFin)) L.polyline([[t.cIni.lat, t.cIni.lon], [t.cFin.lat, t.cFin.lon]], { color: '#36B5D6', weight: 5 }).bindTooltip(esc(etiquetaTramo(t))).addTo(mapaU); [t.cIni, t.cFin].forEach((c) => { if (camOk(c)) L.circleMarker([c.lat, c.lon], { radius: 4, color: '#fff', weight: 1.5, fillColor: '#0A2A4A', fillOpacity: 1 }).addTo(mapaU); }); });
  pinU = null; if (tiene) ponerPin(g.lat, g.lon, false);
  if (!esLector()) mapaU.on('click', (e) => ponerPin(e.latlng.lat, e.latlng.lng, true));
  setTimeout(() => mapaU.invalidateSize(), 80);
}
function ponerPin(lat, lon, guardar) {
  lat = Math.round(lat * 1e6) / 1e6; lon = Math.round(lon * 1e6) / 1e6;
  if (!pinU) { pinU = L.marker([lat, lon], { icon: pinHR(0, true), draggable: !esLector() }).addTo(mapaU); pinU.on('dragend', () => { const p = pinU.getLatLng(); ponerPin(p.lat, p.lng, true); }); }
  else pinU.setLatLng([lat, lon]);
  if (guardar) { S.inf.general.lat = lat; S.inf.general.lon = lon; $('#ub-lat').value = String(lat).replace('.', ','); $('#ub-lon').value = String(lon).replace('.', ','); marcarSucio(); }
}
$('#p-general').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ub]'), r = e.target.closest('[data-ubr]');
  if (r) { const [la, lo] = r.dataset.ubr.split(',').map(Number); mapaU.setView([la, lo], 18); ponerPin(la, lo, true); $('#ub-res').innerHTML = ''; return; }
  if (!b || esLector()) return;
  const a = b.dataset.ub;
  if (a === 'gps') {
    if (!navigator.geolocation) return toast('Este equipo no ofrece ubicación.');
    b.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => { b.disabled = false; mapaU.setView([p.coords.latitude, p.coords.longitude], 18); ponerPin(p.coords.latitude, p.coords.longitude, true); toast('Ubicación tomada (precisión ±' + Math.round(p.coords.accuracy) + ' m).'); },
      (er) => { b.disabled = false; toast('No se obtuvo la ubicación: ' + esc(er.message), 'err'); }, { enableHighAccuracy: true, timeout: 20000 });
  } else if (a === 'quitar') { S.inf.general.lat = null; S.inf.general.lon = null; if (pinU) { pinU.remove(); pinU = null; } $('#ub-lat').value = ''; $('#ub-lon').value = ''; marcarSucio(); }
  else if (a === 'buscar') buscarLugar();
});
$('#p-general').addEventListener('keydown', (e) => { if (e.target.id === 'ub-q' && e.key === 'Enter') { e.preventDefault(); buscarLugar(); } });
$('#p-general').addEventListener('change', (e) => {
  if (e.target.id !== 'ub-lat' && e.target.id !== 'ub-lon') return;
  const la = pn($('#ub-lat').value), lo = pn($('#ub-lon').value);
  if (la != null && lo != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) { mapaU.setView([la, lo], 17); ponerPin(la, lo, true); }
  else if (la == null && lo == null) { S.inf.general.lat = null; S.inf.general.lon = null; marcarSucio(); }
  else if (la != null && lo != null) toast('Coordenadas no válidas: latitud entre -90 y 90, longitud entre -180 y 180.', 'err');
});
async function buscarLugar() {
  const q = ($('#ub-q').value || '').trim(); if (!q) return;
  const box = $('#ub-res'); box.innerHTML = '<span class="ayuda">Buscando…</span>';
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=co&accept-language=es&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } }).then((x) => x.json());
    box.innerHTML = r.length ? r.map((x) => `<button type="button" class="ub-it" data-ubr="${x.lat},${x.lon}">${ico('gps')}<span>${esc(x.display_name)}</span></button>`).join('') : '<span class="ayuda">Sin resultados. Pruebe con municipio y departamento, o toque el mapa.</span>';
  } catch (e) { box.innerHTML = '<span class="ayuda">No se pudo buscar ahora. Toque el sitio en el mapa.</span>'; }
}

/* ============================================================ descartar (primera apertura) y eliminar */
async function descartarInforme(id) {
  if (!(await confirmar('Descartar informe ' + id, 'Se deshace la creación: se borra la carpeta de Drive con lo que haya cargado. No se envía aviso a nadie.', 'Descartar', true))) return;
  const p = progreso('Descartando el informe…'); p.set(0.5);
  try {
    clearTimeout(S.timer); S.dirty = false;
    await apiOk('descartar', { id });
    S.cola = S.cola.filter((q) => q.infId !== id);
    try { localStorage.removeItem('hr_respaldo_' + id); } catch (e) { /* nada */ }
    S.informes = S.informes.filter((i) => i.id !== id); S.inf = null; S.recienCreado = null;
    toast(`Informe <b>${esc(id)}</b> descartado.`, 'ok');
    location.hash = 'informes';
  } catch (e) { toast(esc(e.message), 'err', 8000); }
  finally { p.fin(); }
}

async function eliminarInforme(id) {
  if (!id || esLector()) return;
  if (S.recienCreado === id) return descartarInforme(id);
  const x = S.informes.find((i) => i.id === id) || (S.inf && S.inf.id === id ? { id, titulo: S.inf.general.proyecto, tramos: S.inf.tramos.length, obs: S.inf.tramos.reduce((a, t) => a + t.obs.length, 0) } : { id, titulo: '' });
  const d = abrirModal(`<div class="mh"><h3>Eliminar informe ${esc(id)}</h3></div>
    <div class="mb"><p style="color:var(--mut);margin-bottom:12px"><b style="color:var(--tx)">${esc(x.titulo || 'Sin título')}</b>${x.tramos != null ? ' · ' + x.tramos + ' tramos · ' + (x.obs || 0) + ' observaciones' : ''}</p>
      <p style="margin-bottom:14px">Se borra su carpeta de Drive completa: el informe, las fotos, los videos y los PDF y Word exportados. Los demás creadores reciben un aviso por correo.</p>
      <label class="campo"><span>Motivo (va en el aviso por correo)</span><input id="el-mot" placeholder="Ej.: informe de prueba, duplicado, se rehízo…" maxlength="300"></label>
      <label class="campo"><span>Para confirmar, escriba <b class="mono" style="color:var(--err)">${esc(id)}</b></span><input id="el-cod" autocomplete="off" class="mono"></label>
      <div class="msg" id="el-msg"></div></div>
    <div class="mf"><button class="btn" data-el="no">Cancelar</button><button class="btn pri" data-el="si" id="el-btn" disabled style="background:var(--err);border-color:var(--err);color:#fff">${ico('basura')}Eliminar definitivamente</button></div>`);
  $('#el-cod').addEventListener('input', (e) => { $('#el-btn').disabled = e.target.value.trim().toUpperCase() !== id.toUpperCase(); });
  setTimeout(() => $('#el-mot').focus(), 50);
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-el]'); if (!b) return;
    if (b.dataset.el === 'no') return cerrarModal();
    b.disabled = true; b.textContent = 'Eliminando…';
    try {
      const r = await apiOk('eliminar', { id, confirmacion: $('#el-cod').value, motivo: $('#el-mot').value }, { timeout: 90000 });
      cerrarModal();
      if (S.inf && S.inf.id === id) { S.inf = null; S.dirty = false; clearTimeout(S.timer); }
      S.cola = S.cola.filter((q) => q.infId !== id);
      try { localStorage.removeItem('hr_respaldo_' + id); } catch (er) { /* nada */ }
      S.informes = S.informes.filter((i) => i.id !== id);
      toast(`Informe <b>${esc(id)}</b> eliminado de Drive.${r.avisados && r.avisados.length ? ' Aviso enviado a ' + esc(r.avisados.join(', ')) + '.' : ''}`, 'ok', 8000);
      if (location.hash.indexOf('informe/') >= 0) location.hash = 'informes'; else pintarLista();
    } catch (err) { $('#el-msg').textContent = err.message; $('#el-msg').className = 'msg err'; b.disabled = false; b.innerHTML = ico('basura') + 'Eliminar definitivamente'; }
  });
}

/* ============================================================ exportar y Drive */
/* Al emitir se elige el formato: HYDRO-ROV (membrete + QR verificable) o alterno (sin membrete, sin QR, consecutivo IT-AAAA-NNN) */
function elegirFormato(fmt) {
  return new Promise((res) => {
    const tipo = fmt === 'pdf' ? 'PDF' : 'Word';
    const d = abrirModal(`<div class="mh"><h3>Emitir en ${tipo}</h3></div><div class="mb"><p class="mut-p">¿Con qué formato se emite este informe?</p>
      <div class="formatos">
        <button type="button" class="fmt-op" data-f="hr"><span class="fmt-mini hr"><i></i><i></i><i></i><b></b></span><span class="fmt-tx"><b>Formato HYDRO-ROV</b><span>Con membrete, logo y datos de la empresa. Lleva código QR: la entidad puede verificar en línea que es auténtico.</span><em>Consecutivo ${esc(S.inf.id)}</em></span></button>
        <button type="button" class="fmt-op" data-f="alt"><span class="fmt-mini alt"><i></i><i></i><i></i></span><span class="fmt-tx"><b>Formato alterno</b><span>Sin membrete ni datos de la empresa, con otra presentación. No lleva QR y no se puede verificar en línea.</span><em>${S.inf.alt ? 'Consecutivo ' + esc(S.inf.alt) : 'Consecutivo propio IT-AAAA-NNN'}</em></span></button>
      </div></div><div class="mf"><button class="btn" data-f="x">Cancelar</button></div>`);
    let hecho = false;
    const fin = (v) => { if (hecho) return; hecho = true; cerrarModal(); res(v); };
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) fin(b.dataset.f === 'x' ? null : b.dataset.f); });
  });
}
async function exportar(fmt) {
  if (!S.inf) return;
  const formato = await elegirFormato(fmt); if (!formato) return;
  await guardarAhora();
  if (S.cola.length) { const p = progreso('Terminando de subir fotos a Drive…'); while (S.cola.length) { p.set(0.5); await sleep(500); } p.fin(); }
  const op = { subir: !esLector(), formato };
  if (formato === 'alt') {
    try { const r = await apiOk('consecutivoAlterno', { id: S.inf.id }); op.numero = r.numero; S.inf.alt = r.numero; }
    catch (e) { toast('No se pudo asignar el consecutivo del formato alterno: ' + esc(e.message), 'err', 8000); return; }
  }
  try { await window.HRExport[fmt](S.inf, op); }
  catch (e) { console.error(e); toast('No se pudo exportar: ' + esc(e.message), 'err', 8000); }
}
function abrirDrive() { if (S.carpeta) window.open(S.carpeta, '_blank', 'noopener'); }

/* ============================================================ usuarios */
async function verUsuarios() {
  const V = $('#v-usuarios');
  V.innerHTML = `<div class="cab"><div><h1 class="t">Usuarios</h1><p>Quién puede ingresar y qué puede hacer. Los creadores no se pueden degradar.</p></div></div>
    <div class="card"><h3>${ico('mas')}Agregar usuario</h3><form class="frm" id="u-form">
      <label class="campo w2"><span>Correo</span><input id="u-email" type="email" required placeholder="persona@correo.com"></label>
      <label class="campo"><span>Nombre</span><input id="u-nombre" required></label>
      <label class="campo"><span>Rol</span><select id="u-rol"><option value="EDITOR">Editor · crea y edita informes</option><option value="LECTOR">Lector · solo consulta</option><option value="CREADOR">Creador · acceso total</option></select></label>
      <div class="campo w4 fila-acc"><button class="btn pri" type="submit">${ico('mas')}Crear usuario</button><p class="nota-acc">Se genera una clave temporal que el usuario cambia en su primer ingreso.</p></div></form></div>
    <div class="tw"><table class="tabla resp"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody id="u-tb"><tr><td colspan="5"><div class="spin"></div></td></tr></tbody></table></div>`;
  $('#u-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await apiOk('usuarioGuardar', { email: $('#u-email').value, nombre: $('#u-nombre').value, rol: $('#u-rol').value }); if (r.claveTemporal) mostrarTemporal(r.usuario.email, r.claveTemporal); $('#u-form').reset(); cargarUsuarios(); }
    catch (err) { toast(esc(err.message), 'err'); }
  });
  cargarUsuarios();
}
function editarNombre(email, actual, tr) {
  const d = abrirModal(`<div class="mh"><h3>Editar nombre</h3></div><form class="mb" id="en-f"><p style="color:var(--mut);margin-bottom:12px">${esc(email)}</p>
    <label class="campo"><span>Nombre completo</span><input id="en-n" maxlength="80" required value="${esc(actual)}" autocomplete="off"></label></form>
    <div class="mf"><button class="btn" data-m="x">Cancelar</button><button class="btn pri" data-m="ok">Guardar</button></div>`);
  const inp = d.querySelector('#en-n'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
  const guardar = async () => {
    const nombre = inp.value.trim(); if (!nombre) { inp.focus(); return; }
    const rolSel = tr.querySelector('select[data-uc="rol"]');
    try {
      await apiOk('usuarioGuardar', { email, nombre, rol: rolSel ? rolSel.value : 'CREADOR', activo: !/Inactivo/.test(tr.textContent) });
      cerrarModal(); toast('Nombre actualizado.', 'ok');
      if (S.user && S.user.email === email) { S.user.nombre = nombre; pintarUsuario(); }
      cargarUsuarios();
    } catch (err) { toast(esc(err.message), 'err'); }
  };
  d.querySelector('#en-f').addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
  d.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'ok') guardar(); else cerrarModal(); });
}
function mostrarTemporal(email, clave) {
  const d = abrirModal(`<div class="mh"><h3>Clave temporal</h3></div><div class="mb"><p style="color:var(--mut)">Entréguesela a <b>${esc(email)}</b> por un canal privado. Solo se muestra esta vez; en su primer ingreso deberá crear su propia contraseña.</p>
    <div class="clave-tmp">${esc(clave)}</div><p class="ayuda">Dirección de ingreso: <b>${esc(location.origin + location.pathname)}</b></p></div>
    <div class="mf"><button class="btn" data-m="copiar">${ico('copiar')}Copiar</button><button class="btn pri" data-m="x">Listo</button></div>`);
  d.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'copiar') { navigator.clipboard && navigator.clipboard.writeText(clave); toast('Clave copiada.'); } else cerrarModal(); });
}
async function cargarUsuarios() {
  try {
    const r = await apiOk('usuarios');
    $('#u-tb').innerHTML = r.usuarios.map((u) => `<tr data-u="${esc(u.email)}"><td><div class="u-quien"><b>${esc(u.nombre)}</b><span>${esc(u.email)}</span></div></td>
      <td class="r-rol">${u.creadorFijo ? '<span class="rol CREADOR">CREADOR</span>' : `<select class="inp" data-uc="rol" style="height:34px;width:auto">${['CREADOR', 'EDITOR', 'LECTOR'].map((x) => `<option${x === u.rol ? ' selected' : ''}>${x}</option>`).join('')}</select>`}</td>
      <td class="r-est">${u.bloqueado ? '<span class="est" style="color:var(--err)">Bloqueado</span>' : !u.activo ? '<span class="est">Inactivo</span>' : u.debeCambiar ? '<span class="est REVISION">Pendiente 1er ingreso</span>' : '<span class="est EMITIDO">Activo</span>'}</td>
      <td class="r-ult" data-l="Último ingreso:" style="color:var(--mut)">${u.ultimoIngreso ? esc(hace(u.ultimoIngreso)) : '—'}</td>
      <td class="r-acc"><div class="u-acc">${u.bloqueado ? '<button class="btn xs" data-uc="desbloquear">Desbloquear</button>' : ''}<button class="btn xs" data-uc="nombre" data-nombre="${esc(u.nombre)}">Editar nombre</button><button class="btn xs" data-uc="reiniciar">Reiniciar clave</button>${u.creadorFijo ? '' : `<button class="btn xs ${u.activo ? 'peligro' : ''}" data-uc="activo">${u.activo ? 'Desactivar' : 'Activar'}</button>`}</div></td></tr>`).join('');
  } catch (e) { $('#u-tb').innerHTML = `<tr><td colspan="5">${esc(e.message)}</td></tr>`; }
}
$('#v-usuarios').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-uc]'); if (!b) return;
  const tr = b.closest('[data-u]'), email = tr.dataset.u, a = b.dataset.uc;
  try {
    if (a === 'nombre') { editarNombre(email, b.dataset.nombre, tr); return; }
    if (a === 'reiniciar') { if (!(await confirmar('Reiniciar contraseña', `Se genera una clave temporal para <b>${esc(email)}</b> y se cierran sus sesiones abiertas.`, 'Reiniciar'))) return; const r = await apiOk('usuarioReiniciar', { email }); mostrarTemporal(email, r.claveTemporal); }
    else {
      const rolSel = tr.querySelector('select[data-uc="rol"]'), rol = rolSel ? rolSel.value : 'CREADOR';
      const activoAct = !/Inactivo/.test(tr.textContent);
      await apiOk('usuarioGuardar', { email, rol, activo: a === 'activo' ? !activoAct : activoAct, desbloquear: a === 'desbloquear' });
      toast('Usuario actualizado.', 'ok');
    }
    cargarUsuarios();
  } catch (err) { toast(esc(err.message), 'err'); }
});
$('#v-usuarios').addEventListener('change', async (e) => {
  const s = e.target.closest('select[data-uc="rol"]'); if (!s) return;
  const tr = s.closest('[data-u]');
  try { await apiOk('usuarioGuardar', { email: tr.dataset.u, rol: s.value, activo: !/Inactivo/.test(tr.textContent) }); toast('Rol actualizado.', 'ok'); } catch (err) { toast(esc(err.message), 'err'); cargarUsuarios(); }
});
async function verAuditoria() {
  const V = $('#v-auditoria');
  V.innerHTML = `<div class="cab"><div><h1 class="t">Registro de actividad</h1><p>Ingresos, cambios de clave, informes creados, videos y exportaciones (últimos 200 eventos).</p></div></div><div class="tw"><table class="tabla resp aud"><thead><tr><th>Fecha</th><th>Usuario</th><th>Evento</th><th>Detalle</th></tr></thead><tbody id="a-tb"><tr><td colspan="4"><div class="spin"></div></td></tr></tbody></table></div>`;
  try {
    const r = await apiOk('auditoria');
    $('#a-tb').innerHTML = r.eventos.map((x) => `<tr><td class="mono a-f" style="font-size:12px;white-space:nowrap">${esc(x.fecha)}</td><td class="a-u">${esc(x.usuario)}</td><td class="a-e"><b>${esc(x.accion.replace(/_/g, ' '))}</b></td><td class="a-d" style="color:var(--mut)">${esc(x.detalle)}</td></tr>`).join('') || '<tr><td colspan="4">Sin eventos.</td></tr>';
  } catch (e) { $('#a-tb').innerHTML = `<tr><td colspan="4">${esc(e.message)}</td></tr>`; }
}
function verCuenta() {
  const u = S.user;
  $('#v-cuenta').innerHTML = `<div class="cab"><div><h1 class="t">Mi cuenta</h1><p>${esc(u.nombre)} · ${esc(u.email)} · <span class="rol ${esc(u.rol)}">${esc(u.rol)}</span></p></div></div>
    <div class="card" style="max-width:560px"><h3>${ico('candado')}Cambiar contraseña</h3><form id="k-form">
      <input type="text" autocomplete="username" value="${esc(u.email)}" class="hide" readonly>
      <label class="campo"><span>Contraseña actual</span><input id="k-a" type="password" autocomplete="current-password"></label>
      <label class="campo"><span>Nueva contraseña (mínimo 8 caracteres, letras y números)</span><input id="k-n" type="password" autocomplete="new-password"></label>
      <label class="campo"><span>Repita la nueva</span><input id="k-n2" type="password" autocomplete="new-password"></label>
      <button class="btn pri" type="submit">Guardar contraseña</button><div class="msg" id="k-msg"></div></form><p class="ayuda" style="margin-top:12px">Al cambiarla se cierran sus sesiones abiertas en otros equipos.</p></div>
    <div class="card" style="max-width:560px"><h3>${ico('escudo')}Seguridad</h3><p style="color:var(--mut);margin-bottom:14px">Tras 5 intentos fallidos la cuenta se bloquea 15 minutos. Las sesiones vencen solas; si marcó «mantener la sesión», dura 30 días en ese equipo.</p></div>
    <div id="cuenta-push"></div>`;
  if (HR.push) HR.push.tarjeta($('#cuenta-push'));
  $('#k-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const m = $('#k-msg');
    if ($('#k-n').value !== $('#k-n2').value) { m.textContent = 'Las contraseñas nuevas no coinciden.'; m.className = 'msg err'; return; }
    try { const r = await api('cambiarClave', { actual: $('#k-a').value, nueva: $('#k-n').value }); if (!r.ok) { m.textContent = r.error; m.className = 'msg err'; return; } m.textContent = 'Contraseña actualizada.'; m.className = 'msg ok'; e.target.reset(); }
    catch (err) { m.textContent = err.message; m.className = 'msg err'; }
  });
}

/* ============================================================ arranque */
(async function init() {
  try { if (localStorage.getItem('hr_tema') === 'light') document.body.classList.add('light'); } catch (e) { /* nada */ }
  const s = leerSes();
  if (s && s.t && C.API) {
    S.token = s.t; S.recordar = !!s.r;
    try {
      const r = await api('yo');
      if (r.ok) { S.user = r.usuario; if (r.usuario.debeCambiar) mostrarCambio(); else entrar(); return; }
    } catch (e) { if (S.user) return; }
    cerrarLocal();
  }
  mostrarLogin();
})();
})();
