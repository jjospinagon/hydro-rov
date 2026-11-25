/* HYDRO-ROV · Análisis — exportación del informe a PDF (jsPDF) y Word (docx).
   Las librerías se cargan solo al exportar. Cada archivo se descarga y queda guardado en Drive (carpeta «exportados»). */
'use strict';
(function () {
const HR = window.HR;
const NAVY = [10, 42, 74], CYAN = [54, 181, 214], TX = [29, 36, 48], MUT = [107, 118, 132], LINEA = [227, 232, 238], SUAVE = [244, 247, 250];
const libs = {};
function cargar(src) {
  if (libs[src]) return libs[src];
  libs[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  return libs[src];
}
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const txtPDF = (s) => String(s == null ? '' : s).replace(/→/g, '–').replace(/[^\u0000-ÿ–—‘’“”•…€]/g, '');
const nombreArchivo = (I, ext) => {
  let p = String(I.general.proyecto || 'sin título').replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (p.length > 70) p = p.slice(0, 70).replace(/[\s,.;:-]+\S*$/, '');
  return I.id + ' Informe de inspección - ' + p + '.' + ext;
};
const etq = (t) => (t.pozoIni || '¿?') + ' → ' + (t.pozoFin || '¿?');
const m = (v, u, d = 2) => (v == null || v === '' ? '' : HR.nf(v, d) + (u ? ' ' + u : ''));

function cargarImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagen no válida')); i.src = src; }); }
async function logoPNG() {
  try { await document.fonts.load('700 120px "Barlow Condensed"'); } catch (e) { /* fuente del sistema */ }
  const c = document.createElement('canvas'); c.width = 820; c.height = 160; const x = c.getContext('2d');
  const r = 30; x.fillStyle = '#0A2A4A'; x.beginPath(); x.moveTo(r, 0); x.arcTo(160, 0, 160, 160, r); x.arcTo(160, 160, 0, 160, r); x.arcTo(0, 160, 0, 0, r); x.arcTo(0, 0, 160, 0, r); x.fill();
  x.strokeStyle = '#36B5D6'; x.lineWidth = 15; x.beginPath(); x.arc(80, 80, 47.5, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 12.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(42.5, 100); x.quadraticCurveTo(80, 82.5, 117.5, 100); x.stroke();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(80, 72.5, 12.5, 0, Math.PI * 2); x.fill();
  x.font = '700 128px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; x.textBaseline = 'middle';
  x.fillStyle = '#36B5D6'; x.fillText('HYDRO', 190, 86); const w = x.measureText('HYDRO').width;
  x.fillStyle = '#0A2A4A'; x.fillText('-ROV', 190 + w, 86);
  const w2 = 190 + w + x.measureText('-ROV').width + 8;
  const c2 = document.createElement('canvas'); c2.width = Math.ceil(w2); c2.height = 160; c2.getContext('2d').drawImage(c, 0, 0);
  return { url: c2.toDataURL('image/png'), w: c2.width, h: 160 };
}
async function perfilPNG(t) {
  const svg = HR.perfilSVG(t, { claro: true, fuente: 'Arial, Helvetica, sans-serif' });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await cargarImg(url), c = document.createElement('canvas'); c.width = 2000; c.height = 400;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return { url: c.toDataURL('image/png'), w: 2000, h: 400 };
  } finally { URL.revokeObjectURL(url); }
}
async function prepararFotos(I, p) {
  const ids = []; I.tramos.forEach((t) => t.obs.forEach((o) => { if (o.foto && o.foto.id) ids.push(o.foto.id); }));
  const falt = ids.filter((x) => !HR.S.fotos[x]);
  if (falt.length) { p.set(0.1, `Trayendo ${falt.length} fotos desde Drive…`); await HR.asegurarFotos(falt); }
  const dims = {};
  for (const id of ids) { const src = HR.S.fotos[id]; if (src) { try { const im = await cargarImg(src); dims[id] = { w: im.naturalWidth, h: im.naturalHeight }; } catch (e) { /* sin foto */ } } }
  return dims;
}
const fotoDe = (o) => (o.foto && (HR.S.fotos[o.foto.id] || HR.S.fotos[o.foto.k])) || null;
function b64aU8(dataUrl) { const b = atob(dataUrl.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function blobB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }
async function entregar(I, blob, fmt, op, p) {
  const nombre = nombreArchivo(I, fmt);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  if (!op.subir) { HR.toast('Archivo descargado.', 'ok'); return; }
  p.set(0.92, 'Guardando una copia en Drive…');
  try {
    const r = await HR.apiOk('subirExport', { id: I.id, formato: fmt, nombre, b64: await blobB64(blob) }, { timeout: 240000 });
    HR.toast(`${fmt === 'pdf' ? 'PDF' : 'Word'} descargado y guardado en Drive · <a href="${HR.esc(r.url)}" target="_blank" rel="noopener">abrir</a>`, 'ok', 9000);
  } catch (e) { HR.toast('Se descargó, pero no se guardó la copia en Drive: ' + HR.esc(e.message), 'err', 9000); }
}
function datosGenerales(g) {
  return [['Cliente', g.cliente], ['Contrato', g.contrato], ['Municipio', g.municipio], ['Departamento', g.departamento], ['Sector o dirección', g.sector], ['Tipo de inspección', g.tipo],
    ['Fecha de inspección', HR.fFecha(g.fechaInspeccion)], ['Fecha del informe', HR.fFecha(g.fechaInforme)], ['Equipo', g.equipo], ['Clima', g.clima],
    ['Limpieza previa', g.limpieza], ['Método de limpieza', g.metodoLimpieza], ['Operador', g.operador], ['Auxiliar de campo', g.auxiliar], ['Coordenadas', g.lat != null && g.lat !== '' ? HR.camTxt({ lat: Number(g.lat), lon: Number(g.lon) }) : '']].filter(([, v]) => v);
}
function datosTramo(t) {
  return [['Sentido', t.sentido], ['Tipo de red', t.red], ['Material', t.material], ['Diámetro nominal', m(t.diametro, 'mm', 0)], ['Longitud del tramo', m(t.longitud, 'm')], ['Longitud inspeccionada', m(t.inspeccionada, 'm')],
    ['Profundidad pozo inicial', m(t.profIni, 'm')], ['Profundidad pozo final', m(t.profFin, 'm')], ['Ubicación', t.ubicacion], ['Cámara inicial', HR.camTxt(t.cIni)], ['Cámara final', HR.camTxt(t.cFin)], ['Fecha', HR.fFecha(t.fecha)],
    ['Condición general', t.condicion], ['Video', t.video ? t.video.nombre : ''], ['Fin anticipado', t.finAnticipado]].filter(([, v]) => v);
}
const firmasDe = (I) => {
  const F = Array.isArray(I.firmas) ? I.firmas : [{ rol: 'Elaboró', nombre: I.general.responsable, cargo: 'Ingeniero responsable', matricula: I.general.matricula }, { rol: 'Revisó', nombre: I.general.reviso, cargo: '' }];
  return F.filter((f) => f && (f.nombre || f.cargo)).map((f) => ({ rol: f.rol || '', nombre: f.nombre || '', det: [f.cargo, f.matricula ? 'M.P. ' + f.matricula : ''].filter(Boolean).join(' · ') }));
};
const pares4 = (a) => { const r = []; for (let i = 0; i < a.length; i += 2) r.push([a[i][0], a[i][1], a[i + 1] ? a[i + 1][0] : '', a[i + 1] ? a[i + 1][1] : '']); return r; };
const leyendaFoto = (o, i, n) => `Foto ${n} · Obs. ${i + 1}${o.dist != null ? ' · ' + HR.nf(o.dist) + ' m' : ''}${o.codigo ? ' · ' + o.codigo + (HR.COD[o.codigo] ? ' ' + HR.COD[o.codigo].n.toLowerCase() : '') : ''}${o.grado ? ' · Grado ' + o.grado : ''}`;


/* Recorte de mapa (OpenStreetMap) con los tramos dibujados. `foco`: tramos a resaltar; `todos`: el resto se dibuja en gris. */
const lon2x = (lon, z) => ((lon + 180) / 360) * 256 * Math.pow(2, z);
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * Math.pow(2, z); };
function cargarTesela(url) {
  return new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; const to = setTimeout(() => res(null), 9000); i.onload = () => { clearTimeout(to); res(i); }; i.onerror = () => { clearTimeout(to); res(null); }; i.src = url; });
}
async function mapaPNG(foco, todos, op = {}) {
  const W = op.w || 1400, H = op.h || 560, PAD = 90;
  const cams = (t) => [t.cIni, t.cFin].filter(HR.camOk);
  const pts = []; foco.forEach((t) => cams(t).forEach((c) => pts.push([c.lat, c.lon])));
  if (!pts.length) return null;
  let z = 18;
  if (pts.length > 1) {
    for (z = 19; z > 3; z--) {
      const xs = pts.map((p) => lon2x(p[1], z)), ys = pts.map((p) => lat2y(p[0], z));
      if (Math.max(...xs) - Math.min(...xs) <= W - 2 * PAD && Math.max(...ys) - Math.min(...ys) <= H - 2 * PAD) break;
    }
  }
  z = Math.min(z, 19);
  /* tramos cortos: más allá del zoom 19 se amplían las teselas (hasta 3×) para que el tramo se lea bien */
  let sc = 1;
  { const bx = pts.map((p) => lon2x(p[1], z)), by = pts.map((p) => lat2y(p[0], z)), bw = Math.max(...bx) - Math.min(...bx), bh = Math.max(...by) - Math.min(...by);
    if (z === 19 || pts.length === 1) sc = Math.max(1, Math.min(3, pts.length === 1 ? 1.6 : Math.min((W - 2 * PAD) / Math.max(bw, 1), (H - 2 * PAD) / Math.max(bh, 1)))); }
  const X = (lon) => lon2x(lon, z) * sc, Y = (lat) => lat2y(lat, z) * sc, T = 256 * sc;
  const xs = pts.map((p) => X(p[1])), ys = pts.map((p) => Y(p[0]));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, x0 = cx - W / 2, y0 = cy - H / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#eef2f5'; g.fillRect(0, 0, W, H);
  const n = Math.pow(2, z), tareas = [];
  for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + W - 1) / T); tx++) {
    for (let ty = Math.floor(y0 / T); ty <= Math.floor((y0 + H - 1) / T); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      tareas.push(cargarTesela(`https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`).then((im) => ({ im, dx: tx * T - x0, dy: ty * T - y0 })));
    }
  }
  const teselas = await Promise.all(tareas); let base = 0;
  g.imageSmoothingQuality = 'high'; teselas.forEach(({ im, dx, dy }) => { if (im) { g.drawImage(im, dx, dy, T + 0.5, T + 0.5); base++; } });
  if (!base) { g.fillStyle = '#6b7684'; g.font = '20px Arial'; g.fillText('Mapa base no disponible (sin conexión con OpenStreetMap)', 24, H - 24); }
  const P = (cm) => [X(cm.lon) - x0, Y(cm.lat) - y0];
  const linea = (t, col, ancho, borde) => {
    if (!HR.camOk(t.cIni) || !HR.camOk(t.cFin)) return;
    const [ax, ay] = P(t.cIni), [bx, by] = P(t.cFin);
    g.lineCap = 'round';
    if (borde) { g.strokeStyle = '#0A2A4A'; g.lineWidth = ancho + 6; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = ancho; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (borde) { /* flecha del sentido de la inspección (de la cámara inicial a la final) */
      const mx = (ax + bx) / 2, my = (ay + by) / 2, an = Math.atan2(by - ay, bx - ax), h = 16;
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(mx + h * Math.cos(an), my + h * Math.sin(an));
      g.lineTo(mx + h * Math.cos(an + 2.5), my + h * Math.sin(an + 2.5)); g.lineTo(mx + h * Math.cos(an - 2.5), my + h * Math.sin(an - 2.5)); g.closePath(); g.fill();
    }
  };
  (todos || []).forEach((t) => { if (foco.indexOf(t) < 0) linea(t, 'rgba(90,100,115,.85)', 6, false); });
  foco.forEach((t) => linea(t, '#36B5D6', 9, true));
  const rotulos = new Map();
  foco.forEach((t) => [[t.cIni, t.pozoIni || 'Inicial'], [t.cFin, t.pozoFin || 'Final']].forEach(([cm, nom]) => { if (HR.camOk(cm)) rotulos.set(cm.lat.toFixed(6) + cm.lon.toFixed(6), [cm, nom]); }));
  g.textBaseline = 'middle';
  rotulos.forEach(([cm, nom]) => {
    const [x, y] = P(cm);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#0A2A4A'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.stroke();
    g.font = '700 22px Arial, Helvetica, sans-serif'; const w = g.measureText(nom).width + 20;
    const lx = Math.min(Math.max(x - w / 2, 6), W - w - 6), ly = y - 50;
    g.fillStyle = '#0A2A4A'; g.beginPath(); if (g.roundRect) g.roundRect(lx, ly, w, 32, 6); else g.rect(lx, ly, w, 32); g.fill();
    g.fillStyle = '#ffffff'; g.fillText(nom, lx + 10, ly + 16.5);
  });
  /* norte, escala y atribución */
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(W - 66, 14, 52, 62); g.fillStyle = '#0A2A4A'; g.beginPath(); g.moveTo(W - 40, 22); g.lineTo(W - 52, 52); g.lineTo(W - 40, 46); g.lineTo(W - 28, 52); g.closePath(); g.fill();
  g.font = '700 16px Arial'; g.textAlign = 'center'; g.fillText('N', W - 40, 66); g.textAlign = 'left';
  const latc = pts.reduce((a, p) => a + p[0], 0) / pts.length, mpp = (156543.03392 * Math.cos((latc * Math.PI) / 180)) / n / sc;
  const opciones = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000]; let L = opciones[0];
  opciones.forEach((o) => { if (o / mpp <= 220) L = o; });
  const px = L / mpp;
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(14, H - 50, px + 90, 36);
  g.fillStyle = '#0A2A4A'; g.fillRect(24, H - 30, px, 6); g.fillRect(24, H - 38, 2, 14); g.fillRect(24 + px - 2, H - 38, 2, 14);
  g.font = '15px Arial'; g.fillText(L >= 1000 ? L / 1000 + ' km' : L + ' m', 32 + px, H - 28);
  const at = '© OpenStreetMap'; g.font = '14px Arial'; const aw = g.measureText(at).width + 14;
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(W - aw - 8, H - 26, aw, 20); g.fillStyle = '#3c4652'; g.fillText(at, W - aw - 1, H - 15);
  return { url: c.toDataURL('image/jpeg', 0.88), w: W, h: H };
}

/* ====================================================================== PDF */
async function pdf(I, op) {
  const p = HR.progreso('Preparando el PDF…');
  try {
    await cargar('lib/jspdf-2.5.2.min.js'); await cargar('lib/jspdf-autotable-3.8.4.min.js');
    p.set(0.05); const dims = await prepararFotos(I, p); const logo = await logoPNG();
    const g = I.general, C = HR.C;
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: I.id + ' · ' + (g.proyecto || ''), subject: 'Informe de inspección de redes', author: C.EMPRESA, creator: 'HYDRO-ROV Análisis' });
    const M = 16, W = 210, H = 297, CW = W - 2 * M, TOP = 30, BOT = 279; let y = TOP;
    const pag = () => { doc.addPage(); y = TOP; };
    const espacio = (h) => { if (y + h > BOT) pag(); };
    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const fuente = (s, tam, c) => { doc.setFont('helvetica', s); doc.setFontSize(tam); color(c || TX); };
    const titulo = (t) => { espacio(16); fuente('bold', 12.5, NAVY); doc.text(txtPDF(t), M, y + 5); doc.setDrawColor(...CYAN); doc.setLineWidth(0.7); doc.line(M, y + 7.6, W - M, y + 7.6); y += 13; };
    const subtitulo = (t) => { espacio(12); fuente('bold', 11, NAVY); doc.text(txtPDF(t), M, y + 4.5); y += 8; };
    const parrafo = (t, est) => {
      fuente(est || 'normal', 9.6, TX);
      String(t || '').split(/\n/).forEach((par) => { const ls = doc.splitTextToSize(txtPDF(par) || ' ', CW); ls.forEach((l) => { espacio(4.7); doc.text(l, M, y + 3.6); y += 4.7; }); y += 1.2; });
      y += 1.5;
    };
    const tabla = (cfg) => {
      doc.autoTable(Object.assign({ startY: y, margin: { left: M, right: M, top: TOP, bottom: H - BOT }, theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 1.8, textColor: TX, lineColor: LINEA, lineWidth: 0.2, overflow: 'linebreak' },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.4 } }, cfg));
      y = doc.lastAutoTable.finalY + 5;
    };
    const kv = (pares) => {
      if (!pares.length) return;
      tabla({ body: pares4(pares).map((r) => r.map(txtPDF)), theme: 'plain',
        styles: { font: 'helvetica', fontSize: 8.6, cellPadding: { top: 1.7, bottom: 1.7, left: 2.2, right: 2.2 }, textColor: TX, lineColor: LINEA, lineWidth: { bottom: 0.2 } },
        columnStyles: { 0: { fillColor: SUAVE, textColor: MUT, cellWidth: 34 }, 1: { cellWidth: CW / 2 - 34 }, 2: { fillColor: SUAVE, textColor: MUT, cellWidth: 34 }, 3: { cellWidth: CW / 2 - 34 } } });
    };

    /* portada */
    fuente('bold', 8.4, [19, 122, 153]); doc.setCharSpace(0.6); doc.text('INFORME TÉCNICO DE INSPECCIÓN CCTV DE REDES', M, y + 3); doc.setCharSpace(0); y += 8;
    fuente('bold', 19, NAVY); doc.splitTextToSize(txtPDF(g.proyecto || 'Informe sin título'), CW).forEach((l) => { doc.text(l, M, y + 6); y += 8; });
    y += 1; fuente('normal', 10.5, MUT); doc.text(txtPDF([g.cliente, g.municipio, g.departamento].filter(Boolean).join(' · ')), M, y + 3); y += 9;
    const celdas = [['Código', I.id], ['Fecha de inspección', HR.fFecha(g.fechaInspeccion) || '—'], ['Tramos inspeccionados', String(I.tramos.length)], ['Estado', (HR.ESTADOS[I.estado] || I.estado) + ' · rev. ' + I.rev]];
    doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 17, 2, 2, 'F');
    celdas.forEach(([l, v], i) => { const x = M + 5 + i * (CW / 4); fuente('normal', 7.4, [160, 205, 222]); doc.text(txtPDF(l.toUpperCase()), x, y + 6); fuente('bold', 10, [255, 255, 255]); doc.text(txtPDF(v), x, y + 12.3); });
    y += 25;

    titulo('1.  Información general'); kv(datosGenerales(g));
    if (g.notasCampo) parrafo(g.notasCampo);
    const conCam = I.tramos.filter((t) => HR.camOk(t.cIni) || HR.camOk(t.cFin));
    if (conCam.length) {
      p.set(0.2, 'Dibujando la localización de los tramos…');
      const mg = await mapaPNG(conCam, I.tramos);
      if (mg) { const mh = CW * (mg.h / mg.w); espacio(mh + 12); fuente('bold', 9.6, NAVY); doc.text('Localización de los tramos inspeccionados', M, y + 4); y += 7; doc.addImage(mg.url, 'JPEG', M, y, CW, mh); doc.setDrawColor(...LINEA); doc.rect(M, y, CW, mh); y += mh + 6; }
    }
    titulo('2.  Alcance y metodología');
    if (I.alcance) parrafo(I.alcance);
    tabla({ head: [['Grado', 'Severidad']], body: HR.GRADOS.slice(1).map((x) => [String(x.g), x.n]), tableWidth: 70,
      didParseCell: (d) => { if (d.section === 'body' && d.column.index === 0) { d.cell.styles.fillColor = hexRGB(HR.GRADOS[Number(d.cell.raw)].c); d.cell.styles.textColor = [255, 255, 255]; d.cell.styles.fontStyle = 'bold'; d.cell.styles.halign = 'center'; } } });

    titulo('3.  Resultados por tramo');
    let nFoto = 0;
    for (let ti = 0; ti < I.tramos.length; ti++) {
      const t = I.tramos[ti]; p.set(0.25 + 0.55 * (ti / I.tramos.length), `Armando el tramo ${ti + 1} de ${I.tramos.length}…`);
      espacio(70);
      subtitulo(`3.${ti + 1}  Tramo ${etq(t)}`);
      kv(datosTramo(t));
      if (HR.camOk(t.cIni) || HR.camOk(t.cFin)) {
        const mt = await mapaPNG([t], I.tramos);
        if (mt) { const mh = CW * (mt.h / mt.w); espacio(mh + 4); doc.addImage(mt.url, 'JPEG', M, y, CW, mh); doc.setDrawColor(...LINEA); doc.rect(M, y, CW, mh); y += mh + 4; }
      }
      const pf = await perfilPNG(t), ph = CW * (pf.h / pf.w);
      espacio(ph + 4); doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.rect(M, y, CW, ph + 2); doc.addImage(pf.url, 'PNG', M + 1, y + 1, CW - 2, ph); y += ph + 6;
      if (t.obs.length) {
        tabla({ head: [['#', 'Dist. (m)', 'Código', 'Descripción', 'Hora', 'Grado']],
          body: t.obs.map((o, i) => [String(i + 1), HR.nf(o.dist) + (o.distFin != null ? ' – ' + HR.nf(o.distFin) : ''), (o.codigo || '') + (HR.COD[o.codigo] ? '\n' + HR.COD[o.codigo].n : ''), o.desc || '', o.hIni ? o.hIni + (o.hFin ? ' a ' + o.hFin : '') : '', o.grado ? String(o.grado) : '—'].map(txtPDF)),
          columnStyles: { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 20 }, 2: { cellWidth: 38 }, 4: { cellWidth: 15 }, 5: { cellWidth: 13, halign: 'center' } },
          didParseCell: (d) => { if (d.section === 'body' && d.column.index === 5 && Number(d.cell.raw)) { d.cell.styles.fillColor = hexRGB(HR.GRADOS[Number(d.cell.raw)].c); d.cell.styles.textColor = [255, 255, 255]; d.cell.styles.fontStyle = 'bold'; } } });
      } else parrafo('Sin observaciones registradas en el tramo.', 'italic');
      const conF = t.obs.map((o, i) => ({ o, i, src: fotoDe(o) })).filter((x) => x.src);
      if (conF.length) {
        espacio(10); fuente('bold', 9.6, NAVY); doc.text('Registro fotográfico', M, y + 4); y += 7;
        const gap = 6, cw = (CW - gap) / 2;
        for (let k = 0; k < conF.length; k += 2) {
          const fila = conF.slice(k, k + 2);
          const ih = cw * Math.min(0.8, Math.max(0.5, ...fila.map((f) => { const d = dims[f.o.foto.id]; return d ? d.h / d.w : 0.75; })));
          const caps = fila.map((f) => { nFoto++; fuente('bold', 8, TX); const a = doc.splitTextToSize(txtPDF(leyendaFoto(f.o, f.i, nFoto)), cw - 4); fuente('normal', 8, TX); const b = f.o.desc ? doc.splitTextToSize(txtPDF(f.o.desc), cw - 4).slice(0, 4) : []; return { a, b }; });
          const capH = Math.max(...caps.map((c) => (c.a.length + c.b.length) * 3.6)) + 4;
          espacio(ih + capH + 4);
          fila.forEach((f, j) => {
            const x = M + j * (cw + gap), d = dims[f.o.foto.id] || { w: 4, h: 3 };
            doc.setFillColor(11, 26, 42); doc.rect(x, y, cw, ih, 'F');
            const k2 = Math.min(cw / d.w, ih / d.h), w2 = d.w * k2, h2 = d.h * k2;
            doc.addImage(f.src, 'JPEG', x + (cw - w2) / 2, y + (ih - h2) / 2, w2, h2, undefined, 'FAST');
            if (f.o.grado) { doc.setFillColor(...hexRGB(HR.GRADOS[f.o.grado].c)); doc.rect(x, y + ih - 1.6, cw, 1.6, 'F'); }
            doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.rect(x, y, cw, ih + capH);
            let yy = y + ih + 4; fuente('bold', 8, TX); caps[j].a.forEach((l) => { doc.text(l, x + 2, yy); yy += 3.6; }); fuente('normal', 8, TX); caps[j].b.forEach((l) => { doc.text(l, x + 2, yy); yy += 3.6; });
          });
          y += ih + capH + 5;
        }
      }
      if (t.conclusion) { espacio(10); fuente('bold', 9.6, NAVY); doc.text('Conclusión del tramo', M, y + 4); y += 6.5; parrafo(t.conclusion); }
      if (t.recomendacion) { espacio(10); fuente('bold', 9.6, NAVY); doc.text('Recomendación', M, y + 4); y += 6.5; parrafo(t.recomendacion); }
    }
    p.set(0.82, 'Cerrando el documento…');
    titulo('4.  Conclusiones'); parrafo(I.conclusiones || '—');
    titulo('5.  Recomendaciones'); parrafo(I.recomendaciones || '—');
    if (I.anexos) { titulo('6.  Anexos'); parrafo(I.anexos); }
    const FIR = firmasDe(I);
    for (let k = 0; k < FIR.length; k += 2) {
      espacio(36); y += 6;
      FIR.slice(k, k + 2).forEach((f, j) => {
        const x = M + j * (CW / 2 + 6);
        fuente('normal', 7.4, MUT); doc.setCharSpace(0.4); doc.text(txtPDF(f.rol.toUpperCase()), x, y); doc.setCharSpace(0);
        doc.setDrawColor(...NAVY); doc.setLineWidth(0.35); doc.line(x, y + 16, x + 72, y + 16);
        fuente('bold', 9.4, TX); doc.text(txtPDF(f.nombre || ' '), x, y + 21);
        fuente('normal', 8.4, MUT); doc.splitTextToSize(txtPDF(f.det), 72).slice(0, 2).forEach((l, n) => doc.text(l, x, y + 25.5 + n * 3.8));
      });
      y += 32;
    }

    /* encabezado y pie en todas las páginas */
    const n = doc.getNumberOfPages(), lh = 9, lw = lh * (logo.w / logo.h);
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.addImage(logo.url, 'PNG', M, 10, lw, lh);
      fuente('bold', 8.4, NAVY); doc.text('INFORME DE INSPECCIÓN DE REDES', W - M, 13.3, { align: 'right' });
      fuente('normal', 8, MUT); doc.text(txtPDF(I.id + ' · ' + (HR.fFecha(g.fechaInforme) || '')), W - M, 17.6, { align: 'right' });
      doc.setDrawColor(...CYAN); doc.setLineWidth(0.5); doc.line(M, 22, W - M, 22);
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.line(M, 284, W - M, 284);
      fuente('normal', 7.6, MUT); doc.text(txtPDF(C.EMPRESA + ' · ' + C.LEMA + ' · ' + C.WEB), M, 289);
      doc.text(`Página ${i} de ${n}`, W - M, 289, { align: 'right' });
    }
    p.set(0.9, 'Generando el archivo…');
    await entregar(I, doc.output('blob'), 'pdf', op, p);
  } finally { p.fin(); }
}

/* ====================================================================== WORD */
async function docx(I, op) {
  const p = HR.progreso('Preparando el documento de Word…');
  try {
    await cargar('lib/docx-9.5.1.min.js');
    const D = window.docx, g = I.general, C = HR.C;
    const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, PageNumber, BorderStyle, ShadingType, TabStopType, VerticalAlign, TableLayoutType } = D;
    p.set(0.05); const dims = await prepararFotos(I, p); const logo = await logoPNG();
    const CWd = 9638, PX = 642; // ancho útil: twips y píxeles (A4, márgenes de 2 cm)
    const AZ = '0A2A4A', CI = '36B5D6', GR = '6B7684', LN = 'E3E8EE';
    const sinBorde = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
    const lin = { style: BorderStyle.SINGLE, size: 4, color: LN };
    const bordes = { top: lin, bottom: lin, left: lin, right: lin, insideHorizontal: lin, insideVertical: lin };
    const P = (t, o = {}) => new Paragraph({ spacing: { after: o.after == null ? 100 : o.after, before: o.before || 0, line: 276 }, alignment: o.al, children: [].concat(t).map((x) => (typeof x === 'string' ? new TextRun({ text: x, bold: o.b, color: o.c, size: o.s, italics: o.i }) : x)) });
    const parrafos = (t, o) => String(t || '—').split(/\n+/).map((l) => P(l, o));
    const H1 = (t) => new Paragraph({ spacing: { before: 300, after: 140 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: CI, space: 4 } }, children: [new TextRun({ text: t, bold: true, size: 26, color: AZ })] });
    const H2 = (t) => new Paragraph({ spacing: { before: 240, after: 100 }, keepNext: true, children: [new TextRun({ text: t, bold: true, size: 22, color: AZ })] });
    const H3 = (t) => new Paragraph({ spacing: { before: 140, after: 80 }, keepNext: true, children: [new TextRun({ text: t, bold: true, size: 19, color: AZ })] });
    const celda = (t, o = {}) => new TableCell({ width: { size: o.w, type: WidthType.DXA }, shading: o.f ? { type: ShadingType.CLEAR, color: 'auto', fill: o.f } : undefined, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 90, right: 90 }, children: String(t == null ? '' : t).split('\n').map((l, i) => new Paragraph({ alignment: o.al, children: [new TextRun({ text: l, size: o.s || 17, bold: o.b || (o.b2 && i === 0), color: o.c || (i > 0 && o.sub ? GR : undefined) })] })) });
    const kv = (pares) => {
      if (!pares.length) return [];
      const w = [1900, CWd / 2 - 1900, 1900, CWd / 2 - 1900];
      return [new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: { top: lin, bottom: lin, left: sinBorde.left, right: sinBorde.right, insideHorizontal: lin, insideVertical: sinBorde.left },
        rows: pares4(pares).map((r) => new TableRow({ children: r.map((v, i) => celda(v, { w: w[i], f: i % 2 === 0 ? 'F4F7FA' : undefined, c: i % 2 === 0 ? GR : undefined })) })) }), P('', { after: 60 })];
    };
    const img = (url, w, h, tipo) => new ImageRun({ type: tipo || 'jpg', data: b64aU8(url), transformation: { width: Math.round(w), height: Math.round(h) } });
    const cuerpo = [];

    cuerpo.push(P('INFORME TÉCNICO DE INSPECCIÓN CCTV DE REDES', { b: true, c: '137A99', s: 17, after: 60 }));
    cuerpo.push(P(g.proyecto || 'Informe sin título', { b: true, c: AZ, s: 38, after: 60 }));
    cuerpo.push(P([g.cliente, g.municipio, g.departamento].filter(Boolean).join(' · '), { c: GR, s: 21, after: 200 }));
    const cel = [['CÓDIGO', I.id], ['FECHA DE INSPECCIÓN', HR.fFecha(g.fechaInspeccion) || '—'], ['TRAMOS INSPECCIONADOS', String(I.tramos.length)], ['ESTADO', (HR.ESTADOS[I.estado] || I.estado) + ' · rev. ' + I.rev]];
    cuerpo.push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: [CWd / 4, CWd / 4, CWd / 4, CWd / 4], layout: TableLayoutType.FIXED, borders: sinBorde,
      rows: [new TableRow({ children: cel.map(([l, v]) => new TableCell({ width: { size: CWd / 4, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: AZ }, margins: { top: 120, bottom: 120, left: 160, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: l, size: 14, color: 'A0CDDE' })] }), new Paragraph({ children: [new TextRun({ text: v, size: 20, bold: true, color: 'FFFFFF' })] })] })) })] }));

    cuerpo.push(H1('1.  Información general'), ...kv(datosGenerales(g)));
    if (g.notasCampo) cuerpo.push(...parrafos(g.notasCampo));
    const conCam = I.tramos.filter((t) => HR.camOk(t.cIni) || HR.camOk(t.cFin));
    if (conCam.length) {
      p.set(0.15, 'Dibujando la localización de los tramos…');
      const mg = await mapaPNG(conCam, I.tramos);
      if (mg) cuerpo.push(H3('Localización de los tramos inspeccionados'), new Paragraph({ spacing: { after: 120 }, children: [img(mg.url, PX, PX * (mg.h / mg.w))] }));
    }
    cuerpo.push(H1('2.  Alcance y metodología'));
    if (I.alcance) cuerpo.push(...parrafos(I.alcance));
    cuerpo.push(new Table({ width: { size: 4200, type: WidthType.DXA }, columnWidths: [1000, 3200], borders: bordes,
      rows: [new TableRow({ tableHeader: true, children: [celda('Grado', { w: 1000, f: AZ, c: 'FFFFFF', b: true }), celda('Severidad', { w: 3200, f: AZ, c: 'FFFFFF', b: true })] })]
        .concat(HR.GRADOS.slice(1).map((x) => new TableRow({ children: [celda(String(x.g), { w: 1000, f: x.c.slice(1).toUpperCase(), c: 'FFFFFF', b: true, al: AlignmentType.CENTER }), celda(x.n, { w: 3200 })] }))) }));

    cuerpo.push(H1('3.  Resultados por tramo'));
    let nFoto = 0;
    for (let ti = 0; ti < I.tramos.length; ti++) {
      const t = I.tramos[ti]; p.set(0.2 + 0.6 * (ti / I.tramos.length), `Armando el tramo ${ti + 1} de ${I.tramos.length}…`);
      cuerpo.push(H2(`3.${ti + 1}  Tramo ${etq(t)}`), ...kv(datosTramo(t)));
      if (HR.camOk(t.cIni) || HR.camOk(t.cFin)) { const mt = await mapaPNG([t], I.tramos); if (mt) cuerpo.push(new Paragraph({ spacing: { after: 80 }, keepNext: true, children: [img(mt.url, PX, PX * (mt.h / mt.w))] })); }
      const pf = await perfilPNG(t);
      cuerpo.push(new Paragraph({ spacing: { after: 120 }, children: [img(pf.url, PX, PX * (pf.h / pf.w), 'png')] }));
      if (t.obs.length) {
        const w = [420, 1150, 2250, 3918, 900, 1000];
        cuerpo.push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: bordes,
          rows: [new TableRow({ tableHeader: true, children: ['#', 'Dist. (m)', 'Código', 'Descripción', 'Hora', 'Grado'].map((h, i) => celda(h, { w: w[i], f: AZ, c: 'FFFFFF', b: true })) })]
            .concat(t.obs.map((o, i) => new TableRow({ cantSplit: true, children: [
              celda(String(i + 1), { w: w[0], al: AlignmentType.CENTER }), celda(HR.nf(o.dist) + (o.distFin != null ? ' – ' + HR.nf(o.distFin) : ''), { w: w[1] }),
              celda((o.codigo || '') + (HR.COD[o.codigo] ? '\n' + HR.COD[o.codigo].n : ''), { w: w[2], b2: true, sub: true }), celda(o.desc || '', { w: w[3] }),
              celda(o.hIni ? o.hIni + (o.hFin ? ' a ' + o.hFin : '') : '', { w: w[4] }),
              o.grado ? celda(String(o.grado), { w: w[5], f: HR.GRADOS[o.grado].c.slice(1).toUpperCase(), c: 'FFFFFF', b: true, al: AlignmentType.CENTER }) : celda('—', { w: w[5], al: AlignmentType.CENTER })] }))) }));
      } else cuerpo.push(P('Sin observaciones registradas en el tramo.', { i: true, c: GR }));
      const conF = t.obs.map((o, i) => ({ o, i, src: fotoDe(o) })).filter((x) => x.src);
      if (conF.length) {
        cuerpo.push(H3('Registro fotográfico'));
        const cw = CWd / 2, ipx = 300, ihpx = 225, filas = [];
        for (let k = 0; k < conF.length; k += 2) {
          const fila = conF.slice(k, k + 2).map((f) => {
            nFoto++; const d = dims[f.o.foto.id] || { w: 4, h: 3 }, kk = Math.min(ipx / d.w, ihpx / d.h);
            return new TableCell({ width: { size: cw, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [img(f.src, d.w * kk, d.h * kk)] }),
              new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: leyendaFoto(f.o, f.i, nFoto), bold: true, size: 16 })] }),
              ...(f.o.desc ? [new Paragraph({ children: [new TextRun({ text: f.o.desc, size: 16, color: '3C4652' })] })] : [])] });
          });
          if (fila.length === 1) fila.push(new TableCell({ width: { size: cw, type: WidthType.DXA }, children: [new Paragraph('')] }));
          filas.push(new TableRow({ cantSplit: true, children: fila }));
        }
        cuerpo.push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: [cw, cw], layout: TableLayoutType.FIXED, borders: bordes, rows: filas }));
      }
      if (t.conclusion) cuerpo.push(H3('Conclusión del tramo'), ...parrafos(t.conclusion));
      if (t.recomendacion) cuerpo.push(H3('Recomendación'), ...parrafos(t.recomendacion));
    }
    p.set(0.82, 'Cerrando el documento…');
    cuerpo.push(H1('4.  Conclusiones'), ...parrafos(I.conclusiones));
    cuerpo.push(H1('5.  Recomendaciones'), ...parrafos(I.recomendaciones));
    if (I.anexos) cuerpo.push(H1('6.  Anexos'), ...parrafos(I.anexos));
    const firma = (f) => new TableCell({ width: { size: CWd / 2, type: WidthType.DXA }, borders: sinBorde, margins: { top: 0, bottom: 0, left: 0, right: 400 }, children: f ? [
      new Paragraph({ spacing: { before: 360, after: 620 }, children: [new TextRun({ text: f.rol.toUpperCase(), size: 14, color: GR, characterSpacing: 20 })] }),
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: AZ, space: 4 } }, children: [new TextRun({ text: f.nombre || ' ', bold: true, size: 19 })] }),
      new Paragraph({ children: [new TextRun({ text: f.det, size: 16, color: GR })] })] : [new Paragraph('')] });
    const FIR = firmasDe(I), filasF = [];
    for (let k = 0; k < FIR.length; k += 2) filasF.push(new TableRow({ cantSplit: true, children: [firma(FIR[k]), firma(FIR[k + 1])] }));
    if (filasF.length) cuerpo.push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: [CWd / 2, CWd / 2], borders: sinBorde, rows: filasF }));

    const lh = 34, lw = lh * (logo.w / logo.h);
    const doc = new Document({
      creator: C.EMPRESA, title: I.id + ' · ' + (g.proyecto || ''), description: 'Informe de inspección de redes',
      styles: { default: { document: { run: { font: 'Calibri', size: 19, color: '1D2430' } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1250, left: 1134, right: 1134, header: 500, footer: 500 } } },
        headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWd }], border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: CI, space: 6 } },
          children: [img(logo.url, lw, lh, 'png'), new TextRun({ text: '\tINFORME DE INSPECCIÓN DE REDES', bold: true, size: 16, color: AZ }), new TextRun({ text: '  ' + I.id + ' · ' + (HR.fFecha(g.fechaInforme) || ''), size: 15, color: GR })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWd }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: LN, space: 6 } },
          children: [new TextRun({ text: C.EMPRESA + ' · ' + C.LEMA + ' · ' + C.WEB, size: 14, color: GR }), new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 14, color: GR })] })] }) },
        children: cuerpo
      }]
    });
    p.set(0.9, 'Generando el archivo…');
    await entregar(I, await Packer.toBlob(doc), 'docx', op, p);
  } finally { p.fin(); }
}

window.HRExport = { pdf, docx, mapaPNG };
})();
