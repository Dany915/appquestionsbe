const Attempt     = require('../models/attempt');
const User        = require('../models/user');
const WeeklyClose = require('../models/weeklyClose');
const { otorgarMarcos }    = require('./frames');
const { marcosPorRanking } = require('./frameRewards');

/** Lunes 00:00 UTC de la semana que contiene a `fecha`. */
const inicioSemanaDe = (fecha) => {
    const d = new Date(fecha);
    d.setUTCHours(0, 0, 0, 0);
    const diff = (d.getUTCDay() + 6) % 7; // lunes = 0
    d.setUTCDate(d.getUTCDate() - diff);
    return d;
};

/** Cuántos usuarios del top se premian como máximo. */
const TOP_PREMIADO = 10;

/**
 * Cierra una semana concreta y reparte los marcos del ranking.
 *
 * Concurrencia: el índice único de `inicioSemana` hace de cerrojo. Si dos
 * peticiones intentan cerrar la misma semana a la vez, solo una consigue crear
 * el documento; la otra recibe un error de clave duplicada y se retira sin
 * premiar. Así es imposible entregar los premios dos veces.
 *
 * @returns {Promise<boolean>} true si esta llamada fue la que cerró la semana
 */
const cerrarSemana = async (inicioSemana) => {
    const fin = new Date(inicioSemana);
    fin.setUTCDate(fin.getUTCDate() + 7);

    let cierre;
    try {
        // Intento de tomar el cerrojo. Falla si la semana ya está registrada.
        cierre = await WeeklyClose.create({
            inicioSemana,
            estado: 'procesando',
        });
    } catch (error) {
        if (error?.code === 11000) return false; // otro proceso se adelantó
        throw error;
    }

    // XP de esa semana por usuario
    const filas = await Attempt.aggregate([
        {
            $match: {
                createdAt: { $gte: inicioSemana, $lt: fin },
                xpGanada:  { $gt: 0 },
            },
        },
        { $group: { _id: '$userId', xpSemana: { $sum: '$xpGanada' } } },
        { $sort: { xpSemana: -1 } },
        { $limit: TOP_PREMIADO },
    ]);

    const snapshot = [];

    for (let i = 0; i < filas.length; i++) {
        const posicion = i + 1;
        const userId   = filas[i]._id;

        const user = await User.findById(
            userId,
            'username semanasTop1 rachaTop3 ultimaSemanaTop3 active'
        );
        if (!user || !user.active) continue;

        // ── Contadores históricos ──
        const semanasTop1 = (user.semanasTop1 || 0) + (posicion === 1 ? 1 : 0);

        let rachaTop3 = user.rachaTop3 || 0;
        if (posicion <= 3) {
            // Consecutiva solo si la última vez fue justo la semana anterior
            const anterior = new Date(inicioSemana);
            anterior.setUTCDate(anterior.getUTCDate() - 7);
            const ultima = user.ultimaSemanaTop3
                ? new Date(user.ultimaSemanaTop3).getTime()
                : null;
            rachaTop3 = ultima === anterior.getTime() ? rachaTop3 + 1 : 1;
        } else {
            rachaTop3 = 0; // salió del top 3: se corta la racha
        }

        await User.findByIdAndUpdate(userId, {
            semanasTop1,
            rachaTop3,
            ...(posicion <= 3 && { ultimaSemanaTop3: inicioSemana }),
        });

        // ── Marcos ──
        const marcos = marcosPorRanking({ posicion, semanasTop1, rachaTop3 });
        if (marcos.length > 0) await otorgarMarcos(userId, marcos);

        snapshot.push({
            userId,
            username: user.username,
            position: posicion,
            xpSemana: filas[i].xpSemana,
        });
    }

    cierre.estado             = 'completada';
    cierre.top                = snapshot;
    cierre.totalParticipantes = filas.length;
    await cierre.save();

    return true;
};

/**
 * Cierra las semanas pendientes (todas las anteriores a la actual que aún no
 * se hayan procesado). Se invoca de forma perezosa al consultar el ranking:
 * así no hace falta un cron y la app funciona aunque nadie entre en días.
 *
 * Solo mira las últimas `maxSemanas` para no recorrer el histórico completo.
 */
const cerrarSemanasPendientes = async (maxSemanas = 4) => {
    const semanaActual = inicioSemanaDe(new Date());
    const cerradas = [];

    for (let i = 1; i <= maxSemanas; i++) {
        const inicio = new Date(semanaActual);
        inicio.setUTCDate(inicio.getUTCDate() - 7 * i);

        const yaExiste = await WeeklyClose.exists({ inicioSemana: inicio });
        if (yaExiste) break; // al encontrar una cerrada, las previas también lo están

        const cerrada = await cerrarSemana(inicio);
        if (cerrada) cerradas.push(inicio);
    }

    return cerradas;
};

module.exports = { inicioSemanaDe, cerrarSemana, cerrarSemanasPendientes };
