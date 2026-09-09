/**
 * Ciclo semanal del ranking.
 *
 * La racha y el tope diario de XP se cuentan en el día local de CADA usuario
 * (ver `diaLocal.js`), pero el ranking no puede funcionar así: es una
 * competencia compartida y todos tienen que sumar sobre la misma ventana, o
 * las posiciones no significan nada. Por eso la semana usa una sola zona de
 * referencia para toda la app.
 *
 * Antes la semana empezaba el lunes 00:00 UTC, que en Colombia son las 7 pm
 * del domingo: el ranking se reiniciaba y los premios se repartían con cinco
 * horas de domingo todavía por jugar, y la XP de esa franja se le sumaba a la
 * semana siguiente. Ahora la semana va de lunes 00:00 a lunes 00:00 en hora
 * de referencia.
 *
 * El **id** de la semana (`inicioSemana`, la clave con la que se guarda cada
 * cierre) sigue siendo el lunes 00:00 del calendario de referencia escrito
 * sin el offset, es decir el mismo valor que ya está guardado en la base de
 * datos. Así los cierres viejos se siguen reconociendo y no hay que migrar
 * nada; lo que cambia es la ventana de intentos que ese id representa, que se
 * obtiene con `ventanaSemana`.
 */

const { OFFSET_DEFAULT } = require('./diaLocal');

/**
 * Zona de referencia del ciclo semanal: Colombia (UTC-5, sin horario de
 * verano). Es el único sitio que hay que cambiar si algún día el público
 * principal deja de ser colombiano.
 */
const OFFSET_SEMANA = OFFSET_DEFAULT;

const MS_DIA    = 24 * 60 * 60 * 1000;
const MS_OFFSET = OFFSET_SEMANA * 60 * 1000;

/**
 * Id de la semana que contiene a `fecha`: el lunes 00:00 de referencia.
 * Ej: offset -300, fecha 2026-09-07T02:00Z (domingo 9 pm en Colombia)
 *     → 2026-08-31T00:00Z, o sea la semana que aún no ha terminado.
 */
const idSemanaDe = (fecha = new Date()) => {
    const local = new Date(new Date(fecha).getTime() + MS_OFFSET);
    local.setUTCHours(0, 0, 0, 0);
    local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
    return local;
};

/**
 * Instantes UTC reales en los que abre y cierra la semana `id`. `fin` es
 * exclusivo: es el mismo instante en el que abre la semana siguiente.
 */
const ventanaSemana = (id) => {
    const inicio = new Date(new Date(id).getTime() - MS_OFFSET);
    return { inicio, fin: new Date(inicio.getTime() + 7 * MS_DIA) };
};

/** Id de la semana `semanas` semanas antes que `id`. */
const idSemanaAnterior = (id, semanas = 1) =>
    new Date(new Date(id).getTime() - semanas * 7 * MS_DIA);

module.exports = {
    OFFSET_SEMANA,
    idSemanaDe,
    ventanaSemana,
    idSemanaAnterior,
};
