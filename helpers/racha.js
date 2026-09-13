const { offsetDe, inicioDiaLocal } = require('./diaLocal');

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Días de gracia de la racha: cuántos días pueden pasar entre un día activo y
 * el siguiente sin perderla. La racha cuenta DÍAS ACTIVOS, no días seguidos.
 *
 * Con 3: juega el día 1 → racha 1; vuelve el día 4 → racha 2; si vuelve el
 * día 5 o después → reinicia a 1. Con 1 sería la racha diaria clásica.
 */
const DIAS_GRACIA = 3;

/**
 * Estado real de la racha de un usuario en este momento.
 *
 * `currentStreak` en la BD se actualiza de forma perezosa (solo al calificar),
 * así que si el usuario lleva días sin jugar el campo sigue mostrando la racha
 * vieja. Este helper calcula lo que la app debe mostrar:
 *
 *   diasSinJugar  → días locales desde el último intento (0 = hoy, null = nunca)
 *   rachaViva     → el último intento está dentro de la ventana de gracia
 *   rachaEfectiva → currentStreak si la racha sigue viva; 0 si ya la perdió
 *   jugoHoy       → si ya hizo un intento en su día local actual
 *   cubiertoHoy   → tiene racha viva y hoy NO necesita jugar para conservarla
 *                   (jugó hoy o aún le quedan días de gracia después de hoy)
 *   enRiesgo      → tiene racha viva y hoy es su último día para conservarla
 *   expiraEn      → instante UTC en que se pierde la racha si no juega antes
 *                   (null si no tiene racha)
 *
 * Lo usan el dashboard, el perfil público y `actualizarRacha` al calificar,
 * para que todos cuenten los días con la misma regla.
 */
const estadoRacha = (user, ahora = new Date()) => {
    const offset = offsetDe(user);
    const hoy    = inicioDiaLocal(ahora, offset);

    let diasSinJugar = null;
    let ultimo       = null;

    if (user.lastAttemptDate) {
        ultimo = inicioDiaLocal(user.lastAttemptDate, offset);
        // Negativo solo si el usuario cambió de zona horaria hacia atrás: se
        // trata como si hubiera jugado hoy.
        diasSinJugar = Math.max(0, Math.round((hoy - ultimo) / DIA_MS));
    }

    const jugoHoy       = diasSinJugar === 0;
    const rachaViva     = diasSinJugar !== null && diasSinJugar <= DIAS_GRACIA;
    const rachaEfectiva = rachaViva ? (user.currentStreak || 0) : 0;
    const tieneRacha    = rachaEfectiva > 0;

    return {
        diasSinJugar,
        rachaViva,
        rachaEfectiva,
        jugoHoy,
        cubiertoHoy: tieneRacha && diasSinJugar < DIAS_GRACIA,
        enRiesgo:    tieneRacha && diasSinJugar === DIAS_GRACIA,
        // Se pierde al terminar el último día de gracia
        expiraEn:    tieneRacha
            ? new Date(ultimo.getTime() + (DIAS_GRACIA + 1) * DIA_MS)
            : null,
    };
};

module.exports = { DIAS_GRACIA, estadoRacha };
