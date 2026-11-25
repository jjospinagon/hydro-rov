/* HYDRO-ROV · página pública de verificación.
   Muestra la versión congelada del informe asociada al código del QR y compara la huella SHA-256 de un PDF o Word. */
'use strict';
(function () {
const C = window.HR_CONFIG || {}, K = window.HRC;
const { esc, nf, fFecha, GRADOS, COD, camOk, camTxt, perfilSVG } = K;
/* exportar.js (recorte de mapa) se apoya en window.HR */
window.HR = { C, camOk, camTxt, aGMS: K.aGMS, nf, esc, GRADOS, COD, fFecha, S: { fotos: {} } };
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const codigo = String(params.get('c') || '').trim().toUpperCase();
const fechaHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

async function api(action, data) {
  const r = await fetch(C.API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, credentials: 'omit', body: JSON.stringify(Object.assign({ action }, data)) });
  return r.json();
}
function formulario(msg) {
  $('#main').innerHTML = `${msg ? `<div class="estado no"><div class="ic">!</div><div><h1>Código no válido</h1><p>${esc(msg)}</p></div></div>` : ''}
    <div class="card"><h2>Verificar un informe de HYDRO-ROV</h2><p style="color:var(--mut)">Escanee el código QR del informe o escriba el código de verificación que aparece en la portada (formato XXXX-XXXX-XXXX).</p>
    <form class="buscar" id="f"><input id="c" maxlength="14" placeholder="XXXX-XXXX-XXXX" autocomplete="off" value="${esc(codigo)}" aria-label="Código de verificación"><button class="btn pri" type="submit">Verificar</button></form></div>`;
  $('#f').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#c').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length === 12) location.search = '?c=' + v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8); });
}
function kv(pares) {
  const p = pares.filter(([, v]) => v != null && v !== ''); let h = '';
  for (let i = 0; i < p.length; i += 2) h += `<tr><td>${esc(p[i][0])}</td><td>${esc(p[i][1])}</td>${p[i + 1] ? `<td>${esc(p[i + 1][0])}</td><td>${esc(p[i + 1][1])}</td>` : '<td></td><td></td>'}</tr>`;
  return h ? `<table class="kv">${h}</table>` : '';
}
const etq = (t) => (t.pozoIni || '¿?') + ' → ' + (t.pozoFin || '¿?');
const m = (v, u, d = 2) => (v == null || v === '' ? '' : nf(v, d) + ' ' + u);

function informeHTML(I) {
  const g = I.general || {}; let nF = 0;
  const firmas = (Array.isArray(I.firmas) ? I.firmas : []).filter((f) => f && (f.nombre || f.cargo));
  return `<div class="papel" id="papel">
    <div class="t1">INFORME TÉCNICO DE INSPECCIÓN CCTV DE REDES · ${esc(I.id)}</div>
    <h1>${esc(g.proyecto || 'Informe sin título')}</h1>
    <div style="color:var(--mut)">${esc([g.cliente, g.municipio, g.departamento].filter(Boolean).join(' · '))}</div>
    <h2>1. Información general</h2>
    ${kv([['Cliente', g.cliente], ['Contrato', g.contrato], ['Municipio', g.municipio], ['Departamento', g.departamento], ['Sector o dirección', g.sector], ['Tipo de inspección', g.tipo],
      ['Fecha de inspección', fFecha(g.fechaInspeccion)], ['Fecha del informe', fFecha(g.fechaInforme)], ['Equipo', g.equipo], ['Clima', g.clima], ['Limpieza previa', g.limpieza], ['Método de limpieza', g.metodoLimpieza],
      ['Operador', g.operador], ['Auxiliar de campo', g.auxiliar], ['Coordenadas', g.lat != null && g.lat !== '' ? camTxt({ lat: Number(g.lat), lon: Number(g.lon) }) : '']])}
    ${g.notasCampo ? `<p style="white-space:pre-wrap">${esc(g.notasCampo)}</p>` : ''}
    ${I.tramos.some((t) => camOk(t.cIni) || camOk(t.cFin)) ? '<h3>Localización de los tramos inspeccionados</h3><div class="mapa" data-mapa="todos">Cargando mapa…</div>' : ''}
    <h2>2. Alcance y metodología</h2>${I.alcance ? `<p style="white-space:pre-wrap">${esc(I.alcance)}</p>` : '<p style="color:var(--mut2)">—</p>'}
    <table style="max-width:320px"><tr><th>Grado</th><th>Severidad</th></tr>${GRADOS.slice(1).map((x) => `<tr><td><span class="g" style="background:${x.c}">${x.g}</span></td><td>${x.n}</td></tr>`).join('')}</table>
    <h2>3. Resultados por tramo</h2>
    ${I.tramos.map((t, ti) => `<h3>3.${ti + 1} Tramo ${esc(etq(t))}</h3>
      ${kv([['Sentido', t.sentido], ['Tipo de red', t.red], ['Material', t.material], ['Diámetro nominal', m(t.diametro, 'mm', 0)], ['Longitud del tramo', m(t.longitud, 'm')], ['Longitud inspeccionada', m(t.inspeccionada, 'm')],
        ['Profundidad pozo inicial', m(t.profIni, 'm')], ['Profundidad pozo final', m(t.profFin, 'm')], ['Ubicación', t.ubicacion], ['Cámara inicial', camTxt(t.cIni)], ['Cámara final', camTxt(t.cFin)],
        ['Fecha', fFecha(t.fecha)], ['Condición general', t.condicion], ['Fin anticipado', t.finAnticipado]])}
      ${camOk(t.cIni) || camOk(t.cFin) ? `<div class="mapa" data-mapa="${ti}">Cargando mapa…</div>` : ''}
      <div class="perfil">${perfilSVG(t, { claro: true })}</div>
      ${t.obs.length ? `<table><tr><th>#</th><th>Dist. (m)</th><th>Código</th><th>Descripción</th><th>Hora</th><th>Grado</th></tr>${t.obs.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(nf(o.dist))}${o.distFin != null ? ' – ' + esc(nf(o.distFin)) : ''}</td><td><b>${esc(o.codigo || '')}</b>${COD[o.codigo] ? '<br><span style="color:var(--mut)">' + esc(COD[o.codigo].n) + '</span>' : ''}</td><td>${esc(o.desc || '')}</td><td>${o.hIni ? esc(o.hIni + (o.hFin ? ' a ' + o.hFin : '')) : ''}</td><td>${o.grado ? `<span class="g" style="background:${GRADOS[o.grado].c}">${o.grado}</span>` : '—'}</td></tr>`).join('')}</table>` : '<p style="color:var(--mut2)">Sin observaciones registradas en el tramo.</p>'}
      ${t.obs.some((o) => o.foto && o.foto.id) ? `<div class="fotos">${t.obs.map((o, i) => (o.foto && o.foto.id ? `<figure><div class="sin" data-foto="${esc(o.foto.id)}">Cargando foto…</div><figcaption><b>Foto ${++nF}</b> · Obs. ${i + 1}${o.dist != null ? ' · ' + esc(nf(o.dist)) + ' m' : ''}${o.codigo ? ' · ' + esc(o.codigo) : ''}${o.grado ? ' · Grado ' + o.grado : ''}${o.desc ? '<br>' + esc(o.desc) : ''}</figcaption></figure>` : '')).join('')}</div>` : ''}
      ${t.conclusion ? `<p><b>Conclusión del tramo.</b> ${esc(t.conclusion)}</p>` : ''}${t.recomendacion ? `<p><b>Recomendación.</b> ${esc(t.recomendacion)}</p>` : ''}`).join('')}
    <h2>4. Conclusiones</h2><p style="white-space:pre-wrap">${esc(I.conclusiones || '—')}</p>
    <h2>5. Recomendaciones</h2><p style="white-space:pre-wrap">${esc(I.recomendaciones || '—')}</p>
    ${I.anexos ? `<h2>6. Anexos</h2><p style="white-space:pre-wrap">${esc(I.anexos)}</p>` : ''}
    ${firmas.length ? `<div class="firmas">${firmas.map((f) => `<div><div class="rl">${esc(f.rol || '')}</div><div class="ln"><b>${esc(f.nombre || ' ')}</b><br><span style="color:var(--mut)">${esc([f.cargo, f.matricula ? 'M.P. ' + f.matricula : ''].filter(Boolean).join(' · '))}</span></div></div>`).join('')}</div>` : ''}
  </div>`;
}

async function cargarMapas(I) {
  for (const el of document.querySelectorAll('[data-mapa]')) {
    try {
      const k = el.dataset.mapa, foco = k === 'todos' ? I.tramos.filter((t) => camOk(t.cIni) || camOk(t.cFin)) : [I.tramos[Number(k)]];
      const r = await window.HRExport.mapaPNG(foco, I.tramos);
      el.innerHTML = r ? `<img src="${r.url}" alt="Mapa de localización">` : '';
    } catch (e) { el.textContent = 'Mapa no disponible.'; }
  }
}
async function cargarFotos(I) {
  const ids = [...new Set([...document.querySelectorAll('[data-foto]')].map((x) => x.dataset.foto))];
  for (let i = 0; i < ids.length; i += 6) {
    try {
      const r = await api('verificarFotos', { c: codigo, ids: ids.slice(i, i + 6) });
      Object.entries((r && r.fotos) || {}).forEach(([id, src]) => document.querySelectorAll(`[data-foto="${id}"]`).forEach((el) => { const im = document.createElement('img'); im.src = src; im.alt = ''; el.replaceWith(im); }));
    } catch (e) { /* se queda el aviso */ }
  }
  document.querySelectorAll('[data-foto]').forEach((el) => { el.textContent = 'Foto no disponible'; });
}
async function huella(file) { const b = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }

async function main() {
  $('#correo').textContent = C.CORREO || '';
  if (!C.API) { $('#main').innerHTML = '<div class="estado no"><div class="ic">!</div><div><h1>Servicio no disponible</h1></div></div>'; return; }
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo)) { formulario(codigo ? 'El código no tiene el formato XXXX-XXXX-XXXX.' : ''); return; }
  let r;
  try { r = await api('verificar', { c: codigo }); } catch (e) { $('#main').innerHTML = '<div class="estado no"><div class="ic">!</div><div><h1>No se pudo consultar</h1><p>Revise su conexión e intente de nuevo.</p></div></div>'; return; }
  if (!r.ok) { formulario(r.error || 'Este código no corresponde a ningún informe emitido por HYDRO-ROV.'); return; }
  const em = r.emision;
  const datos = `<div class="datos"><div><span>Código</span><b class="mono">${esc(em.codigo)}</b></div><div><span>Informe</span><b class="mono">${esc(em.id)} · rev. ${esc(em.rev)}</b></div><div><span>Emitido</span><b>${esc(fechaHora(em.fecha))}</b></div>
    <div style="grid-column:span 2"><span>Proyecto</span><b>${esc(em.titulo || '—')}</b></div><div><span>Emitido por</span><b>${esc(em.por || '')}</b></div></div>`;
  if (em.anulado) {
    $('#main').innerHTML = `<div class="estado anulado"><div class="ic">✕</div><div><h1>Documento anulado</h1><p>HYDRO-ROV emitió este informe, pero fue anulado el ${esc(fechaHora(em.anuladoFecha))}${em.anuladoMotivo ? ' (' + esc(em.anuladoMotivo) + ')' : ''}. No tiene validez.</p>${datos}</div></div>`;
    return;
  }
  document.title = em.id + ' · Verificación HYDRO-ROV';
  const h = em.huellas || {};
  $('#main').innerHTML = `<div class="estado ok"><div class="ic">✓</div><div><h1>Documento auténtico emitido por HYDRO-ROV</h1><p>El código corresponde a un informe registrado. Abajo se muestra su contenido tal como fue emitido.</p>${datos}</div></div>
    ${em.posterior ? '<div class="aviso">Este informe tiene una revisión más reciente. El código certifica la versión emitida en la fecha indicada, que es la que se muestra en esta página.</div>' : ''}
    <div class="card no-print"><h2>Comprobar el archivo recibido</h2><p style="color:var(--mut);margin-bottom:10px">Arrastre aquí el PDF o el Word que le entregaron. Se compara su huella digital con la del archivo emitido; si alguien lo modificó, no coincidirá. El archivo no sale de su equipo.</p>
      <label class="soltar" id="soltar"><input type="file" id="arch" accept=".pdf,.docx" hidden>Seleccionar o soltar el archivo</label><div id="res"></div></div>
    ${informeHTML(r.informe)}`;
  $('#imprimir').hidden = false; $('#imprimir').onclick = () => window.print();
  const comprobar = async (f) => {
    if (!f) return;
    const hx = await huella(f), fmt = /\.docx$/i.test(f.name) ? 'docx' : 'pdf', ref = h[fmt];
    $('#res').innerHTML = !ref ? `<div class="res no">Para esta emisión no hay registro de un archivo ${fmt === 'pdf' ? 'PDF' : 'Word'} con el cual comparar.</div>`
      : hx === ref ? `<div class="res ok"><b>✓ El archivo coincide exactamente con el emitido por HYDRO-ROV.</b><br><code>SHA-256 ${hx}</code></div>`
        : `<div class="res no"><b>✕ El archivo no coincide con el emitido.</b> Pudo haber sido modificado después de su emisión, o corresponde a otra versión. Pida el original a HYDRO-ROV.<br><code>Archivo: ${hx}<br>Emitido: ${ref}</code></div>`;
  };
  const so = $('#soltar');
  $('#arch').addEventListener('change', (e) => comprobar(e.target.files[0]));
  so.addEventListener('dragover', (e) => { e.preventDefault(); so.classList.add('sobre'); });
  so.addEventListener('dragleave', () => so.classList.remove('sobre'));
  so.addEventListener('drop', (e) => { e.preventDefault(); so.classList.remove('sobre'); comprobar(e.dataTransfer.files[0]); });
  cargarFotos(r.informe); cargarMapas(r.informe);
}
window.addEventListener('DOMContentLoaded', main);
})();
