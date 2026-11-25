/* HYDRO-ROV · Análisis — aplicación
   Informes de inspección CCTV: video y fotos del tramo, hallazgos, perfil, PDF y Word. Todo se guarda en Drive. */
'use strict';
(function () {
const C = window.HR_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (n, cls = 'i') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nf = (v, d = 2) => (v == null || v === '' || isNaN(v) ? '' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pn = (s) => { if (s == null) return null; const t = String(s).trim().replace(/\s/g, '').replace(',', '.'); if (t === '') return null; const n = Number(t); return isFinite(n) ? n : null; };
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtT = (s) => { if (s == null || isNaN(s)) return ''; s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
const pT = (t) => { t = String(t || '').trim(); if (!t) return null; const p = t.split(':').map(Number); if (p.some(isNaN)) return null; return p.reduce((a, b) => a * 60 + b, 0); };
const fFecha = (iso) => { if (!iso) return ''; const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); };
const hace = (iso) => { const d = (Date.now() - new Date(iso)) / 1000; if (!(d >= 0)) return ''; if (d < 60) return 'hace un momento'; if (d < 3600) return 'hace ' + Math.floor(d / 60) + ' min'; if (d < 86400) return 'hace ' + Math.floor(d / 3600) + ' h'; return fFecha(iso); };

/* ============================================================ catálogo */
const GRADOS = [
  { g: 0, n: 'Sin grado', c: '#6b7890' }, { g: 1, n: 'Muy leve', c: '#3aa76d' }, { g: 2, n: 'Leve', c: '#94c140' },
  { g: 3, n: 'Moderado', c: '#e7b43a' }, { g: 4, n: 'Grave', c: '#ec7a35' }, { g: 5, n: 'Crítico', c: '#e0443e' }];
const CATALOGO = [
  { grupo: 'Estructural', items: [['GL', 'Grieta longitudinal'], ['GC', 'Grieta circunferencial'], ['GM', 'Grietas múltiples'], ['FL', 'Fractura longitudinal'], ['FC', 'Fractura circunferencial'], ['FM', 'Fracturas múltiples'], ['RT', 'Rotura con desprendimiento'], ['HU', 'Hueco o perforación'], ['DF', 'Deformación de la sección'], ['CP', 'Colapso'], ['DJ', 'Desplazamiento de junta'], ['SJ', 'Separación de junta'], ['DS', 'Desgaste o corrosión superficial'], ['RV', 'Falla del revestimiento']] },
  { grupo: 'Operacional', items: [['RA', 'Raíces'], ['IN', 'Infiltración'], ['SE', 'Sedimentos o depósitos'], ['GR', 'Grasa adherida'], ['IC', 'Incrustaciones'], ['OB', 'Obstáculo u objeto extraño'], ['EM', 'Empozamiento o contrapendiente'], ['NA', 'Nivel de agua alto']] },
  { grupo: 'Conexiones y construcción', items: [['CX', 'Conexión domiciliaria'], ['CXP', 'Conexión penetrante'], ['CXD', 'Conexión defectuosa'], ['CM', 'Cambio de material'], ['CD', 'Cambio de diámetro'], ['RP', 'Reparación existente'], ['UN', 'Junta o unión (referencia)']] },
  { grupo: 'Inspección', items: [['INI', 'Inicio de inspección'], ['FIN', 'Llegada a pozo / fin de tramo'], ['FA', 'Fin anticipado de inspección'], ['CAM', 'Cámara bajo el agua'], ['NT', 'Nota general']] }];
const COD = {}; CATALOGO.forEach((g) => g.items.forEach(([k, n]) => { COD[k] = { n, grupo: g.grupo }; }));
const ESTADOS = { BORRADOR: 'Borrador', REVISION: 'En revisión', EMITIDO: 'Emitido' };

const GEN = [
  { k: 'proyecto', l: 'Proyecto u objeto de la inspección', w: 'w4', ph: 'Ej.: Inspección CCTV de redes de alcantarillado sanitario, barrio Comuneros' },
  { k: 'cliente', l: 'Cliente o entidad contratante', w: 'w2' }, { k: 'contrato', l: 'Contrato u orden de servicio' },
  { k: 'tipo', l: 'Tipo de inspección', t: 'sel', o: ['CCTV con equipo robotizado', 'CCTV con cámara de empuje (sonda)', 'Inspección de pozos', 'Inspección combinada'] },
  { k: 'municipio', l: 'Municipio' }, { k: 'departamento', l: 'Departamento' }, { k: 'sector', l: 'Sector, barrio o dirección', w: 'w2' },
  { k: 'fechaInspeccion', l: 'Fecha de inspección', t: 'date' }, { k: 'fechaInforme', l: 'Fecha del informe', t: 'date' },
  { k: 'clima', l: 'Condición del clima', t: 'sel', o: ['', 'Seco', 'Lluvia reciente', 'Lluvia durante la inspección'] },
  { k: 'limpieza', l: 'Limpieza previa de la red', t: 'sel', o: ['', 'Sí', 'No', 'Parcial'] },
  { k: 'equipo', l: 'Equipo de inspección', w: 'w2' }, { k: 'metodoLimpieza', l: 'Método de limpieza', w: 'w2', ph: 'Ej.: hidrosucción, varillado' },
  { k: 'operador', l: 'Operador del equipo' }, { k: 'responsable', l: 'Ingeniero responsable' }, { k: 'matricula', l: 'Matrícula profesional' }, { k: 'reviso', l: 'Revisó' },
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
  { k: 'ubicacion', l: 'Ubicación o dirección', w: 'w2' }, { k: 'coord', l: 'Coordenadas (latitud, longitud)', w: 'w2', gps: true },
  { k: 'finAnticipado', l: 'Motivo de fin anticipado (si no se completó)', w: 'w4' },
  { k: 'conclusion', l: 'Conclusión del tramo', t: 'area', w: 'w4' }, { k: 'recomendacion', l: 'Recomendación para el tramo', t: 'area', w: 'w4' }];

/* ============================================================ estado */
const S = { token: null, user: null, recordar: false, informes: [], inf: null, carpeta: null, tab: 'general', tramoSel: null,
  fotos: {}, cola: [], subiendoFotos: false, dirty: false, guardando: false, otra: false, timer: null,
  videos: {}, subidasVideo: {}, filtro: '', q: '', clavePrevia: null, focoObs: null };
window.HR = { S, C, GRADOS, CATALOGO, COD, ESTADOS, fmtT, nf, fFecha, esc, perfilSVG: null, api: null, toast: null, asegurarFotos: null, progreso: null };

/* ============================================================ avisos, modal, progreso */
function toast(html, tipo = '', ms = 4200) {
  const t = document.createElement('div'); t.className = 'toast ' + tipo; t.innerHTML = html;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms); return t;
}
function abrirModal(html, ancho) {
  const d = $('#modal-doc'); d.className = 'doc' + (ancho ? ' ancho' : ''); d.innerHTML = html;
  $('#modal').classList.add('on'); return d;
}
function cerrarModal() { $('#modal').classList.remove('on'); $('#modal-doc').innerHTML = ''; }
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
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal-doc .lienzo')) cerrarModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').classList.contains('on') && !$('#modal-doc .lienzo')) cerrarModal(); });

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
  hud(); setTimeout(() => $('#l-email').focus(), 50);
}
function mostrarCambio() {
  $('#boot').classList.add('hide'); $('#app').classList.add('hide'); $('#login').classList.remove('hide');
  $$('.paso').forEach((p) => p.classList.toggle('on', p.id === 'paso-cambio'));
  $('#c-quien').textContent = (S.user ? S.user.nombre + ' · ' : '') + 'por seguridad, la clave inicial se reemplaza en el primer ingreso.';
  $('#c-user').value = S.user ? S.user.email : '';
  $('#c-actual-w').classList.toggle('hide', !!S.clavePrevia);
  hud(); reglas(); setTimeout(() => (S.clavePrevia ? $('#c-nueva') : $('#c-actual')).focus(), 50);
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
  const n = S.user.nombre || S.user.email;
  $('#yo-av').textContent = n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  $('#yo-n').textContent = n.split(/\s+/).slice(0, 2).join(' '); $('#yo-r').textContent = S.user.rol;
  $('#ver').textContent = 'v' + (C.VERSION || '');
  route();
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
  const t = S.token; cerrarLocal(); S.inf = null;
  try { await fetch(C.API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'logout', token: t }) }); } catch (e) { /* nada */ }
  location.hash = ''; mostrarLogin();
}
window.addEventListener('hashchange', route);
async function route() {
  if (!S.user) return;
  const p = (location.hash.replace(/^#/, '') || 'informes').split('/');
  if (p[0] === 'informe' && p[1]) return abrirInforme(decodeURIComponent(p[1]), p[2]);
  if (S.inf) await guardarAhora();
  if ((p[0] === 'usuarios' || p[0] === 'auditoria') && esCreador()) return ver(p[0]);
  if (p[0] === 'cuenta') return ver('cuenta');
  return ver('informes');
}
function ver(v) {
  $$('#side a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === v || (v === 'editor' && a.dataset.v === 'informes')));
  $$('.vista').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
  const t = { informes: 'Informes de inspección', usuarios: 'Usuarios', auditoria: 'Registro de actividad', cuenta: 'Mi cuenta' }[v];
  if (t) $('#ctx-t').textContent = t;
  window.scrollTo(0, 0);
  if (v === 'informes') cargarLista();
  if (v === 'usuarios') verUsuarios();
  if (v === 'auditoria') verAuditoria();
  if (v === 'cuenta') verCuenta();
}

/* ============================================================ lista de informes */
async function cargarLista() {
  const L = $('#lista');
  if (!S.informes.length) L.innerHTML = '<div class="vacio"><div class="spin" style="margin:0 auto"></div></div>';
  try { const r = await apiOk('listar'); S.informes = r.informes; if (r.usuario) S.user = Object.assign(S.user, r.usuario); pintarLista(); }
  catch (e) { L.innerHTML = `<div class="vacio"><h3>No se pudo cargar la lista</h3><p>${esc(e.message)}</p></div>`; }
}
function pintarLista() {
  const I = S.informes, q = S.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tramos = I.reduce((a, x) => a + (x.tramos || 0), 0);
  $('#kpis').innerHTML = [['Informes', I.length], ['En borrador', I.filter((x) => x.estado === 'BORRADOR').length], ['Emitidos', I.filter((x) => x.estado === 'EMITIDO').length], ['Tramos registrados', tramos]]
    .map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
  const F = I.filter((x) => (!S.filtro || x.estado === S.filtro) && (!q || [x.id, x.titulo, x.cliente, x.municipio].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
  if (!I.length) {
    $('#lista').innerHTML = `<div class="vacio" style="grid-column:1/-1"><h3>Aún no hay informes</h3><p>Cree el primero: cargue el video del tramo, capture los hallazgos y exporte el informe.</p>${esLector() ? '' : '<p style="margin-top:14px"><button class="btn pri" data-accion="nuevo">' + ico('mas') + 'Nuevo informe</button></p>'}</div>`;
    return;
  }
  if (!F.length) { $('#lista').innerHTML = '<div class="vacio" style="grid-column:1/-1"><h3>Sin resultados</h3><p>Ningún informe coincide con la búsqueda.</p></div>'; return; }
  $('#lista').innerHTML = F.map((x) => `<article class="inf" data-id="${esc(x.id)}" tabindex="0">
    <div class="ph">${x.portada ? `<img data-fid="${esc(x.portada)}" alt="">` : '<div class="rg"><span style="width:60px;height:60px"></span><span style="width:110px;height:110px"></span><span style="width:170px;height:170px"></span></div>'}
      <span class="cod">${esc(x.id)}</span><span class="est est ${esc(x.estado)}">${esc(ESTADOS[x.estado] || x.estado)}</span></div>
    <div class="bd"><h3>${esc(x.titulo)}</h3><div class="me">${esc([x.cliente, x.municipio].filter(Boolean).join(' · ') || 'Sin cliente')}${x.fecha ? ' · ' + esc(fFecha(x.fecha)) : ''}</div>
      <div class="me">${x.tramos || 0} tramo${x.tramos === 1 ? '' : 's'} · ${x.obs || 0} observaci${x.obs === 1 ? 'ón' : 'ones'}</div>
      <div class="ft"><span class="gbar" title="Grado máximo registrado">${[1, 2, 3, 4, 5].map((g) => `<i style="${g <= (x.gradoMax || 0) ? 'background:' + GRADOS[x.gradoMax].c : ''}"></i>`).join('')}</span>
        <span>${esc(hace(x.actualizado))}${x.actualizadoPor ? ' · ' + esc(x.actualizadoPor.split('@')[0]) : ''}</span></div></div></article>`).join('');
  portadas(F.filter((x) => x.portada));
}
async function portadas(lst) {
  for (const x of lst) {
    if (!S.fotos[x.portada]) { try { const r = await apiOk('obtenerFotos', { id: x.id, ids: [x.portada] }); Object.assign(S.fotos, r.fotos); } catch (e) { continue; } }
    $$(`img[data-fid="${x.portada}"]`).forEach((im) => { if (S.fotos[x.portada]) { im.src = S.fotos[x.portada]; im.onload = () => im.classList.add('ok'); } });
  }
}
$('#lista').addEventListener('click', (e) => { const c = e.target.closest('.inf'); if (c) location.hash = 'informe/' + c.dataset.id; });
$('#lista').addEventListener('keydown', (e) => { const c = e.target.closest('.inf'); if (c && e.key === 'Enter') location.hash = 'informe/' + c.dataset.id; });
$('#q').addEventListener('input', (e) => { S.q = e.target.value; pintarLista(); });
$('#filtros').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; S.filtro = b.dataset.f; $$('#filtros .chip').forEach((c) => c.classList.toggle('on', c === b)); pintarLista(); });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-accion]'); if (!b) return;
  const a = b.dataset.accion;
  if (a === 'nuevo') nuevoInforme();
  else if (a === 'volver') location.hash = 'informes';
  else if (a === 'pdf' || a === 'docx') exportar(a);
  else if (a === 'drive') abrirDrive();
});

function nuevoTramo(n) {
  return { id: uid('t'), pozoIni: '', pozoFin: '', sentido: 'Aguas abajo', red: 'Sanitaria', material: '', diametro: null, longitud: null, inspeccionada: null,
    profIni: null, profFin: null, fecha: hoy(), condicion: '', ubicacion: '', coord: '', finAnticipado: '', conclusion: '', recomendacion: '', video: null, obs: [] };
}
async function nuevoInforme() {
  if (esLector()) return;
  const p = progreso('Creando el informe y su carpeta en Drive…'); p.set(0.4);
  try {
    const r = await apiOk('crear', { informe: { estado: 'BORRADOR', general: { tipo: 'CCTV con equipo robotizado', departamento: 'Quindío', equipo: C.EQUIPO_DEFECTO,
      fechaInspeccion: hoy(), fechaInforme: hoy(), responsable: esCreador() ? S.user.nombre : '' }, tramos: [nuevoTramo()], conclusiones: '', recomendaciones: '', alcance: '' } });
    S.inf = null; location.hash = 'informe/' + r.informe.id;
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
    S.inf.tramos.forEach((t) => { t.obs = t.obs || []; });
    S.tramoSel = S.inf.tramos[0].id; S.dirty = false; setSync('ok', 'Guardado');
    pintarEditor();
    precargarFotos();
  } else ver('editor');
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
      <label class="campo w4"><span>Alcance de la inspección y metodología empleada</span><textarea data-b="i:alcance" rows="5" placeholder="Describa qué se inspeccionó, con qué procedimiento y bajo qué criterio de calificación de defectos.">${esc(S.inf.alcance || '')}</textarea></label></div></div>`;
}
function pintarConclusiones() {
  $('#p-conclusiones').innerHTML = `<div class="card"><h3><span class="n">01</span>Conclusiones generales</h3><div class="frm">
      <label class="campo w4"><span>Conclusiones</span><textarea data-b="i:conclusiones" rows="8">${esc(S.inf.conclusiones || '')}</textarea></label></div></div>
    <div class="card"><h3><span class="n">02</span>Recomendaciones</h3><div class="frm">
      <label class="campo w4"><span>Recomendaciones</span><textarea data-b="i:recomendaciones" rows="8">${esc(S.inf.recomendaciones || '')}</textarea></label></div></div>
    <div class="card"><h3><span class="n">03</span>Anexos y notas finales</h3><div class="frm">
      <label class="campo w4"><span>Anexos (relación de videos, planos, registros entregados)</span><textarea data-b="i:anexos" rows="4">${esc(S.inf.anexos || '')}</textarea></label></div></div>`;
}

/* ------------------------------------------------------------ tramos */
function colorTramo(t) { const m = Math.max(0, ...t.obs.map((o) => Number(o.grado) || 0)); return GRADOS[m].c; }
function pintarListaTramos() {
  const box = $('#tr-lista'); if (!box) return;
  box.innerHTML = S.inf.tramos.map((t, i) => `<button type="button" class="tr-it${t.id === S.tramoSel ? ' on' : ''}" data-tramo="${t.id}">
      <div><div class="pz">${esc(etiquetaTramo(t))}</div><div class="me">Tramo ${i + 1} · ${t.obs.length} obs.${t.longitud ? ' · ' + nf(t.longitud) + ' m' : ''}${t.video && t.video.id ? ' · video' : ''}</div></div><span class="gd" style="background:${colorTramo(t)}"></span></button>`).join('')
    + '<button type="button" class="tr-it tr-nuevo solo-ed" data-ta="nuevo">' + ico('mas') + 'Agregar tramo</button>';
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
    <div class="card"><h3><span class="n">FT</span>Ficha técnica del tramo <span class="der solo-ed">
      <button type="button" class="btn sm" data-ta="duplicar" title="Duplicar ficha para el tramo siguiente">${ico('dup')}<span class="tx">Siguiente tramo</span></button>
      <button type="button" class="btn sm peligro" data-ta="borrar">${ico('basura')}<span class="tx">Eliminar</span></button></span></h3>
      <div class="frm">${TR.map((d) => campo(d, t[d.k], 't')).join('')}</div></div>
  </div></div>`;
  pintarListaTramos(); pintarObs(); pintarPerfil(); montarVideo(t); bloquearLector();
}

/* ------------------------------------------------------------ consola de video */
function consolaHTML(t) {
  const v = t.video, sv = S.subidasVideo[t.id];
  return `<div class="consola" id="consola" tabindex="0" aria-label="Consola de video del tramo">
    <div class="barra"><span>TRAMO <b id="cv-tramo">${esc(etiquetaTramo(t))}</b></span><span id="cv-info">${v ? esc(v.nombre) + (v.tamano ? ' · ' + nf(v.tamano / 1048576, 0) + ' MB' : '') : 'Sin video'}</span>
      <span class="der"><span id="cv-drive">${estadoVideoTxt(t)}</span>
      ${v ? `<button type="button" class="solo-ed" data-ta="quitarVideo" title="Quitar video del tramo" style="background:none;border:0;color:#9fb6cc;display:grid;place-items:center">${ico('x')}</button>` : ''}</span></div>
    <div class="subida"><i id="cv-barra" style="width:${sv && sv.estado === 'subiendo' ? Math.round(sv.p * 100) : 0}%"></i></div>
    <div class="pantalla" id="pantalla"><video id="vid" playsinline preload="metadata"></video><div class="hudv" id="vhud"></div><div class="flash" id="flash"></div>
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
    </div></div>`;
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
  vid.addEventListener('loadedmetadata', () => { actualizarTiempo(); pintarMarcas(); });
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
  pintarObs(); pintarMarcas(); pintarPerfil(); pintarListaTramos(); marcarSucio();
  enfocarObs(o.id, true);
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
  const t = tramoActual(), ims = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
  for (const f of ims) {
    try { const url = await comprimir(f); const o = nuevaObs(t, {}); ponerFoto(o, url); }
    catch (e) { toast(esc(e.message), 'err'); }
  }
  pintarObs(); pintarPerfil(); pintarListaTramos(); marcarSucio();
  if (ims.length) toast(`${ims.length} foto${ims.length > 1 ? 's' : ''} agregada${ims.length > 1 ? 's' : ''} como observaciones. Complete distancia, código y grado.`);
}
$('#p-tramos').addEventListener('keydown', (e) => {
  if (!e.target.closest('#consola') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const vid = $('#vid'); if (!vid) return;
  if (e.key === ' ') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
  else if (e.key.toLowerCase() === 'c') { e.preventDefault(); capturar(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); vid.pause(); vid.currentTime = Math.max(0, vid.currentTime - (e.shiftKey ? 5 : 1 / 30)); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); vid.pause(); vid.currentTime += e.shiftKey ? 5 : 1 / 30; }
});

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
        <span class="nro">#${i + 1}${o.tiempo != null ? ' · ' + fmtT(o.tiempo) : ''}</span>${o.foto && !o.foto.id ? '<span class="pend">Subiendo a Drive…</span>' : ''}</div>
      <div class="cps">
        <label><span>Distancia (m)</span><input data-b="o:dist" data-n="1" inputmode="decimal" value="${o.dist == null ? '' : String(o.dist).replace('.', ',')}" placeholder="0,00"></label>
        <label><span>Tiempo video</span><input data-b="o:tiempo" data-tiempo="1" value="${esc(fmtT(o.tiempo))}" placeholder="mm:ss"></label>
        <label class="w2"><span>Código del hallazgo</span><select data-b="o:codigo">${opcionesCodigo(o.codigo)}</select></label>
        <label class="w4"><span>Descripción</span><textarea data-b="o:desc" placeholder="Qué se observa, extensión, condición…">${esc(o.desc || '')}</textarea></label>
        <label class="c12"><span>Posición horaria</span><div class="hr"><select data-b="o:hIni">${horas(o.hIni)}</select><span style="color:var(--mut2)">a</span><select data-b="o:hFin">${horas(o.hFin)}</select></div></label>
        <label class="c3"><span>Continuo hasta (m)</span><input data-b="o:distFin" data-n="1" inputmode="decimal" value="${o.distFin == null ? '' : String(o.distFin).replace('.', ',')}" placeholder="—"></label>
        <div class="c4"><span style="display:block;font-size:11px;color:var(--mut2);margin-bottom:4px">Grado de severidad</span><div class="grados">${GRADOS.map((g) => `<button type="button" data-grado="${g.g}" class="${Number(o.grado || 0) === g.g ? 'on' : ''}" style="${Number(o.grado || 0) === g.g ? 'background:' + g.c : ''}" title="${g.n}">${g.g || '—'}</button>`).join('')}</div></div>
      </div>
      <div class="acc">${o.tiempo != null ? `<button type="button" class="btn xs fant" data-oa="ir" title="Ir a este punto del video">${ico('ir')}</button>` : ''}
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

/* ------------------------------------------------------------ perfil del tramo (SVG) */
function perfilSVG(t, op = {}) {
  const W = 1000, H = op.alto || 200, x0 = 70, x1 = W - 70, yc = 92;
  const maxD = Math.max(0, ...t.obs.map((o) => Math.max(o.dist || 0, o.distFin || 0)));
  const L = Number(t.longitud) || Number(t.inspeccionada) || maxD || 10;
  const X = (d) => x0 + (Math.max(0, Math.min(L, d)) / L) * (x1 - x0);
  const paso = L <= 20 ? 2 : L <= 60 ? 5 : L <= 150 ? 10 : 25;
  const f = op.fuente || 'IBM Plex Sans, Arial, sans-serif', tinta = op.claro ? '#1d2430' : '#c9d4e1', sub = op.claro ? '#6b7684' : '#7d8aa0', tubo = op.claro ? '#dfe6ee' : '#1a2940';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="${f}">`;
  s += `<rect x="${x0}" y="${yc - 9}" width="${x1 - x0}" height="18" rx="9" fill="${tubo}"/>`;
  const insp = Number(t.inspeccionada);
  if (insp && insp < L) s += `<rect x="${X(insp)}" y="${yc - 9}" width="${x1 - X(insp)}" height="18" fill="${op.claro ? '#f3d9d6' : '#3a1f27'}"/><text x="${(X(insp) + x1) / 2}" y="${yc + 4}" text-anchor="middle" font-size="11" fill="${op.claro ? '#a0332c' : '#f19a94'}">no inspeccionado</text>`;
  for (let d = 0; d <= L + 0.001; d += paso) s += `<line x1="${X(d)}" x2="${X(d)}" y1="${yc + 12}" y2="${yc + 18}" stroke="${sub}"/><text x="${X(d)}" y="${yc + 31}" font-size="11" text-anchor="middle" fill="${sub}">${nf(d, 0)}</text>`;
  s += `<text x="${(x0 + x1) / 2}" y="${yc + 48}" font-size="11" text-anchor="middle" fill="${sub}">Distancia desde ${esc(t.sentido === 'Aguas arriba' ? 'el pozo final' : 'el pozo inicial')} (m) · Longitud ${nf(L)} m</text>`;
  [[x0, t.pozoIni || 'Inicial'], [x1, t.pozoFin || 'Final']].forEach(([x, n]) => {
    s += `<rect x="${x - 15}" y="${yc - 30}" width="30" height="60" rx="5" fill="none" stroke="${op.claro ? '#0a2a4a' : '#5cc8e4'}" stroke-width="2.5"/><text x="${x}" y="${yc - 38}" font-size="13" font-weight="700" text-anchor="middle" fill="${tinta}">${esc(n)}</text>`;
  });
  const ax = t.sentido === 'Aguas arriba' ? -1 : 1, am = x0 + 60, ya = H - 14;
  s += `<path d="M${am - 30 * ax} ${ya} L${am + 30 * ax} ${ya} M${am + 22 * ax} ${ya - 5} L${am + 30 * ax} ${ya} L${am + 22 * ax} ${ya + 5}" stroke="${sub}" stroke-width="1.5" fill="none"/><text x="${am + 42}" y="${ya + 4}" font-size="11" fill="${sub}">Sentido de la inspección: ${esc((t.sentido || 'Aguas abajo').toLowerCase())}</text>`;
  const ob = t.obs.filter((o) => o.dist != null).slice().sort((a, b) => a.dist - b.dist);
  ob.filter((o) => o.distFin != null && o.distFin > o.dist).forEach((o) => { s += `<rect x="${X(o.dist)}" y="${yc - 6}" width="${Math.max(2, X(o.distFin) - X(o.dist))}" height="12" fill="${GRADOS[o.grado || 0].c}" opacity=".55"/>`; });
  let ult = -1e9, nivel = 0;
  ob.forEach((o) => {
    const x = X(o.dist), c = GRADOS[o.grado || 0].c; nivel = x - ult < 46 ? (nivel + 1) % 3 : 0; ult = x;
    const yl = yc - 50 - nivel * 16;
    const n = t.obs.indexOf(o) + 1;
    s += `<g data-obs="${o.id}" style="cursor:pointer"><line x1="${x}" x2="${x}" y1="${yc - 9}" y2="${yl + 3}" stroke="${c}" stroke-width="1.5"/><circle cx="${x}" cy="${yc}" r="7" fill="${c}" stroke="${op.claro ? '#fff' : '#03070d'}" stroke-width="2"/>`
      + `<text x="${x}" y="${yl}" font-size="11.5" font-weight="700" text-anchor="middle" fill="${c}">${esc(o.codigo || '#' + n)}</text></g>`;
  });
  return s + '</svg>';
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
    } else if (a === 'anotar') {
      if (fotoSrc(o)) anotar(o);
      else if (!esLector()) { S.fotoPara = o; $('#f-fotos').removeAttribute('multiple'); $('#f-fotos').click(); }
    }
    return;
  }
  const ta = e.target.closest('[data-ta]');
  if (!ta) return;
  e.preventDefault();
  const t = tramoActual(), a = ta.dataset.ta;
  if (a === 'nuevo') { const n = nuevoTramo(); const u = S.inf.tramos[S.inf.tramos.length - 1]; if (u) Object.assign(n, { pozoIni: u.pozoFin, red: u.red, material: u.material, diametro: u.diametro, sentido: u.sentido }); S.inf.tramos.push(n); S.tramoSel = n.id; pintarTramos(); marcarSucio(); }
  else if (a === 'duplicar') { const n = nuevoTramo(); Object.assign(n, { pozoIni: t.pozoFin, red: t.red, material: t.material, diametro: t.diametro, sentido: t.sentido, ubicacion: t.ubicacion }); S.inf.tramos.splice(S.inf.tramos.indexOf(t) + 1, 0, n); S.tramoSel = n.id; pintarTramos(); marcarSucio(); toast('Nuevo tramo con la ficha del anterior. Ajuste el pozo final y la longitud.'); }
  else if (a === 'borrar') {
    if (S.inf.tramos.length < 2) { toast('El informe necesita al menos un tramo.'); return; }
    if (!(await confirmar('Eliminar tramo', `Se retira el tramo <b>${esc(etiquetaTramo(t))}</b> con sus ${t.obs.length} observaciones. Las fotos y el video siguen en la carpeta de Drive.`, 'Eliminar tramo', true))) return;
    S.inf.tramos = S.inf.tramos.filter((x) => x !== t); S.tramoSel = S.inf.tramos[0].id; pintarTramos(); marcarSucio();
  }
  else if (a === 'video') $('#f-video').click();
  else if (a === 'fotos') { S.fotoPara = null; $('#f-fotos').setAttribute('multiple', ''); $('#f-fotos').click(); }
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
    return;
  }
  cargarFotos(fs);
});

/* ------------------------------------------------------------ anotación de fotos */
function anotar(o) {
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
    if (m && m.dataset.m === 'x') cerrarModal();
    if (m && m.dataset.m === 'cambiar') { cerrarModal(); S.fotoPara = o; $('#f-fotos').removeAttribute('multiple'); $('#f-fotos').click(); }
    if (m && m.dataset.m === 'ok') {
      if (!formas.length) { cerrarModal(); return; }
      ponerFoto(o, cv.toDataURL('image/jpeg', 0.9)); cerrarModal(); pintarObs(); marcarSucio(); toast('Anotación guardada. La foto original se conserva en Drive.', 'ok');
    }
  });
}

/* ============================================================ guardado automático */
function setSync(c, t) { const s = $('#sync'); s.className = c; $('#sync-t').textContent = t; }
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
      ${filaKV([['Cliente', g.cliente], ['Contrato', g.contrato], ['Municipio', g.municipio], ['Departamento', g.departamento], ['Sector', g.sector], ['Tipo de inspección', g.tipo], ['Fecha de inspección', fFecha(g.fechaInspeccion)], ['Fecha del informe', fFecha(g.fechaInforme)], ['Equipo', g.equipo], ['Clima', g.clima], ['Limpieza previa', g.limpieza], ['Método de limpieza', g.metodoLimpieza], ['Operador', g.operador], ['Ingeniero responsable', g.responsable]])}
      ${g.notasCampo ? `<p style="white-space:pre-wrap">${esc(g.notasCampo)}</p>` : ''}
      <h2>2. Alcance y metodología</h2>${I.alcance ? `<p style="white-space:pre-wrap">${esc(I.alcance)}</p>` : '<p style="color:#9aa3ae">Sin texto de alcance.</p>'}
      <h3>Grados de severidad empleados</h3><table><tr><th>Grado</th><th>Severidad</th></tr>${GRADOS.slice(1).map((x) => `<tr><td><span class="gtag" style="background:${x.c}">${x.g}</span></td><td>${x.n}</td></tr>`).join('')}</table>
      <h2>3. Resultados por tramo</h2>
      ${I.tramos.map((t, ti) => `<h3>3.${ti + 1} Tramo ${esc(etiquetaTramo(t))}</h3>
        ${filaKV([['Sentido', t.sentido], ['Tipo de red', t.red], ['Material', t.material], ['Diámetro', t.diametro ? nf(t.diametro, 0) + ' mm' : ''], ['Longitud del tramo', t.longitud != null ? nf(t.longitud) + ' m' : ''], ['Longitud inspeccionada', t.inspeccionada != null ? nf(t.inspeccionada) + ' m' : ''], ['Prof. pozo inicial', t.profIni != null ? nf(t.profIni) + ' m' : ''], ['Prof. pozo final', t.profFin != null ? nf(t.profFin) + ' m' : ''], ['Ubicación', t.ubicacion], ['Coordenadas', t.coord], ['Fecha', fFecha(t.fecha)], ['Condición general', t.condicion], ['Video', t.video ? t.video.nombre : ''], ['Fin anticipado', t.finAnticipado]])}
        <div style="border:1px solid #e3e8ee;border-radius:4px;padding:6px;margin:8px 0">${perfilSVG(t, { claro: true })}</div>
        ${t.obs.length ? `<table><tr><th>#</th><th>Dist. (m)</th><th>Tiempo</th><th>Código</th><th>Descripción</th><th>Hora</th><th>Grado</th></tr>${t.obs.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(nf(o.dist))}${o.distFin != null ? ' – ' + esc(nf(o.distFin)) : ''}</td><td>${esc(fmtT(o.tiempo))}</td><td><b>${esc(o.codigo)}</b>${COD[o.codigo] ? '<br><span style="color:#6b7684">' + esc(COD[o.codigo].n) + '</span>' : ''}</td><td>${esc(o.desc)}</td><td>${o.hIni ? esc(o.hIni + (o.hFin ? ' a ' + o.hFin : '')) : ''}</td><td>${o.grado ? `<span class="gtag" style="background:${GRADOS[o.grado].c}">${o.grado}</span>` : '—'}</td></tr>`).join('')}</table>` : '<p style="color:#9aa3ae">Sin observaciones registradas.</p>'}
        ${t.obs.some(fotoSrc) ? `<div class="fotos">${t.obs.map((o, i) => (fotoSrc(o) ? `<figure><img src="${fotoSrc(o)}" alt=""><figcaption><b>Foto ${++fN}</b> · Obs. ${i + 1}${o.dist != null ? ' · ' + esc(nf(o.dist)) + ' m' : ''}${o.codigo ? ' · ' + esc(o.codigo) : ''}${o.grado ? ' · Grado ' + o.grado : ''}${o.desc ? '<br>' + esc(o.desc) : ''}</figcaption></figure>` : '')).join('')}</div>` : ''}
        ${t.conclusion ? `<p><b>Conclusión del tramo.</b> ${esc(t.conclusion)}</p>` : ''}${t.recomendacion ? `<p><b>Recomendación.</b> ${esc(t.recomendacion)}</p>` : ''}`).join('')}
      <h2>4. Conclusiones</h2><p style="white-space:pre-wrap">${esc(I.conclusiones || '—')}</p>
      <h2>5. Recomendaciones</h2><p style="white-space:pre-wrap">${esc(I.recomendaciones || '—')}</p>
      ${I.anexos ? `<h2>6. Anexos</h2><p style="white-space:pre-wrap">${esc(I.anexos)}</p>` : ''}
    </div>`;
  $('#p-vista').innerHTML = html;
}

/* ============================================================ exportar y Drive */
async function exportar(fmt) {
  if (!S.inf) return;
  await guardarAhora();
  if (S.cola.length) { const p = progreso('Terminando de subir fotos a Drive…'); while (S.cola.length) { p.set(0.5); await sleep(500); } p.fin(); }
  try { await window.HRExport[fmt](S.inf, { subir: !esLector() }); }
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
      <div class="campo w4"><button class="btn pri" type="submit">${ico('mas')}Crear usuario</button><span class="ayuda" style="margin-left:10px">Se genera una clave temporal que el usuario cambia en su primer ingreso.</span></div></form></div>
    <div class="tw"><table class="tabla"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody id="u-tb"><tr><td colspan="5"><div class="spin"></div></td></tr></tbody></table></div>`;
  $('#u-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await apiOk('usuarioGuardar', { email: $('#u-email').value, nombre: $('#u-nombre').value, rol: $('#u-rol').value }); if (r.claveTemporal) mostrarTemporal(r.usuario.email, r.claveTemporal); $('#u-form').reset(); cargarUsuarios(); }
    catch (err) { toast(esc(err.message), 'err'); }
  });
  cargarUsuarios();
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
    $('#u-tb').innerHTML = r.usuarios.map((u) => `<tr data-u="${esc(u.email)}"><td><b>${esc(u.nombre)}</b><br><span style="color:var(--mut2);font-size:12.5px">${esc(u.email)}</span></td>
      <td>${u.creadorFijo ? '<span class="rol CREADOR">CREADOR</span>' : `<select class="inp" data-uc="rol" style="height:34px;width:auto">${['CREADOR', 'EDITOR', 'LECTOR'].map((x) => `<option${x === u.rol ? ' selected' : ''}>${x}</option>`).join('')}</select>`}</td>
      <td>${u.bloqueado ? '<span class="est" style="color:var(--err)">Bloqueado</span>' : !u.activo ? '<span class="est">Inactivo</span>' : u.debeCambiar ? '<span class="est REVISION">Pendiente 1er ingreso</span>' : '<span class="est EMITIDO">Activo</span>'}</td>
      <td style="color:var(--mut)">${u.ultimoIngreso ? esc(hace(u.ultimoIngreso)) : '—'}</td>
      <td style="text-align:right;white-space:nowrap">${u.bloqueado ? '<button class="btn xs" data-uc="desbloquear">Desbloquear</button> ' : ''}<button class="btn xs" data-uc="reiniciar">Reiniciar clave</button>
        ${u.creadorFijo ? '' : `<button class="btn xs ${u.activo ? 'peligro' : ''}" data-uc="activo">${u.activo ? 'Desactivar' : 'Activar'}</button>`}</td></tr>`).join('');
  } catch (e) { $('#u-tb').innerHTML = `<tr><td colspan="5">${esc(e.message)}</td></tr>`; }
}
$('#v-usuarios').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-uc]'); if (!b) return;
  const tr = b.closest('[data-u]'), email = tr.dataset.u, a = b.dataset.uc;
  try {
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
  V.innerHTML = `<div class="cab"><div><h1 class="t">Registro de actividad</h1><p>Ingresos, cambios de clave, informes creados, videos y exportaciones (últimos 200 eventos).</p></div></div><div class="tw"><table class="tabla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Evento</th><th>Detalle</th></tr></thead><tbody id="a-tb"><tr><td colspan="4"><div class="spin"></div></td></tr></tbody></table></div>`;
  try {
    const r = await apiOk('auditoria');
    $('#a-tb').innerHTML = r.eventos.map((x) => `<tr><td class="mono" style="font-size:12px;white-space:nowrap">${esc(x.fecha)}</td><td>${esc(x.usuario)}</td><td>${esc(x.accion.replace(/_/g, ' '))}</td><td style="color:var(--mut)">${esc(x.detalle)}</td></tr>`).join('') || '<tr><td colspan="4">Sin eventos.</td></tr>';
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
    <div class="card" style="max-width:560px"><h3>${ico('escudo')}Seguridad</h3><p style="color:var(--mut);margin-bottom:14px">Tras 5 intentos fallidos la cuenta se bloquea 15 minutos. Las sesiones vencen solas; si marcó «mantener la sesión», dura 30 días en ese equipo.</p></div>`;
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
