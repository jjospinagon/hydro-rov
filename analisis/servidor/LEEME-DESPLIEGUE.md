# HYDRO-ROV · Análisis — puesta en marcha

## Arquitectura

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Aplicación web (`analisis/`) | GitHub Pages, repo `jjospinagon/hydro-rov` | Ingreso, informes, consola de video, fotos, perfil del tramo, exportación PDF y Word (en el navegador) |
| Servidor (`servidor/Codigo.gs`) | Google Apps Script de **jjospinagon@gmail.com** | Usuarios y sesiones, guardado en Drive, subida de video por trozos, copias de los exportados |
| Datos | Google Drive de jjospinagon@gmail.com → carpeta **HYDRO-ROV · Informes de inspección** | Una subcarpeta por informe: `informe.json`, `fotos/`, `videos/`, `exportados/` |

## 1. Publicar el servidor (una sola vez)

1. Con la cuenta **jjospinagon@gmail.com** abrir <https://script.google.com> → **Nuevo proyecto**. Nombre: `HYDRO-ROV Análisis`.
2. Pegar el contenido de `Codigo.gs` en el archivo `Código.gs`.
3. Configuración del proyecto (⚙) → marcar «Mostrar el archivo de manifiesto appsscript.json» → pegar el contenido de `appsscript.json`.
4. En el editor elegir la función **`instalar`** → **Ejecutar** → aceptar los permisos (Drive y conexión externa). Crea la carpeta raíz, los dos creadores con clave `0000` y comparte la carpeta con ing.jjgomezm@gmail.com.
5. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo (jjospinagon@gmail.com)**
   - Quién tiene acceso: **Cualquier usuario**
6. Copiar la URL que termina en `/exec` y pegarla en `analisis/config.js` → `API: '…/exec'`. Publicar el cambio en GitHub.

> Al cambiar el código del servidor: **Implementar → Gestionar implementaciones → editar → Nueva versión**. Así la URL `/exec` no cambia.

## 2. Dirección analisis.hydro-rov.com

La app queda servida en `https://hydro-rov.com/analisis/`. Para entrar por `analisis.hydro-rov.com` (dominio en Cloudflare), cualquiera de estas dos:

- **Cloudflare Pages (la dirección no cambia en la barra):** Workers & Pages → Crear → Pages → Conectar con Git → repo `jjospinagon/hydro-rov`, sin comando de compilación, directorio de salida `analisis` → Dominios personalizados → `analisis.hydro-rov.com`.
- **Redirección:** registro DNS `analisis` (AAAA `100::`, proxied) + Regla de redirección `analisis.hydro-rov.com/*` → `https://hydro-rov.com/analisis/` (301).

## 3. Primer ingreso

- Usuarios creadores: `jjospinagon@gmail.com` y `ing.jjgomezm@gmail.com`, clave inicial `0000`.
- En el primer ingreso el sistema obliga a crear una contraseña propia (mínimo 8 caracteres, letras y números). Mientras no se cambie, el servidor no atiende ninguna otra acción.
- **Hacer el primer ingreso de ambos creadores apenas quede publicado**: hasta ese momento la clave `0000` es la única barrera.
- Nuevos usuarios (Usuarios → Agregar): el sistema genera una clave temporal que se muestra una sola vez.

## Seguridad implementada

- Contraseñas guardadas solo como HMAC-SHA256 iterado (1.000 vueltas) con sal propia; nunca en texto.
- 5 intentos fallidos → bloqueo de 15 minutos; máximo 40 intentos de ingreso por minuto en todo el sistema.
- Sesión con token aleatorio de 256 bits (en el servidor solo su huella SHA-256); 10 h renovables o 30 días si se marca «mantener la sesión».
- Cambio de clave cierra las demás sesiones del usuario; desactivar un usuario cierra sus sesiones.
- Roles: CREADOR (todo), EDITOR (crea y edita), LECTOR (consulta y descarga). Los creadores fijos no se pueden degradar.
- Un archivo de Drive solo se entrega si pertenece a la carpeta del informe consultado; las fotos y exportados se validan por su firma binaria (JPG/PNG/PDF/DOCX).
- Control de versiones: si dos personas editan el mismo informe, el segundo guardado avisa del conflicto en vez de sobrescribir.
- Registro de actividad (ingresos, fallos, bloqueos, cambios de clave, informes, videos, exportaciones) en `_sistema/_auditoria.log`.
- Política de contenido (CSP) en la app: solo scripts propios y conexión solo con Apps Script.

## Emergencia

Si un creador pierde su clave: en el editor de Apps Script ejecutar `reiniciarCreadores()` → ambas vuelven a `0000` con cambio obligatorio.
