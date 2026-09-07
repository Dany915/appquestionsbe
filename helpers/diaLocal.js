/**
 * Día "local" del usuario.
 *
 * La racha y el tope diario de XP se cuentan por días naturales, pero el
 * servidor vive en UTC: en Colombia (UTC-5) la medianoche UTC son las 7 pm,
 * así que un usuario que juega un día a las 6 pm y al siguiente a las 8 pm
 * caía en "días" distintos y perdía la racha sin culpa.
 *
 * Cada usuario guarda `utcOffsetMin` (lo manda la app en login/renew) y con
 * él se calcula dónde empieza SU día. Las fechas siguen almacenándose en UTC.
 */

// Colombia. Se usa para usuarios que aún no han enviado su offset.
const OFFSET_DEFAULT = -300;

// Límites reales de las zonas horarias del mundo (UTC-14 a UTC+14)
const OFFSET_MIN = -14 * 60;
const OFFSET_MAX =  14 * 60;

/** Offset del usuario en minutos, con fallback al default. */
const offsetDe = (user) =>
    Number.isInteger(user?.utcOffsetMin) ? user.utcOffsetMin : OFFSET_DEFAULT;

/**
 * Valida un offset recibido del cliente. Retorna el entero o null si no sirve.
 * Acepta número o string numérico (viene por body o por query).
 */
const parsearOffset = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < OFFSET_MIN || n > OFFSET_MAX) return null;
    return n;
};

/**
 * Instante UTC en el que empieza el día local que contiene a `fecha`.
 * Ej: offset -300, fecha 2026-09-06T02:30Z (21:30 del día 5 en Colombia)
 *     → 2026-09-05T05:00Z (medianoche del día 5 en Colombia)
 */
const inicioDiaLocal = (fecha, offsetMin) => {
    const ms    = offsetMin * 60 * 1000;
    const local = new Date(new Date(fecha).getTime() + ms);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - ms);
};

/** true si ambas fechas caen en el mismo día local del usuario. */
const mismoDiaLocal = (a, b, offsetMin) =>
    inicioDiaLocal(a, offsetMin).getTime() === inicioDiaLocal(b, offsetMin).getTime();

module.exports = {
    OFFSET_DEFAULT,
    offsetDe,
    parsearOffset,
    inicioDiaLocal,
    mismoDiaLocal,
};
