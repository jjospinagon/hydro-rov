/* HYDRO-ROV · Análisis — documentos de la cotización (PDF con jsPDF y Word con docx)
   Dos formatos sobre el mismo contenido (HRMod.modelo):
   - «hr»: membrete de HYDRO-ROV (logo, azul y cian, Helvetica/Calibri).
   - «alt»: sin membrete: encabezado con el nombre y las credenciales de quien firma, grafito y verde, tipografía con serifa,
     consecutivo PTE-AAAA-NNN. No menciona a HYDRO-ROV. */
'use strict';
(function () {
const HR = window.HR, C = HR.C;
const txt = (s) => String(s == null ? '' : s).replace(/→/g, '–').replace(/≈/g, '~').replace(/[^\u0000-ÿ–—‘’“”•…€]/g, '');
const partes = (x) => String(x).split('**').map((t, i) => ({ t, b: i % 2 === 1 })).filter((r) => r.t);
const limpio = (s) => String(s == null ? '' : s).trim();
const lineasFirma = (f) => [String(f.perfil || '').split('\n').map(limpio).filter(Boolean), f.matricula ? ['Matrícula profesional ' + limpio(f.matricula)] : []].flat();
const credenciales = (f) => String(f.credenciales || '').split('\n').map(limpio).filter(Boolean);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fLarga = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1] + ' de ' + m[1] : ''; };
const dimsImg = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = url; });
const tipoImg = (url) => (/^data:image\/png/.test(url) ? 'png' : 'jpg');

const PAL = {
  hr: { tx: [29, 36, 48], ac: [10, 42, 74], ac2: [54, 181, 214], mut: [107, 118, 132], ln: [227, 232, 238], suave: [244, 247, 250], caja: [232, 246, 250], th: [10, 42, 74], fuente: 'helvetica' },
  alt: { tx: [34, 34, 34], ac: [35, 73, 59], ac2: [35, 73, 59], mut: [105, 105, 105], ln: [196, 200, 197], suave: [239, 242, 240], caja: [239, 242, 240], th: [35, 73, 59], fuente: 'times' }
};
const hex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

/* ============================================================ PDF */
async function pdf(c, m, op, pr) {
  await window.HRExport.cargar('lib/jspdf-2.5.2.min.js'); await window.HRExport.cargar('lib/jspdf-autotable-3.8.4.min.js');
  pr && pr.set(0.2);
  const alt = op.formato === 'alt', P = alt ? PAL.alt : PAL.hr, F = P.fuente, f = c.firma;
  const logo = alt ? null : await window.HRExport.logoPNG();
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter', compress: true });
  const codigo = alt ? op.numero : c.id;
  doc.setProperties({ title: codigo + ' · Propuesta técnico-económica', subject: 'Propuesta técnico-económica', author: alt ? (f.nombre || '') : C.EMPRESA, creator: alt ? '' : 'HYDRO-ROV Análisis' });
  const W = 215.9, H = 279.4, M = 22, CW = W - 2 * M, TOP = alt ? 38 : 32, BOT = H - 22; let y = TOP;
  const color = (k) => doc.setTextColor(k[0], k[1], k[2]);
  const fuente = (s, tam, k) => { doc.setFont(F, s); doc.setFontSize(tam); color(k || P.tx); };
  const pag = () => { doc.addPage(); y = TOP; };
  const espacio = (h) => { if (y + h > BOT) pag(); };
  const TAM = alt ? 10.5 : 10;

  /* párrafo con **negrilla**, justificado */
  const rico = (texto, o = {}) => {
    const tam = o.s || TAM, lh = tam * 0.3528 * 1.42, ind = o.ind || 0, x0 = M + ind, w = CW - ind;
    const est = (b) => (b ? (o.i ? 'bolditalic' : 'bold') : (o.i ? 'italic' : 'normal'));
    doc.setFontSize(tam);
    String(texto).split('\n').forEach((par) => {
      const words = []; let sp = false;
      partes(txt(par)).forEach((r) => r.t.split(/(\s+)/).forEach((t) => { if (!t) return; if (/^\s+$/.test(t)) { sp = true; return; } words.push({ t, b: r.b, sp: sp && words.length > 0 }); sp = false; }));
      words.forEach((x) => { doc.setFont(F, est(x.b)); x.w = doc.getTextWidth(x.t); });
      doc.setFont(F, 'normal'); const spW = doc.getTextWidth(' ');
      const lineas = []; let L = [], ancho = 0;
      words.forEach((x) => { const add = (L.length && x.sp ? spW : 0) + x.w; if (L.length && ancho + add > w) { lineas.push(L); L = [Object.assign({}, x, { sp: false })]; ancho = x.w; } else { L.push(x); ancho += add; } });
      if (L.length) lineas.push(L);
      lineas.forEach((L2, li) => {
        espacio(lh);
        const ultima = li === lineas.length - 1, nat = L2.reduce((a, x, i) => a + x.w + (i && x.sp ? spW : 0), 0), gaps = L2.filter((x, i) => i && x.sp).length;
        const extra = !ultima && o.al !== 'l' && o.al !== 'c' && gaps ? (w - nat) / gaps : 0;
        let cx = o.al === 'c' ? M + (CW - nat) / 2 : x0;
        if (o.bala && li === 0) { fuente('normal', tam, P.ac2); doc.text(alt ? '–' : '•', x0 - 4.2, y + tam * 0.3528); }
        L2.forEach((x, i) => { if (i && x.sp) cx += spW + extra; doc.setFont(F, est(x.b)); color(o.k || P.tx); doc.text(x.t, cx, y + tam * 0.3528); cx += x.w; });
        y += lh;
      });
    });
    y += o.after != null ? o.after * 0.3528 : 2.2;
  };
  const tabla = (b) => {
    const al = (a) => (a === 'r' ? 'right' : a === 'c' ? 'center' : 'left');
    const body = b.filas.map((r) => r.map(txt)); if (b.total) body.push(b.total.map(txt));
    doc.autoTable({ startY: y, margin: { left: M, right: M, top: TOP, bottom: H - BOT }, theme: 'grid',
      head: [b.cols.map((x) => ({ content: txt(x.x), styles: { halign: al(x.al) } }))], body,
      styles: { font: F, fontSize: alt ? 9.6 : 8.8, cellPadding: 1.9, textColor: P.tx, lineColor: P.ln, lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: P.th, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: alt ? 9 : 8.4 },
      columnStyles: Object.fromEntries(b.cols.map((x, i) => [i, { cellWidth: CW * x.w, halign: al(x.al) }])),
      didParseCell: (d) => { if (b.total && d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = P.suave; } } });
    y = doc.lastAutoTable.finalY + 5;
  };
  const firma = (antes) => {
    const L = lineasFirma(f); espacio(32 + L.length * 4.6);
    if (antes) { y += 2; fuente('normal', TAM, P.tx); doc.text(txt(antes), M, y + TAM * 0.3528); y += 6; }
    y += 15;
    fuente('bold', TAM, P.tx); doc.text(txt((f.nombre || ' ').toUpperCase()), M, y); y += 4.8;
    L.forEach((l) => { fuente('normal', TAM - 0.6, P.tx); doc.text(txt(l), M, y); y += 4.4; });
    y += 4;
  };
  for (const b of m.bloques) {
    if (b.t === 'p') { if (b.before) y += b.before * 0.3528; rico(b.x, { i: b.i, after: b.after }); }
    else if (b.t === 'dest') { b.lineas.forEach((l) => rico(l, { after: 0, al: 'l' })); y += 2; }
    else if (b.t === 'h1') {
      espacio(22); y += 2;
      if (alt) { fuente('bold', 12.5, P.ac); doc.setCharSpace(1.2); doc.text(txt(b.n + '.  ' + b.x), W / 2, y + 5, { align: 'center' }); doc.setCharSpace(0); doc.setDrawColor(...P.ac); doc.setLineWidth(0.3); doc.line(W / 2 - 22, y + 8.5, W / 2 + 22, y + 8.5); y += 15; }
      else { fuente('bold', 13, P.ac); doc.text(txt(b.n + '.  ' + b.x), M, y + 5); doc.setDrawColor(...P.ac2); doc.setLineWidth(0.7); doc.line(M, y + 7.6, W - M, y + 7.6); y += 13; }
    } else if (b.t === 'h2') { espacio(16); y += 1.5; fuente('bold', alt ? 11 : 10.4, P.ac); doc.text(txt(b.n + '   ' + b.x.toUpperCase()), M, y + 4); y += 7.5; }
    else if (b.t === 'h3') { espacio(13); fuente(alt ? 'bolditalic' : 'bold', alt ? 10.6 : 9.8, P.ac); doc.text(txt(b.n + '   ' + b.x), M, y + 4); y += 7; }
    else if (b.t === 'ul') {
      /* evita que el último punto de una lista quede solo en la página siguiente: los dos últimos van juntos */
      const alto = (t) => { doc.setFont(F, 'normal'); doc.setFontSize(TAM); return doc.splitTextToSize(txt(t.replace(/\*\*/g, '')), CW - 7).length * TAM * 0.3528 * 1.42 + 1.5 * 0.3528; };
      b.items.forEach((it, i) => {
        if (b.items.length >= 3 && i === b.items.length - 2) { const h2 = alto(it) + alto(b.items[i + 1]); if (y + h2 > BOT) pag(); }
        rico(it, { ind: 7, bala: true, after: 1.5 });
      });
      y += 1.5;
    }
    else if (b.t === 'tabla') { espacio(24); tabla(b); }
    else if (b.t === 'caja') {
      const tam = TAM - 0.6; fuente('normal', tam); const L = doc.splitTextToSize(txt(b.x), CW - 14), hh = 12 + L.length * tam * 0.3528 * 1.4;
      espacio(hh + 4);
      doc.setFillColor(...P.caja); doc.setDrawColor(...P.ac2); doc.setLineWidth(0.35);
      if (alt) { doc.rect(M, y, CW, hh, 'F'); doc.setFillColor(...P.ac); doc.rect(M, y, 1.6, hh, 'F'); } else doc.roundedRect(M, y, CW, hh, 2, 2, 'FD');
      fuente('bold', 9.2, P.ac); doc.setCharSpace(0.4); doc.text(txt(b.titulo), M + 7, y + 6.5); doc.setCharSpace(0);
      fuente('normal', tam, P.tx); L.forEach((l, i) => doc.text(l, M + 7, y + 11.8 + i * tam * 0.3528 * 1.4));
      y += hh + 5;
    } else if (b.t === 'img') {
      const d = await dimsImg(b.url); if (!d) continue;
      let iw = CW, ih = CW * (d.h / d.w); if (ih > 150) { ih = 150; iw = ih * (d.w / d.h); }
      const libre = BOT - y - 14; if (ih > libre && libre >= 95) { ih = libre; iw = ih * (d.w / d.h); }   // se ajusta al espacio que queda antes de saltar de página
      espacio(ih + 14); const ix = M + (CW - iw) / 2;
      doc.addImage(b.url, tipoImg(b.url) === 'png' ? 'PNG' : 'JPEG', ix, y, iw, ih); doc.setDrawColor(...P.ln); doc.setLineWidth(0.2); doc.rect(ix, y, iw, ih); y += ih + 2.5;
      fuente('italic', 8.4, P.mut); doc.splitTextToSize(txt(b.pie), CW).forEach((l) => { doc.text(l, W / 2, y + 3, { align: 'center' }); y += 3.8; }); y += 4;
    } else if (b.t === 'firma') firma(b.antes);
    else if (b.t === 'salto') pag();
  }
  pr && pr.set(0.8, 'Encabezados y pies de página…');
  const n = doc.getNumberOfPages();
  const pie = alt ? [f.correo, f.telefono].filter(Boolean).join('   ·   ') : [C.EMPRESA, C.CORREO, f.telefono, C.WEB].filter(Boolean).join('  ·  ');
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (alt) {
      const cr = credenciales(f);
      fuente('bold', 11, P.ac); doc.text(txt(f.nombre || ''), M, 13);
      cr.slice(0, 4).forEach((l, j) => { fuente('italic', 8.2, P.mut); doc.text(txt(l), M, 17.4 + j * 3.6); });
      fuente('normal', 8.2, P.mut); doc.text(txt(codigo), W - M, 13, { align: 'right' });
      const yl = 17.4 + Math.max(1, Math.min(4, cr.length)) * 3.6 + 0.4;
      doc.setDrawColor(...P.ac); doc.setLineWidth(0.5); doc.line(M, yl, W - M, yl); doc.setLineWidth(0.15); doc.line(M, yl + 1, W - M, yl + 1);
      doc.setDrawColor(...P.ln); doc.setLineWidth(0.2); doc.line(M + 40, H - 15.5, W - M - 40, H - 15.5);
      fuente('normal', 8.2, P.mut); doc.text(txt(pie), W / 2, H - 11.5, { align: 'center' });
      doc.text(String(i) + ' / ' + n, W - M, H - 11.5, { align: 'right' });
    } else {
      const lh = 9, lw = lh * (logo.w / logo.h); doc.addImage(logo.url, 'PNG', M, 11, lw, lh);
      fuente('bold', 8.6, P.ac); doc.text('PROPUESTA TÉCNICO-ECONÓMICA', W - M, 14.3, { align: 'right' });
      fuente('normal', 8, P.mut); doc.text(txt(codigo + ' · ' + fLarga(c.fecha)), W - M, 18.6, { align: 'right' });
      doc.setDrawColor(...P.ac2); doc.setLineWidth(0.5); doc.line(M, 23, W - M, 23);
      doc.setDrawColor(...P.ln); doc.setLineWidth(0.2); doc.line(M, H - 16, W - M, H - 16);
      fuente('normal', 7.8, P.mut); doc.text(txt(pie), M, H - 11.5); doc.text(`Página ${i} de ${n}`, W - M, H - 11.5, { align: 'right' });
    }
  }
  pr && pr.set(0.88, 'Generando el archivo…');
  return doc.output('blob');
}

/* ============================================================ WORD */
async function docx(c, m, op, pr) {
  await window.HRExport.cargar('lib/docx-9.5.1.min.js');
  const D = window.docx, alt = op.formato === 'alt', P = alt ? PAL.alt : PAL.hr, f = c.firma, codigo = alt ? op.numero : c.id;
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, PageNumber, BorderStyle, ShadingType, TabStopType, VerticalAlign, TableLayoutType, LevelFormat } = D;
  const AC = hex(P.ac), AC2 = hex(P.ac2), TX = hex(P.tx), GR = hex(P.mut), LN = hex(P.ln), SU = hex(P.suave), FUENTE = alt ? 'Cambria' : 'Calibri', TAM = alt ? 22 : 21;
  const CWd = 12240 - 2 * 1247; // carta, márgenes 2,2 cm
  const PX = 620;
  const b64aU8 = window.HRExport.b64aU8;
  const runs = (x, o = {}) => partes(x).map((r) => new TextRun({ text: r.t, bold: r.b || o.b, italics: o.i, color: o.c, size: o.s }));
  const P_ = (x, o = {}) => new Paragraph({ alignment: o.al || AlignmentType.JUSTIFIED, spacing: { before: o.before ? o.before * 20 : 0, after: o.after != null ? o.after * 20 : 140, line: 288 }, keepNext: o.keepNext, numbering: o.bala ? { reference: 'vinetas', level: 0 } : undefined, children: runs(x, o) });
  const lin = { style: BorderStyle.SINGLE, size: 4, color: LN }, nada = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const cuerpo = [];
  let salto = false;
  const push = (p) => { cuerpo.push(p); };
  for (const b of m.bloques) {
    if (b.t === 'p') push(P_(b.x, { i: b.i, after: b.after, before: b.before }));
    else if (b.t === 'dest') { b.lineas.forEach((l, i) => push(P_(l, { after: i === b.lineas.length - 1 ? 8 : 0, al: AlignmentType.LEFT }))); }
    else if (b.t === 'h1') { const pb = salto; salto = false; push(new Paragraph({ pageBreakBefore: pb, alignment: alt ? AlignmentType.CENTER : AlignmentType.LEFT, keepNext: true, spacing: { before: 120, after: 220 }, border: alt ? undefined : { bottom: { style: BorderStyle.SINGLE, size: 12, color: AC2, space: 4 } },
      children: [new TextRun({ text: b.n + '.  ' + b.x, bold: true, size: 26, color: AC, characterSpacing: alt ? 40 : 0 })] })); }
    else if (b.t === 'h2') push(new Paragraph({ keepNext: true, spacing: { before: 220, after: 100 }, children: [new TextRun({ text: b.n + '   ' + b.x.toUpperCase(), bold: true, size: alt ? 22 : 21, color: AC })] }));
    else if (b.t === 'h3') push(new Paragraph({ keepNext: true, spacing: { before: 140, after: 80 }, children: [new TextRun({ text: b.n + '   ' + b.x, bold: true, italics: alt, size: alt ? 21 : 20, color: AC })] }));
    else if (b.t === 'ul') b.items.forEach((it, i) => push(P_(it, { bala: true, after: i === b.items.length - 1 ? 7 : 3, keepNext: b.items.length - i <= 2 && i < b.items.length - 1 })));
    else if (b.t === 'tabla') {
      const al = (a) => (a === 'r' ? AlignmentType.RIGHT : a === 'c' ? AlignmentType.CENTER : AlignmentType.LEFT);
      const w = b.cols.map((x) => Math.round(CWd * x.w));
      const celda = (t, i, o = {}) => new TableCell({ width: { size: w[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: o.f ? { type: ShadingType.CLEAR, color: 'auto', fill: o.f } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ alignment: al(b.cols[i].al), children: [new TextRun({ text: String(t), bold: o.b, color: o.c, size: alt ? 19 : 18 })] })] });
      const filas = [new TableRow({ tableHeader: true, children: b.cols.map((x, i) => celda(x.x, i, { f: hex(P.th), c: 'FFFFFF', b: true })) })]
        .concat(b.filas.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => celda(v, i)) })));
      if (b.total) filas.push(new TableRow({ cantSplit: true, children: b.total.map((v, i) => celda(v, i, { b: true, f: SU })) }));
      push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: { top: lin, bottom: lin, left: lin, right: lin, insideHorizontal: lin, insideVertical: lin }, rows: filas }));
      push(P_('', { after: 60 }));
    } else if (b.t === 'caja') {
      push(new Table({ width: { size: CWd, type: WidthType.DXA }, columnWidths: [CWd], layout: TableLayoutType.FIXED,
        borders: alt ? { top: nada, bottom: nada, right: nada, left: { style: BorderStyle.SINGLE, size: 24, color: AC }, insideHorizontal: nada, insideVertical: nada } : { top: { style: BorderStyle.SINGLE, size: 6, color: AC2 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: AC2 }, left: { style: BorderStyle.SINGLE, size: 6, color: AC2 }, right: { style: BorderStyle.SINGLE, size: 6, color: AC2 }, insideHorizontal: nada, insideVertical: nada },
        rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: CWd, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(P.caja) }, margins: { top: 140, bottom: 140, left: 220, right: 220 },
          children: [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: b.titulo, bold: true, size: 18, color: AC, characterSpacing: 10 })] }), new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: b.x, size: TAM - 1 })] })] })] })] }));
      push(P_('', { after: 60 }));
    } else if (b.t === 'img') {
      const d = await dimsImg(b.url); if (!d) continue;
      let iw = PX, ih = PX * (d.h / d.w); if (ih > 560) { ih = 560; iw = ih * (d.w / d.h); }
      push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 80, after: 60 }, children: [new ImageRun({ type: tipoImg(b.url), data: b64aU8(b.url), transformation: { width: Math.round(iw), height: Math.round(ih) } })] }));
      push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: b.pie, italics: true, size: 16, color: GR })] }));
    } else if (b.t === 'firma') {
      if (b.antes) push(new Paragraph({ spacing: { before: 160, after: 0 }, keepNext: true, children: [new TextRun({ text: b.antes, size: TAM })] }));
      push(new Paragraph({ spacing: { before: 760, after: 0 }, keepNext: true, keepLines: true, children: [new TextRun({ text: (f.nombre || ' ').toUpperCase(), bold: true, size: TAM })] }));
      const LF = lineasFirma(f);
      LF.forEach((l, i) => push(new Paragraph({ spacing: { after: i === LF.length - 1 ? 160 : 0 }, keepNext: i < LF.length - 1, children: [new TextRun({ text: l, size: TAM - 1 })] })));
    } else if (b.t === 'salto') salto = true;   // el título siguiente empieza en página nueva
  }
  pr && pr.set(0.7, 'Encabezados y pies de página…');
  let header, footer;
  const pie = alt ? [f.correo, f.telefono].filter(Boolean).join('   ·   ') : [C.EMPRESA, C.CORREO, f.telefono, C.WEB].filter(Boolean).join('  ·  ');
  if (alt) {
    const cr = credenciales(f);
    header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWd }], spacing: { after: 0 }, children: [new TextRun({ text: f.nombre || '', bold: true, size: 22, color: AC }), new TextRun({ text: '\t' + codigo, size: 16, color: GR })] })]
      .concat(cr.map((l, i) => new Paragraph({ spacing: { after: 0 }, border: i === cr.length - 1 ? { bottom: { style: BorderStyle.DOUBLE, size: 4, color: AC, space: 6 } } : undefined, children: [new TextRun({ text: l, italics: true, size: 16, color: GR })] })))
      .concat(cr.length ? [] : [new Paragraph({ border: { bottom: { style: BorderStyle.DOUBLE, size: 4, color: AC, space: 6 } }, children: [] })]) });
    footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: pie, size: 16, color: GR }), new TextRun({ children: ['     ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16, color: GR })] })] });
  } else {
    const logo = await window.HRExport.logoPNG(), lh = 34, lw = lh * (logo.w / logo.h);
    header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWd }], border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AC2, space: 6 } },
      children: [new ImageRun({ type: 'png', data: b64aU8(logo.url), transformation: { width: Math.round(lw), height: lh } }), new TextRun({ text: '\tPROPUESTA TÉCNICO-ECONÓMICA', bold: true, size: 16, color: AC }), new TextRun({ text: '  ' + codigo + ' · ' + fLarga(c.fecha), size: 15, color: GR })] })] });
    footer = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CWd }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: LN, space: 6 } },
      children: [new TextRun({ text: pie, size: 14, color: GR }), new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 14, color: GR })] })] });
  }
  const doc = new Document({
    creator: alt ? (f.nombre || '') : C.EMPRESA, title: codigo + ' · Propuesta técnico-económica', description: 'Propuesta técnico-económica',
    styles: { default: { document: { run: { font: FUENTE, size: TAM, color: TX } } } },
    numbering: { config: [{ reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: alt ? '–' : '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 280 } }, run: { color: AC2 } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: alt ? 1900 : 1600, bottom: 1300, left: 1247, right: 1247, header: 560, footer: 560 } } },
      headers: { default: header }, footers: { default: footer }, children: cuerpo }]
  });
  pr && pr.set(0.88, 'Generando el archivo…');
  return Packer.toBlob(doc);
}
window.HRCotDoc = { pdf, docx };
})();
