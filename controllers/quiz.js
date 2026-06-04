const mongoose = require('mongoose');
const Question  = require('../models/question');
const Attempt   = require('../models/attempt');
const Topic     = require('../models/topic');
const User      = require('../models/user');

const MAX_PREGUNTAS = 50;

// ─── Niveles de dificultad ─────────────────────────────────────────────────────

const NIVEL_TIPOS = {
    curioso:   ['literal', 'comprension'],
    analitico: ['aplicacion'],
    estratega: ['analisis', 'mejor_respuesta'],
    genio:     ['sintesis', 'mejor_respuesta'],
};

// Orden de fallback: si no hay suficientes en el nivel pedido, se busca en el siguiente
const NIVEL_ORDER = ['curioso', 'analitico', 'estratega', 'genio'];

// ─── Helper de fetch con fallback ──────────────────────────────────────────────

/**
 * Busca hasta `count` preguntas aleatorias empezando desde `nivelInicial`.
 * Si no hay suficientes en ese nivel, completa con el siguiente nivel, y así sucesivamente.
 * Retorna las preguntas mezcladas aleatoriamente y un mapa de distribución por nivel.
 */
const fetchPreguntasConFallback = async (topicIds, nivelInicial, count) => {
    const nivelIndex  = NIVEL_ORDER.indexOf(nivelInicial);
    const preguntas   = [];
    const usedIds     = new Set();
    const distribucion = {};
    let remaining     = count;

    for (let i = nivelIndex; i < NIVEL_ORDER.length && remaining > 0; i++) {
        const nivel = NIVEL_ORDER[i];
        const tipos = NIVEL_TIPOS[nivel];

        const matchQuery = {
            active:   true,
            topicTag: { $in: topicIds },
            tipo:     { $in: tipos },
        };

        // Excluir preguntas ya seleccionadas en iteraciones anteriores
        if (usedIds.size > 0) {
            matchQuery._id = { $nin: [...usedIds] };
        }

        const batch = await Question.aggregate([
            { $match: matchQuery },
            { $sample: { size: remaining } },
            {
                $project: {
                    text:       1,
                    options:    1,
                    topicTag:   1,
                    difficulty: 1,
                    tipo:       1,
                },
            },
        ]);

        if (batch.length > 0) {
            distribucion[nivel] = batch.length;
            batch.forEach(q => {
                preguntas.push(q);
                usedIds.add(String(q._id));
            });
            remaining -= batch.length;
        }
    }

    // Mezclar para que no lleguen primero todas las del nivel inicial y luego las de fallback
    for (let i = preguntas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [preguntas[i], preguntas[j]] = [preguntas[j], preguntas[i]];
    }

    return { preguntas, distribucion };
};

// ─── Helper de racha ───────────────────────────────────────────────────────────

/**
 * Actualiza currentStreak y maxStreak del usuario al guardar un intento.
 * Reglas:
 *   - Si ya hizo un intento hoy → racha no cambia (ya se contó)
 *   - Si el último intento fue ayer → se extiende la racha
 *   - Si pasó más de un día → se reinicia a 1
 */
const actualizarRacha = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return;

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setUTCDate(ayer.getUTCDate() - 1);

    let nuevaRacha = user.currentStreak;

    if (!user.lastAttemptDate) {
        nuevaRacha = 1;
    } else {
        const ultimoDia = new Date(user.lastAttemptDate);
        ultimoDia.setUTCHours(0, 0, 0, 0);

        if (ultimoDia.getTime() === hoy.getTime()) {
            return; // ya hizo un intento hoy, no actualizar
        } else if (ultimoDia.getTime() === ayer.getTime()) {
            nuevaRacha = user.currentStreak + 1;
        } else {
            nuevaRacha = 1; // rompió la racha
        }
    }

    await User.findByIdAndUpdate(userId, {
        currentStreak:   nuevaRacha,
        maxStreak:       Math.max(nuevaRacha, user.maxStreak),
        lastAttemptDate: new Date(),
    });
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/quiz
 * Genera un quiz con preguntas aleatorias. Requiere autenticación (validarJWT).
 *
 * Dos modos excluyentes:
 *   - Por temas:  ?topicTags=mod_1_ley_1105,mod_1_ley_1106  → uno o varios temas específicos
 *   - Por módulo: ?moduleTag=modulo_1                        → todos los temas activos del módulo
 *
 * Query params:
 *   topicTags → tags de temas separados por coma (ej: "mod_1_ley_1105,mod_1_ley_1106")
 *   moduleTag → tag del módulo completo (ej: "modulo_1")
 *   nivel     → dificultad: "curioso" | "analitico" | "estratega" | "genio" (default: curioso)
 *   count     → cantidad de preguntas (1-50, default 10)
 *
 * No se envía correctIndex ni feedback — se revelan solo al calificar.
 */
const generarQuiz = async (req, res) => {
    const { topicTags, moduleTag, nivel, count } = req.query;

    if (!topicTags && !moduleTag) {
        return res.status(400).json({
            ok: false,
            msg: 'Debes enviar "topicTags" (uno o varios temas) o "moduleTag" (módulo completo).',
        });
    }

    if (topicTags && moduleTag) {
        return res.status(400).json({
            ok: false,
            msg: 'Envía solo uno: "topicTags" o "moduleTag", no ambos a la vez.',
        });
    }

    // Validar nivel
    const nivelKey = (nivel ?? 'curioso').toLowerCase();
    if (!NIVEL_ORDER.includes(nivelKey)) {
        return res.status(400).json({
            ok: false,
            msg: `El parámetro "nivel" debe ser uno de: ${NIVEL_ORDER.join(', ')}.`,
        });
    }

    let n = 10;
    if (count !== undefined) {
        n = parseInt(count, 10);
        if (Number.isNaN(n) || n < 1 || n > MAX_PREGUNTAS) {
            return res.status(400).json({
                ok: false,
                msg: `El parámetro "count" debe ser un número entre 1 y ${MAX_PREGUNTAS}.`,
            });
        }
    }

    try {
        let topicIds = [];

        if (topicTags) {
            // Separar por coma y limpiar espacios — soporta uno o varios temas
            const tags = topicTags.split(',').map(t => t.trim()).filter(Boolean);

            if (tags.length === 0) {
                return res.status(400).json({ ok: false, msg: 'El parámetro "topicTags" no puede estar vacío.' });
            }

            const temas = await Topic.find(
                { topicTag: { $in: tags }, active: true },
                '_id topicTag'
            );

            if (temas.length === 0) {
                return res.status(404).json({
                    ok: false,
                    msg: 'No se encontraron temas activos para los topicTags enviados.',
                });
            }

            // Avisar si algún tag no fue encontrado (sin bloquear la petición)
            const encontrados = temas.map(t => t.topicTag);
            const noEncontrados = tags.filter(t => !encontrados.includes(t));

            topicIds = temas.map(t => t._id);

            // Se incluye en la respuesta pero no bloquea el quiz
            req._topicTagsNoEncontrados = noEncontrados;

        } else {
            // Buscar todos los temas activos del módulo para obtener sus _ids
            const temas = await Topic.find(
                { moduleTag: moduleTag.trim(), active: true },
                '_id'
            );

            if (temas.length === 0) {
                return res.status(404).json({
                    ok: false,
                    msg: `No se encontraron temas activos para el módulo "${moduleTag}".`,
                });
            }

            topicIds = temas.map(t => t._id);
        }

        // Buscar preguntas con fallback por nivel
        const { preguntas, distribucion } = await fetchPreguntasConFallback(topicIds, nivelKey, n);

        if (preguntas.length === 0) {
            return res.status(404).json({
                ok: false,
                msg: 'No se encontraron preguntas activas para los parámetros enviados.',
            });
        }

        const usedFallback = Object.keys(distribucion).some(k => k !== nivelKey);

        const respuesta = {
            ok:           true,
            nivel:        nivelKey,
            requested:    n,
            returned:     preguntas.length,
            distribucion,                         // ej: { curioso: 8, analitico: 12 }
            fallback:     usedFallback,           // true si se completó con otro nivel
            questions:    preguntas,
        };

        if (req._topicTagsNoEncontrados?.length > 0) {
            respuesta.warning = `Estos topicTags no se encontraron o están desactivados: ${req._topicTagsNoEncontrados.join(', ')}`;
        }

        return res.status(200).json(respuesta);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al generar el quiz.' });
    }
};

/**
 * POST /api/quiz/calificar
 * Califica las respuestas de un quiz y guarda el intento. Requiere autenticación (validarJWT).
 * El userId se toma del token JWT (req.uid), no del body.
 *
 * Body: {
 *   answers:       [ { questionId, selectedIndex }, ... ],
 *   nivel:         "curioso" | "analitico" | "estratega" | "genio"
 *   topicTags:     [ "mod_1_ley_1105", ... ],   (topicTag strings usados al generar el quiz)
 *   moduleTag:     "modulo_1",
 *   timeTakenSecs: 240,                          (segundos que tardó el usuario)
 * }
 */
const calificarQuiz = async (req, res) => {
    const { answers, nivel, topicTags, moduleTag, timeTakenSecs } = req.body;
    const userId = req.uid;

    if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Debes enviar "answers" como un arreglo con al menos 1 respuesta.',
        });
    }

    const idsVistos              = new Set();
    const respuestasNormalizadas = [];

    for (let i = 0; i < answers.length; i++) {
        const a = answers[i];

        const questionId = a?.questionId;
        if (typeof questionId !== 'string' || !mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({
                ok:  false,
                msg: `La respuesta [${i}] tiene un "questionId" inválido.`,
            });
        }

        const selectedIndex = a?.selectedIndex;
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
            return res.status(400).json({
                ok:  false,
                msg: `La respuesta [${i}] tiene un "selectedIndex" inválido (debe ser un entero >= 0).`,
            });
        }

        if (idsVistos.has(questionId)) {
            return res.status(400).json({
                ok:  false,
                msg: `La pregunta "${questionId}" está duplicada en las respuestas.`,
            });
        }

        idsVistos.add(questionId);
        respuestasNormalizadas.push({ questionId, selectedIndex });
    }

    try {
        const ids       = respuestasNormalizadas.map(a => a.questionId);
        const preguntas = await Question.find(
            { _id: { $in: ids } },
            'text options correctIndex active feedback topicTag difficulty'
        );

        if (preguntas.length !== ids.length) {
            const idsEncontrados = new Set(preguntas.map(q => String(q._id)));
            const faltantes      = ids.filter(id => !idsEncontrados.has(id));
            return res.status(400).json({
                ok:      false,
                msg:     'Algunas preguntas no existen en la base de datos.',
                missing: faltantes,
            });
        }

        const preguntasPorId = new Map(preguntas.map(q => [String(q._id), q]));

        let totalCorrectas   = 0;
        let totalCalificadas = 0;

        const resultados   = [];
        const respuestasBD = [];

        for (const a of respuestasNormalizadas) {
            const q = preguntasPorId.get(a.questionId);

            if (!q.active) {
                resultados.push({
                    questionId: a.questionId,
                    isCorrect:  false,
                    calificada: false,
                    msg:        'Esta pregunta fue desactivada y no se califica.',
                });
                continue;
            }

            if (a.selectedIndex >= q.options.length) {
                resultados.push({
                    questionId: a.questionId,
                    isCorrect:  false,
                    calificada: false,
                    msg:        `El índice seleccionado (${a.selectedIndex}) está fuera del rango. La pregunta tiene ${q.options.length} opciones.`,
                });
                continue;
            }

            const isCorrect = a.selectedIndex === q.correctIndex;
            if (isCorrect) totalCorrectas++;
            totalCalificadas++;

            resultados.push({
                questionId:    a.questionId,
                text:          q.text,
                selectedIndex: a.selectedIndex,
                correctIndex:  q.correctIndex,
                isCorrect,
                feedback:      q.feedback || '',
                calificada:    true,
            });

            respuestasBD.push({
                questionId:    q._id,
                selectedIndex: a.selectedIndex,
                correctIndex:  q.correctIndex,
                isCorrect,
                topicTag:      q.topicTag,
                difficulty:    q.difficulty,
            });
        }

        const scorePercent = totalCalificadas === 0
            ? 0
            : Math.round((totalCorrectas / totalCalificadas) * 100);

        let difficultySum = 0;
        let difficultyAvg = 0;

        if (totalCalificadas > 0) {
            difficultySum = respuestasBD.reduce((acc, r) => acc + r.difficulty, 0);
            difficultyAvg = difficultySum / totalCalificadas;
        }

        const nivelValido = NIVEL_ORDER.includes(nivel) ? nivel : 'curioso';
        const tiempoSecs  = Number.isInteger(timeTakenSecs) && timeTakenSecs >= 0 ? timeTakenSecs : 0;
        const mins        = Math.floor(tiempoSecs / 60);
        const segs        = tiempoSecs % 60;
        const tiempoFormateado = `${mins}:${String(segs).padStart(2, '0')}`;

        await Attempt.create({
            userId,
            nivel:         nivelValido,
            moduleTag:     typeof moduleTag === 'string' ? moduleTag.trim() : '',
            topicTags:     Array.isArray(topicTags)
                               ? topicTags.map(t => String(t).trim()).filter(Boolean)
                               : [],
            timeTakenSecs: tiempoSecs,
            totalAnswered: respuestasNormalizadas.length,
            totalGraded:   totalCalificadas,
            correct:       totalCorrectas,
            scorePercent,
            difficultySum,
            difficultyAvg: Number(difficultyAvg.toFixed(2)),
            answers:       respuestasBD,
        });

        // Actualizar racha del usuario (no bloqueante — fallo silencioso)
        actualizarRacha(userId).catch(err => console.error('Error actualizando racha:', err));

        return res.status(200).json({
            ok:                 true,
            nivel:              nivelValido,
            totalAnswered:      respuestasNormalizadas.length,
            totalGraded:        totalCalificadas,
            correct:            totalCorrectas,
            scorePercent,
            timeTakenSecs:      tiempoSecs,
            timeTakenFormatted: tiempoFormateado,
            difficultyAvg:      Number(difficultyAvg.toFixed(2)),
            results:            resultados,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al calificar el quiz.' });
    }
};

module.exports = { generarQuiz, calificarQuiz };
