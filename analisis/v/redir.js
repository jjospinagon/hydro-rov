/* La verificación vive en /verificar/ (fuera de la app instalada, así abre como pestaña normal). Los QR antiguos apuntan aquí: se redirige conservando el código. */
if (location.pathname.indexOf('/analisis/v') === 0) location.replace('/verificar/' + location.search);
