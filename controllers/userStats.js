const mongoose = require('mongoose');
const Attempt  = require('../models/attempt');
const User     = require('../models/user');

const NIVEL_ORDER = ['curioso', 'analitico', 'estratega', 'genio'];

const formatTime = (totalSecs) => {
    if (totalSecs >= 3600) {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        return `${h}h ${m}m`;
    }
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/dashboard
 * Resumen general del usuario: totales, racha y nivel favorito.
 */
const dashboard = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.uid);

    try {
        const [user, resumen, nivelFavorito] = await Promise.all([

            User.findById(userId, 'username avatar currentStreak maxStreak'),

            Attempt.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id:            null,
                        totalIntentos:  { $sum: 1 },
                        totalPreguntas: { $sum: '$totalAnswered' },
                        tiempoTotal:    { $sum: '$timeTakenSecs' },
                        avgScore:       { $avg: '$scorePercent' },
                        bestScore:      { $max: '$scorePercent' },
                    },
                },
            ]),

            // El nivel en el que más quizzes ha hecho
            Attempt.aggregate([
                { $match: { userId } },
                { $group: { _id: '$nivel', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 },
            ]),

        ]);

        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        const s = resumen[0] || {};

        return res.status(200).json({
            ok:   true,
            user: {
                username:      user.username,
                avatar:        user.avatar,
                currentStreak: user.currentStreak,
                maxStreak:     user.maxStreak,
            },
            stats: {
                totalIntentos:        s.totalIntentos  || 0,
                totalPreguntas:       s.totalPreguntas || 0,
                tiempoTotal:          s.tiempoTotal    || 0,
                tiempoTotalFormateado: formatTime(s.tiempoTotal || 0),
                avgScore:             s.avgScore ? Math.round(s.avgScore * 10) / 10 : 0,
                bestScore:            s.bestScore || 0,
                nivelFavorito:        nivelFavorito[0]?._id || null,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener el dashboard.' });
    }
};

/**
 * GET /api/user-stats/por-tema
 * Rendimiento del usuario en cada tema: % de acierto, total respondidas.
 * Ordenado de peor a mejor para que el usuario vea dónde enfocarse.
 */
const porTema = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.uid);

    try {
        const temas = await Attempt.aggregate([
            { $match: { userId } },
            { $unwind: '$answers' },
            { $match: { 'answers.topicTag': { $exists: true, $ne: null } } },
            {
                $group: {
                    _id:            '$answers.topicTag',
                    totalAnswers:   { $sum: 1 },
                    correctAnswers: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
                },
            },
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
            { $sort: { successRate: 1 } }, // peor primero
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
                    _id:            0,
                    topicId:        '$_id',
                    label:          { $ifNull: ['$topic.label', 'Desconocido'] },
                    moduleTag:      { $ifNull: ['$topic.moduleTag', ''] },
                    moduleTagLabel: { $ifNull: ['$topic.moduleTagLabel', ''] },
                    totalAnswers:   1,
                    correctAnswers: 1,
                    successRate:    1,
                },
            },
        ]);

        return res.status(200).json({ ok: true, count: temas.length, topics: temas });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener rendimiento por tema.' });
    }
};

/**
 * GET /api/user-stats/por-nivel
 * Rendimiento del usuario en cada nivel: intentos, score promedio, mejor score, tiempo promedio.
 */
const porNivel = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.uid);

    try {
        const stats = await Attempt.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id:           '$nivel',
                    totalIntentos: { $sum: 1 },
                    avgScore:      { $avg: '$scorePercent' },
                    bestScore:     { $max: '$scorePercent' },
                    avgTimeSecs:   { $avg: '$timeTakenSecs' },
                },
            },
            {
                $project: {
                    _id:           0,
                    nivel:         '$_id',
                    totalIntentos: 1,
                    avgScore:      { $round: ['$avgScore', 1] },
                    bestScore:     1,
                    avgTimeSecs:   { $round: ['$avgTimeSecs', 0] },
                },
            },
        ]);

        // Rellenar niveles sin intentos y ordenar
        const mapa = Object.fromEntries(stats.map(s => [s.nivel, s]));

        const resultado = NIVEL_ORDER.map(nivel => ({
            nivel,
            totalIntentos: mapa[nivel]?.totalIntentos || 0,
            avgScore:      mapa[nivel]?.avgScore      || 0,
            bestScore:     mapa[nivel]?.bestScore     || 0,
            avgTimeSecs:   mapa[nivel]?.avgTimeSecs   || 0,
            avgTimeFormatted: formatTime(mapa[nivel]?.avgTimeSecs || 0),
        }));

        return res.status(200).json({ ok: true, stats: resultado });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener rendimiento por nivel.' });
    }
};

/**
 * GET /api/user-stats/evolucion?limit=20
 * Últimos N intentos del usuario para mostrar tendencia de mejora.
 * Retorna fecha, score, nivel y tiempo — suficiente para dibujar una gráfica en Flutter.
 */
const evolucion = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.uid);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 50);

    try {
        const intentos = await Attempt.find({ userId })
            .select('scorePercent nivel timeTakenSecs totalGraded correct createdAt')
            .sort({ createdAt: -1 })
            .limit(limit);

        // Invertir para que Flutter los reciba en orden cronológico (más antiguo primero)
        const resultado = intentos.reverse().map(a => ({
            date:               a.createdAt,
            scorePercent:       a.scorePercent,
            nivel:              a.nivel,
            timeTakenSecs:      a.timeTakenSecs,
            timeTakenFormatted: formatTime(a.timeTakenSecs),
            correct:            a.correct,
            totalGraded:        a.totalGraded,
        }));

        return res.status(200).json({ ok: true, count: resultado.length, attempts: resultado });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener la evolución.' });
    }
};

module.exports = { dashboard, porTema, porNivel, evolucion };
