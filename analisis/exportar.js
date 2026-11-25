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
    ['Limpieza previa', g.limpieza], ['Método de limpieza', g.metodoLimpieza], ['Operador', g.operador], ['Ingeniero responsable', g.responsable]].filter(([, v]) => v);
}
function datosTramo(t) {
  return [['Sentido', t.sentido], ['Tipo de red', t.red], ['Material', t.material], ['Diámetro nominal', m(t.diametro, 'mm', 0)], ['Longitud del tramo', m(t.longitud, 'm')], ['Longitud inspeccionada', m(t.inspeccionada, 'm')],
    ['Profundidad pozo inicial', m(t.profIni, 'm')], ['Profundidad pozo final', m(t.profFin, 'm')], ['Ubicación', t.ubicacion], ['Coordenadas', t.coord], ['Fecha', HR.fFecha(t.fecha)],
    ['Condición general', t.condicion], ['Video', t.video ? t.video.nombre : ''], ['Fin anticipado', t.finAnticipado]].filter(([, v]) => v);
}
const pares4 = (a) => { const r = []; for (let i = 0; i < a.length; i += 2) r.push([a[i][0], a[i][1], a[i + 1] ? a[i + 1][0] : '', a[i + 1] ? a[i + 1][1] : '']); return r; };
const leyendaFoto = (o, i, n) => `Foto ${n} · Obs. ${i + 1}${o.dist != null ? ' · ' + HR.nf(o.dist) + ' m' : ''}${o.tiempo != null ? ' · ' + HR.fmtT(o.tiempo) : ''}${o.codigo ? ' · ' + o.codigo + (HR.COD[o.codigo] ? ' ' + HR.COD[o.codigo].n.toLowerCase() : '') : ''}${o.grado ? ' · Grado ' + o.grado : ''}`;

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
      const pf = await perfilPNG(t), ph = CW * (pf.h / pf.w);
      espacio(ph + 4); doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.rect(M, y, CW, ph + 2); doc.addImage(pf.url, 'PNG', M + 1, y + 1, CW - 2, ph); y += ph + 6;
      if (t.obs.length) {
        tabla({ head: [['#', 'Dist. (m)', 'Tiempo', 'Código', 'Descripción', 'Hora', 'Grado']],
          body: t.obs.map((o, i) => [String(i + 1), HR.nf(o.dist) + (o.distFin != null ? ' – ' + HR.nf(o.distFin) : ''), HR.fmtT(o.tiempo), (o.codigo || '') + (HR.COD[o.codigo] ? '\n' + HR.COD[o.codigo].n : ''), o.desc || '', o.hIni ? o.hIni + (o.hFin ? ' a ' + o.hFin : '') : '', o.grado ? String(o.grado) : '—'].map(txtPDF)),
          columnStyles: { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 19 }, 2: { cellWidth: 14 }, 3: { cellWidth: 34 }, 5: { cellWidth: 15 }, 6: { cellWidth: 13, halign: 'center' } },
          didParseCell: (d) => { if (d.section === 'body' && d.column.index === 6 && Number(d.cell.raw)) { d.cell.styles.fillColor = hexRGB(HR.GRADOS[Number(d.cell.raw)].c); d.cell.styles.textColor = [255, 255, 255]; d.cell.styles.fontStyle = 'bold'; } } });
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
    espacio(42); y += 18;
    const firma = (x, rol, nombre, extra) => { doc.setDrawColor(...NAVY); doc.setLineWidth(0.35); doc.line(x, y, x + 72, y); fuente('bold', 9.4, TX); doc.text(txtPDF(nombre || ' '), x, y + 5); fuente('normal', 8.4, MUT); doc.text(txtPDF(rol + (extra ? ' · ' + extra : '')), x, y + 9.5); };
    firma(M, 'Elaboró · Ingeniero responsable', g.responsable, g.matricula ? 'M.P. ' + g.matricula : '');
    if (g.reviso) firma(M + CW / 2 + 6, 'Revisó', g.reviso);
    y += 14;

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
      const pf = await perfilPNG(t);
      cuerpo.push(new Paragraph({ spacing: { after: 120 }, children: [img(pf.url, PX, PX * (pf.h / pf.w), 'png')] }));
      if (t.obs.length) {
        const w = [420, 1100, 850, 2000, 3368, 900, 1000];
        cuerpo.push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: bordes,
          rows: [new TableRow({ tableHeader: true, children: ['#', 'Dist. (m)', 'Tiempo', 'Código', 'Descripción', 'Hora', 'Grado'].map((h, i) => celda(h, { w: w[i], f: AZ, c: 'FFFFFF', b: true })) })]
            .concat(t.obs.map((o, i) => new TableRow({ cantSplit: true, children: [
              celda(String(i + 1), { w: w[0], al: AlignmentType.CENTER }), celda(HR.nf(o.dist) + (o.distFin != null ? ' – ' + HR.nf(o.distFin) : ''), { w: w[1] }), celda(HR.fmtT(o.tiempo), { w: w[2] }),
              celda((o.codigo || '') + (HR.COD[o.codigo] ? '\n' + HR.COD[o.codigo].n : ''), { w: w[3], b2: true, sub: true }), celda(o.desc || '', { w: w[4] }),
              celda(o.hIni ? o.hIni + (o.hFin ? ' a ' + o.hFin : '') : '', { w: w[5] }),
              o.grado ? celda(String(o.grado), { w: w[6], f: HR.GRADOS[o.grado].c.slice(1).toUpperCase(), c: 'FFFFFF', b: true, al: AlignmentType.CENTER }) : celda('—', { w: w[6], al: AlignmentType.CENTER })] }))) }));
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
    const firma = (rol, nombre, extra) => new TableCell({ width: { size: CWd / 2, type: WidthType.DXA }, borders: sinBorde, margins: { top: 0, bottom: 0, left: 0, right: 400 }, children: [
      new Paragraph({ spacing: { before: 900 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: AZ, space: 4 } }, children: [new TextRun({ text: nombre || ' ', bold: true, size: 19 })] }),
      new Paragraph({ children: [new TextRun({ text: rol + (extra ? ' · ' + extra : ''), size: 16, color: GR })] })] });
    cuerpo.push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: [CWd / 2, CWd / 2], borders: sinBorde,
      rows: [new TableRow({ cantSplit: true, children: [firma('Elaboró · Ingeniero responsable', g.responsable, g.matricula ? 'M.P. ' + g.matricula : ''), g.reviso ? firma('Revisó', g.reviso) : new TableCell({ width: { size: CWd / 2, type: WidthType.DXA }, borders: sinBorde, children: [new Paragraph('')] })] })] }));

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

window.HRExport = { pdf, docx };
})();
