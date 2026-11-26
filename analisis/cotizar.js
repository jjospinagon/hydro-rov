/* HYDRO-ROV · Análisis — módulo Cotizaciones
   Propuesta técnico-económica de inspección: destinatario, tramos, alcance, valor por metro lineal (neto, libre de
   retenciones y descuentos), forma de pago y firma editable. Se exporta a PDF y Word con el membrete de HYDRO-ROV
   o sin membrete (encabezado del firmante y consecutivo propio). Todo queda en Drive: Cotizaciones/AAAA/COT-…  */
'use strict';
(function () {
const HR = window.HR, U = HR.ui, C = HR.C;
const { $, $$, ico, uid, pn, hoy, hace, abrirModal, cerrarModal, confirmar, setSync } = U;
const esc = HR.esc, nf = HR.nf;
const PRECIO_ML = Number(C.PRECIO_ML) || 14200;
const EST = { BORRADOR: 'Borrador', ENVIADA: 'Enviada', APROBADA: 'Aprobada', NO_APROBADA: 'No aprobada' };
const K = { lista: [], c: null, tab: 'cliente', dirty: false, timer: null, guardando: false, img: {}, filtro: '', q: '', carpeta: null };
window.HRMod = window.HRMod || {};

/* ============================================================ números, letras y fechas */
const miles = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pesos = (n) => '$' + miles(n);
const mts = (v) => (v == null || v === '' ? '' : nf(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2));
const UNI = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DEC = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
function cientos(n) {
  if (!n) return ''; if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), r = n % 100;
  const t = !r ? '' : r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNI[r % 10] : '');
  return [CEN[c], t].filter(Boolean).join(' ');
}
const apocope = (s) => s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
const bloqueMil = (n) => { const m = Math.floor(n / 1000), r = n % 1000; return [m ? (m === 1 ? 'MIL' : apocope(cientos(m)) + ' MIL') : '', cientos(r)].filter(Boolean).join(' '); };
function letras(n) {
  n = Math.round(Math.abs(Number(n) || 0)); if (!n) return 'CERO';
  const mm = Math.floor(n / 1e6), r = n % 1e6;
  return [mm ? (mm === 1 ? 'UN MILLÓN' : apocope(bloqueMil(mm)) + ' MILLONES') : '', bloqueMil(r)].filter(Boolean).join(' ');
}
const pesosLetras = (n) => { n = Math.round(Number(n) || 0); return apocope(letras(n)) + (n >= 1e6 && n % 1e6 === 0 ? ' DE PESOS' : ' PESOS'); };
/* «dieciséis (16)»; en femenino para jornadas: «una (1)», «veintiuna (21)» */
function cuantos(n, fem) {
  n = Math.round(Number(n) || 0); let t = apocope(letras(n)).toLowerCase();
  if (fem) t = t.replace(/veintiún$/, 'veintiuna').replace(/(^|\s)un$/, '$1una');
  return t + ' (' + n + ')';
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fLarga = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1] + ' de ' + m[1] : ''; };
const sumarDias = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
window.HRLetras = { letras, pesosLetras, cuantos, fLarga, miles };
const limpio = (s) => String(s == null ? '' : s).replace(/\*\*/g, '*').trim();   // ** marca negrilla en el modelo del documento
const sinPunto = (s) => limpio(s).replace(/[.\s]+$/, '');

/* ============================================================ textos sugeridos (de la cotización final de La Aurora) */
const DEF = {
  alcance1: ['Reconocimiento de pozos, cámaras o puntos de ingreso y recuperación del equipo.', 'Comprobación visual de las condiciones iniciales para efectuar la inspección.'],
  alcance2: ['Ingreso del equipo robotizado a cada uno de los tramos de la red de alcantarillado.', 'Recorrido visual controlado de cada tramo hasta su longitud aproximada o hasta el punto máximo técnicamente accesible.'],
  alcance3: ['Identificación básica de los archivos según el tramo inspeccionado y la fecha de ejecución.', 'Entrega de los registros de captura y del informe mediante enlace de descarga, memoria USB u otro medio digital.'],
  metodologia: 'El robot será posicionado dentro de la tubería desde los accesos disponibles y avanzará a velocidad controlada para favorecer la estabilidad de la imagen. Cuando las condiciones lo permitan, la cámara se orientará hacia elementos singulares visibles, como juntas, conexiones, cambios de sección, obstrucciones, depósitos o deterioros aparentes. La operación se suspenderá ante cualquier condición que pueda comprometer el equipo o impedir su desplazamiento.',
  consideraciones: ['Los accesos deberán estar localizados, destapados, autorizados y disponibles al momento de la inspección.',
    'Las tuberías deberán estar previamente limpias y libres de sedimentos, residuos, raíces u otros elementos que impidan el avance o reduzcan la visibilidad.',
    'El contratante deberá facilitar, cuando resulte necesario, el control del flujo o nivel de agua requerido para una inspección segura y con visibilidad suficiente.',
    'La presencia de una obstrucción, deformación, colapso, sedimento o nivel de agua que limite el recorrido no implica por sí sola la repetición gratuita de la inspección.'],
  entregables: ['Registros de captura correspondientes al recorrido de cada uno de los tramos inspeccionados.', 'Archivos parciales cuando el registro de un tramo deba dividirse.'],
  requisitos: ['Identificación precisa de los puntos inicial y final de cada tramo.', 'Acceso autorizado al sitio y a las estructuras de inspección.', 'Tuberías previamente limpiadas y desobstruidas.',
    'Información disponible sobre diámetros, materiales, profundidad, antecedentes de obstrucción y sentido de flujo.', 'Permisos, señalización y coordinación con la administración del sitio.'],
  exclusiones: ['Limpieza, lavado, succión, destaponamiento, corte de raíces o retiro de sedimentos y residuos.', 'Bombeo, taponamiento temporal, desvío de caudales o manejo de aguas residuales y lluvias.',
    'Apertura, reconstrucción o adecuación de pozos, cámaras y puntos de acceso.', 'Ingreso de personal a espacios confinados, pruebas de estanqueidad o pruebas de presión.',
    'Levantamiento topográfico, localización electromagnética, georreferenciación o planos.', 'Diagnóstico técnico, clasificación de defectos o diseño de rehabilitación de las redes.',
    'Actividades nocturnas, cierres viales, suministro de materiales o trámites ante entidades.'],
  neto: 'El precio por metro lineal y el valor total de esta propuesta son netos: libres de retenciones y descuentos. Si el contratante debe practicar alguna retención, estampilla, contribución o descuento, este no se restará del valor aquí cotizado.',
  incluye: 'la movilización, la operación del equipo robotizado, los registros de captura y el informe de la inspección',
  cambios: 'Cualquier cambio no contemplado que implique limpieza, visitas adicionales, repetición de recorridos por causas ajenas al equipo, diagnóstico técnico u otra ampliación del alcance será cotizado por separado. Si la longitud real aumenta, el plazo se ajustará en proporción a este.'
};
const INFORMES = {
  descriptivo: { n: 'Informe descriptivo', d: 'Longitud inspeccionada, estado observable y registro fotográfico por tramo. Sin diagnóstico ni clasificación de defectos.',
    alcance: 'Elaboración del informe de la inspección: longitud inspeccionada, observaciones del estado observable y registro fotográfico por tramo.',
    nota: 'El informe es descriptivo: no incluye diagnóstico técnico, inventario de hallazgos, clasificación PACP, georreferenciación de anomalías, concepto estructural ni recomendaciones de rehabilitación.' },
  hallazgos: { n: 'Informe técnico con hallazgos', d: 'Hallazgos de cada tramo con su codificación, grado de severidad, perfil y registro fotográfico.',
    alcance: 'Elaboración del informe técnico de la inspección: longitud inspeccionada, hallazgos observados en cada tramo con su codificación y grado de severidad, perfil del tramo y registro fotográfico.',
    nota: 'El informe identifica y califica los hallazgos observables; no incluye concepto estructural, diseño de rehabilitación ni presupuesto de reparaciones.' },
  ninguno: { n: 'Sin informe', d: 'Solo se entregan los registros de captura.', alcance: '',
    nota: 'La propuesta no incluye la elaboración de informe; se entregan únicamente los registros de captura.' }
};
/* firmantes conocidos: llenan la firma con un toque; todo queda editable */
const FIRMANTES = [
  { email: 'ing.jjgomezm@gmail.com', nombre: 'Juan José Gómez Moscoso', perfil: 'Especialista en ingeniería hidráulica y ambiental.\nIngeniero Civil.',
    credenciales: 'Maestrante en Recursos Hidráulicos – Universidad Nacional de Colombia\nEspecialista en Ingeniería Hidráulica y Ambiental – Universidad Nacional de Colombia\nIngeniero Civil – Universidad del Quindío',
    correo: 'ing.jjgomezm@gmail.com', telefono: '321-888-3402', matricula: '' },
  { email: 'jjospinagon@gmail.com', nombre: 'Juan José Ospina González', perfil: 'Especialista en gerencia de proyectos.\nIngeniero Civil.',
    credenciales: 'Especialista en Gerencia de Proyectos\nIngeniero Civil', correo: 'jjospinagon@gmail.com', telefono: '', matricula: '' }];
function firmaDefecto() {
  try { const f = JSON.parse(localStorage.getItem('hr_firma_cot') || 'null'); if (f && f.nombre) return f; } catch (e) { /* nada */ }
  const u = HR.S.user || {}, f = FIRMANTES.find((x) => x.email === u.email);
  return f ? Object.assign({}, f) : { nombre: u.nombre || '', perfil: 'Ingeniero Civil.', credenciales: '', correo: u.email || '', telefono: '', matricula: '' };
}
function nuevaCot() {
  return { estado: 'BORRADOR', fecha: hoy(), ciudadEmision: 'Armenia',
    cliente: { tratamiento: 'Señores', entidad: '', atencion: '', nit: '', ciudad: 'Armenia, Quindío', telefono: '', correo: '' },
    objeto: '', descripcion: '', notaLongitud: '', origen: 'Medido en SIG, de esquina a esquina', redondear: true,
    tramos: [], imagen: null, pieImagen: 'Localización y longitud aproximada de los tramos considerados. Fuente: elaboración propia.',
    precioMl: PRECIO_ML,
    items: [{ id: uid('i'), desc: 'Inspección robotizada CCTV de los tramos relacionados (longitud estimada)', unidad: 'm', auto: true, usaPrecio: true, cant: null, vu: PRECIO_ML, porDefinir: false }],
    informe: 'descriptivo', jornadas: null, plazoEntrega: 7, plazoTipo: 'hábiles', anticipo: 50, validez: 30,
    alcance1: DEF.alcance1.slice(), alcance2: DEF.alcance2.slice(), alcance3: DEF.alcance3.slice(), metodologia: DEF.metodologia,
    consideraciones: DEF.consideraciones.slice(), entregables: DEF.entregables.slice(), requisitos: DEF.requisitos.slice(), exclusiones: DEF.exclusiones.slice(),
    neto: DEF.neto, incluye: DEF.incluye, cambios: DEF.cambios, notaPago: '', cartaExtra: '', firma: firmaDefecto() };
}
/* completa cotizaciones guardadas con campos que falten (versiones futuras del módulo) */
const completar = (c) => { const b = nuevaCot(); Object.keys(b).forEach((k) => { if (c[k] === undefined) c[k] = b[k]; }); c.cliente = Object.assign(b.cliente, c.cliente); c.firma = Object.assign({}, b.firma, c.firma); return c; };

/* ============================================================ cálculo */
const mlTramos = (c) => Math.round(c.tramos.reduce((a, t) => a + (Number(t.longitud) || 0), 0) * 100) / 100;
const mlAdoptado = (c) => { const m = mlTramos(c); return c.redondear ? Math.round(m) : m; };
function calc(c) {
  const items = c.items.map((it) => {
    const cant = it.auto ? mlAdoptado(c) : it.cant, vu = it.usaPrecio ? c.precioMl : it.vu;
    const sub = !it.porDefinir && cant != null && vu != null ? Math.round(cant * vu) : null;
    return Object.assign({}, it, { cant, vu, sub });
  });
  const total = items.reduce((a, x) => a + (x.sub || 0), 0);
  return { items, total, ml: mlTramos(c), mlA: mlAdoptado(c), n: c.tramos.length, porDefinir: items.filter((x) => x.porDefinir), porMetro: items.some((x) => x.unidad === 'm') };
}
const UNIDADES = { m: 'm', und: 'und', gl: 'gl', jornada: 'jornada', dia: 'día' };
const cantTxt = (it) => (it.porDefinir ? 'Por definir' : it.cant == null ? '—' : (it.unidad === 'm' ? mts(it.cant) : nf(it.cant, it.cant % 1 ? 2 : 0)) + ' ' + (UNIDADES[it.unidad] || ''));
const vuTxt = (it) => (it.vu == null ? '—' : pesos(it.vu) + (it.unidad === 'm' ? '/m' : ''));

/* ============================================================ modelo del documento (lo usan vista previa, PDF y Word)
   bloques: p (texto con **negrilla**), h1, h2, h3, ul, tabla, caja, img, firma, dest, salto */
function modelo(c, op = {}) {
  const k = calc(c), cli = c.cliente, inf = INFORMES[c.informe] || INFORMES.descriptivo, conInf = c.informe !== 'ninguno';
  const obj = sinPunto(c.objeto) || 'la inspección robotizada de la red de alcantarillado';
  const largo = k.mlA ? `una longitud estimada de ${mts(k.mlA)} m${k.n ? ` distribuida en ${cuantos(k.n)} tramos` : ''}` : '';
  const regInf = conInf ? 'los registros de captura y el informe de la inspección' : 'los registros de captura';
  const pm = c.items.some((x) => x.usaPrecio);
  const B = [], h = (t, x, n) => B.push({ t, x, n });
  const p = (x, o = {}) => B.push(Object.assign({ t: 'p', x }, o));
  const ul = (items) => { const L = items.map(limpio).filter(Boolean); if (L.length) B.push({ t: 'ul', items: L }); };
  let s1 = 0, s2 = 0;
  const H1 = (x) => { s1++; s2 = 0; h('h1', x, String(s1)); };
  const H2 = (x) => { s2++; h('h2', x, s1 + '.' + s2); };

  /* carta de presentación */
  p(`${limpio(c.ciudadEmision) || 'Armenia'}, ${fLarga(c.fecha)}.`, { after: 14 });
  B.push({ t: 'dest', lineas: [limpio(cli.tratamiento) || 'Señores', '**' + (limpio(cli.entidad) || 'Destinatario').toUpperCase() + '**', cli.atencion ? 'Atención: ' + limpio(cli.atencion) : '', cli.nit ? 'NIT ' + limpio(cli.nit) : '', limpio(cli.ciudad)].filter(Boolean) });
  p(`**Ref.** Propuesta técnico-económica para ${obj}.`, { before: 10 });
  p('Cordial saludo.');
  p(`En atención a su solicitud, me permito presentar a su consideración la propuesta técnico-económica para ${obj}, mediante equipo robotizado con cámara de circuito cerrado de televisión (CCTV)${largo ? ', con ' + largo : ''}.`);
  p('El alcance general contempla:', { after: 2 });
  const resumen = ['Movilización y operación del equipo robotizado para inspección CCTV.', `Inspección visual del interior de las tuberías${largo ? ', con ' + largo : ''}.`];
  k.porDefinir.forEach((x) => resumen.push(`${sinPunto(x.desc)}, liquidada según el recorrido efectivo.`));
  k.items.filter((x) => !x.auto && !x.porDefinir && x.desc).forEach((x) => resumen.push(sinPunto(x.desc) + '.'));
  resumen.push(`Entrega digital de ${regInf}.`);
  ul(resumen);
  if (c.notaLongitud) p('**Nota:** ' + limpio(c.notaLongitud), { i: true });
  const vtxt = `**${pesosLetras(k.total)} (${pesos(k.total)} COP)**`;
  p(`El valor total estimado de la propuesta asciende a ${vtxt}${pm ? `, calculado a razón de **${pesos(c.precioMl)} COP por metro lineal** de inspección` : ''}. **Este valor es neto: libre de retenciones y descuentos.**${k.porMetro ? ' El valor definitivo se liquidará con la longitud efectivamente inspeccionada.' : ''}`);
  if (c.jornadas) p(`La actividad de campo se prevé para ${cuantos(c.jornadas, true)} jornada${c.jornadas == 1 ? '' : 's'} de trabajo${k.mlA ? ` para los ${mts(k.mlA)} m estimados` : ''}, siempre que los accesos estén habilitados y las condiciones permitan el desplazamiento seguro del equipo.${k.porDefinir.length ? ' Los tramos por definir podrán requerir jornadas adicionales.' : ''}`);
  if (c.cartaExtra) p(limpio(c.cartaExtra));
  B.push({ t: 'firma', antes: 'Atentamente,' });
  B.push({ t: 'salto' });

  /* propuesta técnica */
  H1('PROPUESTA TÉCNICA');
  H2('Objetivo');
  p(`Realizar ${obj}${largo ? ', con ' + largo : ''}, y entregar al contratante ${regInf} correspondientes al recorrido efectivamente inspeccionado${k.porDefinir.length ? ', incluidos los tramos por definir, siempre y cuando estos se puedan recorrer' : ''}.`);
  H2('Descripción y localización');
  const desc = [limpio(c.descripcion) || `La inspección se realizará en ${limpio(cli.entidad) || 'el sitio indicado por el contratante'}${cli.ciudad ? ', ' + limpio(cli.ciudad) : ''}.`];
  if (k.n > 1 && k.ml) desc.push(`La suma de los ${cuantos(k.n).replace(/ \(\d+\)$/, '')} tramos es de ${mts(k.ml)} m${c.redondear && k.mlA !== k.ml ? `, adoptada como ${mts(k.mlA)} m para efectos de esta propuesta` : ''}.`);
  if (k.porDefinir.length) desc.push('Los tramos por definir no están incluidos en esta cifra porque su longitud no pudo determinarse.');
  p(desc.join(' '));
  if (c.imagen && op.imagen) B.push({ t: 'img', url: op.imagen, pie: 'Figura 1. ' + sinPunto(c.pieImagen) + '.' });
  if (k.n) {
    B.push({ t: 'tabla', cols: [{ x: 'TRAMO', w: 0.3 }, { x: 'LONGITUD APROXIMADA', w: 0.26, al: 'c' }, { x: 'CONDICIÓN', w: 0.44 }],
      filas: c.tramos.map((t) => [limpio(t.nombre) || '—', t.longitud != null ? mts(t.longitud) + ' m' : 'Por definir', limpio(t.nota) || limpio(c.origen)]),
      total: ['TOTAL ESTIMADO', mts(k.ml) + ' m' + (c.redondear && k.mlA !== k.ml ? ' (se adopta ' + mts(k.mlA) + ' m)' : ''), 'Sujeto al recorrido efectivo'] });
  }
  H2('Alcance del proyecto');
  p('El alcance contempla la ejecución de las siguientes actividades:');
  h('h3', 'Preparación y verificación de accesos', s1 + '.' + s2 + '.1'); ul(c.alcance1);
  h('h3', 'Inspección de los tramos', s1 + '.' + s2 + '.2'); ul(c.alcance2.concat(k.porDefinir.map((x) => `${sinPunto(x.desc)}: su longitud se establecerá en campo y se liquidará con la misma tarifa por metro lineal.`)));
  h('h3', 'Informe y entrega de archivos', s1 + '.' + s2 + '.3'); ul(conInf ? [c.alcance3[0], inf.alcance].concat(c.alcance3.slice(1)) : c.alcance3);
  H2('Metodología de ejecución'); p(limpio(c.metodologia));
  H2('Consideraciones especiales'); ul(c.consideraciones);
  H2('Entregables'); p('Se realizará entrega en medio digital de:', { after: 2 });
  ul(conInf ? c.entregables.slice(0, 1).concat('Informe de la inspección, en formato PDF.', c.entregables.slice(1)) : c.entregables);
  p(`**${conInf ? 'Los registros de captura y el informe permitirán' : 'Los registros de captura permitirán'} observar el estado de la tubería al momento de la inspección. ${inf.nota}**`, { i: true });
  H2('Información y condiciones requeridas'); p('El contratante deberá suministrar o garantizar:', { after: 2 }); ul(c.requisitos);
  H2('Exclusiones'); p('La presente propuesta no incluye:', { after: 2 }); ul(c.exclusiones);
  B.push({ t: 'salto' });

  /* propuesta económica */
  H1('PROPUESTA ECONÓMICA');
  H2('Valor de la propuesta');
  p('El valor de la propuesta se resume en los siguientes ítems:');
  B.push({ t: 'tabla', cols: [{ x: 'DESCRIPCIÓN', w: 0.46 }, { x: 'CANTIDAD', w: 0.15, al: 'c' }, { x: 'VALOR UNITARIO', w: 0.18, al: 'r' }, { x: 'SUBTOTAL', w: 0.21, al: 'r' }],
    filas: k.items.map((x) => [limpio(x.desc), cantTxt(x), vuTxt(x), x.porDefinir ? 'Según longitud real' : x.sub == null ? '—' : pesos(x.sub)]),
    total: ['VALOR TOTAL ESTIMADO' + (k.porDefinir.length ? ' (sin ítems por definir)' : ''), '', '', pesos(k.total)] });
  B.push({ t: 'caja', titulo: 'VALOR NETO · LIBRE DE RETENCIONES Y DESCUENTOS', x: limpio(c.neto) });
  p(`El valor total estimado de la propuesta es de ${vtxt}${pm && k.mlA ? `, correspondiente a ${mts(k.mlA)} m a razón de ${pesos(c.precioMl)}/m` : ''}.${c.incluye ? ' El valor incluye ' + sinPunto(c.incluye) + '.' : ''}`);
  if (k.porMetro) p(`Las cantidades son estimadas: el valor definitivo se liquidará${pm ? ` a ${pesos(c.precioMl)} COP/m` : ''} con la longitud efectivamente inspeccionada, ya sea mayor${k.porDefinir.length ? ' (p. ej., tramos por definir)' : ''} o menor.`);
  H2('Tiempo de ejecución');
  if (c.jornadas) p(`La inspección se prevé para ${cuantos(c.jornadas, true)} jornada${c.jornadas == 1 ? '' : 's'} de trabajo, contadas a partir de la autorización de ingreso, siempre que los accesos estén habilitados, las tuberías limpias y las condiciones hidráulicas permitan el desplazamiento seguro del equipo.`);
  if (c.plazoEntrega) p(`**Plazo de entrega de ${regInf.replace(' de la inspección', '')}: ${cuantos(c.plazoEntrega)} días ${c.plazoTipo === 'calendario' ? 'calendario' : 'hábiles'} desde la inspección.**`);
  H2('Forma de pago');
  p('En caso de ser aceptada la propuesta, los pagos se realizarán de la siguiente forma:', { after: 2 });
  const an = Math.max(0, Math.min(100, Number(c.anticipo) || 0));
  ul(an === 0 ? [`100% contra entrega de ${regInf}, ajustado a la longitud inspeccionada.`]
    : an === 100 ? ['100% anticipado a la aprobación de la propuesta, calculado sobre el valor estimado; la diferencia con la longitud inspeccionada se liquidará al final.']
      : [`${an}% de anticipo a la aprobación de la propuesta, calculado sobre el valor estimado.`, `${100 - an}% contra entrega de ${regInf}, ajustado a la longitud inspeccionada.`]);
  if (c.notaPago) p(limpio(c.notaPago));
  if (c.cambios) p(limpio(c.cambios));
  H2('Validez de la propuesta');
  p(`**La presente propuesta tiene una validez de ${cuantos(c.validez || 30)} días calendario, contados desde su fecha.**`);
  B.push({ t: 'firma', antes: 'Atentamente,' });
  return { bloques: B, k };
}
const partes = (x) => String(x).split('**').map((t, i) => ({ t, b: i % 2 === 1 })).filter((r) => r.t);
const firmaLineas = (f) => [String(f.perfil || '').split('\n').map(limpio).filter(Boolean), f.matricula ? ['Matrícula profesional ' + limpio(f.matricula)] : []].flat();

/* ============================================================ servidor */
const api = (a, d, o) => HR.apiOk(a, d, o);
HR.cotIndice = () => K.lista;
async function cargarLista() {
  try { const r = await api('cotListar'); K.lista = r.cotizaciones; } catch (e) { HR.toast(esc(e.message), 'err'); }
  return K.lista;
}
HR.cargarCotizaciones = cargarLista;

/* ============================================================ lista */
const vence = (x) => (x.fecha && x.validez ? sumarDias(x.fecha, Number(x.validez)) : '');
const vencida = (x) => x.estado === 'ENVIADA' && vence(x) && vence(x) < hoy();
async function listaCot() {
  const V = $('#v-cotizaciones');
  V.innerHTML = `<div class="cab"><div><h1 class="t">Cotizaciones</h1><p>Propuestas técnico-económicas de inspección. Cada una guarda su carpeta en Drive con los PDF y Word emitidos.</p></div>
      <button class="btn pri solo-editor" data-cot="nueva">${ico('mas')}Nueva cotización</button></div>
    <div class="k4 k-cot" id="cot-kpis"></div>
    <div class="tools"><label class="buscar">${ico('buscar')}<input id="cot-q" type="search" placeholder="Buscar por cliente, objeto o código" aria-label="Buscar cotización" value="${esc(K.q)}"></label>
      <div class="chips" id="cot-f">${[['', 'Todas'], ['BORRADOR', 'Borrador'], ['ENVIADA', 'Enviadas'], ['APROBADA', 'Aprobadas'], ['NO_APROBADA', 'No aprobadas']].map(([v, l]) => `<button class="chip${K.filtro === v ? ' on' : ''}" data-f="${v}">${l}</button>`).join('')}</div></div>
    <div id="cot-lista"><div class="vacio"><div class="spin" style="margin:0 auto"></div></div></div>`;
  V.querySelector('#cot-q').addEventListener('input', (e) => { K.q = e.target.value; pintarLista(); });
  V.querySelector('#cot-f').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; K.filtro = b.dataset.f; $$('#cot-f .chip').forEach((x) => x.classList.toggle('on', x === b)); pintarLista(); });
  await Promise.all([cargarLista(), HR.cargarAgenda ? HR.cargarAgenda() : null]);
  pintarLista();
}
function pintarLista() {
  const L = K.lista, box = $('#cot-lista'); if (!box) return;
  const cuenta = (e) => L.filter((x) => x.estado === e);
  const apr = cuenta('APROBADA'), dec = apr.length + cuenta('NO_APROBADA').length;
  $('#cot-kpis').innerHTML = `<div class="kpi kpi-ml"><div class="l">Valor aprobado</div><div class="v">${pesos(apr.reduce((a, x) => a + (x.total || 0), 0))}</div><div class="s">${apr.length} cotización${apr.length === 1 ? '' : 'es'} aprobada${apr.length === 1 ? '' : 's'}</div></div>`
    + [['Cotizaciones', L.length], ['Enviadas', cuenta('ENVIADA').length], ['Por vencer o vencidas', L.filter((x) => x.estado === 'ENVIADA' && vence(x) && vence(x) <= sumarDias(hoy(), 5)).length],
      ['Aprobación', dec ? Math.round((apr.length / dec) * 100) + '%' : '—']].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
  const q = K.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const F = L.filter((x) => (!K.filtro || x.estado === K.filtro) && (!q || [x.id, x.cliente, x.objeto, x.municipio].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
  if (!L.length) { box.innerHTML = `<div class="vacio"><h3>Aún no hay cotizaciones</h3><p>Cree la primera: destinatario, tramos, valor por metro lineal y firma. Se exporta a PDF y Word.</p>${U.esLector() ? '' : `<p style="margin-top:14px"><button class="btn pri" data-cot="nueva">${ico('mas')}Nueva cotización</button></p>`}</div>`; return; }
  if (!F.length) { box.innerHTML = '<div class="vacio"><h3>Sin resultados</h3><p>Ninguna cotización coincide con la búsqueda.</p></div>'; return; }
  const ev = (id) => (HR.eventosDe ? HR.eventosDe(id) : []);
  box.innerHTML = `<div class="tw"><table class="tabla resp cot-t"><thead><tr><th>Cotización</th><th>Cliente y objeto</th><th>Valor</th><th>Estado</th><th>Agenda</th><th></th></tr></thead><tbody>${F.map((x) => {
    const e = ev(x.id).filter((v) => v.estado !== 'CANCELADO').sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const prox = e.find((v) => v.fin >= hoy()) || e[e.length - 1];
    return `<tr data-id="${esc(x.id)}" tabindex="0"><td class="c-cod"><b>${esc(x.id)}</b><small>${esc(HR.fFecha(x.fecha))}</small></td>
      <td class="c-cli"><b>${esc(x.cliente || 'Sin destinatario')}</b><small>${esc(x.objeto || '—')}</small></td>
      <td class="c-val" data-l="Valor"><b>${pesos(x.total)}</b><small>${x.ml ? mts(x.ml) + ' m' : ''}</small></td>
      <td class="c-est"><span class="est c-${esc(x.estado)}">${esc(EST[x.estado] || x.estado)}</span>${vencida(x) ? '<span class="est c-VENCIDA" title="Pasó la fecha de validez">Vencida</span>' : ''}</td>
      <td class="c-ag">${prox ? `<span class="ag-tag ${esc(prox.tipo)}">${ico('cal', 'i mini')}${esc(prox.tipo === 'VISITA' ? 'Visita' : prox.tipo === 'TRABAJO' ? 'Trabajo' : 'Evento')} · ${esc(HR.fFecha(prox.inicio))}</span>` : '<span class="mut">—</span>'}</td>
      <td class="c-acc"><button type="button" class="btn xs fant peligro solo-editor" data-cot="eliminar" data-id="${esc(x.id)}" title="Eliminar cotización" aria-label="Eliminar">${ico('basura')}</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cot]');
  if (b) {
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.cot;
    if (a === 'nueva') return nueva();
    if (a === 'eliminar') return eliminar(b.dataset.id || (K.c && K.c.id));
    if (a === 'volver') { location.hash = 'cotizaciones'; return; }
    if (a === 'pdf' || a === 'docx') return exportar(a);
    if (a === 'drive') { if (K.carpeta) window.open(K.carpeta, '_blank', 'noopener'); return; }
    if (a === 'duplicar') return duplicar();
    if (a === 'visita' || a === 'trabajo') return agendar(a === 'visita' ? 'VISITA' : 'TRABAJO');
    if (a === 'informe') return crearInforme();
    return;
  }
  const tr = e.target.closest('#cot-lista tr[data-id]');
  if (tr) location.hash = 'cotizacion/' + encodeURIComponent(tr.dataset.id);
});
document.addEventListener('keydown', (e) => { const tr = e.target.closest && e.target.closest('#cot-lista tr[data-id]'); if (tr && e.key === 'Enter') location.hash = 'cotizacion/' + encodeURIComponent(tr.dataset.id); });

async function nueva(base) {
  if (U.esLector()) return;
  const pr = HR.progreso('Creando la cotización y su carpeta en Drive…'); pr.set(0.4);
  try { const r = await api('cotCrear', { cotizacion: base || nuevaCot() }); K.lista = []; location.hash = 'cotizacion/' + r.cotizacion.id; HR.toast(`Cotización <b>${esc(r.cotizacion.id)}</b> creada.`, 'ok'); }
  catch (err) { HR.toast(esc(err.message), 'err'); } finally { pr.fin(); }
}
async function duplicar() {
  if (!K.c) return; await guardarAhora();
  const c = JSON.parse(JSON.stringify(K.c));
  ['id', 'rev', 'creado', 'creadoPor', 'actualizado', 'actualizadoPor', 'alt', 'imagen'].forEach((x) => delete c[x]);
  c.estado = 'BORRADOR'; c.fecha = hoy();
  await nueva(c);
}
async function eliminar(id) {
  if (!id) return;
  const d = abrirModal(`<div class="mh"><h3>Eliminar ${esc(id)}</h3></div><div class="mb"><p style="color:var(--mut)">Se envía a la papelera de Drive la carpeta de la cotización con sus PDF y Word. Los eventos de agenda ligados se conservan.</p>
    <label class="campo" style="margin-top:12px"><span>Escriba <b>${esc(id)}</b> para confirmar</span><input id="cot-conf" autocomplete="off"></label></div>
    <div class="mf"><button class="btn" data-r="0">Cancelar</button><button class="btn peligro" data-r="1">${ico('basura')}Eliminar</button></div>`);
  d.querySelector('#cot-conf').focus();
  d.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === '0') return cerrarModal();
    try { await api('cotEliminar', { id, confirmacion: d.querySelector('#cot-conf').value }); cerrarModal(); HR.toast(`${esc(id)} eliminada.`, 'ok'); K.c = null; K.dirty = false; K.lista = K.lista.filter((x) => x.id !== id); if (location.hash.startsWith('#cotizacion/')) location.hash = 'cotizaciones'; else pintarLista(); }
    catch (err) { HR.toast(esc(err.message), 'err'); }
  });
}

/* ============================================================ editor */
const TABS = [['cliente', 'Destinatario y firma'], ['tramos', 'Tramos y localización'], ['alcance', 'Alcance y condiciones'], ['valor', 'Valor y pago'], ['vista', 'Vista previa y exportar']];
async function abrirCot(id, tab) {
  const V = $('#v-cotizacion');
  if (!K.c || K.c.id !== id) {
    V.innerHTML = '<div class="vacio"><div class="spin" style="margin:0 auto"></div></div>';
    try { const r = await api('cotObtener', { id }); K.c = completar(r.cotizacion); K.carpeta = r.carpeta; K.dirty = false; }
    catch (e) { V.innerHTML = `<div class="vacio"><h3>No se pudo abrir la cotización</h3><p>${esc(e.message)}</p><p style="margin-top:12px"><button class="btn" data-cot="volver">Volver a cotizaciones</button></p></div>`; return; }
  }
  if (tab && TABS.some((t) => t[0] === tab)) K.tab = tab;
  pintarEditor();
}
function pintarEditor() {
  const c = K.c, V = $('#v-cotizacion'), lector = U.esLector();
  V.innerHTML = `<div class="ed-cab">
      <div class="f1"><button class="hb" data-cot="volver" aria-label="Volver a cotizaciones">${ico('atras')}</button>
        <div class="tt"><div class="cod">${esc(c.id)}${c.alt ? ' · ' + esc(c.alt) : ''}</div><h2 id="cot-tit">${esc(c.cliente.entidad || 'Cotización sin destinatario')}</h2></div>
        <select id="cot-est" aria-label="Estado de la cotización" ${lector ? 'disabled' : ''}>${Object.entries(EST).map(([v, l]) => `<option value="${v}"${c.estado === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button class="hb" data-cot="drive" title="Abrir la carpeta en Drive">${ico('drive')}<span class="tx">Drive</span></button>
        <button class="hb" data-cot="pdf">${ico('pdf')}<span class="tx">PDF</span></button>
        <button class="hb" data-cot="docx">${ico('word')}<span class="tx">Word</span></button>
        <button class="hb solo-editor" data-cot="eliminar" title="Eliminar cotización" aria-label="Eliminar cotización" style="color:var(--err)">${ico('basura')}</button></div>
      <div class="tabs" role="tablist">${TABS.map(([k, l], i) => `<button class="tab${K.tab === k ? ' on' : ''}" data-ctab="${k}"><b>0${i + 1}</b>${l}</button>`).join('')}</div></div>
    <fieldset id="cot-fs" ${lector ? 'disabled' : ''}>${TABS.slice(0, 4).map(([k]) => `<div class="panel${K.tab === k ? ' on' : ''}" id="cp-${k}"></div>`).join('')}</fieldset>
    <div class="panel${K.tab === 'vista' ? ' on' : ''}" id="cp-vista"></div>`;
  V.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ctab]'); if (b) setTab(b.dataset.ctab); });
  V.querySelector('#cot-est').addEventListener('change', (e) => { c.estado = e.target.value; sucio(); if (c.estado === 'APROBADA') sugerirTrabajo(); });
  const fs = V.querySelector('#cot-fs');
  fs.addEventListener('input', onInput); fs.addEventListener('change', onInput); fs.addEventListener('click', onClick);
  pintarPanel(K.tab);
}
function setTab(t) {
  K.tab = t; $$('#v-cotizacion [data-ctab]').forEach((b) => b.classList.toggle('on', b.dataset.ctab === t));
  $$('#v-cotizacion .panel').forEach((p) => p.classList.toggle('on', p.id === 'cp-' + t));
  history.replaceState(null, '', '#cotizacion/' + encodeURIComponent(K.c.id) + '/' + t);
  pintarPanel(t); window.scrollTo(0, 0);
}
const val = (v) => esc(v == null ? '' : v);
const numTxt = (v) => (v == null ? '' : String(v).replace('.', ','));
const fld = (l, path, v, o = {}) => {
  const id = 'c_' + path.replace(/\W/g, '_'), at = `id="${id}" data-c="${path}"${o.n ? ' data-n="1" inputmode="decimal"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}`;
  const inp = o.t === 'area' ? `<textarea ${at} rows="${o.rows || 3}">${val(v)}</textarea>`
    : o.t === 'sel' ? `<select ${at}>${o.o.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`
      : `<input ${at} type="${o.t || 'text'}" value="${o.n ? esc(numTxt(v)) : val(v)}">`;
  return `<label class="campo ${o.w || ''}" for="${id}"><span>${l}</span>${inp}${o.ayuda ? `<small class="ayuda-c">${o.ayuda}</small>` : ''}</label>`;
};
const lista = (l, k, ayuda) => `<label class="campo w4" for="cl_${k}"><span>${l}<button type="button" class="btn xs fant restaurar" data-rest="${k}" title="Volver al texto sugerido">Restaurar sugerido</button></span>
  <textarea id="cl_${k}" data-l="${k}" rows="${Math.max(3, Math.min(9, K.c[k].length + 1))}">${esc(K.c[k].join('\n'))}</textarea>${ayuda ? `<small class="ayuda-c">${ayuda}</small>` : '<small class="ayuda-c">Una actividad por línea.</small>'}</label>`;

function pintarPanel(t) {
  const c = K.c, P = $('#cp-' + t); if (!P) return;
  if (t === 'cliente') {
    P.innerHTML = `<div class="card"><h3><span class="n">01</span>Destinatario</h3><div class="frm">
        ${fld('Tratamiento', 'cliente.tratamiento', c.cliente.tratamiento, { t: 'sel', o: [['Señores', 'Señores'], ['Señor', 'Señor'], ['Señora', 'Señora'], ['Doctor', 'Doctor'], ['Doctora', 'Doctora'], ['Ingeniero', 'Ingeniero'], ['Ingeniera', 'Ingeniera']] })}
        ${fld('Entidad, empresa o persona', 'cliente.entidad', c.cliente.entidad, { w: 'w2', ph: 'Ej.: Conjunto Residencial La Aurora' })}
        ${fld('NIT o cédula (opcional)', 'cliente.nit', c.cliente.nit)}
        ${fld('Atención a (opcional)', 'cliente.atencion', c.cliente.atencion, { w: 'w2', ph: 'Nombre y cargo de quien recibe' })}
        ${fld('Ciudad del destinatario', 'cliente.ciudad', c.cliente.ciudad, { w: 'w2' })}
        ${fld('Teléfono de contacto', 'cliente.telefono', c.cliente.telefono, { ayuda: 'No sale en el documento: se usa en la agenda.' })}
        ${fld('Correo de contacto', 'cliente.correo', c.cliente.correo, { t: 'email', w: 'w2', ayuda: 'No sale en el documento.' })}</div></div>
      <div class="card"><h3><span class="n">02</span>Propuesta</h3><div class="frm">
        ${fld('Fecha', 'fecha', c.fecha, { t: 'date' })}
        ${fld('Ciudad de emisión', 'ciudadEmision', c.ciudadEmision)}
        ${fld('Objeto', 'objeto', c.objeto, { t: 'area', w: 'w4', rows: 2, ph: 'la inspección robotizada de la red de alcantarillado del Conjunto Residencial La Aurora', ayuda: 'Complete la frase «Propuesta técnico-económica para…». Empiece en minúscula.' })}
        ${fld('Párrafo adicional en la carta (opcional)', 'cartaExtra', c.cartaExtra, { t: 'area', w: 'w4', rows: 2 })}</div></div>
      <div class="card"><h3><span class="n">03</span>Quién presenta la cotización</h3>
        <div class="firmantes">${FIRMANTES.map((f, i) => `<button type="button" class="chip${c.firma.nombre === f.nombre ? ' on' : ''}" data-firmante="${i}">${esc(f.nombre)}</button>`).join('')}<span class="ayuda-c">Toque un nombre para llenar la firma; todo queda editable.</span></div>
        <div class="frm">${fld('Nombre', 'firma.nombre', c.firma.nombre, { w: 'w2' })}${fld('Teléfono', 'firma.telefono', c.firma.telefono)}${fld('Correo', 'firma.correo', c.firma.correo, { t: 'email' })}
          ${fld('Perfil bajo la firma', 'firma.perfil', c.firma.perfil, { t: 'area', w: 'w2', rows: 3, ayuda: 'Una línea por renglón.' })}
          ${fld('Credenciales del encabezado (formato sin membrete)', 'firma.credenciales', c.firma.credenciales, { t: 'area', w: 'w2', rows: 3, ayuda: 'Van bajo el nombre en el encabezado cuando se emite sin membrete de HYDRO-ROV.' })}
          ${fld('Matrícula profesional (opcional)', 'firma.matricula', c.firma.matricula, { w: 'w2' })}</div></div>`;
  }
  if (t === 'tramos') {
    const k = calc(c);
    P.innerHTML = `<div class="card"><h3><span class="n">01</span>Descripción del sitio</h3><div class="frm">
        ${fld('Descripción y localización', 'descripcion', c.descripcion, { t: 'area', w: 'w4', rows: 4, ph: 'La inspección corresponde a la red de alcantarillado residual del Conjunto Residencial La Aurora, en Armenia, Quindío. Como el conjunto no dispone de plano…' })}
        ${fld('Nota sobre las longitudes (sale en la carta)', 'notaLongitud', c.notaLongitud, { t: 'area', w: 'w4', rows: 3, ph: 'La longitud total estimada es de … m, medida en un software SIG de esquina a esquina, pues el conjunto no cuenta con plano de alcantarillado…' })}</div></div>
      <div class="card"><h3><span class="n">02</span>Tramos considerados</h3>
        <div class="frm">${fld('Condición por defecto de cada tramo', 'origen', c.origen, { w: 'w2' })}
          <label class="campo w2 chk-c"><input type="checkbox" data-c="redondear" ${c.redondear ? 'checked' : ''}><span>Adoptar la suma redondeada al metro (657,98 m → 658 m)</span></label></div>
        <div class="tr-ed" id="tr-ed">${filasTramos()}</div>
        <div class="tr-pie"><button type="button" class="btn sm" data-ta="tramo">${ico('mas')}Agregar tramo</button><button type="button" class="btn sm" data-ta="pegar">${ico('copiar')}Pegar desde Excel</button>
          <span class="tr-suma" id="tr-suma">${sumaTxt(k)}</span></div></div>
      <div class="card"><h3><span class="n">03</span>Figura de localización (opcional)</h3>
        <div class="loc-img" id="loc-img">${c.imagen ? '<div class="spin"></div>' : `<p class="ayuda-c">Imagen del trazado con las longitudes (captura del SIG, Google Earth o plano). Sale como Figura 1.</p>`}</div>
        <div class="tr-pie"><button type="button" class="btn sm" data-ta="imagen">${ico('foto')}${c.imagen ? 'Cambiar imagen' : 'Cargar imagen'}</button>${c.imagen ? `<button type="button" class="btn sm fant peligro" data-ta="sin-imagen">${ico('x')}Quitar</button>` : ''}</div>
        <div class="frm" style="margin-top:12px">${fld('Pie de la figura', 'pieImagen', c.pieImagen, { w: 'w4' })}</div></div>`;
    if (c.imagen) imagenDe(c).then((u) => { const b = $('#loc-img'); if (b) b.innerHTML = u ? `<img src="${u}" alt="Localización">` : '<p class="ayuda-c">No se pudo cargar la imagen.</p>'; });
  }
  if (t === 'alcance') {
    P.innerHTML = `<div class="card"><h3><span class="n">01</span>Informe que se entrega</h3>
        <div class="op-inf">${Object.entries(INFORMES).map(([k, x]) => `<label class="op${c.informe === k ? ' on' : ''}"><input type="radio" name="inf" value="${k}" data-c="informe" ${c.informe === k ? 'checked' : ''}><b>${x.n}</b><small>${x.d}</small></label>`).join('')}</div></div>
      <div class="card"><h3><span class="n">02</span>Alcance del proyecto</h3><div class="frm">
        ${lista('Preparación y verificación de accesos', 'alcance1')}${lista('Inspección de los tramos', 'alcance2', 'Una por línea. Los tramos por definir del valor se agregan solos.')}
        ${lista('Informe y entrega de archivos', 'alcance3', 'Una por línea. La línea del informe se agrega sola según la opción elegida arriba.')}
        <label class="campo w4"><span>Metodología de ejecución<button type="button" class="btn xs fant restaurar" data-rest="metodologia">Restaurar sugerido</button></span><textarea data-c="metodologia" rows="5">${esc(c.metodologia)}</textarea></label></div></div>
      <div class="card"><h3><span class="n">03</span>Condiciones</h3><div class="frm">
        ${lista('Consideraciones especiales', 'consideraciones')}${lista('Entregables', 'entregables', 'Una por línea. «Informe de la inspección, en formato PDF» se agrega solo si hay informe.')}
        ${lista('Información y condiciones requeridas al contratante', 'requisitos')}${lista('Exclusiones', 'exclusiones')}</div></div>`;
  }
  if (t === 'valor') {
    P.innerHTML = `<div class="card"><h3><span class="n">01</span>Precio y valor</h3><div class="frm">
        ${fld('Precio por metro lineal (COP)', 'precioMl', c.precioMl, { n: true, ayuda: `Sugerido: ${pesos(PRECIO_ML)}. Valor neto, libre de retenciones y descuentos.` })}
        <div class="campo w3 tot-box" id="tot-box"></div></div>
        <div class="it-ed" id="it-ed">${filasItems()}</div>
        <div class="tr-pie"><button type="button" class="btn sm" data-ta="item">${ico('mas')}Agregar ítem</button><button type="button" class="btn sm" data-ta="item-def">${ico('mas')}Tramos por definir (se liquidan por metro)</button></div></div>
      <div class="card"><h3><span class="n">02</span>Valor neto</h3><div class="frm">
        <label class="campo w4"><span>Texto del recuadro «Valor neto · libre de retenciones y descuentos»<button type="button" class="btn xs fant restaurar" data-rest="neto">Restaurar sugerido</button></span><textarea data-c="neto" rows="3">${esc(c.neto)}</textarea></label>
        <label class="campo w4"><span>El valor incluye…<button type="button" class="btn xs fant restaurar" data-rest="incluye">Restaurar sugerido</button></span><textarea data-c="incluye" rows="2">${esc(c.incluye)}</textarea></label></div></div>
      <div class="card"><h3><span class="n">03</span>Plazos, pago y validez</h3><div class="frm">
        ${fld('Jornadas de campo', 'jornadas', c.jornadas, { n: true, ph: 'Ej.: 7' })}
        ${fld('Plazo de entrega (días)', 'plazoEntrega', c.plazoEntrega, { n: true })}
        ${fld('Tipo de días', 'plazoTipo', c.plazoTipo, { t: 'sel', o: [['hábiles', 'Hábiles'], ['calendario', 'Calendario']] })}
        ${fld('Validez (días calendario)', 'validez', c.validez, { n: true })}
        ${fld('Anticipo (%)', 'anticipo', c.anticipo, { n: true, ayuda: 'El saldo se paga contra entrega, ajustado a la longitud inspeccionada.' })}
        ${fld('Nota de pago (opcional)', 'notaPago', c.notaPago, { w: 'w3', ph: 'Ej.: consignación en la cuenta de ahorros…' })}
        <label class="campo w4"><span>Cambios de alcance<button type="button" class="btn xs fant restaurar" data-rest="cambios">Restaurar sugerido</button></span><textarea data-c="cambios" rows="3">${esc(c.cambios)}</textarea></label></div></div>`;
    pintarTotal();
  }
  if (t === 'vista') pintarVista();
}
const sumaTxt = (k) => `${k.n} tramo${k.n === 1 ? '' : 's'} · <b>${mts(k.ml)} m</b>${K.c.redondear && k.mlA !== k.ml ? ` · se adopta <b>${mts(k.mlA)} m</b>` : ''}`;
function filasTramos() {
  const c = K.c;
  if (!c.tramos.length) return '<p class="ayuda-c" style="padding:6px 0 12px">Sin tramos. Agréguelos uno a uno o péguelos desde Excel (nombre y longitud).</p>';
  return `<div class="tr-h"><span>Tramo</span><span>Longitud (m)</span><span>Condición</span><span></span></div>` + c.tramos.map((t) => `<div class="tr-f" data-tid="${esc(t.id)}">
    <input data-tr="nombre" value="${val(t.nombre)}" placeholder="T1" aria-label="Nombre del tramo">
    <input data-tr="longitud" data-n="1" inputmode="decimal" value="${esc(numTxt(t.longitud))}" placeholder="0,00" aria-label="Longitud en metros">
    <input data-tr="nota" value="${val(t.nota)}" placeholder="${esc(c.origen)}" aria-label="Condición">
    <button type="button" class="btn xs fant peligro" data-ta="quitar-tramo" aria-label="Quitar tramo">${ico('x')}</button></div>`).join('');
}
function filasItems() {
  const k = calc(K.c);
  return `<div class="it-h"><span>Descripción</span><span>Cantidad</span><span>Unidad</span><span>Valor unitario</span><span>Subtotal</span><span></span></div>` + k.items.map((x) => `<div class="it-f${x.porDefinir ? ' def' : ''}" data-iid="${esc(x.id)}">
    <textarea data-it="desc" rows="1" aria-label="Descripción">${esc(x.desc)}</textarea>
    ${x.auto ? `<span class="it-auto" title="Suma de los tramos">${mts(x.cant)}<small>de los tramos</small></span>` : x.porDefinir ? '<span class="it-auto">Por definir</span>' : `<input data-it="cant" data-n="1" inputmode="decimal" value="${esc(numTxt(x.cant))}" aria-label="Cantidad">`}
    <select data-it="unidad" aria-label="Unidad" ${x.auto ? 'disabled' : ''}>${Object.entries(UNIDADES).map(([a, b]) => `<option value="${a}"${x.unidad === a ? ' selected' : ''}>${b}</option>`).join('')}</select>
    ${x.usaPrecio ? `<span class="it-auto" title="Toma el precio por metro lineal">${pesos(x.vu)}<small>precio por m</small></span>` : `<input data-it="vu" data-n="1" inputmode="decimal" value="${esc(numTxt(x.vu))}" aria-label="Valor unitario">`}
    <span class="it-sub">${x.porDefinir ? 'Según longitud real' : x.sub == null ? '—' : pesos(x.sub)}</span>
    ${x.auto ? '<span></span>' : `<button type="button" class="btn xs fant peligro" data-ta="quitar-item" aria-label="Quitar ítem">${ico('x')}</button>`}</div>`).join('');
}
function pintarTotal() {
  const b = $('#tot-box'); if (!b) return; const k = calc(K.c);
  b.innerHTML = `<span>Valor total estimado${k.porDefinir.length ? ' (sin ítems por definir)' : ''}</span><b>${pesos(k.total)}</b><small>${esc(pesosLetras(k.total))} M/CTE · neto, libre de retenciones y descuentos</small>`;
}
function refrescarCalculos() {
  const k = calc(K.c);
  const s = $('#tr-suma'); if (s) s.innerHTML = sumaTxt(k);
  k.items.forEach((x) => {
    const f = document.querySelector(`#it-ed [data-iid="${CSS.escape(x.id)}"]`); if (!f) return;
    f.querySelector('.it-sub').textContent = x.porDefinir ? 'Según longitud real' : x.sub == null ? '—' : pesos(x.sub);
    const au = f.querySelectorAll('.it-auto');
    if (x.auto && au[0]) au[0].innerHTML = mts(x.cant) + '<small>de los tramos</small>';
    if (x.usaPrecio && au[au.length - 1]) au[au.length - 1].innerHTML = pesos(x.vu) + '<small>precio por m</small>';
  });
  pintarTotal();
}
function setPath(o, path, v) { const p = path.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) x = x[p[i]]; x[p[p.length - 1]] = v; }
function onInput(e) {
  const el = e.target, c = K.c;
  if (el.dataset.c) {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.n) v = pn(v);
    if (el.type === 'radio') { if (!el.checked) return; $$('.op-inf .op').forEach((x) => x.classList.toggle('on', x.contains(el))); }
    setPath(c, el.dataset.c, v);
    if (el.dataset.c === 'cliente.entidad') $('#cot-tit').textContent = v || 'Cotización sin destinatario';
    if (/^firma\./.test(el.dataset.c)) guardarFirma();
    if (['precioMl', 'redondear'].includes(el.dataset.c)) refrescarCalculos();
  } else if (el.dataset.l) {
    c[el.dataset.l] = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
  } else if (el.dataset.tr) {
    const t = c.tramos.find((x) => x.id === el.closest('[data-tid]').dataset.tid); if (!t) return;
    t[el.dataset.tr] = el.dataset.n ? pn(el.value) : el.value; refrescarCalculos();
  } else if (el.dataset.it) {
    const it = c.items.find((x) => x.id === el.closest('[data-iid]').dataset.iid); if (!it) return;
    it[el.dataset.it] = el.dataset.n ? pn(el.value) : el.value;
    if (el.dataset.it === 'unidad' && e.type === 'change') { $('#it-ed').innerHTML = filasItems(); }
    refrescarCalculos();
  } else return;
  sucio();
}
function guardarFirma() { try { localStorage.setItem('hr_firma_cot', JSON.stringify(K.c.firma)); } catch (e) { /* nada */ } }
async function onClick(e) {
  const c = K.c, fi = e.target.closest('[data-firmante]');
  if (fi) { c.firma = Object.assign({}, FIRMANTES[Number(fi.dataset.firmante)]); delete c.firma.email; guardarFirma(); sucio(); pintarPanel('cliente'); return; }
  const r = e.target.closest('[data-rest]');
  if (r) { e.preventDefault(); const k = r.dataset.rest; c[k] = Array.isArray(DEF[k]) ? DEF[k].slice() : DEF[k]; sucio(); pintarPanel(K.tab); return; }
  const b = e.target.closest('[data-ta]'); if (!b) return;
  const a = b.dataset.ta;
  if (a === 'tramo') { const n = c.tramos.length + 1; c.tramos.push({ id: uid('t'), nombre: 'T' + n, longitud: null, nota: '' }); $('#tr-ed').innerHTML = filasTramos(); const ins = $$('#tr-ed [data-tr="longitud"]'); if (ins.length) ins[ins.length - 1].focus(); }
  if (a === 'quitar-tramo') { c.tramos = c.tramos.filter((x) => x.id !== b.closest('[data-tid]').dataset.tid); $('#tr-ed').innerHTML = filasTramos(); }
  if (a === 'pegar') return pegarTramos();
  if (a === 'item') { c.items.push({ id: uid('i'), desc: '', unidad: 'und', cant: 1, vu: null, usaPrecio: false, porDefinir: false }); $('#it-ed').innerHTML = filasItems(); }
  if (a === 'item-def') { c.items.push({ id: uid('i'), desc: 'Inspección de tramos por definir', unidad: 'm', cant: null, usaPrecio: true, porDefinir: true }); $('#it-ed').innerHTML = filasItems(); }
  if (a === 'quitar-item') { c.items = c.items.filter((x) => x.id !== b.closest('[data-iid]').dataset.iid); $('#it-ed').innerHTML = filasItems(); }
  if (a === 'imagen') return elegirImagen();
  if (a === 'sin-imagen') { c.imagen = null; pintarPanel('tramos'); }
  refrescarCalculos(); sucio();
}
function pegarTramos() {
  const d = abrirModal(`<div class="mh"><h3>Pegar tramos desde Excel</h3><button class="btn xs fant" data-r="0" aria-label="Cerrar">${ico('x')}</button></div><div class="mb">
    <p style="color:var(--mut);margin-bottom:10px">Copie en Excel las columnas <b>Tramo</b> y <b>Longitud</b> (y si quiere, <b>Condición</b>) y péguelas aquí. Se agregan a los tramos actuales.</p>
    <textarea id="pg-t" rows="9" class="inp" style="height:auto;padding:10px;font-family:var(--mono);font-size:12.5px" placeholder="T1&#9;61,59&#10;T2&#9;35,77"></textarea><p class="ayuda-c" id="pg-n" style="margin-top:8px"></p></div>
    <div class="mf"><button class="btn" data-r="0">Cancelar</button><button class="btn pri" data-r="1">Agregar tramos</button></div>`);
  const leer = () => d.querySelector('#pg-t').value.split(/\r?\n/).map((l) => l.split(/\t|;|\s{2,}/).map((x) => x.trim())).filter((x) => x[0])
    .map((x) => { const nn = x.findIndex((v, i) => i > 0 && pn(v) != null); return { id: uid('t'), nombre: x[0], longitud: nn > 0 ? pn(x[nn]) : null, nota: nn > 0 ? x.slice(nn + 1).join(' ') : '' }; });
  d.querySelector('#pg-t').addEventListener('input', () => { const L = leer(); d.querySelector('#pg-n').textContent = L.length ? `${L.length} tramo${L.length === 1 ? '' : 's'} · ${mts(L.reduce((a, x) => a + (x.longitud || 0), 0))} m` : ''; });
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === '1') { const L = leer(); if (!L.length) return; K.c.tramos.push(...L); sucio(); pintarPanel('tramos'); HR.toast(`${L.length} tramos agregados.`, 'ok'); }
    cerrarModal();
  });
  d.querySelector('#pg-t').focus();
}
async function comprimir(file, max = 1800, q = 0.86) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen.')); i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}
function elegirImagen() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const pr = HR.progreso('Subiendo la imagen a Drive…'); pr.set(0.3);
    try {
      const url = await comprimir(f); pr.set(0.6);
      const r = await api('cotImagen', { id: K.c.id, b64: url, anterior: K.c.imagen && K.c.imagen.id });
      K.img[r.fileId] = url; K.c.imagen = { id: r.fileId }; sucio(); pintarPanel('tramos');
    } catch (e) { HR.toast(esc(e.message), 'err'); } finally { pr.fin(); }
  };
  inp.click();
}
async function imagenDe(c) {
  if (!c.imagen) return null; if (K.img[c.imagen.id]) return K.img[c.imagen.id];
  try { const r = await api('cotImagenLeer', { id: c.id, fileId: c.imagen.id }); K.img[c.imagen.id] = r.url; return r.url; } catch (e) { return null; }
}

/* guardado automático (2 s después del último cambio) */
function sucio() {
  if (U.esLector() || !K.c) return;
  K.dirty = true; setSync('pend', 'Cambios sin guardar');
  try { localStorage.setItem('hr_resp_cot_' + K.c.id, JSON.stringify({ t: Date.now(), c: K.c })); } catch (e) { /* lleno */ }
  clearTimeout(K.timer); K.timer = setTimeout(guardarAhora, 2000);
}
async function guardarAhora(forzar) {
  clearTimeout(K.timer);
  if (!K.c || !K.dirty || U.esLector()) return true;
  if (K.guardando) { K.otra = true; return false; }
  K.guardando = true; setSync('pend', 'Guardando…');
  const enviado = K.c;
  try {
    const r = await HR.api('cotGuardar', { cotizacion: enviado, forzar: !!forzar });
    if (r.ok) {
      enviado.rev = r.rev; enviado.actualizado = r.actualizado; enviado.actualizadoPor = r.actualizadoPor; if (K.c === enviado) K.dirty = false;
      setSync('ok', 'Guardado'); try { localStorage.removeItem('hr_resp_cot_' + enviado.id); } catch (e) { /* nada */ }
      const e = K.lista.find((x) => x.id === enviado.id); if (e) Object.assign(e, { estado: enviado.estado, cliente: enviado.cliente.entidad, total: calc(enviado).total });
      return true;
    }
    if (r.codigo === 'CONFLICTO') {
      setSync('err', 'Conflicto');
      const d = abrirModal(`<div class="mh"><h3>Otra persona modificó esta cotización</h3></div><div class="mb"><p style="color:var(--mut)">${esc(r.error)} ¿Qué desea hacer con sus cambios?</p></div>
        <div class="mf"><button class="btn" data-r="recargar">Descartar los míos y recargar</button><button class="btn pri" data-r="forzar">Guardar los míos encima</button></div>`);
      d.addEventListener('click', async (ev) => { const b = ev.target.closest('[data-r]'); if (!b) return; cerrarModal(); if (b.dataset.r === 'forzar') { K.dirty = true; K.guardando = false; await guardarAhora(true); } else { const id = K.c.id; K.c = null; K.dirty = false; abrirCot(id); } });
      return false;
    }
    setSync('err', 'Sin guardar'); HR.toast(esc(r.error), 'err'); return false;
  } catch (e) { setSync('err', 'Sin conexión'); clearTimeout(K.timer); K.timer = setTimeout(guardarAhora, 8000); return false; }
  finally { K.guardando = false; if (K.otra) { K.otra = false; if (K.dirty) setTimeout(guardarAhora, 300); } }
}
window.addEventListener('beforeunload', (e) => { if (K.dirty) { e.preventDefault(); e.returnValue = ''; } });
HRMod.salir = async () => { if (K.c) await guardarAhora(); };

/* ============================================================ vista previa */
function htmlBloques(B, c, alt) {
  const f = c.firma, md = (x) => partes(esc(x)).map((r) => (r.b ? `<b>${r.t}</b>` : r.t)).join('');
  return B.map((b) => {
    if (b.t === 'p') return `<p class="${b.i ? 'it' : ''}" style="${b.before ? 'margin-top:' + b.before + 'px;' : ''}${b.after != null ? 'margin-bottom:' + b.after + 'px' : ''}">${md(b.x)}</p>`;
    if (b.t === 'dest') return `<div class="dest">${b.lineas.map((l) => `<div>${md(l)}</div>`).join('')}</div>`;
    if (b.t === 'h1') return `<h1 class="ch1">${esc(b.n)}. ${esc(b.x)}</h1>`;
    if (b.t === 'h2') return `<h2>${esc(b.n)} ${esc(b.x.toUpperCase())}</h2>`;
    if (b.t === 'h3') return `<h3>${esc(b.n)} ${esc(b.x)}</h3>`;
    if (b.t === 'ul') return `<ul>${b.items.map((x) => `<li>${md(x)}</li>`).join('')}</ul>`;
    if (b.t === 'tabla') return `<table><tr>${b.cols.map((x) => `<th style="width:${x.w * 100}%;text-align:${x.al === 'r' ? 'right' : x.al === 'c' ? 'center' : 'left'}">${esc(x.x)}</th>`).join('')}</tr>
      ${b.filas.map((r) => `<tr>${r.map((v, i) => `<td style="text-align:${b.cols[i].al === 'r' ? 'right' : b.cols[i].al === 'c' ? 'center' : 'left'}">${esc(v)}</td>`).join('')}</tr>`).join('')}
      ${b.total ? `<tr class="tot">${b.total.map((v, i) => `<td style="text-align:${b.cols[i].al === 'r' ? 'right' : b.cols[i].al === 'c' ? 'center' : 'left'}">${esc(v)}</td>`).join('')}</tr>` : ''}</table>`;
    if (b.t === 'caja') return `<div class="caja-neto"><b>${esc(b.titulo)}</b><p>${esc(b.x)}</p></div>`;
    if (b.t === 'img') return `<figure class="fig"><img src="${b.url}" alt=""><figcaption>${esc(b.pie)}</figcaption></figure>`;
    if (b.t === 'firma') return `${b.antes ? `<p style="margin-top:10px">${esc(b.antes)}</p>` : ''}<div class="firma-c"><b>${esc((f.nombre || 'Nombre de quien presenta').toUpperCase())}</b>${firmaLineas(f).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
    if (b.t === 'salto') return '<div class="salto" aria-hidden="true"><span>nueva página</span></div>';
    return '';
  }).join('');
}
async function pintarVista() {
  const c = K.c, P = $('#cp-vista'); if (!P) return;
  const img = await imagenDe(c), { bloques, k } = modelo(c, { imagen: img }), f = c.firma, lector = U.esLector();
  P.innerHTML = `<div class="exp-op"><button class="btn pri" data-cot="pdf">${ico('pdf')}Exportar PDF</button><button class="btn" data-cot="docx">${ico('word')}Exportar Word</button>
      <button class="btn fant" data-cot="drive">${ico('drive')}Carpeta en Drive</button><span class="ayuda" style="margin:0">Al exportar se elige el formato: con membrete de HYDRO-ROV o sin membrete.</span></div>
    <div class="cot-acc solo-editor">${lector ? '' : `<button class="btn sm" data-cot="visita">${ico('cal')}Agendar visita previa</button><button class="btn sm" data-cot="trabajo">${ico('cal')}Programar el trabajo</button>
      <button class="btn sm" data-cot="informe">${ico('doc')}Crear informe con estos datos</button><button class="btn sm fant" data-cot="duplicar">${ico('dup')}Duplicar</button>`}</div>
    <div class="cot-res"><div><span>Valor total</span><b>${pesos(k.total)}</b></div><div><span>Longitud</span><b>${mts(k.mlA)} m</b></div><div><span>Tramos</span><b>${k.n}</b></div><div><span>Vence</span><b>${esc(HR.fFecha(sumarDias(c.fecha, Number(c.validez) || 30)))}</b></div></div>
    <div class="papel cot-papel">
      <div class="enc"><div class="marca"><svg><use href="#logo"/></svg><div><div class="w"><span class="h">HYDRO</span><span class="r" style="color:#0a2a4a">-ROV</span></div><small style="color:#6b7684">${esc(C.LEMA)}</small></div></div>
        <div class="d"><b style="color:#0a2a4a">PROPUESTA TÉCNICO-ECONÓMICA</b><br>${esc(c.id)} · ${esc(fLarga(c.fecha))}</div></div>
      ${htmlBloques(bloques, c)}
      <div class="pie-c">${esc([C.EMPRESA, C.CORREO, f.telefono, C.WEB].filter(Boolean).join(' · '))}</div></div>`;
}

/* ============================================================ exportación */
function elegirFormato(fmt) {
  return new Promise((res) => {
    const d = abrirModal(`<div class="mh"><h3>Emitir la cotización en ${fmt === 'pdf' ? 'PDF' : 'Word'}</h3></div><div class="mb"><p class="mut-p">¿Con qué formato se emite?</p>
      <div class="formatos">
        <button type="button" class="fmt-op" data-f="hr"><span class="fmt-mini hr"><i></i><i></i><i></i><b></b></span><span class="fmt-tx"><b>Con membrete HYDRO-ROV</b><span>Logo, encabezado y pie de página de HYDRO-ROV.</span><em>Consecutivo ${esc(K.c.id)}</em></span></button>
        <button type="button" class="fmt-op" data-f="alt"><span class="fmt-mini alt"><i></i><i></i><i></i></span><span class="fmt-tx"><b>Sin membrete</b><span>Encabezado con el nombre y las credenciales de quien firma, otra presentación y sin mencionar a HYDRO-ROV.</span><em>${K.c.alt ? 'Consecutivo ' + esc(K.c.alt) : 'Consecutivo propio PTE-AAAA-NNN'}</em></span></button>
      </div></div><div class="mf"><button class="btn" data-f="x">Cancelar</button></div>`);
    let hecho = false;
    const fin = (v) => { if (hecho) return; hecho = true; cerrarModal(); res(v); };
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) fin(b.dataset.f === 'x' ? null : b.dataset.f); });
  });
}
async function exportar(fmt) {
  if (!K.c) return;
  const formato = await elegirFormato(fmt); if (!formato) return;
  await guardarAhora();
  const c = K.c, op = { formato, subir: !U.esLector() };
  if (formato === 'alt') {
    if (!c.alt) {
      try { const r = await api('cotConsecutivoAlterno', { id: c.id }); c.alt = r.numero; }
      catch (e) { HR.toast('No se pudo asignar el consecutivo del formato sin membrete: ' + esc(e.message), 'err'); return; }
    }
    op.numero = c.alt;
    const cod = $('#v-cotizacion .cod'); if (cod) cod.textContent = c.id + ' · ' + c.alt;
  }
  const pr = HR.progreso(fmt === 'pdf' ? 'Preparando el PDF…' : 'Preparando el documento de Word…');
  try {
    const img = await imagenDe(c), m = modelo(c, { imagen: img });
    const blob = await (fmt === 'pdf' ? window.HRCotDoc.pdf(c, m, op, pr) : window.HRCotDoc.docx(c, m, op, pr));
    const nombre = nombreArchivo(c, fmt, op);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    if (!op.subir) { HR.toast('Archivo descargado.', 'ok'); return; }
    pr.set(0.92, 'Guardando una copia en Drive…');
    try {
      const r = await api('cotExport', { id: c.id, formato: fmt, nombre, b64: await window.HRExport.blobB64(blob) }, { timeout: 240000 });
      HR.toast(`${fmt === 'pdf' ? 'PDF' : 'Word'} descargado y guardado en Drive · <a href="${esc(r.url)}" target="_blank" rel="noopener">abrir</a>`, 'ok', 9000);
    } catch (e) { HR.toast('Se descargó, pero no se guardó la copia en Drive: ' + esc(e.message), 'err', 9000); }
  } catch (e) { console.error(e); HR.toast('No se pudo generar el archivo: ' + esc(e.message), 'err', 9000); }
  finally { pr.fin(); }
}
function nombreArchivo(c, ext, op) {
  let p = String(c.cliente.entidad || 'sin destinatario').replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (p.length > 70) p = p.slice(0, 70).replace(/[\s,.;:-]+\S*$/, '');
  return (op.formato === 'alt' ? op.numero : c.id) + ' Propuesta técnico-económica - ' + p + '.' + ext;
}

/* ============================================================ enlaces con agenda e informes */
async function agendar(tipo) {
  if (!K.c) return; await guardarAhora();
  const c = K.c, k = calc(c);
  HRMod.nuevoEvento({ tipo, cotId: c.id, cliente: c.cliente.entidad, lugar: [c.cliente.entidad, c.cliente.ciudad].filter(Boolean).join(', '),
    contacto: c.cliente.atencion, telefono: c.cliente.telefono, jornadas: tipo === 'TRABAJO' ? c.jornadas : null,
    titulo: (tipo === 'VISITA' ? 'Visita técnica previa · ' : 'Inspección CCTV · ') + (c.cliente.entidad || c.id) + (tipo === 'TRABAJO' && k.mlA ? ` (${mts(k.mlA)} m)` : '') });
}
function sugerirTrabajo() {
  const ya = (HR.eventosDe ? HR.eventosDe(K.c.id) : []).some((v) => v.tipo === 'TRABAJO' && v.estado !== 'CANCELADO');
  if (ya) return;
  const t = HR.toast(`Cotización aprobada. <button class="btn xs" data-cot="trabajo">${ico('cal')}Programar el trabajo</button>`, 'ok', 10000);
  t.addEventListener('click', (e) => { if (e.target.closest('[data-cot]')) t.remove(); });
}
async function crearInforme() {
  if (!K.c) return; await guardarAhora();
  const c = K.c, ciu = String(c.cliente.ciudad || '').split(',').map((x) => x.trim());
  if (!(await confirmar('Crear informe de inspección', `Se crea un informe nuevo con el cliente <b>${esc(c.cliente.entidad || '—')}</b>, el objeto y la ciudad de esta cotización.`, 'Crear informe'))) return;
  const pr = HR.progreso('Creando el informe…'); pr.set(0.4);
  try {
    await U.crearInforme({ proyecto: sinPunto(c.objeto).replace(/^./, (x) => x.toUpperCase()), cliente: c.cliente.entidad, contrato: 'Propuesta ' + c.id, municipio: ciu[0] || '', departamento: ciu[1] || 'Quindío' });
  } catch (e) { HR.toast(esc(e.message), 'err'); } finally { pr.fin(); }
}

Object.assign(HRMod, { listaCot, abrirCot, modelo, nuevaCot, calc, INFORMES, DEF });
})();
