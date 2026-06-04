const Attempt = require('../models/attempt');
const User    = require('../models/user');

const NIVEL_ORDER = ['curioso', 'analitico', 'estratega', 'genio'];

const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/temas-dificiles
 * Temas ordenados de menor a mayor tasa de acierto global.
 * Solo incluye temas con al menos 5 respuestas para que sea estadísticamente relevante.
 * Query: ?limit=10
 */
const temasMasDificiles = async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    try {
        const temas = await Attempt.aggregate([
            { $unwind: '$answers' },
            { $match: { 'answers.topicTag': { $exists: true, $ne: null } } },
            {
                $group: {
                    _id:            '$answers.topicTag',
                    totalAnswers:   { $sum: 1 },
                    correctAnswers: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
                },
            },
            { $match: { totalAnswers: { $gte: 5 } } },
            {
                $project: {
                    totalAnswers:   1,
                    correctAnswers: 1,
                    successRate: {
                        $round: [
                            { $multiply: [{ $divide: ['$correctAnswers', '$totalAnswers'] }, 100] },
                            1,
                        ],
                    },
                },
            },
            { $sort: { successRate: 1 } },
            { $limit: limit },
            {
                $lookup: {
                    from:         'topics',
                    localField:   '_id',
                    foreignField: '_id',
                    as:           'topic',
                },
            },
            { $unwind: { path: '$topic', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id:          0,
                    topicId:      '$_id',
                    label:        { $ifNull: ['$topic.label', 'Desconocido'] },
                    moduleTag:    { $ifNull: ['$topic.moduleTag', ''] },
                    totalAnswers: 1,
                    successRate:  1,
                },
            },
        ]);

        return res.status(200).json({ ok: true, count: temas.length, topics: temas });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener temas difíciles.' });
    }
};

/**
 * GET /api/stats/tiempo-por-nivel
 * Tiempo promedio y score promedio por nivel de dificultad (global).
 */
const tiempoPorNivel = async (req, res) => {
    try {
        const stats = await Attempt.aggregate([
            { $match: { timeTakenSecs: { $gt: 0 }, totalGraded: { $gt: 0 } } },
            {
                $group: {
                    _id:           '$nivel',
                    avgTimeSecs:   { $avg: '$timeTakenSecs' },
                    avgScore:      { $avg: '$scorePercent' },
                    totalAttempts: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id:           0,
                    nivel:         '$_id',
                    avgTimeSecs:   { $round: ['$avgTimeSecs', 0] },
                    avgScore:      { $round: ['$avgScore', 1] },
                    totalAttempts: 1,
                },
            },
        ]);

        stats.sort((a, b) => NIVEL_ORDER.indexOf(a.nivel) - NIVEL_ORDER.indexOf(b.nivel));

        const resultado = stats.map(s => ({
            ...s,
            avgTimeFormatted: formatTime(s.avgTimeSecs),
        }));

        return res.status(200).json({ ok: true, stats: resultado });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al calcular tiempo por nivel.' });
    }
};

/**
 * GET /api/stats/racha
 * Top usuarios con mayor racha histórica (maxStreak).
 * Query: ?limit=10
 */
const rachaMasLarga = async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    try {
        const usuarios = await User.find({ active: true, maxStreak: { $gt: 0 } })
            .select('username avatar currentStreak maxStreak')
            .sort({ maxStreak: -1 })
            .limit(limit);

        const ranking = usuarios.map((u, i) => ({
            position:      i + 1,
            username:      u.username,
            avatar:        u.avatar,
            currentStreak: u.currentStreak,
            maxStreak:     u.maxStreak,
        }));

        return res.status(200).json({ ok: true, count: ranking.length, ranking });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener racha.' });
    }
};

/**
 * GET /api/stats/eficiencia
 * Top usuarios: mejor score con menor tiempo. Un intento por usuario.
 * Query: ?nivel=curioso&limit=10
 */
const eficiencia = async (req, res) => {
    const limit      = Math.min(parseInt(req.query.limit) || 10, 50);
    const { nivel }  = req.query;

    const matchQuery = { totalGraded: { $gt: 0 }, timeTakenSecs: { $gt: 0 } };
    if (nivel && NIVEL_ORDER.includes(nivel)) {
        matchQuery.nivel = nivel;
    }

    try {
        const ranking = await Attempt.aggregate([
            { $match: matchQuery },
            // Ordenar antes de agrupar: el $first tomará el mejor intento de cada usuario
            { $sort: { scorePercent: -1, timeTakenSecs: 1 } },
            {
                $group: {
                    _id:           '$userId',
                    scorePercent:  { $first: '$scorePercent' },
                    timeTakenSecs: { $first: '$timeTakenSecs' },
                    nivel:         { $first: '$nivel' },
                },
            },
            { $sort: { scorePercent: -1, timeTakenSecs: 1 } },
            { $limit: limit },
            {
                $lookup: {
                    from:         'users',
                    localField:   '_id',
                    foreignField: '_id',
                    as:           'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id:           0,
                    username:      '$user.username',
                    avatar:        '$user.avatar',
                    scorePercent:  1,
                    timeTakenSecs: 1,
                    nivel:         1,
                },
            },
        ]);

        const resultado = ranking.map((r, i) => ({
            position:           i + 1,
            ...r,
            timeTakenFormatted: formatTime(r.timeTakenSecs),
        }));

        return res.status(200).json({ ok: true, count: resultado.length, ranking: resultado });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al calcular eficiencia.' });
    }
};

module.exports = { temasMasDificiles, tiempoPorNivel, rachaMasLarga, eficiencia };
