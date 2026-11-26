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
/* ---------- entrada: código o archivo ---------- */
const ICO_DOC = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14l2 2 4-4"/></svg>';
function zonaArchivo(id) {
  return `<label class="soltar" id="${id}"><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
    <span class="si">${ICO_DOC}</span><b>Seleccione o suelte aquí el PDF o el Word</b><span class="sm">El archivo se analiza en su equipo; no se envía a ningún servidor.</span></label>`;
}
function conectarZona(id, fn) {
  const so = $('#' + id); if (!so) return;
  so.querySelector('input').addEventListener('change', (e) => fn(e.target.files[0]));
  so.addEventListener('dragover', (e) => { e.preventDefault(); so.classList.add('sobre'); });
  so.addEventListener('dragleave', () => so.classList.remove('sobre'));
  so.addEventListener('drop', (e) => { e.preventDefault(); so.classList.remove('sobre'); fn(e.dataTransfer.files[0]); });
}
function formulario(msg) {
  $('#main').innerHTML = `${msg ? `<div class="estado no"><div class="ic">!</div><div><h1>No se pudo verificar</h1><p>${esc(msg)}</p></div></div>` : ''}
    <div class="intro"><h1>Verificar un informe de <span style="white-space:nowrap">HYDRO-ROV</span></h1><p>Compruebe que el informe que recibió fue emitido por HYDRO-ROV y que nadie lo modificó después.</p></div>
    <div class="dos">
      <div class="card"><span class="paso">Opción 1</span><h2>Cargar el archivo recibido</h2><p class="mut">Se calcula la huella digital del PDF o Word y se compara con el registro de archivos emitidos. Si alguien cambió una sola letra, no coincide.</p>
        ${zonaArchivo('soltar')}<div id="res"></div></div>
      <div class="card"><span class="paso">Opción 2</span><h2>Escribir el código de verificación</h2><p class="mut">Está en la portada del informe y al pie de cada página, con el formato XXXX-XXXX-XXXX. También puede escanear el código QR con la cámara del celular.</p>
        <form class="buscar" id="f"><input id="c" maxlength="14" placeholder="XXXX-XXXX-XXXX" autocomplete="off" value="${esc(codigo)}" aria-label="Código de verificación"><button class="btn pri" type="submit">Verificar</button></form></div>
    </div>`;
  $('#f').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#c').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length === 12) location.search = '?c=' + v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8); else $('#c').focus(); });
  conectarZona('soltar', porArchivo);
}

/* ---------- lectura del código dentro del archivo (para identificar un archivo modificado) ---------- */
const RE_COD = /\b([A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4})\b/;
const latin1 = (u8) => { let t = ''; for (let i = 0; i < u8.length; i += 32768) t += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return t; };
async function inflar(u8, modo) {
  try { const ds = new DecompressionStream(modo); const w = ds.writable.getWriter(); w.write(u8).catch(() => {}); w.close().catch(() => {}); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); } catch (e) { return null; }
}
function buscarCodigo(t) {
  const m1 = /(?:Verificaci\S{1,6}n|C\S{1,6}digo|[?&]c=)\s*([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/.exec(t); if (m1 && RE_COD.test(m1[1])) return m1[1];
  const m2 = RE_COD.exec(t); return m2 ? m2[1] : null;
}
async function codigoEnPDF(u8) {
  const t = latin1(u8); let c = buscarCodigo(t); if (c) return c;
  const re = /stream\r?\n/g; let m, n = 0;
  while ((m = re.exec(t)) && n++ < 400) {
    const ini = m.index + m[0].length; let fin = t.indexOf('endstream', ini); if (fin < 0) break;
    let f2 = fin; while (f2 > ini && (t.charCodeAt(f2 - 1) === 10 || t.charCodeAt(f2 - 1) === 13)) f2--;
    if (/DCTDecode|JPXDecode/.test(t.slice(Math.max(0, m.index - 300), m.index))) { re.lastIndex = fin; continue; }
    const out = await inflar(u8.subarray(ini, f2), 'deflate');
    if (out && out.length < 4e6) { c = buscarCodigo(latin1(out).replace(/\\\d{3}/g, ' ')); if (c) return c; }
    re.lastIndex = fin;
  }
  return null;
}
async function codigoEnDOCX(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let fin = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  let p = dv.getUint32(fin + 16, true); const n = dv.getUint16(fin + 10, true), dec = new TextDecoder();
  for (let k = 0; k < n && p + 46 <= u8.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const met = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nombre = dec.decode(u8.subarray(p + 46, p + 46 + ln)); p += 46 + ln + le + lc;
    if (!/^word\/(document|footer\d*|header\d*)\.xml$/.test(nombre)) continue;
    const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), datos = u8.subarray(ini, ini + tam);
    const xml = met === 0 ? datos : await inflar(datos, 'deflate-raw'); if (!xml) continue;
    const c = buscarCodigo(dec.decode(xml).replace(/<[^>]+>/g, '')); if (c) return c;
  }
  return null;
}
async function codigoEnArchivo(file) {
  const u8 = new Uint8Array(await file.arrayBuffer());
  if (u8[0] === 0x25 && u8[1] === 0x50) return codigoEnPDF(u8);       // %P(DF)
  if (u8[0] === 0x50 && u8[1] === 0x4b) return codigoEnDOCX(u8);       // PK (zip)
  return null;
}
const tipoArchivo = (f) => (/\.docx$/i.test(f.name) ? 'Word' : 'PDF');

async function porArchivo(f) {
  if (!f) return;
  if (!/\.(pdf|docx)$/i.test(f.name)) { $('#res').innerHTML = '<div class="res no">Cargue el informe en PDF o en Word (.docx).</div>'; return; }
  $('#res').innerHTML = '<div class="res"><span class="spin chico"></span> Analizando el archivo…</div>';
  try {
    const hx = await huella(f);
    const r = await api('verificarHuella', { h: hx });
    if (r.ok) { history.replaceState(null, '', location.pathname + '?c=' + r.codigo); return mostrar(r.codigo, { nombre: f.name, tipo: tipoArchivo(f), hx, coincide: true }); }
    const cod = await codigoEnArchivo(f);
    if (cod) {
      const v = await api('verificar', { c: cod });
      if (v.ok) { history.replaceState(null, '', location.pathname + '?c=' + cod); return mostrar(cod, { nombre: f.name, tipo: tipoArchivo(f), hx, coincide: false }, v); }
    }
    $('#res').innerHTML = `<div class="res no"><b>✕ Este archivo no corresponde a ningún informe emitido por HYDRO-ROV.</b><br>
      ${cod ? `El archivo menciona el código <b class="mono">${esc(cod)}</b>, pero ese código no está registrado.` : 'No coincide con ningún archivo emitido y no se encontró en él un código de verificación válido.'}
      Si es una copia modificada, pida el original a HYDRO-ROV${C.CORREO ? ' (' + esc(C.CORREO) + ')' : ''}.<br><code>SHA-256 ${hx}</code></div>`;
  } catch (e) { $('#res').innerHTML = '<div class="res no">No se pudo analizar el archivo. Revise su conexión e intente de nuevo.</div>'; }
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
  mostrar(codigo, null);
}

/* arch: resultado de un archivo cargado ({nombre, tipo, hx, coincide}) o null si se llegó por el código */
async function mostrar(cod, arch, pre) {
  window.scrollTo(0, 0);
  if (!pre) $('#main').innerHTML = '<div class="cargando"><div class="spin"></div><p>Consultando el registro de informes emitidos…</p></div>';
  let r = pre;
  if (!r) {
    try { r = await api('verificar', { c: cod }); } catch (e) { $('#main').innerHTML = '<div class="estado no"><div class="ic">!</div><div><h1>No se pudo consultar</h1><p>Revise su conexión e intente de nuevo.</p></div></div>'; return; }
  }
  if (!r.ok) { formulario(r.error || 'Este código no corresponde a ningún informe emitido por HYDRO-ROV.'); return; }
  const em = r.emision, otro = '<p class="otro no-print"><a href="${location.pathname}">← Verificar otro informe</a></p>';
  const datos = `<div class="datos"><div><span>Código</span><b class="mono">${esc(em.codigo)}</b></div><div><span>Informe</span><b class="mono">${esc(em.id)} · rev. ${esc(em.rev)}</b></div><div><span>Emitido</span><b>${esc(fechaHora(em.fecha))}</b></div>
    <div style="grid-column:span 2"><span>Proyecto</span><b>${esc(em.titulo || '—')}</b></div><div><span>Emitido por</span><b>${esc(em.por || '')}</b></div></div>`;
  if (em.anulado) {
    $('#main').innerHTML = `${otro}<div class="estado anulado"><div class="ic">✕</div><div><h1>Documento anulado</h1><p>HYDRO-ROV emitió este informe, pero fue anulado el ${esc(fechaHora(em.anuladoFecha))}${em.anuladoMotivo ? ' (' + esc(em.anuladoMotivo) + ')' : ''}. No tiene validez.</p>${datos}</div></div>`;
    return;
  }
  document.title = em.id + ' · Verificación HYDRO-ROV';
  const h = em.huellas || {}, lista = (f) => (Array.isArray(h[f]) ? h[f] : h[f] ? [h[f]] : []);
  let cabeza;
  if (arch && arch.coincide) {
    cabeza = `<div class="estado ok"><div class="ic">✓</div><div><h1>Archivo auténtico y sin modificaciones</h1><p>El ${esc(arch.tipo)} «${esc(arch.nombre)}» coincide exactamente con el archivo emitido por HYDRO-ROV. Abajo se muestra su contenido tal como fue emitido.</p>${datos}</div></div>`;
  } else if (arch) {
    cabeza = `<div class="estado no"><div class="ic">!</div><div><h1>El archivo fue modificado</h1><p>El ${esc(arch.tipo)} «${esc(arch.nombre)}» dice corresponder al informe ${esc(em.id)} (código ${esc(em.codigo)}), pero su contenido <b>no coincide</b> con ninguno de los archivos que HYDRO-ROV emitió con ese código: alguien lo cambió después de su emisión. Abajo se muestra el informe original; compárelo con el que recibió y pida el original a HYDRO-ROV.</p>${datos}</div></div>`;
  } else {
    cabeza = `<div class="estado ok"><div class="ic">✓</div><div><h1>Código auténtico emitido por HYDRO-ROV</h1><p>El código corresponde a un informe registrado. Abajo se muestra su contenido tal como fue emitido. Para comprobar que el archivo que recibió no fue modificado, cárguelo aquí abajo.</p>${datos}</div></div>`;
  }
  $('#main').innerHTML = `${otro}${cabeza}
    ${em.posterior ? '<div class="aviso">Este informe tiene una revisión más reciente. El código certifica la versión emitida en la fecha indicada, que es la que se muestra en esta página.</div>' : ''}
    ${arch && arch.coincide ? '' : `<div class="card no-print"><h2>${arch ? 'Comprobar otro archivo' : 'Comprobar el archivo recibido'}</h2><p class="mut">Cargue el PDF o el Word que le entregaron. Se compara su huella digital con la de los archivos emitidos con este código; si alguien lo modificó, no coincidirá.</p>
      ${zonaArchivo('soltar')}<div id="res"></div></div>`}
    ${informeHTML(r.informe)}`;
  $('#imprimir').hidden = false; $('#imprimir').onclick = () => window.print();
  conectarZona('soltar', async (f) => {
    if (!f) return;
    const hx = await huella(f), fmt = /\.docx$/i.test(f.name) ? 'docx' : 'pdf';
    if (lista(fmt).indexOf(hx) >= 0) return mostrar(cod, { nombre: f.name, tipo: tipoArchivo(f), hx, coincide: true }, r);
    const ajeno = await api('verificarHuella', { h: hx }).catch(() => ({}));
    if (ajeno.ok && ajeno.codigo !== cod) { $('#res').innerHTML = `<div class="res no"><b>Este archivo pertenece a otro informe emitido (código ${esc(ajeno.codigo)}).</b> <a href="${location.pathname}?c=${esc(ajeno.codigo)}">Ver ese informe</a>.</div>`; return; }
    mostrar(cod, { nombre: f.name, tipo: tipoArchivo(f), hx, coincide: false }, r);
  });
  cargarFotos(r.informe); cargarMapas(r.informe);
}
window.addEventListener('DOMContentLoaded', main);
})();
