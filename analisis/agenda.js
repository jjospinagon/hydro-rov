/* HYDRO-ROV · Análisis — módulo Agenda: visitas técnicas previas y programación de trabajos
   Calendario mensual con festivos de Colombia (Ley Emiliani), lista de próximos eventos, lista de verificación por evento,
   aviso de cruce del equipo, y enlaces a Google Calendar, archivo .ics y WhatsApp. El servidor replica cada evento en el
   calendario «HYDRO-ROV · Agenda» (invitado hydrorov.co@gmail.com) y avisa al resto del equipo con notificación push. */
'use strict';
(function () {
const HR = window.HR, U = HR.ui;
const { $, $$, ico, hoy, abrirModal, cerrarModal, confirmar } = U;
const esc = HR.esc;
const A = { eventos: [], cargado: false, mes: hoy().slice(0, 7), vista: null, tipo: '', dia: hoy() };
const TIPOS = { VISITA: 'Visita previa', TRABAJO: 'Trabajo', OTRO: 'Otro' };
const ESTADOS = { PROGRAMADO: 'Programado', CONFIRMADO: 'Confirmado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado' };
const LISTA_VISITA = ['Localizar pozos, cámaras y puntos de acceso', 'Verificar diámetros, materiales y profundidades', 'Confirmar o medir las longitudes de los tramos',
  'Revisar limpieza de la red y nivel de agua', 'Definir dónde se ubica el equipo (acceso vehicular y energía)', 'Registrar el contacto de la administración o del sitio'];
const LISTA_TRABAJO = ['Anticipo recibido', 'Accesos localizados, destapados y autorizados', 'Tuberías limpias y desobstruidas', 'Control del nivel de agua coordinado', 'Equipo cargado y probado (baterías, cable, cámara)'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
window.HRMod = window.HRMod || {};

/* ============================================================ fechas y festivos de Colombia */
const D = (iso) => new Date(iso + 'T12:00:00');
const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const mas = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
const dow = (s) => (D(s).getDay() + 6) % 7;   // 0 = lunes
const fLarga = (s) => { const d = D(s); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
const fCorta = (s) => { const d = D(s); return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); };
function pascua(y) { /* algoritmo de Meeus/Jones/Butcher */
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
const FEST = {};
function festivos(y) {
  if (FEST[y]) return FEST[y];
  const F = {}, f = (s, n) => { F[s] = n; };
  const lunes = (s) => { const w = dow(s); return w === 0 ? s : mas(s, 7 - w); };   // Ley Emiliani: se pasa al lunes siguiente
  [['01-01', 'Año Nuevo'], ['05-01', 'Día del Trabajo'], ['07-20', 'Independencia'], ['08-07', 'Batalla de Boyacá'], ['12-08', 'Inmaculada Concepción'], ['12-25', 'Navidad']].forEach(([d, n]) => f(`${y}-${d}`, n));
  [['01-06', 'Reyes Magos'], ['03-19', 'San José'], ['06-29', 'San Pedro y San Pablo'], ['08-15', 'Asunción de la Virgen'], ['10-12', 'Día de la Raza'], ['11-01', 'Todos los Santos'], ['11-11', 'Independencia de Cartagena']]
    .forEach(([d, n]) => f(lunes(`${y}-${d}`), n));
  const p = pascua(y);
  f(mas(p, -3), 'Jueves Santo'); f(mas(p, -2), 'Viernes Santo'); f(mas(p, 43), 'Ascensión del Señor'); f(mas(p, 64), 'Corpus Christi'); f(mas(p, 71), 'Sagrado Corazón');
  return (FEST[y] = F);
}
const festivo = (s) => festivos(Number(s.slice(0, 4)))[s] || '';
const habil = (s) => dow(s) !== 6 && !festivo(s);
/* fecha final de un trabajo de n jornadas que empieza en «ini» (no cuenta domingos ni festivos) */
function finJornadas(ini, n) { let d = ini, k = habil(ini) ? 1 : 0; while (k < (n || 1)) { d = mas(d, 1); if (habil(d)) k++; } return d; }

/* ============================================================ datos */
async function cargar() {
  try { const r = await HR.apiOk('agenda'); A.eventos = r.eventos; A.cargado = true; } catch (e) { if (!A.cargado) HR.toast(esc(e.message), 'err'); }
  return A.eventos;
}
HR.cargarAgenda = cargar;
HR.eventosDe = (cotId) => A.eventos.filter((v) => v.cotId === cotId);
const activos = () => A.eventos.filter((v) => v.estado !== 'CANCELADO');
const enDia = (s) => A.eventos.filter((v) => v.inicio <= s && v.fin >= s && (!A.tipo || v.tipo === A.tipo)).sort((a, b) => ((a.hora || '99') < (b.hora || '99') ? -1 : 1));
/* cruces: el equipo es uno solo, dos trabajos en las mismas fechas no se pueden; una visita el día de un trabajo se advierte */
function cruces(ev) {
  if (ev.estado === 'CANCELADO') return [];
  return activos().filter((v) => v.id !== ev.id && v.inicio <= ev.fin && v.fin >= ev.inicio && (v.tipo === 'TRABAJO' || ev.tipo === 'TRABAJO')
    && !(ev.tipo !== 'TRABAJO' && v.tipo !== 'TRABAJO'));
}

/* ============================================================ vista */
async function agenda() {
  const V = $('#v-agenda');
  if (!A.vista) A.vista = matchMedia('(max-width:640px)').matches ? 'lista' : 'mes';
  V.innerHTML = `<div class="cab"><div><h1 class="t">Agenda</h1><p>Visitas técnicas previas y trabajos programados. Cada evento se copia al calendario de Google de HYDRO-ROV.</p></div>
      <div class="cab-acc solo-editor"><button class="btn" data-ag="nuevo" data-tipo="VISITA">${ico('cal')}Agendar visita previa</button><button class="btn pri" data-ag="nuevo" data-tipo="TRABAJO">${ico('mas')}Programar trabajo</button></div></div>
    <div class="ag-kpis" id="ag-kpis"></div>
    <div class="tools ag-tools">
      <div class="ag-nav"><button class="hb" data-ag="mes" data-d="-1" aria-label="Mes anterior">${ico('atras')}</button><b id="ag-mes"></b><button class="hb rot" data-ag="mes" data-d="1" aria-label="Mes siguiente">${ico('atras')}</button><button class="chip" data-ag="hoy">Hoy</button></div>
      <div class="chips seg" id="ag-vista"><button class="chip" data-v="mes">Mes</button><button class="chip" data-v="lista">Próximos</button></div>
      <div class="chips" id="ag-tipo">${[['', 'Todo'], ['VISITA', 'Visitas'], ['TRABAJO', 'Trabajos'], ['OTRO', 'Otros']].map(([v, l]) => `<button class="chip${A.tipo === v ? ' on' : ''}" data-t="${v}">${l}</button>`).join('')}</div>
      <button class="chip ag-push hide" id="ag-push">${ico('campana')}Activar notificaciones</button></div>
    <div id="ag-cuerpo"><div class="vacio"><div class="spin" style="margin:0 auto"></div></div></div>`;
  V.querySelector('#ag-vista').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { A.vista = b.dataset.v; pintar(); } });
  V.querySelector('#ag-tipo').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; A.tipo = b.dataset.t; $$('#ag-tipo .chip').forEach((x) => x.classList.toggle('on', x === b)); pintar(); });
  if (HR.push && HR.push.ofrecer) HR.push.ofrecer($('#ag-push'));
  await Promise.all([cargar(), HR.cargarCotizaciones && !(HR.cotIndice() || []).length ? HR.cargarCotizaciones() : null]);
  pintar();
  if (HR.avisos) HR.avisos.leidos('agenda');
  if (A.pendiente) { const p = A.pendiente; A.pendiente = null; editar(p); }
}
function pintar() {
  if (!$('#ag-cuerpo')) return;
  $$('#ag-vista .chip').forEach((x) => x.classList.toggle('on', x.dataset.v === A.vista));
  const [y, m] = A.mes.split('-').map(Number);
  $('#ag-mes').textContent = MESES[m - 1].replace(/^./, (x) => x.toUpperCase()) + ' ' + y;
  $('.ag-nav').classList.toggle('hide', A.vista !== 'mes');
  const h = hoy(), act = activos();
  const prox = act.filter((v) => v.fin >= h).sort((a, b) => (a.inicio + (a.hora || '') < b.inicio + (b.hora || '') ? -1 : 1));
  const pv = prox.find((v) => v.tipo === 'VISITA'), pt = prox.find((v) => v.tipo === 'TRABAJO');
  const ini = A.mes + '-01', fin = mas(mas(ini, 32).slice(0, 7) + '-01', -1);
  let ocup = 0; for (let d = ini; d <= fin; d = mas(d, 1)) if (act.some((v) => v.tipo === 'TRABAJO' && v.inicio <= d && v.fin >= d)) ocup++;
  const kp = (l, v, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  $('#ag-kpis').innerHTML = kp('Próxima visita', pv ? esc(fCorta(pv.inicio)) + (pv.hora ? `<small> ${esc(pv.hora)}</small>` : '') : '—', pv ? esc(pv.cliente || pv.titulo) : 'Sin visitas pendientes')
    + kp('Próximo trabajo', pt ? esc(fCorta(pt.inicio)) : '—', pt ? esc(pt.cliente || pt.titulo) : 'Sin trabajos pendientes')
    + kp('Días de equipo ocupado', ocup + '<small> en ' + MESES[m - 1] + '</small>', 'jornadas de trabajo programadas')
    + kp('Por confirmar', act.filter((v) => v.estado === 'PROGRAMADO' && v.fin >= h).length, 'eventos sin confirmar con el cliente');
  if (A.vista === 'mes') pintarMes(); else pintarLista();
}
function chip(v, d) {
  const n = v.inicio !== v.fin ? ` <small>${Math.round((D(d) - D(v.inicio)) / 864e5) + 1}/${Math.round((D(v.fin) - D(v.inicio)) / 864e5) + 1}</small>` : '';
  return `<button type="button" class="ev ${esc(v.tipo)} ${esc(v.estado)}" data-ev="${esc(v.id)}" title="${esc(TIPOS[v.tipo] + ' · ' + v.titulo)}">${v.hora && v.inicio === d ? `<b>${esc(v.hora)}</b> ` : ''}${esc(v.cliente || v.titulo)}${n}</button>`;
}
function pintarMes() {
  const ini = A.mes + '-01', des = dow(ini), h = hoy(); let d = mas(ini, -des), html = '';
  for (let s = 0; s < 6; s++) {
    for (let k = 0; k < 7; k++) {
      const fe = festivo(d), evs = enDia(d), fuera = d.slice(0, 7) !== A.mes;
      html += `<div class="dia${fuera ? ' fuera' : ''}${d === h ? ' hoy' : ''}${d === A.dia ? ' sel' : ''}${fe || k === 6 ? ' festivo' : ''}" data-dia="${d}" tabindex="0" role="button" aria-label="${esc(fLarga(d))}${fe ? ', festivo' : ''}${evs.length ? ', ' + evs.length + ' eventos' : ''}">
        <span class="n">${D(d).getDate()}</span>${fe ? `<span class="fe" title="${esc(fe)}">${esc(fe)}</span>` : ''}
        <div class="evs">${evs.slice(0, 3).map((v) => chip(v, d)).join('')}${evs.length > 3 ? `<span class="mas">+${evs.length - 3}</span>` : ''}</div>
        <div class="pts">${evs.slice(0, 4).map((v) => `<i class="${esc(v.tipo)} ${esc(v.estado)}"></i>`).join('')}</div></div>`;
      d = mas(d, 1);
    }
    if (d.slice(0, 7) !== A.mes && s >= 4) break;
  }
  $('#ag-cuerpo').innerHTML = `<div class="cal"><div class="cal-h">${DIAS.map((x) => `<span>${x}</span>`).join('')}</div><div class="cal-g">${html}</div></div><div class="ag-dia" id="ag-dia"></div>`;
  pintarDia();
}
function tarjeta(v) {
  const cot = v.cotId ? `<a class="ag-cot" href="#cotizacion/${encodeURIComponent(v.cotId)}">${ico('doc', 'i mini')}${esc(v.cotId)}</a>` : '';
  const hechos = (v.lista || []).filter((x) => x.ok).length, cr = cruces(v);
  return `<article class="ag-ev ${esc(v.tipo)} ${esc(v.estado)}" data-ev="${esc(v.id)}" tabindex="0">
    <div class="ag-t"><span class="tag ${esc(v.tipo)}">${esc(TIPOS[v.tipo])}</span><span class="est e-${esc(v.estado)}">${esc(ESTADOS[v.estado])}</span>${cot}</div>
    <h3>${esc(v.titulo)}</h3>
    <div class="ag-m">${ico('cal', 'i mini')}${esc(v.inicio === v.fin ? fLarga(v.inicio) : fLarga(v.inicio) + ' → ' + fLarga(v.fin))}${v.hora ? ' · ' + esc(v.hora) + (v.horaFin ? '–' + esc(v.horaFin) : '') : ''}</div>
    ${v.lugar ? `<div class="ag-m">${ico('gps', 'i mini')}${esc(v.lugar)}</div>` : ''}
    ${v.contacto || v.telefono ? `<div class="ag-m">${ico('user', 'i mini')}${esc([v.contacto, v.telefono].filter(Boolean).join(' · '))}</div>` : ''}
    <div class="ag-p">${(v.lista || []).length ? `<span class="prog" title="Lista de verificación"><i style="width:${Math.round((hechos / v.lista.length) * 100)}%"></i></span><small>${hechos}/${v.lista.length}</small>` : ''}
      ${cr.length ? `<span class="cruce" title="${esc(cr.map((x) => x.titulo).join(' · '))}">Cruce con ${cr.length} evento${cr.length === 1 ? '' : 's'}</span>` : ''}${v.gcal ? `<span class="gc" title="Copiado al calendario de Google">${ico('cal', 'i mini')}Google</span>` : ''}</div></article>`;
}
function pintarDia() {
  const box = $('#ag-dia'); if (!box) return;
  const evs = enDia(A.dia), fe = festivo(A.dia);
  box.innerHTML = `<div class="ag-dia-h"><h3>${esc(fLarga(A.dia).replace(/^./, (x) => x.toUpperCase()))}</h3>${fe ? `<span class="fe-tag">Festivo · ${esc(fe)}</span>` : ''}
      <button class="btn sm solo-editor" data-ag="nuevo" data-tipo="VISITA" data-fecha="${A.dia}">${ico('mas')}Agendar este día</button></div>
    ${evs.length ? `<div class="ag-grid">${evs.map(tarjeta).join('')}</div>` : '<p class="mut" style="padding:4px 2px 8px">Sin eventos este día.</p>'}`;
}
function pintarLista() {
  const h = hoy(), L = A.eventos.filter((v) => (!A.tipo || v.tipo === A.tipo) && (A.anteriores ? v.fin < h : v.fin >= h))
    .sort((a, b) => ((a.inicio + (a.hora || '')) < (b.inicio + (b.hora || '')) ? (A.anteriores ? 1 : -1) : (A.anteriores ? -1 : 1)));
  const grupos = new Map(); L.forEach((v) => { const k = v.inicio < h && !A.anteriores ? h : v.inicio; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(v); });
  $('#ag-cuerpo').innerHTML = (L.length ? [...grupos.entries()].map(([d, evs]) => `<div class="ag-grupo"><h4>${esc(d === h ? 'Hoy · ' + fLarga(d) : fLarga(d).replace(/^./, (x) => x.toUpperCase()))}${festivo(d) ? ` <span class="fe-tag">${esc(festivo(d))}</span>` : ''}</h4><div class="ag-grid">${evs.map(tarjeta).join('')}</div></div>`).join('')
    : `<div class="vacio"><h3>${A.anteriores ? 'Sin eventos anteriores' : 'Nada programado'}</h3><p>${A.anteriores ? '' : 'Agende una visita técnica previa o programe un trabajo.'}</p></div>`)
    + `<p style="margin-top:14px"><button class="chip" data-ag="anteriores">${A.anteriores ? 'Ver próximos' : 'Ver anteriores'}</button></p>`;
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#v-agenda') && !e.target.closest('[data-ag="nuevo"]')) return;
  const b = e.target.closest('[data-ag]');
  if (b) {
    const a = b.dataset.ag;
    if (a === 'mes') { const [y, m] = A.mes.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.d), 15); A.mes = iso(d).slice(0, 7); pintar(); return; }
    if (a === 'hoy') { A.mes = hoy().slice(0, 7); A.dia = hoy(); pintar(); return; }
    if (a === 'anteriores') { A.anteriores = !A.anteriores; pintar(); return; }
    if (a === 'nuevo') { e.stopPropagation(); nuevoEvento({ tipo: b.dataset.tipo, inicio: b.dataset.fecha }); return; }
  }
  const ev = e.target.closest('[data-ev]');
  if (ev && !e.target.closest('a')) { const v = A.eventos.find((x) => x.id === ev.dataset.ev); if (v) editar(v); return; }
  const dia = e.target.closest('[data-dia]');
  if (dia) { A.dia = dia.dataset.dia; $$('.cal .dia').forEach((x) => x.classList.toggle('sel', x === dia)); if (dia.classList.contains('fuera')) { A.mes = A.dia.slice(0, 7); pintar(); } else pintarDia(); }
});
document.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || !e.target.closest) return; const x = e.target.closest('#v-agenda [data-ev], #v-agenda [data-dia]'); if (x && x === e.target) { e.preventDefault(); x.click(); } });

/* ============================================================ crear y editar */
function nuevoEvento(p = {}) {
  if (U.esLector()) return;
  const tipo = p.tipo || 'VISITA', ini = p.inicio || (A.dia >= hoy() ? A.dia : hoy());
  const v = { id: '', tipo, estado: 'PROGRAMADO', titulo: p.titulo || (tipo === 'VISITA' ? 'Visita técnica previa' : tipo === 'TRABAJO' ? 'Inspección CCTV' : ''), cliente: p.cliente || '', cotId: p.cotId || '',
    lugar: p.lugar || '', inicio: ini, fin: tipo === 'TRABAJO' && p.jornadas ? finJornadas(ini, p.jornadas) : ini, hora: tipo === 'VISITA' ? '08:00' : '07:30', horaFin: '',
    responsables: '', contacto: p.contacto || '', telefono: p.telefono || '', notas: '',
    lista: (tipo === 'VISITA' ? LISTA_VISITA : tipo === 'TRABAJO' ? LISTA_TRABAJO : []).map((t) => ({ t, ok: false })), _jornadas: p.jornadas || null };
  if (!location.hash.startsWith('#agenda')) { A.pendiente = v; location.hash = 'agenda'; return; }
  editar(v);
}
HRMod.nuevoEvento = nuevoEvento;
const opt = (o, sel) => Object.entries(o).map(([k, l]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');
function editar(v0) {
  const v = JSON.parse(JSON.stringify(v0)), lector = U.esLector(), nuevo = !v.id;
  const cots = (HR.cotIndice ? HR.cotIndice() : []).filter((c) => c.estado !== 'NO_APROBADA' || c.id === v.cotId);
  const d = abrirModal(`<div class="mh"><h3>${nuevo ? (v.tipo === 'TRABAJO' ? 'Programar trabajo' : v.tipo === 'VISITA' ? 'Agendar visita previa' : 'Nuevo evento') : esc(TIPOS[v.tipo])}</h3><button class="btn xs fant" data-x="cerrar" aria-label="Cerrar">${ico('x')}</button></div>
    <div class="mb"><fieldset ${lector ? 'disabled' : ''} class="ev-f">
      <div class="chips seg ev-tipo">${Object.entries(TIPOS).map(([k, l]) => `<button type="button" class="chip${v.tipo === k ? ' on' : ''}" data-tipo="${k}">${l}</button>`).join('')}</div>
      <div class="frm">
        <label class="campo w4"><span>Título</span><input data-e="titulo" value="${esc(v.titulo)}" required></label>
        <label class="campo w2"><span>Cotización ligada (opcional)</span><select data-e="cotId"><option value="">— ninguna —</option>${cots.map((c) => `<option value="${esc(c.id)}"${c.id === v.cotId ? ' selected' : ''}>${esc(c.id + ' · ' + (c.cliente || ''))}</option>`).join('')}</select></label>
        <label class="campo w2"><span>Cliente</span><input data-e="cliente" value="${esc(v.cliente)}"></label>
        <label class="campo w4"><span>Lugar o dirección</span><input data-e="lugar" value="${esc(v.lugar)}" placeholder="Ej.: Conjunto Residencial La Aurora, Armenia"></label>
        <label class="campo"><span>Fecha${v.tipo === 'TRABAJO' ? ' de inicio' : ''}</span><input type="date" data-e="inicio" value="${esc(v.inicio)}"></label>
        <label class="campo ${v.tipo === 'TRABAJO' ? '' : 'hide'}" id="ev-finw"><span>Fecha final</span><input type="date" data-e="fin" value="${esc(v.fin)}"></label>
        <label class="campo"><span>Hora</span><input type="time" data-e="hora" value="${esc(v.hora)}"></label>
        <label class="campo"><span>Hasta (opcional)</span><input type="time" data-e="horaFin" value="${esc(v.horaFin)}"></label>
        <div class="campo w4 ev-jorn ${v.tipo === 'TRABAJO' ? '' : 'hide'}" id="ev-jorn"><span class="lb">Jornadas</span><div class="ev-jorn-f"><input data-j="1" inputmode="numeric" value="${esc(v._jornadas || '')}" placeholder="n.º" aria-label="Número de jornadas"><small>Calcula la fecha final sin domingos ni festivos.</small></div></div>
        <label class="campo"><span>Estado</span><select data-e="estado">${opt(ESTADOS, v.estado)}</select></label>
        <label class="campo"><span>Responsables</span><input data-e="responsables" value="${esc(v.responsables)}" placeholder="Operador, auxiliar…"></label>
        <label class="campo"><span>Contacto en sitio</span><input data-e="contacto" value="${esc(v.contacto)}"></label>
        <label class="campo"><span>Teléfono</span><input data-e="telefono" type="tel" value="${esc(v.telefono)}"></label>
        <label class="campo w4"><span>Notas</span><textarea data-e="notas" rows="2">${esc(v.notas)}</textarea></label></div>
      <div class="ev-lista"><div class="lb">Lista de verificación</div><div id="ev-items">${listaHTML(v)}</div>
        <div class="ev-add"><input id="ev-nuevo" placeholder="Agregar un punto…" aria-label="Nuevo punto de la lista"><button type="button" class="btn sm" data-x="add">${ico('mas')}</button></div></div>
      <div class="ev-cruce hide" id="ev-cruce"></div></fieldset>
      ${nuevo ? '' : `<div class="ev-ext"><a class="btn sm" target="_blank" rel="noopener" href="${esc(gcalUrl(v))}">${ico('cal')}Google Calendar</a><button type="button" class="btn sm" data-x="ics">${ico('cal')}Archivo .ics</button>${v.telefono ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(waUrl(v))}">${ico('wa')}WhatsApp al contacto</a>` : ''}</div>`}</div>
    <div class="mf">${nuevo || lector ? '' : `<button class="btn peligro" data-x="borrar">${ico('basura')}<span class="tx">Eliminar</span></button>`}<span style="flex:1"></span><button class="btn" data-x="cerrar">Cancelar</button>${lector ? '' : `<button class="btn pri" data-x="guardar">${nuevo ? 'Agendar' : 'Guardar'}</button>`}</div>`, true);
  d.classList.add('ev-modal');
  const leer = () => { $$('[data-e]', d).forEach((el) => { v[el.dataset.e] = el.value; }); if (v.tipo !== 'TRABAJO') v.fin = v.inicio; if (v.fin < v.inicio) v.fin = v.inicio; };
  const revisar = () => {
    leer(); const cr = cruces(v), box = $('#ev-cruce', d);
    box.classList.toggle('hide', !cr.length);
    box.innerHTML = cr.length ? `<b>Ojo:</b> ${v.tipo === 'TRABAJO' ? 'el equipo ya está programado' : 'ese día hay un trabajo programado'}: ${cr.map((x) => esc(`${x.titulo} (${fCorta(x.inicio)}${x.fin !== x.inicio ? '–' + fCorta(x.fin) : ''})`)).join(' · ')}.` : '';
    const fi = festivo(v.inicio); if (fi || dow(v.inicio) === 6) { box.classList.remove('hide'); box.innerHTML += `${cr.length ? '<br>' : ''}<b>${fi ? 'Festivo' : 'Domingo'}:</b> ${esc(fLarga(v.inicio))}${fi ? ' es ' + esc(fi) : ''}.`; }
  };
  d.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.j || (el.dataset.e === 'inicio' && v.tipo === 'TRABAJO')) { const n = parseInt($('[data-j]', d).value, 10); if (n > 0) { leer(); v.fin = finJornadas(v.inicio, n); $('[data-e="fin"]', d).value = v.fin; } }
    if (el.dataset.e === 'cotId' && el.value) {
      const c = cots.find((x) => x.id === el.value);
      if (c) { const cl = $('[data-e="cliente"]', d); if (!cl.value) cl.value = c.cliente || ''; const lu = $('[data-e="lugar"]', d); if (!lu.value) lu.value = [c.cliente, c.municipio].filter(Boolean).join(', '); }
    }
    if (el.dataset.ok != null) { const i = Number(el.dataset.ok); v.lista[i].ok = el.checked; }
    revisar();
  });
  d.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tipo]');
    if (t && t.closest('.ev-tipo')) {
      leer(); const antes = v.tipo; v.tipo = t.dataset.tipo; $$('.ev-tipo .chip', d).forEach((x) => x.classList.toggle('on', x === t));
      $('#ev-finw', d).classList.toggle('hide', v.tipo !== 'TRABAJO'); $('#ev-jorn', d).classList.toggle('hide', v.tipo !== 'TRABAJO');
      if (nuevo && antes !== v.tipo) {
        const ti = $('[data-e="titulo"]', d); ti.value = ti.value.replace(/^(Visita técnica previa|Inspección CCTV)/, v.tipo === 'VISITA' ? 'Visita técnica previa' : v.tipo === 'TRABAJO' ? 'Inspección CCTV' : '$1');
        if (!v.lista.some((x) => x.ok)) { v.lista = (v.tipo === 'VISITA' ? LISTA_VISITA : v.tipo === 'TRABAJO' ? LISTA_TRABAJO : []).map((x) => ({ t: x, ok: false })); $('#ev-items', d).innerHTML = listaHTML(v); }
      }
      revisar(); return;
    }
    const b = e.target.closest('[data-x]'); if (!b) return;
    const a = b.dataset.x;
    if (a === 'cerrar') return cerrarModal();
    if (a === 'add') { const i = $('#ev-nuevo', d); if (i.value.trim()) { v.lista.push({ t: i.value.trim(), ok: false }); i.value = ''; $('#ev-items', d).innerHTML = listaHTML(v); i.focus(); } return; }
    if (a === 'quitar') { v.lista.splice(Number(b.dataset.i), 1); $('#ev-items', d).innerHTML = listaHTML(v); return; }
    if (a === 'ics') { descargarIcs(v); return; }
    if (a === 'borrar') {
      cerrarModal();
      if (!(await confirmar('Eliminar evento', `Se elimina «${esc(v.titulo)}» de la agenda y del calendario de Google. Si solo se aplazó o se canceló, mejor cambie su estado.`, 'Eliminar', true))) return editar(v0);
      try { await HR.apiOk('agendaEliminar', { id: v.id }); A.eventos = A.eventos.filter((x) => x.id !== v.id); pintar(); HR.toast('Evento eliminado.', 'ok'); } catch (err) { HR.toast(esc(err.message), 'err'); }
      return;
    }
    if (a === 'guardar') {
      leer(); if (!v.titulo.trim()) { $('[data-e="titulo"]', d).focus(); return; }
      b.disabled = true; b.innerHTML = '<span class="spin mini"></span>Guardando';
      try {
        const env = Object.assign({}, v); delete env._jornadas;
        const r = await HR.api('agendaGuardar', { evento: env });
        if (!r.ok && r.codigo === 'CONFLICTO') { HR.toast(esc(r.error), 'err', 8000); await cargar(); cerrarModal(); pintar(); return; }
        if (!r.ok) throw new Error(r.error);
        const i = A.eventos.findIndex((x) => x.id === r.evento.id); if (i >= 0) A.eventos[i] = r.evento; else A.eventos.push(r.evento);
        cerrarModal(); A.dia = r.evento.inicio; A.mes = r.evento.inicio.slice(0, 7); pintar();
        const cr = cruces(r.evento);
        HR.toast(`${nuevo ? 'Agendado' : 'Guardado'}${r.calendario === 'ok' ? ' y copiado al calendario de Google' : ''}.${r.avisados ? ` Se avisó a ${r.avisados} persona${r.avisados === 1 ? '' : 's'}.` : ''}${cr.length ? ' <b>Revise el cruce con otros eventos.</b>' : ''}${r.calendario && r.calendario !== 'ok' ? '<br><small>Calendario de Google: ' + esc(r.calendario) + '</small>' : ''}`, cr.length || (r.calendario && r.calendario !== 'ok') ? 'err' : 'ok', 7000);
      } catch (err) { HR.toast(esc(err.message), 'err'); b.disabled = false; b.textContent = nuevo ? 'Agendar' : 'Guardar'; }
    }
  });
  $('#ev-nuevo', d).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); d.querySelector('[data-x="add"]').click(); } });
  revisar();
}
function listaHTML(v) {
  return (v.lista || []).map((x, i) => `<label class="ev-item"><input type="checkbox" data-ok="${i}" ${x.ok ? 'checked' : ''}><span>${esc(x.t)}</span><button type="button" class="btn xs fant" data-x="quitar" data-i="${i}" aria-label="Quitar">${ico('x')}</button></label>`).join('')
    || '<p class="mut" style="font-size:12.5px;margin:2px 0 8px">Sin puntos.</p>';
}

/* ============================================================ enlaces externos */
const compacto = (s) => s.replace(/-/g, '');
const horaMas = (h, min) => { const [a, b] = h.split(':').map(Number), t = a * 60 + b + min; return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
function detalle(v) {
  return [TIPOS[v.tipo] + ' · ' + ESTADOS[v.estado], v.cliente && 'Cliente: ' + v.cliente, v.cotId && 'Cotización: ' + v.cotId, v.contacto && 'Contacto: ' + v.contacto + (v.telefono ? ' · ' + v.telefono : ''),
    v.responsables && 'Responsables: ' + v.responsables, v.notas, (v.lista || []).length && 'Lista:\n' + v.lista.map((x) => (x.ok ? '☑ ' : '☐ ') + x.t).join('\n')].filter(Boolean).join('\n');
}
function rango(v) {
  if (v.inicio === v.fin && v.hora) { const hf = v.horaFin || horaMas(v.hora, v.tipo === 'VISITA' ? 120 : 480); return [compacto(v.inicio) + 'T' + v.hora.replace(':', '') + '00', compacto(v.inicio) + 'T' + hf.replace(':', '') + '00']; }
  return [compacto(v.inicio), compacto(mas(v.fin, 1))];
}
function gcalUrl(v) {
  const [a, b] = rango(v);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(v.titulo) + '&dates=' + a + '/' + b + '&ctz=America/Bogota&details=' + encodeURIComponent(detalle(v)) + '&location=' + encodeURIComponent(v.lugar || '');
}
function descargarIcs(v) {
  const [a, b] = rango(v), e = (s) => String(s || '').replace(/[\\;,]/g, (x) => '\\' + x).replace(/\n/g, '\\n');
  const dt = a.length > 8 ? `DTSTART;TZID=America/Bogota:${a}\r\nDTEND;TZID=America/Bogota:${b}` : `DTSTART;VALUE=DATE:${a}\r\nDTEND;VALUE=DATE:${b}`;
  const t = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HYDRO-ROV//Agenda//ES\r\nBEGIN:VEVENT\r\nUID:${v.id}@hydro-rov.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\r\n${dt}\r\nSUMMARY:${e(v.titulo)}\r\nLOCATION:${e(v.lugar)}\r\nDESCRIPTION:${e(detalle(v))}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([t], { type: 'text/calendar' })); a2.download = (v.titulo || 'evento').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) + '.ics';
  document.body.appendChild(a2); a2.click(); setTimeout(() => { URL.revokeObjectURL(a2.href); a2.remove(); }, 3000);
}
function waUrl(v) {
  let n = String(v.telefono || '').replace(/\D/g, ''); if (n.length === 10) n = '57' + n;
  const que = v.tipo === 'VISITA' ? 'la visita técnica previa' : v.tipo === 'TRABAJO' ? 'la inspección robotizada de la red' : v.titulo;
  const cuando = v.inicio === v.fin ? fLarga(v.inicio) : 'del ' + fLarga(v.inicio) + ' al ' + fLarga(v.fin);
  const txt = `Buen día${v.contacto ? ', ' + v.contacto.split(/\s+/)[0] : ''}. Le confirmamos ${que} de HYDRO-ROV ${v.inicio === v.fin ? 'el ' : ''}${cuando}${v.hora ? ' a las ' + v.hora : ''}${v.lugar ? ' en ' + v.lugar : ''}.`
    + (v.tipo === 'TRABAJO' ? ' Le agradecemos tener los accesos localizados y destapados, y las tuberías limpias para ese día.' : '') + ' Quedamos atentos.';
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(txt);
}

Object.assign(HRMod, { agenda, nuevoEvento, festivos, finJornadas, pascua });
})();
