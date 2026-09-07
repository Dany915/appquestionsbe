const { offsetDe, inicioDiaLocal } = require('./diaLocal');

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Estado real de la racha de un usuario en este momento.
 *
 * `currentStreak` en la BD se actualiza de forma perezosa (solo al calificar),
 * así que si el usuario lleva días sin jugar el campo sigue mostrando la racha
 * vieja. Este helper calcula lo que la app debe mostrar:
 *
 *   rachaEfectiva → currentStreak si jugó hoy o ayer; 0 si ya la perdió
 *   jugoHoy       → si ya hizo un intento en su día local actual
 *   enRiesgo      → tiene racha viva pero hoy aún no ha jugado
 *   expiraEn      → instante UTC en que se pierde la racha si no juega antes
 *                   (null si no tiene racha)
 *
 * Lo usan el dashboard, el perfil público y `actualizarRacha` al calificar,
 * para que todos cuenten los días con la misma regla.
 */
const estadoRacha = (user, ahora = new Date()) => {
    const offset = offsetDe(user);
    const hoy    = inicioDiaLocal(ahora, offset);
    const ayer   = new Date(hoy.getTime() - DIA_MS);
    const manana = new Date(hoy.getTime() + DIA_MS);

    let jugoHoy  = false;
    let jugoAyer = false;

    if (user.lastAttemptDate) {
        const ultimo = inicioDiaLocal(user.lastAttemptDate, offset).getTime();
        jugoHoy  = ultimo === hoy.getTime();
        jugoAyer = ultimo === ayer.getTime();
    }

    const rachaEfectiva = (jugoHoy || jugoAyer) ? (user.currentStreak || 0) : 0;

    let expiraEn = null;
    if (rachaEfectiva > 0) {
        // Si ya jugó hoy tiene hasta el final de mañana; si no, hasta el final de hoy
        expiraEn = jugoHoy ? new Date(manana.getTime() + DIA_MS) : manana;
    }

    return {
        rachaEfectiva,
        jugoHoy,
        jugoAyer,
        enRiesgo: rachaEfectiva > 0 && !jugoHoy,
        expiraEn,
    };
};

module.exports = { estadoRacha };
