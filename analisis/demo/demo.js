/* HYDRO-ROV · Análisis — informe DEMO.
   Crea, con la sesión abierta en la app, un informe de ejemplo completo: 3 tramos, cámaras con coordenadas, video,
   fotos con anotaciones, hallazgos con posición horaria y grados, daños continuos, fin anticipado, conclusiones y firmas.
   Uso (desde la app con sesión iniciada): crearDemoHR(). Todo queda marcado como DEMO y se puede eliminar. */
'use strict';
window.crearDemoHR = async function (avisar) {
  const HR = window.HR, A = HR.apiOk, log = avisar || ((t) => console.log('[demo] ' + t));
  const base = new URL('demo/', location.href.replace(/[#?].*$/, '')).href;
  const deBlob = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  const dataURL = async (u) => deBlob(await (await fetch(u)).blob());
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const o = (dist, codigo, grado, hIni, hFin, desc, foto, extra) => Object.assign({ id: uid('o'), dist, tiempo: null, codigo, desc, hIni: hIni || '', hFin: hFin || '', grado, continuo: false, distFin: null, foto: null, _f: foto || null }, extra || {});

  const general = {
    proyecto: 'DEMO · Inspección CCTV de la red de alcantarillado sanitario, Calle 12 entre carreras 4 y 7',
    cliente: 'Empresa de servicios públicos (ejemplo)', contrato: 'DEMO-001-2026', tipo: 'CCTV con equipo robotizado',
    municipio: 'Montenegro', departamento: 'Quindío', sector: 'Calle 12 entre carreras 4 y 7, barrio centro',
    fechaInspeccion: '2026-11-24', fechaInforme: '2026-11-25', clima: 'Seco', limpieza: 'Sí',
    metodoLimpieza: 'Hidrosucción previa con equipo combinado (vactor) el 23 de noviembre',
    equipo: 'Robot de inspección CCTV VEVOR WR030 · cable de 60 m', operador: 'Operador de campo HYDRO-ROV', auxiliar: 'Auxiliar de campo HYDRO-ROV',
    notasCampo: 'Inspección realizada con cierre parcial de la calzada y señalización. Caudal bajo al momento de la inspección (sin lluvias en las 48 h previas). Tapas de los pozos PZ-01 a PZ-04 en buen estado y accesibles.',
    lat: 4.56628, lon: -75.75098,
    ocrZona: { x: 1085 / 1280, y: 12 / 720, w: 173 / 1280, h: 58 / 720, claro: true }
  };
  const T1 = { id: uid('t'), pozoIni: 'PZ-01', pozoFin: 'PZ-02', sentido: 'Aguas abajo', red: 'Sanitaria', material: 'PVC', diametro: 315, longitud: 42.5, inspeccionada: 42.5,
    profIni: 1.8, profFin: 2.1, fecha: '2026-11-24', condicion: 'Regular', ubicacion: 'Calle 12 entre carreras 4 y 5', cIni: { lat: 4.5658, lon: -75.7514 }, cFin: { lat: 4.56612, lon: -75.75112 },
    finAnticipado: '', conclusion: 'Tramo en condición regular: sedimentos en la solera entre 23,40 y 27,00 m y una conexión domiciliaria defectuosa con escurrimiento a los 31,80 m. Las grietas observadas no comprometen por ahora la estabilidad de la tubería.',
    recomendacion: 'Limpieza hidrodinámica del tramo y revisión de la conexión domiciliaria de los 31,80 m (empalme y sello).', video: null,
    obs: [
      o(0, 'INI', 0, '', '', 'Inicio de la inspección en el pozo PZ-01, cámara centrada y con buena visibilidad.', 't1-ini', { tiempo: 0.3 }),
      o(6.2, 'GL', 2, '01', '02', 'Grieta longitudinal fina en la clave, sin desplazamiento de las caras ni infiltración visible.', 't1-cx', { tiempo: 1.6, distFin: 8.1, anotada: true }),
      o(12.4, 'CX', 1, '09', '', 'Conexión domiciliaria a las 9, con acople en buen estado y sin aporte de sedimentos.', 't1-gl', { tiempo: 3.2 }),
      o(23.4, 'SE', 3, '05', '07', 'Sedimentos y depósitos en la solera, con reducción aproximada del 15 % de la sección según apreciación visual.', 't1-ra', { tiempo: 5.0, distFin: 27, anotada: true }),
      o(31.8, 'CXD', 3, '02', '04', 'Conexión domiciliaria defectuosa a las 3: el empalme presenta escurrimiento por el muro y una grieta radial que parte de la conexión.', 't1-se', { tiempo: 7.4, anotada: true }),
      o(42.5, 'FIN', 0, '', '', 'Llegada al pozo PZ-02. Fin del tramo.', 't1-fin', { tiempo: 9.0 })
    ] };
  const T2 = { id: uid('t'), pozoIni: 'PZ-02', pozoFin: 'PZ-03', sentido: 'Aguas abajo', red: 'Sanitaria', material: 'Concreto', diametro: 450, longitud: 55, inspeccionada: 38.6,
    profIni: 2.1, profFin: 2.6, fecha: '2026-11-24', condicion: 'Mala', ubicacion: 'Calle 12 entre carreras 5 y 6', cIni: { lat: 4.56612, lon: -75.75112 }, cFin: { lat: 4.56648, lon: -75.75071 },
    finAnticipado: 'A los 38,60 m la acumulación de escombros y el nivel de agua impidieron el avance del robot. Queda pendiente completar la inspección desde el pozo PZ-03 en sentido aguas arriba.',
    conclusion: 'Tramo en mala condición: infiltración activa a los 15,20 m, raíces en junta a los 30,50 m y fractura longitudinal a los 38,60 m. No fue posible inspeccionar los últimos 16,40 m.',
    recomendacion: 'Intervención prioritaria: corte de raíces, limpieza y nueva inspección completa. Evaluar rehabilitación del tramo (encamisado) con base en el resultado de la inspección desde PZ-03.', video: null,
    obs: [
      o(0, 'INI', 0, '', '', 'Inicio de la inspección en el pozo PZ-02.', null),
      o(8.7, 'DJ', 3, '09', '03', 'Desplazamiento de la junta en la mitad superior de la sección; el borde del tubo siguiente sobresale cerca de 2 cm.', 't2-dj'),
      o(15.2, 'IN', 4, '02', '03', 'Infiltración activa con escurrimiento continuo desde el acople lateral a las 2-3, con huella de flujo sobre el muro hasta la solera.', 't2-in', { anotada: true }),
      o(21, 'OB', 4, '05', '07', 'Escombros y material grueso en la solera que reducen la sección hidráulica.', 't2-fc', { anotada: true }),
      o(30.5, 'RA', 5, '11', '01', 'Raíces en la junta, en la clave; ocupan cerca de la mitad de la sección. Registro sin foto: la cámara se empañó en ese punto.', null),
      o(38.6, 'FL', 4, '10', '12', 'Fractura longitudinal en el cuadrante superior izquierdo con abertura visible.', 't2-ra', { anotada: true }),
      o(38.6, 'FA', 0, '', '', 'Fin anticipado de la inspección: el robot no pudo avanzar por escombros y nivel de agua.', null)
    ] };
  const T3 = { id: uid('t'), pozoIni: 'PZ-03', pozoFin: 'PZ-04', sentido: 'Aguas abajo', red: 'Sanitaria', material: 'GRP / PRFV', diametro: 400, longitud: 30, inspeccionada: 30,
    profIni: 2.6, profFin: 2.9, fecha: '2026-11-24', condicion: 'Buena', ubicacion: 'Calle 12 entre carreras 6 y 7', cIni: { lat: 4.56648, lon: -75.75071 }, cFin: { lat: 4.56671, lon: -75.75049 },
    finAnticipado: '', conclusion: 'Tramo en buena condición estructural; empozamiento leve con depósitos en la solera entre 18,00 y 24,00 m y una conexión penetrante a los 9,50 m.',
    recomendacion: 'Retirar el excedente de la conexión penetrante y verificar la pendiente entre 18 y 24 m en la próxima limpieza programada.', video: null,
    obs: [
      o(0, 'INI', 0, '', '', 'Inicio de la inspección en el pozo PZ-03.', null),
      o(9.5, 'CXP', 2, '03', '', 'Conexión penetrante a las 3: el tubo domiciliario sobresale cerca de 4 cm dentro del colector.', 't3-cxp'),
      o(18, 'EM', 2, '05', '07', 'Empozamiento leve con depósitos de material fino en la solera.', 't3-em', { distFin: 24, anotada: true }),
      o(30, 'FIN', 0, '', '', 'Llegada al pozo PZ-04. Fin del tramo.', null)
    ] };
  const informe = {
    estado: 'REVISION', muestra: true, general, tramos: [T1, T2, T3],
    alcance: 'Inspección por circuito cerrado de televisión (CCTV) de tres tramos consecutivos del colector sanitario de la Calle 12, entre los pozos PZ-01 y PZ-04, con robot autopropulsado y registro continuo de video. Cada hallazgo se registra con su distancia desde el pozo de inicio (leída del contador del equipo), su posición horaria mirando aguas abajo (12 = clave, 6 = solera), un código del catálogo de defectos y un grado de severidad de 1 (muy leve) a 5 (crítico) según el criterio del inspector. DOCUMENTO DE DEMOSTRACIÓN: los datos y las fotografías son ilustrativos.',
    conclusiones: 'De los tres tramos inspeccionados, el PZ-02 → PZ-03 presenta la condición más desfavorable (mala), con infiltración activa, raíces en junta y fractura longitudinal, y quedó con inspección incompleta por obstrucción. El tramo PZ-01 → PZ-02 está en condición regular por sedimentos y una conexión defectuosa. El tramo PZ-03 → PZ-04 está en buena condición, con hallazgos leves de operación.',
    recomendaciones: '1. Priorizar el tramo PZ-02 → PZ-03: corte de raíces, retiro de escombros y nueva inspección completa desde PZ-03.\n2. Programar limpieza hidrodinámica en PZ-01 → PZ-02 y corregir la conexión domiciliaria de los 31,80 m.\n3. Incluir los tramos en el plan de mantenimiento preventivo con inspección de seguimiento en 12 meses.',
    anexos: 'Videos de inspección del tramo PZ-01 → PZ-02 (archivo MP4) en la carpeta del informe. Registro fotográfico completo en la carpeta «fotos».',
    firmas: [
      { rol: 'Elaboró', nombre: '', cargo: 'Ingeniero responsable de la inspección', matricula: '' },
      { rol: 'Revisó', nombre: '', cargo: 'Interventoría', matricula: '' },
      { rol: 'Vo. Bo.', nombre: '', cargo: 'Supervisor del contrato · Empresa de servicios públicos', matricula: '' }
    ]
  };

  log('Creando el informe y su carpeta en Drive…');
  const creado = (await A('crear', { informe: JSON.parse(JSON.stringify(informe, (k, v) => (k === '_f' || k === 'anotada' ? undefined : v))) })).informe;
  const fotos = informe.tramos.flatMap((t) => t.obs.filter((x) => x._f).map((x) => ({ t, x })));
  let n = 0;
  for (const { t, x } of fotos) {
    n++; log(`Subiendo foto ${n} de ${fotos.length}…`);
    const nombre = `${creado.id} ${t.pozoIni}-${t.pozoFin} ${x.codigo}`;
    const orig = await A('subirFoto', { id: creado.id, b64: await dataURL(base + x._f + '.jpg'), nombre });
    if (x.anotada) { const an = await A('subirFoto', { id: creado.id, b64: await dataURL(base + x._f + '-anotada.jpg'), nombre: nombre + ' anotada' }); x.foto = { id: an.fileId, original: orig.fileId }; }
    else x.foto = { id: orig.fileId };
    delete x._f; delete x.anotada;
  }
  informe.tramos.forEach((t) => t.obs.forEach((x) => { delete x._f; delete x.anotada; }));
  log('Subiendo el video del tramo PZ-01 → PZ-02…');
  const vb = await (await fetch(base + 'tramo-demo.mp4')).blob();
  const up = await A('videoIniciar', { id: creado.id, nombre: creado.id + ' PZ-01-PZ-02.mp4', tamano: vb.size, mime: 'video/mp4', tramo: 'PZ-01 → PZ-02' });
  let off = 0, fin = null;
  while (!fin) {
    const b64 = (await deBlob(vb.slice(off, off + up.trozo))).split(',')[1];
    const r = await A('videoTrozo', { subida: up.subida, inicio: off, b64 }, { timeout: 240000 });
    if (r.fin) fin = r; else off = r.siguiente;
  }
  T1.video = { id: fin.fileId, nombre: 'Inspección PZ-01 a PZ-02.mp4', tamano: vb.size, subido: new Date().toISOString() };
  log('Guardando el informe completo…');
  const final = Object.assign({}, informe, { id: creado.id, rev: creado.rev });
  await A('guardar', { informe: final });
  log('Listo: ' + creado.id);
  return creado.id;
};
