/* HYDRO-ROV · Análisis — piezas compartidas por la app y la página pública de verificación:
   formatos, catálogo de hallazgos, coordenadas en grados-minutos-segundos y perfil del tramo. */
'use strict';
(function () {
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 2) => (v == null || v === '' || isNaN(v) ? '' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtT = (s) => { if (s == null || isNaN(s)) return ''; s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
const fFecha = (iso) => { if (!iso) return ''; const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); };

/* ============================================================ coordenadas en grados, minutos y segundos */
/* Acepta 75°14'36", 75 14 36, 75°14'36.5"W, -75.2433, 4,5339 … Devuelve {v: valor absoluto en grados decimales, h: hemisferio escrito o null}. */
function leerGMS(txt) {
  let t = String(txt || '').trim().toUpperCase().replace(/[′’´`]/g, "'").replace(/[″”]|''/g, '"').replace(/º/g, '°');
  if (!t) return null;
  const hm = /([NSEWO])\s*$/.exec(t) || /^\s*([NSEWO])/.exec(t); const h = hm ? hm[1] : null;
  const neg = /^\s*-/.test(t);
  t = t.replace(/[NSEWO]/g, ' ').replace(/^\s*-/, '');
  const nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '.')));
  if (!nums.length || nums.length > 3 || nums.some(isNaN)) return null;
  const [g, m = 0, sg = 0] = nums;
  if (nums.length > 1 && (m >= 60 || sg >= 60 || g % 1)) return null;
  return { v: g + m / 60 + sg / 3600, h: h || (neg ? '-' : null) };
}
function aGMS(dec, tipo, sinHemi) {
  if (dec == null || dec === '' || isNaN(dec)) return '';
  const a = Math.abs(Number(dec)); let g = Math.floor(a), m = Math.floor((a - g) * 60), sg = Math.round(((a - g) * 60 - m) * 600) / 10;
  if (sg >= 60) { sg = 0; m++; } if (m >= 60) { m = 0; g++; }
  const h = tipo === 'lat' ? (dec < 0 ? 'S' : 'N') : (dec < 0 ? 'O' : 'E');
  return `${g}°${String(m).padStart(2, '0')}'${sg.toFixed(1).padStart(4, '0').replace('.', ',')}"` + (sinHemi ? '' : ' ' + h);
}
const camOk = (c) => !!(c && c.lat != null && c.lon != null && !isNaN(c.lat) && !isNaN(c.lon));
const camTxt = (c) => (camOk(c) ? aGMS(c.lat, 'lat') + '  ' + aGMS(c.lon, 'lon') : '');

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

/* ------------------------------------------------------------ perfil del tramo (SVG) */
function perfilSVG(t, op = {}) {
  const W = 1000, H = op.alto || 200, x0 = 70, x1 = W - 70, yc = 104;
  const maxD = Math.max(0, ...t.obs.map((o) => Math.max(o.dist || 0, o.distFin || 0)));
  const L = Number(t.longitud) || Number(t.inspeccionada) || maxD || 10;
  const X = (d) => x0 + (Math.max(0, Math.min(L, d)) / L) * (x1 - x0);
  const paso = L <= 20 ? 2 : L <= 60 ? 5 : L <= 150 ? 10 : 25;
  const f = op.fuente || 'IBM Plex Sans, Arial, sans-serif', tinta = op.claro ? '#1d2430' : '#c9d4e1', sub = op.claro ? '#6b7684' : '#7d8aa0', tubo = op.claro ? '#dfe6ee' : '#1a2940';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="${f}">`;
  s += `<rect x="${x0}" y="${yc - 9}" width="${x1 - x0}" height="18" rx="9" fill="${tubo}"/>`;
  const insp = Number(t.inspeccionada);
  if (insp && insp < L) {
    /* tramo no inspeccionado: el texto va dentro solo si cabe; si no, debajo del tubo, centrado en el tramo */
    const ancho = x1 - X(insp), xm = (X(insp) + x1) / 2, cabe = ancho > 130;
    s += `<rect x="${X(insp)}" y="${yc - 9}" width="${ancho}" height="18" fill="${op.claro ? '#f3d9d6' : '#3a1f27'}"/>`;
    if (cabe) s += `<text x="${xm}" y="${yc + 4}" text-anchor="middle" font-size="11" fill="${op.claro ? '#a0332c' : '#f19a94'}">no inspeccionado</text>`;
    else s += `<text x="${Math.min(xm, x1 - 58)}" y="${yc + 27}" text-anchor="middle" font-size="10.5" fill="${op.claro ? '#a0332c' : '#f19a94'}">no inspeccionado</text>`;
  }
  for (let d = 0; d <= L + 0.001; d += paso) s += `<line x1="${X(d)}" x2="${X(d)}" y1="${yc + 12}" y2="${yc + 18}" stroke="${sub}"/><text x="${X(d)}" y="${yc + 44}" font-size="11" text-anchor="middle" fill="${sub}">${nf(d, 0)}</text>`;
  s += `<text x="${(x0 + x1) / 2}" y="${yc + 62}" font-size="11" text-anchor="middle" fill="${sub}">Distancia desde ${esc(t.sentido === 'Aguas arriba' ? 'el pozo final' : 'el pozo inicial')} (m) · Longitud ${nf(L)} m</text>`;
  [[x0, t.pozoIni || 'Inicial'], [x1, t.pozoFin || 'Final']].forEach(([x, n]) => {
    s += `<rect x="${x - 15}" y="${yc - 30}" width="30" height="60" rx="5" fill="none" stroke="${op.claro ? '#0a2a4a' : '#5cc8e4'}" stroke-width="2.5"/><text x="${x}" y="${yc - 38}" font-size="13" font-weight="700" text-anchor="middle" fill="${tinta}">${esc(n)}</text>`;
    /* los rótulos de los hallazgos van por encima de los nombres de los pozos */
  });
  const ax = t.sentido === 'Aguas arriba' ? -1 : 1, am = x0 + 60, ya = H - 14;
  s += `<path d="M${am - 30 * ax} ${ya} L${am + 30 * ax} ${ya} M${am + 22 * ax} ${ya - 5} L${am + 30 * ax} ${ya} L${am + 22 * ax} ${ya + 5}" stroke="${sub}" stroke-width="1.5" fill="none"/><text x="${am + 42}" y="${ya + 4}" font-size="11" fill="${sub}">Sentido de la inspección: ${esc((t.sentido || 'Aguas abajo').toLowerCase())}</text>`;
  const ob = t.obs.filter((o) => o.dist != null).slice().sort((a, b) => a.dist - b.dist);
  ob.filter((o) => o.distFin != null && o.distFin > o.dist).forEach((o) => { s += `<rect x="${X(o.dist)}" y="${yc - 6}" width="${Math.max(2, X(o.distFin) - X(o.dist))}" height="12" fill="${GRADOS[o.grado || 0].c}" opacity=".55"/>`; });
  let ult = -1e9, nivel = 0;
  ob.forEach((o) => {
    const x = X(o.dist), c = GRADOS[o.grado || 0].c, n = t.obs.indexOf(o) + 1;
    const borde = x - x0 < 26 ? -1 : x1 - x < 26 ? 1 : 0;   // junto a un pozo
    /* inicio y fin de la inspección junto al pozo: el recuadro del pozo ya los marca, solo el punto */
    if (borde && (o.codigo === 'INI' || o.codigo === 'FIN')) { s += `<g data-obs="${o.id}" style="cursor:pointer"><circle cx="${x}" cy="${yc}" r="6" fill="${c}" stroke="${op.claro ? '#fff' : '#03070d'}" stroke-width="2"/></g>`; return; }
    nivel = x - ult < 46 ? (nivel + 1) % 3 : 0; ult = x;
    const yl = yc - 60 - nivel * 15;
    /* junto a un pozo el rótulo se corre hacia el centro para no tapar el nombre del pozo */
    const xl = borde === -1 ? x0 + 28 : borde === 1 ? x1 - 28 : x, an = 'middle';
    const ruta = borde ? `${x},${yc - 9} ${x},${yc - 20} ${xl},${yc - 20} ${xl},${yl + 4}` : `${x},${yc - 9} ${x},${yl + 4}`;
    s += `<g data-obs="${o.id}" style="cursor:pointer"><polyline points="${ruta}" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="${x}" cy="${yc}" r="7" fill="${c}" stroke="${op.claro ? '#fff' : '#03070d'}" stroke-width="2"/>`
      + `<text x="${xl}" y="${yl}" font-size="11.5" font-weight="700" text-anchor="${an}" fill="${c}">${esc(o.codigo || '#' + n)}</text></g>`;
  });
  return s + '</svg>';
}

window.HRC = { esc, nf, fmtT, fFecha, leerGMS, aGMS, camOk, camTxt, GRADOS, CATALOGO, COD, ESTADOS, perfilSVG };
})();
