/**
 * HYDRO-ROV · Análisis — servidor (Google Apps Script)
 * ---------------------------------------------------------------------------------------------
 * Se publica como aplicación web: "Ejecutar como: Yo (jjospinagon@gmail.com)" y "Quién tiene acceso: Cualquier usuario".
 * Todo lo que se guarda queda en el Drive de la cuenta propietaria, en la carpeta
 * "HYDRO-ROV · Informes de inspección" (una subcarpeta por informe: informe.json, fotos, videos y exportados).
 *
 * Seguridad
 *  - Ingreso con correo y contraseña. La contraseña se guarda solo como HMAC-SHA256 iterado con sal propia por usuario.
 *  - Clave inicial 0000 para los creadores, con cambio obligatorio en el primer ingreso (el servidor no atiende
 *    ninguna otra acción hasta que se cambie).
 *  - 5 intentos fallidos bloquean la cuenta 15 minutos; límite global de intentos por minuto.
 *  - Sesiones con token aleatorio de 256 bits; en el servidor solo se guarda su huella SHA-256.
 *  - Roles: CREADOR (todo, incluida la gestión de usuarios), EDITOR (crea y edita informes), LECTOR (solo consulta).
 *  - Ningún archivo de Drive se entrega si no pertenece a la carpeta del informe que se consulta.
 *
 * Instalación: ver LEEME-DESPLIEGUE.md. Ejecutar una vez la función instalar() desde el editor para autorizar.
 */

var VERSION = '1.9.0 (2026-11-25)';

var CFG = {
  RAIZ_NOMBRE: 'HYDRO-ROV · Informes de inspección',
  CREADORES: [
    { email: 'jjospinagon@gmail.com', nombre: 'Juan José Ospina González' },
    { email: 'ing.jjgomezm@gmail.com', nombre: 'Juan José Gómez Moscoso' }
  ],
  CLAVE_INICIAL: '0000',
  ITERACIONES: 1000,            // HMAC-SHA256 iterado
  SES_HORAS: 10,                // sesión normal (se renueva con el uso)
  SES_RECORDAR_DIAS: 30,        // "mantener la sesión en este equipo"
  MAX_FALLOS: 5,
  BLOQUEO_MIN: 15,
  MAX_INTENTOS_MIN: 40,         // intentos de ingreso por minuto en todo el sistema
  MAX_JSON: 1800000,            // tamaño máximo del informe (sin fotos)
  MAX_FOTO: 10 * 1024 * 1024,
  MAX_EXPORT: 36 * 1024 * 1024,
  MAX_TROZO: 8 * 1024 * 1024,
  ROLES: ['CREADOR', 'EDITOR', 'LECTOR']
};
var GENERICO = 'Correo o contraseña incorrectos.';

/* ============================================================ entrada */
function doGet() {
  return json_({ ok: true, servicio: 'HYDRO-ROV Análisis', version: VERSION });
}

function doPost(e) {
  var q;
  try { q = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Solicitud inválida.' }); }
  try {
    return json_(despachar_(q));
  } catch (err) {
    if (err && err.usuario) return json_({ ok: false, error: err.message, codigo: err.codigo || null });
    console.error(err && err.stack || err);
    return json_({ ok: false, error: 'Error interno del servidor. Intente de nuevo.' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function Falla_(msg, codigo) { var e = new Error(msg); e.usuario = true; e.codigo = codigo; return e; }

function despachar_(q) {
  var a = String(q.action || '');
  asegurarUsuarios_();
  if (a === 'estado') return { ok: true, version: VERSION };
  if (a === 'login') return login_(q);
  if (a === 'verificar') return verificar_(q);          // público: página de autenticidad (código del QR)
  if (a === 'verificarFotos') return verificarFotos_(q);
  if (a === 'verificarHuella') return verificarHuella_(q);   // público: identificar un PDF/Word por su huella
  if (a === 'pushNovedades') return pushNovedades_(q);       // público con clave propia: lo llama el service worker al recibir un push

  var ses = sesion_(q.token);
  if (!ses) throw Falla_('Su sesión terminó. Ingrese de nuevo.', 'NO_AUTH');
  if (a === 'logout') return logout_(q.token, ses);
  if (a === 'yo') return { ok: true, usuario: publico_(ses.email, ses.user) };
  if (a === 'cambiarClave') return cambiarClave_(ses, q);
  if (ses.user.debeCambiar) throw Falla_('Debe crear su contraseña personal antes de continuar.', 'CAMBIAR');

  switch (a) {
    case 'listar': return listar_(ses);
    case 'obtener': return obtener_(ses, q);
    case 'crear': puede_(ses, 'editar'); return crear_(ses, q);
    case 'guardar': puede_(ses, 'editar'); return guardar_(ses, q);
    case 'duplicar': puede_(ses, 'editar'); return duplicar_(ses, q);
    case 'eliminar': puede_(ses, 'editar'); return eliminar_(ses, q);
    case 'descartar': puede_(ses, 'editar'); return descartar_(ses, q);
    case 'subirFoto': puede_(ses, 'editar'); return subirFoto_(ses, q);
    case 'obtenerFotos': return obtenerFotos_(ses, q);
    case 'borrarFoto': puede_(ses, 'editar'); return borrarFoto_(ses, q);
    case 'videoIniciar': puede_(ses, 'editar'); return videoIniciar_(ses, q);
    case 'videoTrozo': puede_(ses, 'editar'); return videoTrozo_(ses, q);
    case 'videoLeer': return videoLeer_(ses, q);
    case 'subirExport': puede_(ses, 'editar'); return subirExport_(ses, q);
    case 'emitir': puede_(ses, 'editar'); return emitir_(ses, q);
    case 'consecutivoAlterno': puede_(ses, 'editar'); return consecutivoAlterno_(ses, q);
    case 'enlaceDrive': return enlaceDrive_(ses, q);
    case 'usuarios': puede_(ses, 'admin'); return usuariosListar_();
    case 'usuarioGuardar': puede_(ses, 'admin'); return usuarioGuardar_(ses, q);
    case 'usuarioReiniciar': puede_(ses, 'admin'); return usuarioReiniciar_(ses, q);
    case 'auditoria': puede_(ses, 'admin'); return { ok: true, eventos: leerAuditoria_() };
    case 'cotListar': return cotListar_();
    case 'cotObtener': return cotObtener_(q);
    case 'cotCrear': puede_(ses, 'editar'); return cotCrear_(ses, q);
    case 'cotGuardar': puede_(ses, 'editar'); return cotGuardar_(ses, q);
    case 'cotEliminar': puede_(ses, 'editar'); return cotEliminar_(ses, q);
    case 'cotImagen': puede_(ses, 'editar'); return cotImagen_(ses, q);
    case 'cotImagenLeer': return cotImagenLeer_(q);
    case 'cotExport': puede_(ses, 'editar'); return cotExport_(ses, q);
    case 'cotConsecutivoAlterno': puede_(ses, 'editar'); return cotConsecutivoAlterno_(ses, q);
    case 'agenda': return { ok: true, eventos: leerAgenda_().eventos };
    case 'avisos': return avisosDe_(ses.email);
    case 'avisosLeidos': return avisosLeidos_(ses.email, q);
    case 'pushClave': return { ok: true, clave: vapid_().pub };
    case 'pushSuscribir': return pushSuscribir_(ses, q);
    case 'pushQuitar': return pushQuitar_(ses, q);
    case 'pushProbar': return pushProbar_(ses);
    case 'agendaGuardar': puede_(ses, 'editar'); return agendaGuardar_(ses, q);
    case 'agendaEliminar': puede_(ses, 'editar'); return agendaEliminar_(ses, q);
  }
  throw Falla_('Acción desconocida.');
}

function puede_(ses, que) {
  var r = ses.user.rol;
  if (que === 'admin' && r !== 'CREADOR') throw Falla_('Esta opción es solo para los creadores.', 'PERMISO');
  if (que === 'editar' && r === 'LECTOR') throw Falla_('Su usuario es de solo consulta.', 'PERMISO');
}

/* ============================================================ utilidades */
function props_() { return PropertiesService.getScriptProperties(); }
function ahora_() { return new Date().toISOString(); }
function txt_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n || 300); }
function normEmail_(s) {
  var e = String(s || '').trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) && e.length <= 120 ? e : '';
}
function hex_(bytes) {
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}
function sha256_(t) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)); }
function aleatorio_(n) { // n bytes hex aprox. a partir de UUID v4 (122 bits aleatorios c/u)
  var s = '';
  while (s.length < n * 2) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, n * 2);
}
function hashClave_(clave, sal) {
  var k = Utilities.newBlob(String(sal)).getBytes();
  var h = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(clave)).getBytes(), k);
  for (var i = 1; i < CFG.ITERACIONES; i++) h = Utilities.computeHmacSha256Signature(h, k);
  return Utilities.base64Encode(h);
}
function igual_(a, b) { // comparación de tiempo constante
  a = String(a); b = String(b);
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function conCandado_(fn) {
  var l = LockService.getScriptLock();
  if (!l.tryLock(25000)) throw Falla_('El servidor está ocupado. Intente de nuevo en unos segundos.');
  try { return fn(); } finally { l.releaseLock(); }
}
function claveTemporal_() {
  var abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', s = '', r = aleatorio_(12);
  for (var i = 0; i < 10; i++) s += abc.charAt(parseInt(r.substr(i * 2, 2), 16) % abc.length);
  return s.slice(0, 5) + '-' + s.slice(5);
}

/* ============================================================ usuarios */
function usuarios_() { var t = props_().getProperty('USUARIOS'); return t ? JSON.parse(t) : {}; }
function guardarUsuarios_(U) { props_().setProperty('USUARIOS', JSON.stringify(U)); }
function esCreadorFijo_(email) { return CFG.CREADORES.some(function (c) { return c.email === email; }); }

function nuevoUsuario_(nombre, rol, clave, debeCambiar) {
  var sal = aleatorio_(16);
  return { nombre: nombre, rol: rol, sal: sal, hash: hashClave_(clave, sal), debeCambiar: !!debeCambiar,
           activo: true, fallos: 0, bloqueoHasta: 0, creado: ahora_(), ultimoIngreso: null };
}

function asegurarUsuarios_() {
  if (props_().getProperty('USUARIOS')) return;
  conCandado_(function () {
    if (props_().getProperty('USUARIOS')) return;
    var U = {};
    CFG.CREADORES.forEach(function (c) { U[c.email] = nuevoUsuario_(c.nombre, 'CREADOR', CFG.CLAVE_INICIAL, true); });
    guardarUsuarios_(U);
  });
}

function publico_(email, u) {
  return { email: email, nombre: u.nombre, rol: u.rol, debeCambiar: !!u.debeCambiar, activo: u.activo !== false,
           ultimoIngreso: u.ultimoIngreso || null, creadorFijo: esCreadorFijo_(email) };
}

function validarClaveNueva_(clave, email) {
  clave = String(clave || '');
  if (clave.length < 8) throw Falla_('La contraseña debe tener al menos 8 caracteres.');
  if (clave.length > 128) throw Falla_('La contraseña es demasiado larga.');
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clave) || !/[0-9]/.test(clave)) throw Falla_('Use letras y números en la contraseña.');
  if (/^(.)\1+$/.test(clave) || /^(0123|1234|2345|abcd|qwer|0000)/i.test(clave)) throw Falla_('Esa contraseña es demasiado fácil de adivinar.');
  var local = String(email || '').split('@')[0];
  if (local && local.length >= 4 && clave.toLowerCase().indexOf(local) >= 0) throw Falla_('La contraseña no puede contener su correo.');
}

/* ============================================================ sesiones */
function login_(q) {
  var email = normEmail_(q.email), clave = String(q.clave || '');
  if (!email || !clave) throw Falla_('Escriba su correo y su contraseña.');
  var cache = CacheService.getScriptCache();
  var gk = 'LG_' + Math.floor(Date.now() / 60000), g = Number(cache.get(gk) || 0);
  if (g >= CFG.MAX_INTENTOS_MIN) throw Falla_('Demasiados intentos de ingreso. Espere un minuto.');
  cache.put(gk, String(g + 1), 120);

  var res = conCandado_(function () {
    var U = usuarios_(), u = U[email];
    if (!u || u.activo === false) { hashClave_(clave, 'igualar-tiempo'); return { error: GENERICO }; }
    if (u.bloqueoHasta && u.bloqueoHasta > Date.now()) {
      var min = Math.ceil((u.bloqueoHasta - Date.now()) / 60000);
      return { error: 'Cuenta bloqueada por intentos fallidos. Intente de nuevo en ' + min + ' min.' };
    }
    if (!igual_(hashClave_(clave, u.sal), u.hash)) {
      u.fallos = (u.fallos || 0) + 1;
      var bloq = u.fallos >= CFG.MAX_FALLOS;
      if (bloq) { u.bloqueoHasta = Date.now() + CFG.BLOQUEO_MIN * 60000; u.fallos = 0; }
      guardarUsuarios_(U);
      auditar_(email, bloq ? 'cuenta_bloqueada' : 'ingreso_fallido', '');
      return { error: bloq ? 'Demasiados intentos fallidos: la cuenta queda bloqueada ' + CFG.BLOQUEO_MIN + ' minutos.' : GENERICO };
    }
    u.fallos = 0; u.bloqueoHasta = 0; u.ultimoIngreso = ahora_();
    guardarUsuarios_(U);
    return { u: u };
  });
  if (res.error) throw Falla_(res.error, 'LOGIN');
  var s = crearSesion_(email, !!q.recordar);
  auditar_(email, 'ingreso', q.recordar ? 'recordar' : '');
  return { ok: true, token: s.token, expira: s.expira, usuario: publico_(email, res.u) };
}

function crearSesion_(email, recordar) {
  var token = aleatorio_(32);
  var dur = recordar ? CFG.SES_RECORDAR_DIAS * 86400000 : CFG.SES_HORAS * 3600000;
  var exp = Date.now() + dur;
  limpiarSesiones_();
  props_().setProperty('S_' + sha256_(token), JSON.stringify({ e: email, x: exp, r: recordar ? 1 : 0 }));
  return { token: token, expira: new Date(exp).toISOString() };
}

function sesion_(token) {
  token = String(token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  var k = 'S_' + sha256_(token), t = props_().getProperty(k);
  if (!t) return null;
  var s = JSON.parse(t);
  if (s.x < Date.now()) { props_().deleteProperty(k); return null; }
  var U = usuarios_(), u = U[s.e];
  if (!u || u.activo === false) { props_().deleteProperty(k); return null; }
  if (!s.r && s.x - Date.now() < CFG.SES_HORAS * 3600000 / 2) { // renovación por uso
    s.x = Date.now() + CFG.SES_HORAS * 3600000; props_().setProperty(k, JSON.stringify(s));
  }
  return { email: s.e, user: u, clave: k };
}

function logout_(token, ses) {
  props_().deleteProperty(ses.clave);
  auditar_(ses.email, 'salida', '');
  return { ok: true };
}

function limpiarSesiones_() {
  var p = props_(), all = p.getProperties(), n = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    try { if (JSON.parse(all[k]).x < n) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); }
  });
}

function cerrarSesionesDe_(email, excepto) {
  var p = props_(), all = p.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') !== 0 || k === excepto) return;
    try { if (JSON.parse(all[k]).e === email) p.deleteProperty(k); } catch (e) { /* nada */ }
  });
}

function cambiarClave_(ses, q) {
  var actual = String(q.actual || ''), nueva = String(q.nueva || '');
  validarClaveNueva_(nueva, ses.email);
  var r = conCandado_(function () {
    var U = usuarios_(), u = U[ses.email];
    if (!igual_(hashClave_(actual, u.sal), u.hash)) return { error: 'La contraseña actual no es correcta.' };
    if (igual_(hashClave_(nueva, u.sal), u.hash)) return { error: 'La nueva contraseña debe ser distinta de la actual.' };
    u.sal = aleatorio_(16); u.hash = hashClave_(nueva, u.sal); u.debeCambiar = false; u.claveCambiada = ahora_();
    guardarUsuarios_(U);
    return { u: u };
  });
  if (r.error) throw Falla_(r.error);
  cerrarSesionesDe_(ses.email, ses.clave);   // cualquier otra sesión abierta con la clave anterior queda cerrada
  auditar_(ses.email, 'cambio_clave', '');
  return { ok: true, usuario: publico_(ses.email, r.u) };
}

/* ============================================================ gestión de usuarios (creadores) */
function usuariosListar_() {
  var U = usuarios_();
  return { ok: true, usuarios: Object.keys(U).sort().map(function (e) {
    var p = publico_(e, U[e]); p.bloqueado = U[e].bloqueoHasta > Date.now(); return p;
  }) };
}

function usuarioGuardar_(ses, q) {
  var email = normEmail_(q.email);
  if (!email) throw Falla_('Correo no válido.');
  var nombre = txt_(q.nombre, 80), rol = String(q.rol || 'EDITOR').toUpperCase();
  if (CFG.ROLES.indexOf(rol) < 0) throw Falla_('Rol no válido.');
  var activo = q.activo !== false;
  var r = conCandado_(function () {
    var U = usuarios_(), u = U[email], temporal = null;
    if (esCreadorFijo_(email) && (rol !== 'CREADOR' || !activo)) return { error: 'Los creadores fijos no se pueden degradar ni desactivar.' };
    if (!u) {
      if (Object.keys(U).length >= 30) return { error: 'Se alcanzó el máximo de 30 usuarios.' };
      temporal = claveTemporal_();
      u = U[email] = nuevoUsuario_(nombre || email, rol, temporal, true);
    } else {
      if (nombre) u.nombre = nombre;
      u.rol = rol; u.activo = activo;
      if (q.desbloquear) { u.bloqueoHasta = 0; u.fallos = 0; }
    }
    guardarUsuarios_(U);
    return { u: u, temporal: temporal };
  });
  if (r.error) throw Falla_(r.error);
  if (!activo) cerrarSesionesDe_(email, null);
  auditar_(ses.email, r.temporal ? 'usuario_creado' : 'usuario_editado', email + ' ' + rol + (activo ? '' : ' inactivo'));
  return { ok: true, usuario: publico_(email, r.u), claveTemporal: r.temporal };
}

function usuarioReiniciar_(ses, q) {
  var email = normEmail_(q.email);
  var temporal = claveTemporal_();
  var r = conCandado_(function () {
    var U = usuarios_(), u = U[email];
    if (!u) return { error: 'Ese usuario no existe.' };
    u.sal = aleatorio_(16); u.hash = hashClave_(temporal, u.sal); u.debeCambiar = true; u.fallos = 0; u.bloqueoHasta = 0;
    guardarUsuarios_(U);
    return { u: u };
  });
  if (r.error) throw Falla_(r.error);
  cerrarSesionesDe_(email, null);
  auditar_(ses.email, 'clave_reiniciada', email);
  return { ok: true, claveTemporal: temporal };
}

/* ============================================================ Drive: carpetas e índice */
function raiz_() {
  var id = props_().getProperty('RAIZ_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* se recrea */ } }
  var it = DriveApp.getRootFolder().getFoldersByName(CFG.RAIZ_NOMBRE);
  var r = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(CFG.RAIZ_NOMBRE);
  r.setDescription('HYDRO-ROV · Informes de inspección CCTV de redes. Generado por analisis.hydro-rov.com — no mover ni renombrar los archivos internos.');
  props_().setProperty('RAIZ_ID', r.getId());
  return r;
}
function sistema_() {
  var id = props_().getProperty('SIS_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* se recrea */ } }
  var r = raiz_(), it = r.getFoldersByName('_sistema');
  var s = it.hasNext() ? it.next() : r.createFolder('_sistema');
  props_().setProperty('SIS_ID', s.getId());
  return s;
}
function archivoSistema_(nombre, inicial) {
  var key = 'F_' + nombre, id = props_().getProperty(key);
  if (id) { try { var f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) { /* se recrea */ } }
  var s = sistema_(), it = s.getFilesByName(nombre);
  var a = it.hasNext() ? it.next() : s.createFile(nombre, inicial, MimeType.PLAIN_TEXT);
  props_().setProperty(key, a.getId());
  return a;
}
function leerIndice_() { return JSON.parse(archivoSistema_('_indice.json', '{"informes":[]}').getBlob().getDataAsString('UTF-8') || '{"informes":[]}'); }
function guardarIndice_(ix) { archivoSistema_('_indice.json', '{"informes":[]}').setContent(JSON.stringify(ix)); }
function entrada_(ix, id) {
  for (var i = 0; i < ix.informes.length; i++) if (ix.informes[i].id === id) return ix.informes[i];
  return null;
}
function entradaOFalla_(id) {
  id = String(id || '');
  if (!/^HR-\d{4}-\d{3,4}$/.test(id)) throw Falla_('Informe no válido.');
  var e = entrada_(leerIndice_(), id);
  if (!e) throw Falla_('Ese informe ya no existe.', 'NO_EXISTE');
  return e;
}
function nombreCarpeta_(id, titulo) { return (id + ' · ' + (titulo || 'Sin título')).replace(/[\\/:*?"<>|]/g, '-').slice(0, 120); }

function resumen_(inf, e) {
  var g = inf.general || {}, tramos = inf.tramos || [], nobs = 0, max = 0;
  tramos.forEach(function (t) { (t.obs || []).forEach(function (o) { nobs++; if (Number(o.grado) > max) max = Number(o.grado); }); });
  var portada = null;
  for (var i = 0; i < tramos.length && !portada; i++) for (var j = 0; j < (tramos[i].obs || []).length; j++) {
    if (tramos[i].obs[j].foto && tramos[i].obs[j].foto.id) { portada = tramos[i].obs[j].foto.id; break; }
  }
  e.titulo = txt_(g.proyecto, 160) || 'Sin título';
  e.cliente = txt_(g.cliente, 120);
  e.municipio = txt_(g.municipio, 80);
  e.fecha = txt_(g.fechaInspeccion, 10);
  e.estado = txt_(inf.estado, 20) || 'BORRADOR';
  /* informe de muestra (el que se publica en la web): se lista, pero no suma en los indicadores ni en el mapa */
  if (inf.muestra) e.muestra = true; else delete e.muestra;
  e.tramos = tramos.length; e.obs = nobs; e.gradoMax = max;
  e.portada = portada;
  /* metros lineales: la longitud inspeccionada que registró el inspector (si no la puso, la del tramo) */
  var ml = 0, pts = [], lin = [];
  var cam = function (c) { return c && isFinite(Number(c.lat)) && isFinite(Number(c.lon)) && c.lat !== null && c.lon !== null && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180 ? [Number(c.lat), Number(c.lon)] : null; };
  tramos.forEach(function (t) {
    var v = Number(t.inspeccionada); if (!(v > 0)) v = Number(t.longitud); if (v > 0 && v < 100000) ml += v;
    var a = cam(t.cIni) || coord_(t.coord), b = cam(t.cFin), et = txt_((t.pozoIni || '') + ' → ' + (t.pozoFin || ''), 40);
    if (a && pts.length < 80) pts.push([a[0], a[1], txt_(t.pozoIni || 'cámara', 20)]);
    if (b && pts.length < 80) pts.push([b[0], b[1], txt_(t.pozoFin || 'cámara', 20)]);
    if (a && b && lin.length < 60) lin.push([a[0], a[1], b[0], b[1], et]);
  });
  e.lin = lin;
  e.ml = Math.round(ml * 100) / 100;
  var lat = Number(g.lat), lon = Number(g.lon);
  e.lat = isFinite(lat) && Math.abs(lat) <= 90 && g.lat !== '' && g.lat != null ? lat : null;
  e.lon = isFinite(lon) && Math.abs(lon) <= 180 && g.lon !== '' && g.lon != null ? lon : null;
  if (e.lat == null && pts.length) { e.lat = pts[0][0]; e.lon = pts[0][1]; }
  e.pts = pts;
  e.rev = inf.rev; e.actualizado = inf.actualizado; e.actualizadoPor = inf.actualizadoPor;
  return e;
}

/* ============================================================ informes */
function coord_(s) {
  var m = /(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/.exec(String(s || ''));
  if (!m) return null;
  var a = Number(m[1]), b = Number(m[2]);
  return isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null;
}
function listar_(ses) {
  var ix = leerIndice_();
  /* informes guardados antes de la versión 1.2: completar metros lineales y ubicación una sola vez */
  if (ix.informes.some(function (x) { return x.ml === undefined; })) {
    conCandado_(function () {
      ix = leerIndice_();
      ix.informes.forEach(function (e) { if (e.ml === undefined) { try { resumen_(leerInforme_(e), e); } catch (err) { e.ml = 0; } } });
      guardarIndice_(ix);
    });
  }
  /* versión 1.5: informes creados antes de las carpetas por año y mes — se reubican una sola vez */
  if (ix.informes.some(function (x) { return x.mes === undefined; })) {
    conCandado_(function () {
      ix = leerIndice_();
      ix.informes.forEach(function (e) { if (e.mes === undefined) { try { ubicarCarpeta_(e, leerInforme_(e)); } catch (err) { /* se reintenta */ } } });
      guardarIndice_(ix);
    });
  }
  return { ok: true, informes: ix.informes.slice().sort(function (a, b) { return String(b.actualizado).localeCompare(String(a.actualizado)); }),
           usuario: publico_(ses.email, ses.user) };
}

function leerInforme_(e) { return JSON.parse(DriveApp.getFileById(e.archivo).getBlob().getDataAsString('UTF-8')); }

function obtener_(ses, q) {
  var e = entradaOFalla_(q.id);
  return { ok: true, informe: leerInforme_(e), carpeta: DriveApp.getFolderById(e.carpeta).getUrl() };
}

/* ---- carpetas por año y mes: Raíz / 2026 / 11 · Noviembre / HR-2026-004 · título
   El mes es el de la fecha de inspección; si aún no se ha escrito, el de creación del informe. Si luego cambia la
   fecha de inspección a otro mes, la carpeta del informe se mueve sola. */
var MESES_ = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function claveMes_(fechaInsp, respaldo) {
  var m = /^(\d{4})-(\d{2})/.exec(String(fechaInsp || ''));
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return m[1] + '-' + m[2];
  var d = respaldo ? new Date(respaldo) : new Date(); if (isNaN(d.getTime())) d = new Date();
  return Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM');
}
function hija_(padre, nombre) { var it = padre.getFoldersByName(nombre); return it.hasNext() ? it.next() : padre.createFolder(nombre); }
function carpetaMes_(clave) {
  var y = clave.slice(0, 4), m = Number(clave.slice(5, 7));
  return hija_(hija_(raiz_(), y), ('0' + m).slice(-2) + ' · ' + MESES_[m - 1]);
}
function vacia_(f) {
  var a = f.getFolders(); while (a.hasNext()) if (!a.next().isTrashed()) return false;
  var b = f.getFiles(); while (b.hasNext()) if (!b.next().isTrashed()) return false;
  return true;
}
/* tras mover o borrar un informe, retira la carpeta del mes y la del año si quedaron vacías */
function podarVacias_(mes) {
  try {
    var raizId = raiz_().getId(), f = mes;
    for (var k = 0; k < 2 && f && f.getId() !== raizId; k++) {
      if (!vacia_(f)) return;
      var p = f.getParents(), padre = p.hasNext() ? p.next() : null;
      f.setTrashed(true); f = padre;
    }
  } catch (err) { /* no es grave */ }
}
function padreDe_(folderId) { try { var p = DriveApp.getFolderById(folderId).getParents(); return p.hasNext() ? p.next() : null; } catch (e) { return null; } }
/* deja la carpeta del informe en el año/mes que le corresponde; devuelve true si la movió */
function ubicarCarpeta_(e, inf) {
  var clave = claveMes_((inf.general || {}).fechaInspeccion, inf.creado);
  if (e.mes === clave) return false;
  var c = DriveApp.getFolderById(e.carpeta), antes = padreDe_(e.carpeta), destino = carpetaMes_(clave);
  if (!antes || antes.getId() !== destino.getId()) {
    c.moveTo(destino);
    if (antes && antes.getId() !== raiz_().getId()) podarVacias_(antes);
  }
  e.mes = clave;
  return true;
}

function crearCarpetas_(id, titulo, clave) {
  var c = carpetaMes_(clave).createFolder(nombreCarpeta_(id, titulo));
  return { carpeta: c.getId(), fFotos: c.createFolder('fotos').getId(), fVideos: c.createFolder('videos').getId(), fExport: c.createFolder('exportados').getId(), c: c };
}

/* Formato alterno (sin membrete ni QR): numeración propia IT-AAAA-NNN, una por informe y estable en el tiempo. */
function consecutivoAlterno_(ses, q) {
  var e0 = entradaOFalla_(q.id);
  return conCandado_(function () {
    var ix = leerIndice_(), e = entrada_(ix, e0.id);
    if (e.alt) return { ok: true, numero: e.alt, nuevo: false };
    var y = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy'), k = 'CONSEC_ALT_' + y;
    var n = Number(props_().getProperty(k) || 0) + 1;
    props_().setProperty(k, String(n));
    e.alt = 'IT-' + y + '-' + ('00' + n).slice(-3);
    guardarIndice_(ix);
    auditar_(ses.email, 'consecutivo_alterno', e.id + ' ' + e.alt);
    return { ok: true, numero: e.alt, nuevo: true };
  });
}

function nuevoId_() {
  var y = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy'), k = 'CONSEC_' + y;
  var n = Number(props_().getProperty(k) || 0) + 1;
  props_().setProperty(k, String(n));
  return 'HR-' + y + '-' + ('00' + n).slice(-3);
}

function crear_(ses, q) {
  var base = q.informe && typeof q.informe === 'object' ? q.informe : {};
  return conCandado_(function () {
    var ix = leerIndice_(), id = nuevoId_();
    var inf = limpiarInforme_(base);
    inf.id = id; inf.rev = 1; inf.creado = ahora_(); inf.creadoPor = ses.email;
    inf.actualizado = inf.creado; inf.actualizadoPor = ses.email; inf.estado = inf.estado || 'BORRADOR';
    var clave = claveMes_((inf.general || {}).fechaInspeccion, inf.creado);
    var cs = crearCarpetas_(id, (inf.general || {}).proyecto, clave);
    var a = cs.c.createFile('informe.json', JSON.stringify(inf), MimeType.PLAIN_TEXT);
    var e = { id: id, carpeta: cs.carpeta, fFotos: cs.fFotos, fVideos: cs.fVideos, fExport: cs.fExport, archivo: a.getId(), mes: clave };
    ix.informes.push(resumen_(inf, e));
    guardarIndice_(ix);
    auditar_(ses.email, 'informe_creado', id);
    return { ok: true, informe: inf };
  });
}

function limpiarInforme_(inf) {
  var o = JSON.parse(JSON.stringify(inf || {}));
  delete o.id; delete o.rev; delete o.creado; delete o.creadoPor; delete o.actualizado; delete o.actualizadoPor;
  if (!o.general || typeof o.general !== 'object') o.general = {};
  if (!Array.isArray(o.tramos)) o.tramos = [];
  return o;
}

function guardar_(ses, q) {
  var inf = q.informe;
  if (!inf || typeof inf !== 'object') throw Falla_('No llegó el informe.');
  var texto = JSON.stringify(inf);
  if (texto.length > CFG.MAX_JSON) throw Falla_('El informe supera el tamaño permitido. Retire texto repetido o divídalo.');
  return conCandado_(function () {
    var ix = leerIndice_(), e = entrada_(ix, String(inf.id || ''));
    if (!e) throw Falla_('Ese informe ya no existe.', 'NO_EXISTE');
    var actual = leerInforme_(e);
    if (Number(inf.rev) !== Number(actual.rev) && !q.forzar) {
      return { ok: false, codigo: 'CONFLICTO', error: 'Otra persona (' + actual.actualizadoPor + ') guardó cambios a las ' +
        Utilities.formatDate(new Date(actual.actualizado), 'America/Bogota', 'HH:mm') + '.', rev: actual.rev, actualizadoPor: actual.actualizadoPor };
    }
    var nuevo = limpiarInforme_(inf);
    nuevo.id = actual.id; nuevo.creado = actual.creado; nuevo.creadoPor = actual.creadoPor;
    nuevo.rev = Number(actual.rev) + 1; nuevo.actualizado = ahora_(); nuevo.actualizadoPor = ses.email;
    DriveApp.getFileById(e.archivo).setContent(JSON.stringify(nuevo));
    var tituloAnt = e.titulo;
    resumen_(nuevo, e);
    if (tituloAnt !== e.titulo) { try { DriveApp.getFolderById(e.carpeta).setName(nombreCarpeta_(e.id, e.titulo)); } catch (err) { /* nombre */ } }
    try { ubicarCarpeta_(e, nuevo); } catch (err) { /* se reintenta en el próximo guardado */ }
    guardarIndice_(ix);
    return { ok: true, rev: nuevo.rev, actualizado: nuevo.actualizado, actualizadoPor: ses.email };
  });
}

function duplicar_(ses, q) {
  var e = entradaOFalla_(q.id), inf = leerInforme_(e);
  (inf.tramos || []).forEach(function (t) { t.obs = []; t.video = null; t.id = 't' + aleatorio_(4); });
  inf.estado = 'BORRADOR'; inf.conclusiones = ''; inf.recomendaciones = '';
  inf.general = inf.general || {}; inf.general.proyecto = (inf.general.proyecto || '') + ' (copia)';
  return crear_(ses, { informe: inf });
}

/* Eliminar un informe: borra su carpeta de Drive (informe, fotos, videos, exportados) y avisa por correo a los
   demás creadores. Puede eliminar: un CREADOR (cualquier informe) o un EDITOR (solo los informes que él creó).
   Para evitar borrados por error, el cliente debe enviar el código del informe escrito por el usuario. */
function eliminar_(ses, q) {
  var id = String(q.id || '');
  if (String(q.confirmacion || '').trim().toUpperCase() !== id.toUpperCase()) throw Falla_('Escriba el código del informe para confirmar.');
  var motivo = txt_(q.motivo, 400);
  var r = conCandado_(function () {
    var ix = leerIndice_(), e = entrada_(ix, id);
    if (!e) throw Falla_('Ese informe ya no existe.', 'NO_EXISTE');
    var inf = {};
    try { inf = leerInforme_(e); } catch (err) { /* informe dañado: se borra igual */ }
    if (ses.user.rol !== 'CREADOR' && inf.creadoPor !== ses.email) throw Falla_('Solo los creadores, o quien creó el informe, pueden eliminarlo.', 'PERMISO');
    var conteo = { fotos: 0, videos: 0, exportados: 0 };
    [['fotos', e.fFotos], ['videos', e.fVideos], ['exportados', e.fExport]].forEach(function (par) {
      try { var it = DriveApp.getFolderById(par[1]).getFiles(); while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) conteo[par[0]]++; } } catch (err) { /* sin carpeta */ }
    });
    var url = '';
    var mesE = padreDe_(e.carpeta);
    try { var c = DriveApp.getFolderById(e.carpeta); url = c.getUrl(); c.setTrashed(true); } catch (err) { /* ya no está */ }
    if (mesE) podarVacias_(mesE);
    ix.informes = ix.informes.filter(function (x) { return x.id !== id; });
    guardarIndice_(ix);
    return { e: e, inf: inf, conteo: conteo, url: url };
  });
  anularEmisiones_(id, ses, 'Informe eliminado' + (motivo ? ': ' + motivo : ''));
  auditar_(ses.email, 'informe_eliminado', id + (motivo ? ' · ' + motivo : ''));
  var avisados = avisarEliminacion_(ses, id, r, motivo);
  return { ok: true, avisados: avisados, mensaje: 'Informe ' + id + ' eliminado de Drive.' };
}

/* Descartar: deshace la creación de un informe en su primera apertura (la app solo lo ofrece antes de salir del informe).
   Sin aviso por correo porque nadie más lo ha trabajado. El servidor exige que lo haya creado el mismo usuario y que
   sea reciente; pasado ese punto se usa «eliminar». */
function descartar_(ses, q) {
  var id = String(q.id || '');
  conCandado_(function () {
    var ix = leerIndice_(), e = entrada_(ix, id);
    if (!e) throw Falla_('Ese informe ya no existe.', 'NO_EXISTE');
    var inf = leerInforme_(e);
    if (inf.creadoPor !== ses.email) throw Falla_('Solo quien creó el informe puede descartarlo.', 'PERMISO');
    if (Date.now() - new Date(inf.creado).getTime() > 12 * 3600000) throw Falla_('Este informe ya no se puede descartar; use «Eliminar».', 'PERMISO');
    var mesD = padreDe_(e.carpeta);
    try { DriveApp.getFolderById(e.carpeta).setTrashed(true); } catch (err) { /* ya no está */ }
    if (mesD) podarVacias_(mesD);
    ix.informes = ix.informes.filter(function (x) { return x.id !== id; });
    guardarIndice_(ix);
  });
  anularEmisiones_(id, ses, 'Informe descartado');
  auditar_(ses.email, 'informe_descartado', id);
  return { ok: true };
}

function avisarEliminacion_(ses, id, r, motivo) {
  var U = usuarios_(), dest = Object.keys(U).filter(function (m) { return U[m].rol === 'CREADOR' && U[m].activo !== false && m !== ses.email; });
  if (!dest.length) return [];
  var g = (r.inf && r.inf.general) || {}, tramos = (r.inf && r.inf.tramos) || [], nobs = 0;
  tramos.forEach(function (t) { nobs += (t.obs || []).length; });
  var cuando = Utilities.formatDate(new Date(), 'America/Bogota', "dd/MM/yyyy 'a las' HH:mm");
  var quien = (ses.user.nombre || ses.email) + ' (' + ses.email + ')';
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fila = function (k, v) { return v ? '<tr><td style="padding:6px 12px 6px 0;color:#5b6573;white-space:nowrap">' + k + '</td><td style="padding:6px 0;color:#1d2430">' + esc(v) + '</td></tr>' : ''; };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1d2430">'
    + '<div style="border-bottom:3px solid #36B5D6;padding-bottom:10px;margin-bottom:16px"><b style="font-size:20px;color:#36B5D6">HYDRO</b><b style="font-size:20px;color:#0A2A4A">-ROV</b>'
    + '<span style="color:#6b7684;font-size:12px;margin-left:8px">Análisis de inspección</span></div>'
    + '<h2 style="font-size:17px;color:#0A2A4A;margin:0 0 8px">Se eliminó el informe ' + esc(id) + '</h2>'
    + '<p style="margin:0 0 14px;color:#3c4652">' + esc(quien) + ' eliminó este informe el ' + esc(cuando) + '. Su carpeta de Drive se borró junto con las fotos, los videos y los archivos exportados.</p>'
    + '<table style="border-collapse:collapse;font-size:14px;margin-bottom:14px">'
    + fila('Proyecto', g.proyecto) + fila('Cliente', g.cliente) + fila('Municipio', g.municipio) + fila('Fecha de inspección', g.fechaInspeccion)
    + fila('Estado', r.inf && r.inf.estado) + fila('Tramos', String(tramos.length)) + fila('Observaciones', String(nobs))
    + fila('Archivos borrados', r.conteo.fotos + ' fotos · ' + r.conteo.videos + ' videos · ' + r.conteo.exportados + ' exportados')
    + fila('Motivo', motivo || 'No se indicó') + '</table>'
    + '<p style="font-size:12.5px;color:#6b7684;margin:0">La carpeta queda en la papelera de Google Drive de ' + esc(CFG.CREADORES[0].email) + ' durante 30 días; después Google la borra de forma definitiva. Si la eliminación no era esperada, pídale que la restaure desde la papelera.</p></div>';
  var texto = 'Se eliminó el informe ' + id + ' (' + (g.proyecto || 'sin título') + ').\n' + quien + ' lo eliminó el ' + cuando + '.\nMotivo: ' + (motivo || 'No se indicó')
    + '\nArchivos borrados: ' + r.conteo.fotos + ' fotos, ' + r.conteo.videos + ' videos, ' + r.conteo.exportados + ' exportados.'
    + '\nLa carpeta queda 30 días en la papelera de Drive de ' + CFG.CREADORES[0].email + '.';
  var enviados = [];
  dest.forEach(function (m) {
    try { MailApp.sendEmail({ to: m, subject: 'HYDRO-ROV · Se eliminó el informe ' + id, body: texto, htmlBody: html, name: 'HYDRO-ROV Análisis' }); enviados.push(m); }
    catch (err) { console.warn('No se envió el aviso a ' + m + ': ' + err); }
  });
  if (enviados.length) auditar_(ses.email, 'aviso_eliminacion', id + ' → ' + enviados.join(', '));
  return enviados;
}

function enlaceDrive_(ses, q) {
  var e = entradaOFalla_(q.id);
  return { ok: true, carpeta: DriveApp.getFolderById(e.carpeta).getUrl() };
}

/* ============================================================ archivos: verificación de pertenencia */
function archivoDe_(fileId, carpetaId) {
  fileId = String(fileId || '');
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(fileId)) throw Falla_('Archivo no válido.');
  var f;
  try { f = DriveApp.getFileById(fileId); } catch (e) { throw Falla_('El archivo ya no está en Drive.'); }
  var ps = f.getParents();
  while (ps.hasNext()) if (ps.next().getId() === carpetaId) return f;
  throw Falla_('El archivo no pertenece a este informe.', 'PERMISO');
}
function bytesDe_(b64) {
  var t = String(b64 || '').replace(/^data:[^,]*,/, '');
  return Utilities.base64Decode(t);
}
function empiezaCon_(bytes, firma) {
  for (var i = 0; i < firma.length; i++) { var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i]; if (b !== firma[i]) return false; }
  return true;
}
function nombreArchivo_(s, def) { return (txt_(s, 100) || def).replace(/[\\/:*?"<>|]/g, '-'); }

/* ============================================================ fotos */
function subirFoto_(ses, q) {
  var e = entradaOFalla_(q.id), b = bytesDe_(q.b64);
  if (b.length < 200) throw Falla_('La foto llegó vacía.');
  if (b.length > CFG.MAX_FOTO) throw Falla_('La foto pesa más de 10 MB.');
  var mime = empiezaCon_(b, [0xFF, 0xD8, 0xFF]) ? 'image/jpeg' : empiezaCon_(b, [0x89, 0x50, 0x4E, 0x47]) ? 'image/png' : '';
  if (!mime) throw Falla_('Solo se aceptan fotos JPG o PNG.');
  var nombre = nombreArchivo_(q.nombre, 'foto') + (mime === 'image/png' ? '.png' : '.jpg');
  var f = DriveApp.getFolderById(e.fFotos).createFile(Utilities.newBlob(b, mime, nombre));
  if (q.descripcion) f.setDescription(txt_(q.descripcion, 400));
  return { ok: true, fileId: f.getId() };
}

function obtenerFotos_(ses, q) {
  var e = entradaOFalla_(q.id), ids = Array.isArray(q.ids) ? q.ids.slice(0, 12) : [], out = {}, faltan = [];
  ids.forEach(function (fid) {
    try {
      var f = archivoDe_(fid, e.fFotos), bl = f.getBlob();
      out[fid] = 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes());
    } catch (err) { faltan.push(fid); }
  });
  return { ok: true, fotos: out, faltan: faltan };
}

function borrarFoto_(ses, q) {
  var e = entradaOFalla_(q.id);
  try { archivoDe_(q.fileId, e.fFotos).setTrashed(true); } catch (err) { /* ya no estaba */ }
  return { ok: true };
}

/* ============================================================ video (subida reanudable por trozos) */
function videoIniciar_(ses, q) {
  var e = entradaOFalla_(q.id);
  var total = Math.floor(Number(q.tamano || 0));
  if (!(total > 0) || total > 5 * 1024 * 1024 * 1024) throw Falla_('Tamaño de video no válido (máximo 5 GB).');
  var mime = /^video\/[a-z0-9.+-]+$/i.test(String(q.mime || '')) ? String(q.mime) : 'video/mp4';
  var meta = { name: nombreArchivo_(q.nombre, 'video.mp4'), parents: [e.fVideos], mimeType: mime,
               description: 'Video de inspección ' + e.id + (q.tramo ? ' · tramo ' + txt_(q.tramo, 60) : '') };
  var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify(meta), muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(total) }
  });
  var h = r.getAllHeaders(), loc = h.Location || h.location;
  if (r.getResponseCode() !== 200 || !loc) throw Falla_('Drive no abrió la subida del video (' + r.getResponseCode() + ').');
  var up = aleatorio_(16);
  CacheService.getScriptCache().put('UP_' + up, JSON.stringify({ loc: String(loc), total: total, id: e.id, u: ses.email }), 21600);
  return { ok: true, subida: up, trozo: 4 * 1024 * 1024 };
}

function videoTrozo_(ses, q) {
  var c = CacheService.getScriptCache(), raw = c.get('UP_' + String(q.subida || ''));
  if (!raw) throw Falla_('La subida del video expiró. Vuelva a cargarlo.', 'SUBIDA_EXPIRADA');
  var up = JSON.parse(raw);
  if (up.u !== ses.email) throw Falla_('Esta subida pertenece a otro usuario.', 'PERMISO');
  if (q.consultar) { // ¿hasta qué byte recibió Drive? (para reanudar tras un corte de red)
    var rc = UrlFetchApp.fetch(up.loc, { method: 'put', payload: '', muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes */' + up.total } });
    var cc = rc.getResponseCode();
    if (cc === 200 || cc === 201) { c.remove('UP_' + q.subida); return { ok: true, fin: true, fileId: JSON.parse(rc.getContentText() || '{}').id }; }
    if (cc === 308) { var hc = rc.getAllHeaders(), mc = /bytes=0-(\d+)/.exec(String(hc.Range || hc.range || '')); return { ok: true, fin: false, siguiente: mc ? Number(mc[1]) + 1 : 0 }; }
    throw Falla_('No se pudo consultar la subida (' + cc + ').', 'TROZO');
  }
  var inicio = Math.floor(Number(q.inicio || 0)), b = bytesDe_(q.b64);
  if (b.length > CFG.MAX_TROZO) throw Falla_('Trozo demasiado grande.');
  var fin = inicio + b.length - 1;
  if (fin >= up.total) throw Falla_('El trozo excede el tamaño del video.');
  var r = UrlFetchApp.fetch(up.loc, {
    method: 'put', contentType: 'application/octet-stream', payload: b, muteHttpExceptions: true, followRedirects: false,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes ' + inicio + '-' + fin + '/' + up.total }
  });
  var code = r.getResponseCode();
  if (code === 308) {
    var h = r.getAllHeaders(), rg = String(h.Range || h.range || ''), m = /bytes=0-(\d+)/.exec(rg);
    return { ok: true, fin: false, siguiente: m ? Number(m[1]) + 1 : 0 };
  }
  if (code === 200 || code === 201) {
    c.remove('UP_' + q.subida);
    var j = JSON.parse(r.getContentText() || '{}');
    auditar_(ses.email, 'video_subido', up.id + ' ' + j.id);
    return { ok: true, fin: true, fileId: j.id };
  }
  throw Falla_('Drive rechazó el trozo del video (' + code + '). Se reintentará.', 'TROZO');
}

function videoLeer_(ses, q) {
  var e = entradaOFalla_(q.id), f = archivoDe_(q.fileId, e.fVideos);
  var ini = Math.max(0, Math.floor(Number(q.inicio || 0))), largo = Math.min(CFG.MAX_TROZO / 2, Math.max(1, Math.floor(Number(q.largo || 4194304))));
  var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '?alt=media', {
    muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + ini + '-' + (ini + largo - 1) }
  });
  var code = r.getResponseCode();
  if (code !== 206 && code !== 200) throw Falla_('No se pudo leer el video de Drive (' + code + ').');
  var h = r.getAllHeaders(), cr = String(h['Content-Range'] || h['content-range'] || ''), m = /\/(\d+)$/.exec(cr);
  return { ok: true, b64: Utilities.base64Encode(r.getContent()), total: m ? Number(m[1]) : f.getSize(), mime: f.getMimeType() };
}

/* ============================================================ exportados (PDF / Word) */
function subirExport_(ses, q) {
  var e = entradaOFalla_(q.id), fmt = String(q.formato || ''), b = bytesDe_(q.b64);
  if (b.length > CFG.MAX_EXPORT) throw Falla_('El archivo exportado supera 36 MB.');
  var mime;
  if (fmt === 'pdf' && empiezaCon_(b, [0x25, 0x50, 0x44, 0x46])) mime = 'application/pdf';
  else if (fmt === 'docx' && empiezaCon_(b, [0x50, 0x4B])) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else throw Falla_('Formato de exportación no válido.');
  var nombre = (txt_(q.nombre, 200).replace(/\.(pdf|docx)$/i, '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 140) || e.id) + '.' + fmt;
  var carpeta = DriveApp.getFolderById(e.fExport), prev = carpeta.getFilesByName(nombre);
  while (prev.hasNext()) prev.next().setTrashed(true);   // la versión anterior queda en la papelera
  var f = carpeta.createFile(Utilities.newBlob(b, mime, nombre));
  auditar_(ses.email, 'exportado_' + fmt, e.id);
  var cod = String(q.codigo || '').toUpperCase();
  if (cod) {
    conCandado_(function () {
      var E = leerEmisiones_(), em = E[cod];
      if (em && em.id === e.id && !em.anulado) {
        /* cada exportación de la misma emisión agrega su huella: todos los archivos entregados siguen siendo verificables */
        em.huellas = em.huellas || {};
        var hx = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b)), lista = listaHuellas_(em.huellas[fmt]);
        if (lista.indexOf(hx) < 0) lista.push(hx);
        em.huellas[fmt] = lista.slice(-40);
        em.archivos = em.archivos || {}; em.archivos[fmt] = nombre;
        guardarEmisiones_(E);
      }
    });
  }
  return { ok: true, url: f.getUrl(), nombre: nombre };
}


/* ============================================================ emisión y verificación de autenticidad (QR)
   Al exportar, el informe se «emite»: se congela una copia (instantánea) en _sistema/emisiones y se le asigna un código
   aleatorio XXXX-XXXX-XXXX que va en el QR. La página pública /v/?c=CÓDIGO muestra esa versión congelada y compara la
   huella SHA-256 de un PDF o Word con la del archivo emitido. Mientras el informe no cambie, se reutiliza el mismo código. */
function leerEmisiones_() { return JSON.parse(archivoSistema_('_emisiones.json', '{}').getBlob().getDataAsString('UTF-8') || '{}'); }
function guardarEmisiones_(E) { archivoSistema_('_emisiones.json', '{}').setContent(JSON.stringify(E)); }
function carpetaEmisiones_() {
  var id = props_().getProperty('EMI_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* se recrea */ } }
  var s = sistema_(), it = s.getFoldersByName('emisiones');
  var c = it.hasNext() ? it.next() : s.createFolder('emisiones');
  props_().setProperty('EMI_ID', c.getId());
  return c;
}
function codigoEmision_() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = aleatorio_(16), t = '';
  for (var i = 0; i < 12; i++) t += abc.charAt(parseInt(r.substr(i * 2, 2), 16) % abc.length);
  return t.slice(0, 4) + '-' + t.slice(4, 8) + '-' + t.slice(8);
}
function emitir_(ses, q) {
  var e = entradaOFalla_(q.id);
  return conCandado_(function () {
    var inf = leerInforme_(e), E = leerEmisiones_(), ult = null;
    Object.keys(E).forEach(function (k) { var x = E[k]; if (x.id === e.id && !x.anulado && (!ult || x.fecha > ult.fecha)) ult = x; });
    if (ult && ult.rev === inf.rev) return { ok: true, codigo: ult.codigo, fecha: ult.fecha, nuevo: false };
    var cod; do { cod = codigoEmision_(); } while (E[cod]);
    var snap = JSON.parse(JSON.stringify(inf));
    delete snap.creadoPor; delete snap.actualizadoPor;
    var f = carpetaEmisiones_().createFile(cod + '.json', JSON.stringify(snap), MimeType.PLAIN_TEXT);
    E[cod] = { codigo: cod, id: e.id, rev: inf.rev, fecha: ahora_(), por: ses.user.nombre || ses.email, archivo: f.getId(),
               fotos: e.fFotos, titulo: (inf.general || {}).proyecto || '', huellas: {}, anulado: false };
    guardarEmisiones_(E);
    auditar_(ses.email, 'informe_emitido', e.id + ' rev ' + inf.rev + ' · ' + cod);
    return { ok: true, codigo: cod, fecha: E[cod].fecha, nuevo: true };
  });
}
function anularEmisiones_(id, ses, motivo) {
  conCandado_(function () {
    var E = leerEmisiones_(), n = 0;
    Object.keys(E).forEach(function (k) { if (E[k].id === id && !E[k].anulado) { E[k].anulado = true; E[k].anuladoFecha = ahora_(); E[k].anuladoMotivo = motivo; E[k].anuladoPor = ses.user.nombre || ses.email; n++; } });
    if (n) guardarEmisiones_(E);
  });
}
function limiteVerificacion_() {
  var c = CacheService.getScriptCache(), k = 'VF_' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0);
  if (n > 240) throw Falla_('Demasiadas consultas. Intente en un minuto.');
  c.put(k, String(n + 1), 120);
}
function listaHuellas_(v) { return Array.isArray(v) ? v.slice() : (v ? [String(v)] : []); }
/* Verificación por archivo: busca la emisión a la que pertenece un PDF o Word por su huella SHA-256.
   La huella se calcula en el equipo de quien verifica; el archivo nunca se envía. */
function verificarHuella_(q) {
  limiteVerificacion_();
  var h = String(q.h || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: 'Huella no válida.' };
  var E = leerEmisiones_(), hit = null;
  Object.keys(E).some(function (k) {
    var hs = E[k].huellas || {};
    return Object.keys(hs).some(function (fmt) { if (listaHuellas_(hs[fmt]).indexOf(h) >= 0) { hit = { codigo: k, formato: fmt }; return true; } return false; });
  });
  return hit ? { ok: true, codigo: hit.codigo, formato: hit.formato } : { ok: false, codigo: 'NO_EXISTE' };
}
function emisionPublica_(c) {
  c = String(c || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return null;
  return leerEmisiones_()[c] || null;
}
function verificar_(q) {
  limiteVerificacion_();
  var em = emisionPublica_(q.c);
  if (!em) return { ok: false, codigo: 'NO_EXISTE', error: 'Este código no corresponde a ningún informe emitido por HYDRO-ROV.' };
  var out = { ok: true, emision: { codigo: em.codigo, id: em.id, rev: em.rev, fecha: em.fecha, por: em.por, titulo: em.titulo,
    huellas: (function (hs) { var o = {}; Object.keys(hs || {}).forEach(function (f) { o[f] = listaHuellas_(hs[f]); }); return o; })(em.huellas), anulado: !!em.anulado, anuladoFecha: em.anuladoFecha || null, anuladoMotivo: em.anuladoMotivo || null } };
  if (em.anulado) return out;
  out.informe = JSON.parse(DriveApp.getFileById(em.archivo).getBlob().getDataAsString('UTF-8'));
  var actual = entrada_(leerIndice_(), em.id);
  out.emision.posterior = !!(actual && Number(actual.rev) > Number(em.rev));
  return out;
}
function verificarFotos_(q) {
  limiteVerificacion_();
  var em = emisionPublica_(q.c);
  if (!em || em.anulado) return { ok: false, error: 'Código no válido.' };
  var snap = DriveApp.getFileById(em.archivo).getBlob().getDataAsString('UTF-8');
  var ids = Array.isArray(q.ids) ? q.ids.slice(0, 8) : [], out = {};
  ids.forEach(function (fid) {
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(String(fid)) || snap.indexOf('"' + fid + '"') < 0) return;   // solo fotos de esa versión
    try { var bl = archivoDe_(fid, em.fotos).getBlob(); out[fid] = 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes()); } catch (e) { /* ya no está */ }
  });
  return { ok: true, fotos: out };
}

/* ============================================================ auditoría (archivo de texto en _sistema) */
function auditar_(email, accion, detalle) {
  try {
    var f = archivoSistema_('_auditoria.log', '');
    var lineas = f.getBlob().getDataAsString('UTF-8').split('\n').filter(String);
    lineas.push([Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'), email, accion, String(detalle || '').slice(0, 160)].join('\t'));
    if (lineas.length > 3000) lineas = lineas.slice(-3000);
    f.setContent(lineas.join('\n'));
  } catch (e) { console.warn('auditoría: ' + e); }
}
function leerAuditoria_() {
  var t = archivoSistema_('_auditoria.log', '').getBlob().getDataAsString('UTF-8');
  return t.split('\n').filter(String).slice(-200).reverse().map(function (l) {
    var p = l.split('\t'); return { fecha: p[0], usuario: p[1], accion: p[2], detalle: p[3] || '' };
  });
}

/* ============================================================ cotizaciones (1.9.0)
   Cada cotización tiene su carpeta en «Cotizaciones/AAAA/COT-AAAA-NNN · cliente» dentro de la carpeta raíz:
   cotizacion.json, la imagen de localización y los Word/PDF exportados. El índice resumido va en _sistema/_cotizaciones.json.
   Consecutivo propio por año (propiedad CONSEC_COT_AAAA), independiente del de los informes. */
var COT_ESTADOS = ['BORRADOR', 'ENVIADA', 'APROBADA', 'NO_APROBADA'];
function leerCotIx_() { return JSON.parse(archivoSistema_('_cotizaciones.json', '{"cotizaciones":[]}').getBlob().getDataAsString('UTF-8') || '{"cotizaciones":[]}'); }
function guardarCotIx_(ix) { archivoSistema_('_cotizaciones.json', '{"cotizaciones":[]}').setContent(JSON.stringify(ix)); }
function cotEntrada_(ix, id) {
  for (var i = 0; i < ix.cotizaciones.length; i++) if (ix.cotizaciones[i].id === id) return ix.cotizaciones[i];
  return null;
}
function cotEntradaOFalla_(id) {
  id = String(id || '');
  if (!/^COT-\d{4}-\d{3,4}$/.test(id)) throw Falla_('Cotización no válida.');
  var e = cotEntrada_(leerCotIx_(), id);
  if (!e) throw Falla_('Esa cotización ya no existe.', 'NO_EXISTE');
  return e;
}
function nombreCarpetaCot_(id, cliente) { return (id + ' · ' + (cliente || 'Sin cliente')).replace(/[\\/:*?"<>|]/g, '-').slice(0, 120); }
function cotLimpia_(c) {
  var o = JSON.parse(JSON.stringify(c || {}));
  ['id', 'rev', 'creado', 'creadoPor', 'actualizado', 'actualizadoPor'].forEach(function (k) { delete o[k]; });
  if (COT_ESTADOS.indexOf(o.estado) < 0) o.estado = 'BORRADOR';
  if (!o.cliente || typeof o.cliente !== 'object') o.cliente = {};
  if (!Array.isArray(o.items)) o.items = [];
  if (!Array.isArray(o.tramos)) o.tramos = [];
  return o;
}
function cotResumen_(c, e) {
  var tot = 0, ml = 0;
  (c.tramos || []).forEach(function (t) { var l = Number(t.longitud); if (t.longitud != null && isFinite(l)) ml += l; });
  ml = Math.round(ml * 100) / 100;
  var mlA = c.redondear ? Math.round(ml) : ml;   // mismo cálculo que la app: ítem «auto» = suma de tramos; «usaPrecio» = precio por metro
  (c.items || []).forEach(function (it) {
    var q = it.auto ? mlA : it.cant, v = it.usaPrecio ? c.precioMl : it.vu;
    if (!it.porDefinir && q != null && v != null && isFinite(Number(q)) && isFinite(Number(v))) tot += Math.round(Number(q) * Number(v));
  });
  e.cliente = txt_((c.cliente || {}).entidad, 160); e.objeto = txt_(c.objeto, 240); e.fecha = txt_(c.fecha, 10);
  e.estado = c.estado; e.total = Math.round(tot); e.ml = mlA; e.tramos = (c.tramos || []).length;
  e.validez = Number(c.validez) || 0; e.municipio = txt_((c.cliente || {}).ciudad, 80); e.firmante = txt_((c.firma || {}).nombre, 120);
  e.rev = c.rev; e.actualizado = c.actualizado; e.actualizadoPor = c.actualizadoPor; e.creadoPor = c.creadoPor;
  return e;
}
function carpetaCot_(anio) { return hija_(hija_(raiz_(), 'Cotizaciones'), String(anio)); }
function cotListar_() {
  var L = leerCotIx_().cotizaciones.map(function (e) { var o = JSON.parse(JSON.stringify(e)); delete o.archivo; delete o.carpeta; return o; });
  L.sort(function (a, b) { return a.id < b.id ? 1 : -1; });
  return { ok: true, cotizaciones: L };
}
function cotLeer_(e) { return JSON.parse(DriveApp.getFileById(e.archivo).getBlob().getDataAsString('UTF-8')); }
function cotObtener_(q) {
  var e = cotEntradaOFalla_(q.id);
  return { ok: true, cotizacion: cotLeer_(e), carpeta: 'https://drive.google.com/drive/folders/' + e.carpeta };
}
function cotCrear_(ses, q) {
  var base = q.cotizacion && typeof q.cotizacion === 'object' ? q.cotizacion : {};
  if (JSON.stringify(base).length > CFG.MAX_JSON) throw Falla_('La cotización supera el tamaño permitido.');
  return conCandado_(function () {
    var ix = leerCotIx_(), y = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy'), k = 'CONSEC_COT_' + y;
    var n = Number(props_().getProperty(k) || 0) + 1;
    props_().setProperty(k, String(n));
    var id = 'COT-' + y + '-' + ('00' + n).slice(-3);
    var c = cotLimpia_(base);
    delete c.imagen; delete c.alt;   // la imagen se sube después con cotImagen (pertenece a la carpeta de esta cotización)
    c.id = id; c.rev = 1; c.creado = ahora_(); c.creadoPor = ses.email; c.actualizado = c.creado; c.actualizadoPor = ses.email;
    var f = carpetaCot_(y).createFolder(nombreCarpetaCot_(id, (c.cliente || {}).entidad));
    var a = f.createFile('cotizacion.json', JSON.stringify(c), MimeType.PLAIN_TEXT);
    ix.cotizaciones.push(cotResumen_(c, { id: id, carpeta: f.getId(), archivo: a.getId() }));
    guardarCotIx_(ix);
    auditar_(ses.email, 'cotizacion_creada', id);
    return { ok: true, cotizacion: c };
  });
}
function cotGuardar_(ses, q) {
  var c = q.cotizacion;
  if (!c || typeof c !== 'object') throw Falla_('No llegó la cotización.');
  if (JSON.stringify(c).length > CFG.MAX_JSON) throw Falla_('La cotización supera el tamaño permitido.');
  var r = conCandado_(function () {
    var ix = leerCotIx_(), e = cotEntrada_(ix, String(c.id || ''));
    if (!e) throw Falla_('Esa cotización ya no existe.', 'NO_EXISTE');
    var actual = cotLeer_(e);
    if (Number(c.rev) !== Number(actual.rev) && !q.forzar) {
      return { ok: false, codigo: 'CONFLICTO', error: 'Otra persona (' + actual.actualizadoPor + ') guardó cambios a las ' +
        Utilities.formatDate(new Date(actual.actualizado), 'America/Bogota', 'HH:mm') + '.', rev: actual.rev };
    }
    var nuevo = cotLimpia_(c);
    nuevo.id = actual.id; nuevo.creado = actual.creado; nuevo.creadoPor = actual.creadoPor;
    nuevo.rev = Number(actual.rev) + 1; nuevo.actualizado = ahora_(); nuevo.actualizadoPor = ses.email;
    if (e.alt) nuevo.alt = e.alt; else delete nuevo.alt;
    DriveApp.getFileById(e.archivo).setContent(JSON.stringify(nuevo));
    var cliAnt = e.cliente;
    cotResumen_(nuevo, e);
    if (cliAnt !== e.cliente) { try { DriveApp.getFolderById(e.carpeta).setName(nombreCarpetaCot_(e.id, e.cliente)); } catch (err) { /* nombre */ } }
    if (actual.estado !== nuevo.estado) auditar_(ses.email, 'cotizacion_' + nuevo.estado.toLowerCase(), e.id);
    guardarCotIx_(ix);
    return { ok: true, rev: nuevo.rev, actualizado: nuevo.actualizado, actualizadoPor: ses.email, _cambio: actual.estado !== nuevo.estado ? nuevo.estado : '', _e: e };
  });
  if (r._cambio === 'APROBADA') {
    var quien = nombreCorto_(ses.email);
    avisar_(ses.email, { sec: 'cotizaciones', url: '#cotizacion/' + r._e.id, ref: r._e.id, ti: 'Cotización aprobada: ' + (r._e.cliente || r._e.id), cu: r._e.id + ' · $' + String(r._e.total).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' — por ' + quien });
  }
  delete r._cambio; delete r._e;
  return r;
}
function cotEliminar_(ses, q) {
  var id = String(q.id || '');
  if (String(q.confirmacion || '').trim().toUpperCase() !== id.toUpperCase()) throw Falla_('Escriba el código de la cotización para confirmar.');
  return conCandado_(function () {
    var ix = leerCotIx_(), e = cotEntrada_(ix, id);
    if (!e) throw Falla_('Esa cotización ya no existe.', 'NO_EXISTE');
    if (ses.user.rol !== 'CREADOR' && e.creadoPor !== ses.email) throw Falla_('Solo los creadores, o quien creó la cotización, pueden eliminarla.', 'PERMISO');
    try { DriveApp.getFolderById(e.carpeta).setTrashed(true); } catch (err) { /* ya no estaba */ }
    ix.cotizaciones = ix.cotizaciones.filter(function (x) { return x.id !== id; });
    guardarCotIx_(ix);
    auditar_(ses.email, 'cotizacion_eliminada', id);
    return { ok: true };
  });
}
/* Formato sin membrete: consecutivo propio PTE-AAAA-NNN (propuesta técnico-económica), uno por cotización y estable. */
function cotConsecutivoAlterno_(ses, q) {
  var e0 = cotEntradaOFalla_(q.id);
  return conCandado_(function () {
    var ix = leerCotIx_(), e = cotEntrada_(ix, e0.id);
    if (e.alt) return { ok: true, numero: e.alt, nuevo: false };
    var y = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy'), k = 'CONSEC_PTE_' + y;
    var n = Number(props_().getProperty(k) || 0) + 1;
    props_().setProperty(k, String(n));
    e.alt = 'PTE-' + y + '-' + ('00' + n).slice(-3);
    var c = cotLeer_(e); c.alt = e.alt; DriveApp.getFileById(e.archivo).setContent(JSON.stringify(c));
    guardarCotIx_(ix);
    auditar_(ses.email, 'cotizacion_consecutivo_alterno', e.id + ' ' + e.alt);
    return { ok: true, numero: e.alt, nuevo: true };
  });
}
function archivoEnCarpeta_(fileId, carpetaId) {
  var f;
  try { f = DriveApp.getFileById(String(fileId || '')); } catch (err) { return null; }
  var p = f.getParents();
  while (p.hasNext()) if (p.next().getId() === carpetaId) return f;
  return null;
}
function cotImagen_(ses, q) {
  var e = cotEntradaOFalla_(q.id), b = bytesDe_(q.b64);
  if (b.length < 200) throw Falla_('La imagen llegó vacía.');
  if (b.length > CFG.MAX_FOTO) throw Falla_('La imagen pesa más de 10 MB.');
  var mime = empiezaCon_(b, [0xFF, 0xD8, 0xFF]) ? 'image/jpeg' : empiezaCon_(b, [0x89, 0x50, 0x4E, 0x47]) ? 'image/png' : '';
  if (!mime) throw Falla_('Solo se aceptan imágenes JPG o PNG.');
  var carpeta = DriveApp.getFolderById(e.carpeta);
  if (q.anterior) { var v = archivoEnCarpeta_(q.anterior, e.carpeta); if (v) v.setTrashed(true); }
  var f = carpeta.createFile(Utilities.newBlob(b, mime, 'localizacion' + (mime === 'image/png' ? '.png' : '.jpg')));
  return { ok: true, fileId: f.getId() };
}
function cotImagenLeer_(q) {
  var e = cotEntradaOFalla_(q.id), f = archivoEnCarpeta_(q.fileId, e.carpeta);
  if (!f) return { ok: false, error: 'La imagen ya no está en la carpeta de la cotización.' };
  var bl = f.getBlob();
  return { ok: true, url: 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes()) };
}
function cotExport_(ses, q) {
  var e = cotEntradaOFalla_(q.id), fmt = String(q.formato || ''), b = bytesDe_(q.b64);
  if (b.length > CFG.MAX_EXPORT) throw Falla_('El archivo supera 36 MB.');
  var mime;
  if (fmt === 'pdf' && empiezaCon_(b, [0x25, 0x50, 0x44, 0x46])) mime = 'application/pdf';
  else if (fmt === 'docx' && empiezaCon_(b, [0x50, 0x4B])) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else throw Falla_('Formato de exportación no válido.');
  var nombre = (txt_(q.nombre, 200).replace(/\.(pdf|docx)$/i, '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 140) || e.id) + '.' + fmt;
  var carpeta = DriveApp.getFolderById(e.carpeta), prev = carpeta.getFilesByName(nombre);
  while (prev.hasNext()) prev.next().setTrashed(true);
  var f = carpeta.createFile(Utilities.newBlob(b, mime, nombre));
  auditar_(ses.email, 'cotizacion_exportada_' + fmt, e.id);
  return { ok: true, url: f.getUrl(), nombre: nombre };
}

/* ============================================================ agenda: visitas previas y trabajos (1.9.0)
   Un solo archivo _sistema/_agenda.json. Cada evento puede ir ligado a una cotización (cotId). */
var EV_TIPOS = ['VISITA', 'TRABAJO', 'OTRO'], EV_ESTADOS = ['PROGRAMADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO'];
function leerAgenda_() { return JSON.parse(archivoSistema_('_agenda.json', '{"eventos":[]}').getBlob().getDataAsString('UTF-8') || '{"eventos":[]}'); }
function guardarAgenda_(A) { archivoSistema_('_agenda.json', '{"eventos":[]}').setContent(JSON.stringify(A)); }
function fechaOk_(s) { s = String(s || ''); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function horaOk_(s) { s = String(s || ''); return /^\d{2}:\d{2}$/.test(s) ? s : ''; }
function agendaGuardar_(ses, q) {
  var v = q.evento;
  if (!v || typeof v !== 'object') throw Falla_('No llegó el evento.');
  var ini = fechaOk_(v.inicio);
  if (!ini) throw Falla_('Indique la fecha del evento.');
  var fin = fechaOk_(v.fin) || ini;
  if (fin < ini) throw Falla_('La fecha final es anterior a la inicial.');
  var ev = {
    tipo: EV_TIPOS.indexOf(v.tipo) >= 0 ? v.tipo : 'OTRO', estado: EV_ESTADOS.indexOf(v.estado) >= 0 ? v.estado : 'PROGRAMADO',
    titulo: txt_(v.titulo, 160), cliente: txt_(v.cliente, 160), cotId: /^COT-\d{4}-\d{3,4}$/.test(String(v.cotId || '')) ? v.cotId : '',
    lugar: txt_(v.lugar, 240), inicio: ini, fin: fin, hora: horaOk_(v.hora), horaFin: horaOk_(v.horaFin),
    responsables: txt_(v.responsables, 240), contacto: txt_(v.contacto, 120), telefono: txt_(v.telefono, 40), notas: txt_(v.notas, 3000),
    lista: (Array.isArray(v.lista) ? v.lista : []).slice(0, 30).map(function (x) { return { t: txt_(x && x.t, 200), ok: !!(x && x.ok) }; }).filter(function (x) { return x.t; })
  };
  if (!ev.titulo) throw Falla_('Escriba un título para el evento.');
  var antes = null;
  var r = conCandado_(function () {
    var A = leerAgenda_(), id = String(v.id || ''), prev = null;
    for (var i = 0; i < A.eventos.length; i++) if (A.eventos[i].id === id) prev = A.eventos[i];
    if (prev) {
      if (prev.ver && v.ver !== prev.ver && !q.forzar) return { ok: false, codigo: 'CONFLICTO', error: 'Otra persona (' + prev.actPor + ') modificó este evento. Recargue la agenda.' };
      antes = JSON.parse(JSON.stringify(prev));
      Object.keys(ev).forEach(function (k) { prev[k] = ev[k]; });
      ev = prev;
    } else {
      ev.id = 'EV-' + aleatorio_(5).toUpperCase(); ev.creado = ahora_(); ev.creadoPor = ses.email;
      A.eventos.push(ev);
    }
    ev.act = ahora_(); ev.actPor = ses.email; ev.ver = aleatorio_(4);   // ver: cambia en cada guardado (control de edición simultánea)
    var cal = calSync_(ev);                                            // copia en el calendario de Google (no detiene el guardado si falla)
    if (A.eventos.length > 3000) A.eventos = A.eventos.slice(-3000);
    guardarAgenda_(A);
    auditar_(ses.email, antes ? 'agenda_editada' : 'agenda_creada', ev.id + ' ' + ev.inicio + ' ' + ev.titulo);
    return { ok: true, evento: ev, calendario: cal };
  });
  if (r.ok) {
    var aviso = avisoAgenda_(ev, antes, ses);
    r.avisados = aviso ? avisar_(ses.email, aviso) : 0;
  }
  return r;
}
var TIPO_TXT = { VISITA: 'Visita previa', TRABAJO: 'Trabajo', OTRO: 'Evento' };
function nombreCorto_(email) { var w = String((usuarios_()[email] || {}).nombre || email).trim().split(/\s+/); return w.length >= 4 ? w[0] + ' ' + w[2] : w.slice(0, 2).join(' '); }
function fechaCorta_(d) { var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], p = String(d).split('-'); return Number(p[2]) + ' ' + m[Number(p[1]) - 1]; }
function cuandoTxt_(ev) { return (ev.inicio === ev.fin ? fechaCorta_(ev.inicio) : fechaCorta_(ev.inicio) + ' al ' + fechaCorta_(ev.fin)) + (ev.hora ? ' · ' + ev.hora : ''); }
/* qué cambió en el evento (para el aviso al resto del equipo); null si no hay nada que avisar */
function avisoAgenda_(ev, antes, ses) {
  var nombre = nombreCorto_(ses.email);
  var base = { sec: 'agenda', url: '#agenda', ref: ev.id };
  if (!antes) return Object.assign(base, { ti: TIPO_TXT[ev.tipo] + ' agendada: ' + (ev.cliente || ev.titulo), cu: cuandoTxt_(ev) + (ev.lugar ? ' · ' + ev.lugar : '') + ' — por ' + nombre });
  if (antes.estado !== ev.estado && ev.estado === 'CANCELADO') return Object.assign(base, { ti: TIPO_TXT[ev.tipo] + ' cancelada: ' + (ev.cliente || ev.titulo), cu: cuandoTxt_(antes) + ' — por ' + nombre });
  if (antes.inicio !== ev.inicio || antes.fin !== ev.fin || antes.hora !== ev.hora) return Object.assign(base, { ti: TIPO_TXT[ev.tipo] + ' reprogramada: ' + (ev.cliente || ev.titulo), cu: 'Antes ' + cuandoTxt_(antes) + ' → ahora ' + cuandoTxt_(ev) + ' — por ' + nombre });
  if (antes.estado !== ev.estado && ev.estado === 'CONFIRMADO') return Object.assign(base, { ti: TIPO_TXT[ev.tipo] + ' confirmada: ' + (ev.cliente || ev.titulo), cu: cuandoTxt_(ev) + ' — por ' + nombre });
  return null;
}
function agendaEliminar_(ses, q) {
  var id = String(q.id || '');
  return conCandado_(function () {
    var A = leerAgenda_(), n = A.eventos.length;
    var ev = null;
    A.eventos = A.eventos.filter(function (x) { if (x.id === id) ev = x; return x.id !== id; });
    if (A.eventos.length === n) throw Falla_('Ese evento ya no existe.', 'NO_EXISTE');
    if (ev && ev.gcal) { ev.estado = 'CANCELADO'; calSync_(ev); }
    guardarAgenda_(A);
    auditar_(ses.email, 'agenda_eliminada', id);
    return { ok: true };
  });
}

/* ============================================================ calendario de Google (1.9.0)
   Cada evento de la agenda se copia en el calendario «HYDRO-ROV · Agenda» de la cuenta propietaria, con
   hydrorov.co@gmail.com como invitado: así aparece en el calendario de esa cuenta. Sin correos de invitación. */
var CAL_NOMBRE = 'HYDRO-ROV · Agenda', CAL_INVITADOS = ['hydrorov.co@gmail.com'];
function calendario_() {
  var id = props_().getProperty('CAL_ID');
  if (id) { var c = CalendarApp.getCalendarById(id); if (c) return c; }
  var L = CalendarApp.getCalendarsByName(CAL_NOMBRE);
  var cal = L.length ? L[0] : CalendarApp.createCalendar(CAL_NOMBRE, { timeZone: 'America/Bogota', summary: 'Visitas técnicas previas y trabajos programados desde hydro-rov.com/analisis', color: CalendarApp.Color.TURQOISE });
  props_().setProperty('CAL_ID', cal.getId());
  return cal;
}
function fechaHora_(d, h) { return new Date(d + 'T' + (h || '00:00') + ':00-05:00'); }   // Colombia no tiene horario de verano
function calDescripcion_(ev) {
  var L = [TIPO_TXT[ev.tipo] + ' · ' + ({ PROGRAMADO: 'Programado (por confirmar)', CONFIRMADO: 'Confirmado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado' })[ev.estado]];
  if (ev.cliente) L.push('Cliente: ' + ev.cliente);
  if (ev.cotId) L.push('Cotización: ' + ev.cotId);
  if (ev.contacto || ev.telefono) L.push('Contacto: ' + [ev.contacto, ev.telefono].filter(String).join(' · '));
  if (ev.responsables) L.push('Responsables: ' + ev.responsables);
  if (ev.notas) L.push('', ev.notas);
  if (ev.lista && ev.lista.length) { L.push('', 'Lista de verificación:'); ev.lista.forEach(function (x) { L.push((x.ok ? '☑ ' : '☐ ') + x.t); }); }
  L.push('', 'Agenda: https://hydro-rov.com/analisis/#agenda');
  return L.join('\n');
}
function calSync_(ev) {
  try {
    var cal = calendario_(), e = null;
    if (ev.gcal) { try { e = cal.getEventById(ev.gcal); } catch (x) { e = null; } }
    if (ev.estado === 'CANCELADO') { if (e) e.deleteEvent(); ev.gcal = ''; return 'ok'; }
    var titulo = (ev.estado === 'REALIZADO' ? '✓ ' : ev.estado === 'PROGRAMADO' ? '(por confirmar) ' : '') + ev.titulo;
    var conHora = ev.inicio === ev.fin && !!ev.hora;
    if (e && e.isAllDayEvent() === conHora) { e.deleteEvent(); e = null; }   // cambió de «todo el día» a «con hora» o al revés
    var op = { description: calDescripcion_(ev), location: ev.lugar || '', guests: CAL_INVITADOS.join(','), sendInvites: false };
    if (conHora) {
      var ini = fechaHora_(ev.inicio, ev.hora), fin = ev.horaFin ? fechaHora_(ev.inicio, ev.horaFin) : new Date(ini.getTime() + (ev.tipo === 'VISITA' ? 2 : 8) * 3600000);
      if (fin <= ini) fin = new Date(ini.getTime() + 3600000);
      if (e) e.setTime(ini, fin); else e = cal.createEvent(titulo, ini, fin, op);
    } else {
      var d1 = fechaHora_(ev.inicio, '00:00'), d2 = fechaHora_(ev.fin, '00:00'); d2 = new Date(d2.getTime() + 86400000);
      if (e) e.setAllDayDates(d1, d2); else e = cal.createAllDayEvent(titulo, d1, d2, op);
    }
    e.setTitle(titulo); e.setDescription(op.description); e.setLocation(op.location);
    CAL_INVITADOS.forEach(function (g) { if (!e.getGuestByEmail(g)) e.addGuest(g); });
    try { e.setColor(ev.tipo === 'VISITA' ? CalendarApp.EventColor.PALE_BLUE : ev.tipo === 'TRABAJO' ? CalendarApp.EventColor.ORANGE : CalendarApp.EventColor.GRAY); } catch (x) { /* color opcional */ }
    ev.gcal = e.getId();
    return 'ok';
  } catch (err) {
    console.warn('calendario: ' + err);
    return /permis|authoriz|autoriz|scope/i.test(String(err)) ? 'falta autorizar el acceso al calendario' : String(err && err.message || err).slice(0, 140);
  }
}
/** Ejecutar una vez desde el editor tras publicar 1.9.0: pide el permiso del calendario y crea «HYDRO-ROV · Agenda». */
function autorizarCalendario() {
  var c = calendario_();
  console.log('Calendario listo: ' + c.getName() + ' (' + c.getId() + ')');
  var A = leerAgenda_(), n = 0;
  A.eventos.forEach(function (ev) { if (!ev.gcal && ev.estado !== 'CANCELADO' && ev.fin >= Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd')) { calSync_(ev); n++; } });
  guardarAgenda_(A);
  console.log('Eventos copiados: ' + n);
  vapid_();
}

/* ============================================================ avisos y notificaciones push (1.9.0)
   Avisos por usuario en _sistema/_avisos.json (campana de la app y contador del ícono). Cada aviso nuevo dispara un
   Web Push sin contenido a los equipos suscritos del destinatario; el service worker pide el texto con pushNovedades.
   Firma VAPID (ES256, curva P-256) implementada aquí con BigInt: Apps Script no trae ECDSA. */
function leerAvisos_() { return JSON.parse(archivoSistema_('_avisos.json', '{"u":{}}').getBlob().getDataAsString('UTF-8') || '{"u":{}}'); }
function guardarAvisos_(V) { archivoSistema_('_avisos.json', '{"u":{}}').setContent(JSON.stringify(V)); }
/* destinatarios: los creadores activos, menos quien hizo el cambio */
function destinatarios_(actor) {
  var U = usuarios_();
  return Object.keys(U).filter(function (m) { return m !== actor && U[m].activo !== false && U[m].rol === 'CREADOR'; });
}
function avisar_(actor, a) {
  var dest = destinatarios_(actor);
  if (!dest.length) return 0;
  try {
    conCandado_(function () {
      var V = leerAvisos_();
      dest.forEach(function (m) {
        var L = V.u[m] || [];
        L.push({ id: 'A' + aleatorio_(5), t: ahora_(), ti: txt_(a.ti, 140), cu: txt_(a.cu, 300), url: txt_(a.url, 120), sec: txt_(a.sec, 20), ref: txt_(a.ref, 40), leido: false });
        V.u[m] = L.slice(-60);
      });
      guardarAvisos_(V);
    });
    enviarPush_(dest);
  } catch (err) { console.warn('avisos: ' + err); }
  return dest.length;
}
function avisosDe_(email) {
  var L = (leerAvisos_().u[email] || []).slice().reverse();
  return { ok: true, avisos: L.slice(0, 40), noLeidos: L.filter(function (x) { return !x.leido; }).length };
}
function avisosLeidos_(email, q) {
  var ids = Array.isArray(q.ids) ? q.ids.map(String) : null, sec = txt_(q.seccion, 20), todos = !!q.todos;
  conCandado_(function () {
    var V = leerAvisos_(), L = V.u[email] || [];
    L.forEach(function (x) { if (todos || (ids && ids.indexOf(x.id) >= 0) || (sec && x.sec === sec)) x.leido = true; });
    V.u[email] = L; guardarAvisos_(V);
  });
  return avisosDe_(email);
}

/* ---------- suscripciones */
var PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com)\//;
function leerPush_() { return JSON.parse(archivoSistema_('_push.json', '{"subs":[]}').getBlob().getDataAsString('UTF-8') || '{"subs":[]}'); }
function guardarPush_(S) { archivoSistema_('_push.json', '{"subs":[]}').setContent(JSON.stringify(S)); }
function pushSuscribir_(ses, q) {
  var s = q.sub || {}, ep = String(s.endpoint || '');
  if (!PUSH_HOSTS.test(ep) || ep.length > 900) throw Falla_('Este navegador usa un servicio de notificaciones no reconocido.');
  var clave = aleatorio_(24);
  var sid = conCandado_(function () {
    var S = leerPush_(), x = null;
    S.subs.forEach(function (o) { if (o.endpoint === ep) x = o; });
    if (!x) { x = { id: 'P' + aleatorio_(6), endpoint: ep, creado: ahora_() }; S.subs.push(x); }
    x.email = ses.email; x.clave = sha256_(clave); x.ua = txt_(q.ua, 160); x.act = ahora_();
    var mios = S.subs.filter(function (o) { return o.email === ses.email; });
    if (mios.length > 8) { var viejo = mios.sort(function (a, b) { return a.act < b.act ? -1 : 1; })[0]; S.subs = S.subs.filter(function (o) { return o !== viejo; }); }
    guardarPush_(S);
    return x.id;
  });
  auditar_(ses.email, 'push_activado', txt_(q.ua, 60));
  return { ok: true, sid: sid, clave: clave };
}
function pushQuitar_(ses, q) {
  var ep = String(q.endpoint || '');
  conCandado_(function () { var S = leerPush_(); S.subs = S.subs.filter(function (o) { return !(o.endpoint === ep && o.email === ses.email); }); guardarPush_(S); });
  return { ok: true };
}
function pushProbar_(ses) {
  conCandado_(function () {
    var V = leerAvisos_(), L = V.u[ses.email] || [];
    L.push({ id: 'A' + aleatorio_(5), t: ahora_(), ti: 'Notificaciones activadas', cu: 'Este equipo recibirá los avisos de la agenda y de las cotizaciones de HYDRO-ROV.', url: '#agenda', sec: 'sistema', ref: '', leido: false });
    V.u[ses.email] = L.slice(-60); guardarAvisos_(V);
  });
  return { ok: true, enviados: enviarPush_([ses.email]) };
}
/* lo llama el service worker: identifica el equipo por su id y su clave (no necesita la sesión) */
function pushNovedades_(q) {
  var sid = String(q.sid || ''), clave = String(q.clave || ''), sub = null;
  leerPush_().subs.forEach(function (o) { if (o.id === sid) sub = o; });
  if (!sub || !igual_(sub.clave, sha256_(clave))) return { ok: false, error: 'Suscripción no válida.' };
  var r = avisosDe_(sub.email);
  return { ok: true, avisos: r.avisos.filter(function (x) { return !x.leido; }).slice(0, 3), noLeidos: r.noLeidos };
}

/* ---------- envío (VAPID) */
function b64url_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function vapid_() {
  var P = props_(), d = P.getProperty('VAPID_D'), pub = P.getProperty('VAPID_PUB');
  if (d && pub) return { d: d, pub: pub };
  var E = ec_(), k;
  do { k = E.mod(E.big(Utilities.computeHmacSha256Signature(Utilities.newBlob(Utilities.getUuid() + Utilities.getUuid()).getBytes(), Utilities.newBlob(Utilities.getUuid()).getBytes())), E.N); } while (k === E.cero);
  var Q = E.afin(E.mul(k, E.G));
  d = E.hex32(k); pub = b64url_([4].concat(E.bytes32(Q[0]), E.bytes32(Q[1])));
  P.setProperty('VAPID_D', d); P.setProperty('VAPID_PUB', pub);
  return { d: d, pub: pub };
}
function jwtVapid_(aud) {
  var cache = CacheService.getScriptCache(), k = 'JWT_' + sha256_(aud).slice(0, 20), t = cache.get(k);
  if (t) return t;
  var v = vapid_(), exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  var ent = b64url_(Utilities.newBlob(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).getBytes()) + '.' + b64url_(Utilities.newBlob(JSON.stringify({ aud: aud, exp: exp, sub: 'mailto:contacto@hydro-rov.com' })).getBytes());
  t = ent + '.' + b64url_(ec_().firmar(ent, v.d));
  cache.put(k, t, 11 * 3600);
  return t;
}
function enviarPush_(emails) {
  var S = leerPush_(), subs = S.subs.filter(function (o) { return emails.indexOf(o.email) >= 0; });
  if (!subs.length) return 0;
  var pub = vapid_().pub;
  var reqs = subs.map(function (o) {
    var aud = o.endpoint.match(/^https:\/\/[^\/]+/)[0];
    return { url: o.endpoint, method: 'post', muteHttpExceptions: true, contentType: 'application/octet-stream', payload: '',
      headers: { TTL: '86400', Urgency: 'high', Authorization: 'vapid t=' + jwtVapid_(aud) + ', k=' + pub } };
  });
  var res = UrlFetchApp.fetchAll(reqs), muertas = [], ok = 0;
  res.forEach(function (r, i) { var c = r.getResponseCode(); if (c === 404 || c === 410) muertas.push(subs[i].endpoint); else if (c < 300) ok++; else console.warn('push ' + c + ': ' + r.getContentText().slice(0, 200)); });
  if (muertas.length) conCandado_(function () { var S2 = leerPush_(); S2.subs = S2.subs.filter(function (o) { return muertas.indexOf(o.endpoint) < 0; }); guardarPush_(S2); });
  return ok;
}

/* ---------- curva P-256 (ECDSA) con BigInt, coordenadas jacobianas */
var EC_CACHE_ = null;
function ec_() {
  if (EC_CACHE_) return EC_CACHE_;
  var B = function (h) { return BigInt('0x' + h); }, Z = BigInt(0), U = BigInt(1), D2 = BigInt(2), D3 = BigInt(3), D4 = BigInt(4), D8 = BigInt(8);
  var P = B('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  var N = B('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  var G = [B('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), B('4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')];
  function mod(a, m) { var r = a % m; return r < Z ? r + m : r; }
  function inv(a, m) { var lm = U, hm = Z, low = mod(a, m), high = m; while (low > U) { var r = high / low, nm = hm - lm * r, nw = high - low * r; hm = lm; high = low; lm = nm; low = nw; } return mod(lm, m); }
  function dbl(p) {
    if (!p || p[1] === Z) return null;
    var de = mod(p[2] * p[2], P), ga = mod(p[1] * p[1], P), be = mod(p[0] * ga, P), al = mod(D3 * (p[0] - de) * (p[0] + de), P);
    var x3 = mod(al * al - D8 * be, P);
    return [x3, mod(al * (D4 * be - x3) - D8 * ga * ga, P), mod((p[1] + p[2]) * (p[1] + p[2]) - ga - de, P)];
  }
  function add(p, q) {
    if (!p) return q; if (!q) return p;
    var z1 = mod(p[2] * p[2], P), z2 = mod(q[2] * q[2], P), u1 = mod(p[0] * z2, P), u2 = mod(q[0] * z1, P), s1 = mod(p[1] * q[2] * z2, P), s2 = mod(q[1] * p[2] * z1, P);
    if (u1 === u2) return s1 === s2 ? dbl(p) : null;
    var h = mod(u2 - u1, P), r = mod(s2 - s1, P), hh = mod(h * h, P), hhh = mod(h * hh, P), v = mod(u1 * hh, P), x3 = mod(r * r - hhh - D2 * v, P);
    return [x3, mod(r * (v - x3) - s1 * hhh, P), mod(p[2] * q[2] * h, P)];
  }
  function mul(k, pt) { var R = null, Q = [pt[0], pt[1], U]; while (k > Z) { if (k & U) R = add(R, Q); Q = dbl(Q); k = k >> U; } return R; }
  function afin(p) { var zi = inv(p[2], P), zi2 = mod(zi * zi, P); return [mod(p[0] * zi2, P), mod(p[1] * zi2 * zi, P)]; }
  function big(bytes) { var h = bytes.map(function (b) { var x = (b < 0 ? b + 256 : b).toString(16); return x.length === 1 ? '0' + x : x; }).join(''); return h ? BigInt('0x' + h) : Z; }
  function hex32(x) { var h = x.toString(16); while (h.length < 64) h = '0' + h; return h; }
  function bytes32(x) { var h = hex32(x), o = []; for (var i = 0; i < 64; i += 2) { var b = parseInt(h.substr(i, 2), 16); o.push(b > 127 ? b - 256 : b); } return o; }
  /* firma ECDSA de un texto con la clave privada (hex). Nonce «cubierto»: HMAC(clave, hash ‖ azar), nunca se repite. */
  function firmar(texto, dHex) {
    var d = B(dHex), hb = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8), z = big(hb);
    for (var i = 0; i < 20; i++) {
      var k = mod(big(Utilities.computeHmacSha256Signature(Utilities.newBlob(hex32(z) + Utilities.getUuid() + i).getBytes(), Utilities.newBlob(dHex).getBytes())), N - U) + U;
      var R = afin(mul(k, G)), r = mod(R[0], N); if (r === Z) continue;
      var s = mod(inv(k, N) * (z + r * d), N); if (s === Z) continue;
      return bytes32(r).concat(bytes32(s));
    }
    throw new Error('No se pudo firmar.');
  }
  EC_CACHE_ = { N: N, G: G, cero: Z, mod: mod, mul: mul, afin: afin, big: big, hex32: hex32, bytes32: bytes32, firmar: firmar };
  return EC_CACHE_;
}

/* ============================================================ instalación (ejecutar una vez desde el editor) */
function instalar() {
  asegurarUsuarios_();
  var r = raiz_(); sistema_(); leerIndice_();
  // el segundo creador ve y edita la carpeta desde su propio Drive
  CFG.CREADORES.forEach(function (c) {
    if (c.email === CFG.CREADORES[0].email) return;   // el propietario de la cuenta
    try { r.addEditor(c.email); } catch (e) { console.warn('No se compartió con ' + c.email + ': ' + e); }
  });
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  console.log('Correos disponibles hoy: ' + MailApp.getRemainingDailyQuota());
  console.log('Listo. Carpeta raíz: ' + r.getUrl());
}

/** Solo para emergencias: devuelve la clave de un creador a 0000 con cambio obligatorio. Ejecutar desde el editor. */
function reiniciarCreadores() {
  conCandado_(function () {
    var U = usuarios_();
    CFG.CREADORES.forEach(function (c) {
      var u = U[c.email] || nuevoUsuario_(c.nombre, 'CREADOR', CFG.CLAVE_INICIAL, true);
      u.sal = aleatorio_(16); u.hash = hashClave_(CFG.CLAVE_INICIAL, u.sal); u.debeCambiar = true; u.activo = true; u.rol = 'CREADOR';
      u.fallos = 0; u.bloqueoHasta = 0; U[c.email] = u;
    });
    guardarUsuarios_(U);
  });
  CFG.CREADORES.forEach(function (c) { cerrarSesionesDe_(c.email, null); });
}
