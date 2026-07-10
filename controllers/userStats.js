const mongoose = require('mongoose');
const Attempt  = require('../models/attempt');
const User     = require('../models/user');
const { progresoNivel, rangoDeNivel } = require('../helpers/leveling');

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

            User.findById(userId, 'username avatar currentStreak maxStreak xp'),

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
            progreso: progresoNivel(user.xp || 0),
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

/**
 * GET /api/user-stats/nivel
 * Progreso de nivel del usuario: nivel, rango, XP y barra de progreso.
 * No expone el nivel máximo — en el tope, xpParaSubir llega como null.
 */
const nivelUsuario = async (req, res) => {
    try {
        const user = await User.findById(req.uid, 'xp');

        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        return res.status(200).json({
            ok:       true,
            progreso: progresoNivel(user.xp || 0),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener el nivel del usuario.' });
    }
};

// ─── Ranking semanal de XP ─────────────────────────────────────────────────────

// Lunes 00:00 UTC de la semana actual
const inicioSemanaUTC = () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    const diff = (d.getUTCDay() + 6) % 7; // lunes = 0, domingo = 6
    d.setUTCDate(d.getUTCDate() - diff);
    return d;
};

/**
 * GET /api/user-stats/ranking-semanal?limit=10
 * Ranking de XP ganada esta semana (lunes a domingo, UTC). Se reinicia cada lunes.
 *
 * Retorna:
 *   - top:     los mejores N de la semana (podio)
 *   - yo:      posición y XP del usuario autenticado (null si no ha jugado esta semana)
 *   - vecinos: los 2 usuarios arriba y 2 abajo del usuario (sus rivales directos)
 */
const rankingSemanal = async (req, res) => {
    const userId = req.uid;
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);

    try {
        const inicio = inicioSemanaUTC();
        const fin    = new Date(inicio);
        fin.setUTCDate(fin.getUTCDate() + 7);

        // XP semanal por usuario, ordenada de mayor a menor
        const filas = await Attempt.aggregate([
            { $match: { createdAt: { $gte: inicio }, xpGanada: { $gt: 0 } } },
            {
                $group: {
                    _id:      '$userId',
                    xpSemana: { $sum: '$xpGanada' },
                    quizzes:  { $sum: 1 },
                },
            },
            { $sort: { xpSemana: -1, quizzes: 1 } },
        ]);

        const miIndex = filas.findIndex(f => String(f._id) === userId);

        // Índices que necesitamos resolver a usuario: top N + ventana alrededor del usuario
        const indices = new Set();
        for (let i = 0; i < Math.min(limit, filas.length); i++) indices.add(i);
        if (miIndex >= 0) {
            const desde = Math.max(0, miIndex - 2);
            const hasta = Math.min(filas.length - 1, miIndex + 2);
            for (let i = desde; i <= hasta; i++) indices.add(i);
        }

        const ids      = [...indices].map(i => filas[i]._id);
        const usuarios = await User.find({ _id: { $in: ids }, active: true }, 'username avatar level');
        const porId    = new Map(usuarios.map(u => [String(u._id), u]));

        const filaRanking = (i) => {
            const f = filas[i];
            const u = porId.get(String(f._id));
            return {
                position:     i + 1,
                username:     u?.username || 'Usuario',
                avatar:       u?.avatar   || '',
                nivel:        u?.level    || 1,
                rango:        rangoDeNivel(u?.level || 1),
                xpSemana:     f.xpSemana,
                quizzes:      f.quizzes,
                esMiPosicion: String(f._id) === userId,
            };
        };

        const top = [];
        for (let i = 0; i < Math.min(limit, filas.length); i++) top.push(filaRanking(i));

        let yo      = null;
        let vecinos = [];

        if (miIndex >= 0) {
            yo = filaRanking(miIndex);

            const desde = Math.max(0, miIndex - 2);
            const hasta = Math.min(filas.length - 1, miIndex + 2);
            for (let i = desde; i <= hasta; i++) {
                if (i !== miIndex) vecinos.push(filaRanking(i));
            }
        }

        return res.status(200).json({
            ok:     true,
            semana: { inicio, fin },
            totalParticipantes: filas.length,
            top,
            yo,       // null si el usuario aún no ganó XP esta semana
            vecinos,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener el ranking semanal.' });
    }
};

module.exports = { dashboard, porTema, porNivel, evolucion, nivelUsuario, rankingSemanal };
