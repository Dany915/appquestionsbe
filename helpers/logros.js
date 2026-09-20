const mongoose = require('mongoose');
const Attempt  = require('../models/attempt');
const User     = require('../models/user');
const { progresoNivel } = require('./leveling');
const { faltanAvatares, evaluarAvatares } = require('./avatarRewards');
const { faltanMarcosTiempo, evaluarMarcosTiempo } = require('./frameRewards');

/**
 * Logros que dependen del historial COMPLETO del usuario (no del quiz recién
 * calificado): los 12 avatares y los 6 marcos de dedicación.
 *
 * Coste: una sola agregación con todos los contadores, y solo cuando al
 * usuario le falta algo. Al que ya los tiene todos no le cuesta ninguna
 * consulta extra.
 *
 * Como cuentan el historial entero, son retroactivos: al terminar su siguiente
 * quiz, cada usuario recibe de golpe lo que ya tenía ganado.
 */

/** Un quiz cuenta si tuvo al menos estas preguntas calificadas. */
const MIN_PREGUNTAS_QUIZ = 5;

/** Preguntas mínimas para que un 100% cuente como "quiz perfecto". */
const MIN_PREGUNTAS_PERFECTO = 10;

/**
 * Contadores acumulados del usuario.
 * @returns {Promise<{quizzes, correctas, horas, perfectos, nivel}>}
 */
const estadisticasDe = async (userId, xp = 0) => {
    const _id = new mongoose.Types.ObjectId(String(userId));

    const [r] = await Attempt.aggregate([
        { $match: { userId: _id } },
        {
            $group: {
                _id: null,
                quizzes: {
                    $sum: { $cond: [{ $gte: ['$totalGraded', MIN_PREGUNTAS_QUIZ] }, 1, 0] },
                },
                correctas: { $sum: '$correct' },
                segundos:  { $sum: '$timeTakenSecs' },
                perfectos: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$totalGraded', MIN_PREGUNTAS_PERFECTO] },
                                    { $eq: ['$scorePercent', 100] },
                                ],
                            },
                            1, 0,
                        ],
                    },
                },
            },
        },
    ]);

    return {
        quizzes:   r?.quizzes   || 0,
        correctas: r?.correctas || 0,
        horas:     (r?.segundos || 0) / 3600,
        perfectos: r?.perfectos || 0,
        nivel:     progresoNivel(xp || 0).nivel,
    };
};

/**
 * Evalúa y otorga los logros acumulados. Devuelve lo recién desbloqueado:
 *   { avatars: [...], marcos: [...] }
 */
const evaluarLogrosAcumulados = async (userId) => {
    const vacio = { avatars: [], marcos: [] };

    const user = await User.findById(userId, 'xp avatarsDesbloqueados marcosDesbloqueados');
    if (!user) return vacio;

    const faltanAv = faltanAvatares(user.avatarsDesbloqueados);
    const faltanMa = faltanMarcosTiempo(user.marcosDesbloqueados);
    if (!faltanAv && !faltanMa) return vacio;

    const stats = await estadisticasDe(userId, user.xp);

    const [avatars, marcos] = await Promise.all([
        faltanAv ? evaluarAvatares(userId, stats) : [],
        faltanMa ? evaluarMarcosTiempo(userId, stats.horas) : [],
    ]);

    return { avatars, marcos };
};

module.exports = {
    MIN_PREGUNTAS_QUIZ,
    MIN_PREGUNTAS_PERFECTO,
    estadisticasDe,
    evaluarLogrosAcumulados,
};
