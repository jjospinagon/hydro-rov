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

var VERSION = '1.0.0 (2026-11-25)';

var CFG = {
  RAIZ_NOMBRE: 'HYDRO-ROV · Informes de inspección',
  CREADORES: [
    { email: 'jjospinagon@gmail.com', nombre: 'Juan José Ospina González' },
    { email: 'ing.jjgomezm@gmail.com', nombre: 'Creador HYDRO-ROV' }
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
    case 'eliminar': puede_(ses, 'admin'); return eliminar_(ses, q);
    case 'subirFoto': puede_(ses, 'editar'); return subirFoto_(ses, q);
    case 'obtenerFotos': return obtenerFotos_(ses, q);
    case 'borrarFoto': puede_(ses, 'editar'); return borrarFoto_(ses, q);
    case 'videoIniciar': puede_(ses, 'editar'); return videoIniciar_(ses, q);
    case 'videoTrozo': puede_(ses, 'editar'); return videoTrozo_(ses, q);
    case 'videoLeer': return videoLeer_(ses, q);
    case 'subirExport': puede_(ses, 'editar'); return subirExport_(ses, q);
    case 'enlaceDrive': return enlaceDrive_(ses, q);
    case 'usuarios': puede_(ses, 'admin'); return usuariosListar_();
    case 'usuarioGuardar': puede_(ses, 'admin'); return usuarioGuardar_(ses, q);
    case 'usuarioReiniciar': puede_(ses, 'admin'); return usuarioReiniciar_(ses, q);
    case 'auditoria': puede_(ses, 'admin'); return { ok: true, eventos: leerAuditoria_() };
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
  e.tramos = tramos.length; e.obs = nobs; e.gradoMax = max;
  e.portada = portada;
  e.rev = inf.rev; e.actualizado = inf.actualizado; e.actualizadoPor = inf.actualizadoPor;
  return e;
}

/* ============================================================ informes */
function listar_(ses) {
  var ix = leerIndice_();
  return { ok: true, informes: ix.informes.slice().sort(function (a, b) { return String(b.actualizado).localeCompare(String(a.actualizado)); }),
           usuario: publico_(ses.email, ses.user) };
}

function leerInforme_(e) { return JSON.parse(DriveApp.getFileById(e.archivo).getBlob().getDataAsString('UTF-8')); }

function obtener_(ses, q) {
  var e = entradaOFalla_(q.id);
  return { ok: true, informe: leerInforme_(e), carpeta: DriveApp.getFolderById(e.carpeta).getUrl() };
}

function crearCarpetas_(id, titulo) {
  var c = raiz_().createFolder(nombreCarpeta_(id, titulo));
  return { carpeta: c.getId(), fFotos: c.createFolder('fotos').getId(), fVideos: c.createFolder('videos').getId(), fExport: c.createFolder('exportados').getId(), c: c };
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
    var cs = crearCarpetas_(id, (inf.general || {}).proyecto);
    var a = cs.c.createFile('informe.json', JSON.stringify(inf), MimeType.PLAIN_TEXT);
    var e = { id: id, carpeta: cs.carpeta, fFotos: cs.fFotos, fVideos: cs.fVideos, fExport: cs.fExport, archivo: a.getId() };
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

function eliminar_(ses, q) {
  return conCandado_(function () {
    var ix = leerIndice_(), id = String(q.id || ''), e = entrada_(ix, id);
    if (!e) throw Falla_('Ese informe ya no existe.');
    try { DriveApp.getFolderById(e.carpeta).setTrashed(true); } catch (err) { /* ya no está */ }
    ix.informes = ix.informes.filter(function (x) { return x.id !== id; });
    guardarIndice_(ix);
    auditar_(ses.email, 'informe_a_papelera', id);
    return { ok: true, mensaje: 'El informe quedó en la papelera de Drive (se puede recuperar durante 30 días).' };
  });
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
  return { ok: true, url: f.getUrl(), nombre: nombre };
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
