const { response } = require('express');
const mongoose    = require('mongoose');
const Question    = require('../models/question');
const Attempt     = require('../models/attempt');
const Topic       = require('../models/topic');

// ─── Constantes ────────────────────────────────────────────────────────────────

// Límite máximo de preguntas por quiz (protege el servidor)
const MAX_PREGUNTAS = 50;

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/quiz
 * Genera un quiz con preguntas aleatorias. Requiere autenticación (validarJWT).
 *
 * Dos modos excluyentes:
 *   - Por tema:   ?topicTag=mod_1_ley_1105   → preguntas de ese tema específico
 *   - Por módulo: ?moduleTag=modulo_1         → preguntas de todos los temas activos del módulo
 *
 * Query params:
 *   topicTag  → tag de un tema específico
 *   moduleTag → tag de un módulo completo
 *   count     → cantidad de preguntas (1-50, default 10)
 *
 * IMPORTANTE: no se envía correctIndex ni feedback — se revelan solo al calificar.
 */
const generarQuiz = async (req, res = response) => {
    const { topicTag, moduleTag, count } = req.query;

    // Debe venir uno de los dos modos, no ambos ni ninguno
    if (!topicTag && !moduleTag) {
        return res.status(400).json({
            ok: false,
            msg: 'Debes enviar "topicTag" (para un tema) o "moduleTag" (para un módulo completo).',
        });
    }

    if (topicTag && moduleTag) {
        return res.status(400).json({
            ok: false,
            msg: 'Envía solo uno: "topicTag" o "moduleTag", no ambos a la vez.',
        });
    }

    // Validar y parsear count
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
        let tagsParaBuscar = [];

        if (topicTag) {
            // Modo tema: usar el topicTag directamente como filtro
            tagsParaBuscar = [topicTag.trim()];

        } else {
            // Modo módulo: obtener todos los topicTags activos de ese módulo
            const temas = await Topic.find(
                { moduleTag: moduleTag.trim(), active: true },
                'topicTag'
            );

            if (temas.length === 0) {
                return res.status(404).json({
                    ok: false,
                    msg: `No se encontraron temas activos para el módulo "${moduleTag}".`,
                });
            }

            tagsParaBuscar = temas.map(t => t.topicTag);
        }

        // Buscar preguntas activas que contengan alguno de los tags, de forma aleatoria
        const preguntas = await Question.aggregate([
            {
                $match: {
                    active: true,
                    tags:   { $in: tagsParaBuscar },
                },
            },
            { $sample: { size: n } },
            {
                // Solo se envían los campos necesarios para mostrar la pregunta
                // correctIndex y feedback se omiten intencionalmente
                $project: {
                    text:       1,
                    options:    1,
                    tags:       1,
                    difficulty: 1,
                    tipo:       1,
                },
            },
        ]);

        if (preguntas.length === 0) {
            return res.status(404).json({
                ok: false,
                msg: 'No se encontraron preguntas activas para los parámetros enviados.',
            });
        }

        return res.status(200).json({
            ok:        true,
            requested: n,
            returned:  preguntas.length,
            questions: preguntas,
        });

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
 *   answers:   [ { questionId, selectedIndex }, ... ],
 *   topicTags: [ "mod_1_ley_1105", ... ],   (tags que se usaron para generar el quiz)
 *   moduleTag: "modulo_1",                  (módulo del quiz, si aplica)
 * }
 */
const calificarQuiz = async (req, res = response) => {
    const { answers, topicTags, moduleTag } = req.body;

    // userId viene del middleware validarJWT, no del body
    const userId = req.uid;

    // Validar que answers sea un arreglo no vacío
    if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Debes enviar "answers" como un arreglo con al menos 1 respuesta.',
        });
    }

    // Validar y normalizar cada respuesta individualmente
    const idsVistos              = new Set();
    const respuestasNormalizadas = [];

    for (let i = 0; i < answers.length; i++) {
        const a = answers[i];

        // questionId debe ser un ObjectId válido de MongoDB
        const questionId = a?.questionId;
        if (typeof questionId !== 'string' || !mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({
                ok:  false,
                msg: `La respuesta [${i}] tiene un "questionId" inválido.`,
            });
        }

        // selectedIndex debe ser un entero no negativo
        const selectedIndex = a?.selectedIndex;
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
            return res.status(400).json({
                ok:  false,
                msg: `La respuesta [${i}] tiene un "selectedIndex" inválido (debe ser un entero >= 0).`,
            });
        }

        // No se permite responder la misma pregunta dos veces
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
        // Obtener todas las preguntas en una sola consulta (más eficiente que N consultas)
        const ids       = respuestasNormalizadas.map(a => a.questionId);
        const preguntas = await Question.find(
            { _id: { $in: ids } },
            'text options correctIndex active feedback tags difficulty'
        );

        // Verificar que todas las preguntas existan en BD
        if (preguntas.length !== ids.length) {
            const idsEncontrados = new Set(preguntas.map(q => String(q._id)));
            const faltantes      = ids.filter(id => !idsEncontrados.has(id));
            return res.status(400).json({
                ok:      false,
                msg:     'Algunas preguntas no existen en la base de datos.',
                missing: faltantes,
            });
        }

        // Mapa para acceso rápido por ID sin tener que iterar el arreglo cada vez
        const preguntasPorId = new Map(preguntas.map(q => [String(q._id), q]));

        // ─── Calificación ──────────────────────────────────────────────────────

        let totalCorrectas  = 0;
        let totalCalificadas = 0;

        const resultados   = []; // lo que se devuelve al cliente (con feedback)
        const respuestasBD = []; // lo que se guarda en la BD

        for (const a of respuestasNormalizadas) {
            const q = preguntasPorId.get(a.questionId);

            // Caso: pregunta desactivada después de que se generó el quiz
            if (!q.active) {
                resultados.push({
                    questionId: a.questionId,
                    isCorrect:  false,
                    calificada: false,
                    msg:        'Esta pregunta fue desactivada y no se califica.',
                });
                continue; // no se cuenta en totalCalificadas
            }

            // Caso: el índice seleccionado está fuera del rango de opciones
            if (a.selectedIndex >= q.options.length) {
                resultados.push({
                    questionId: a.questionId,
                    isCorrect:  false,
                    calificada: false,
                    msg:        `El índice seleccionado (${a.selectedIndex}) está fuera del rango. La pregunta tiene ${q.options.length} opciones.`,
                });
                continue; // no se cuenta en totalCalificadas
            }

            // Calificación normal
            const isCorrect = a.selectedIndex === q.correctIndex;
            if (isCorrect) totalCorrectas++;
            totalCalificadas++;

            // Resultado para el cliente: incluye feedback y cuál era la respuesta correcta
            resultados.push({
                questionId:    a.questionId,
                text:          q.text,
                selectedIndex: a.selectedIndex,
                correctIndex:  q.correctIndex,
                isCorrect,
                feedback:      q.feedback || '',
                calificada:    true,
            });

            // Datos para guardar en BD
            respuestasBD.push({
                questionId:    q._id,
                selectedIndex: a.selectedIndex,
                correctIndex:  q.correctIndex,
                isCorrect,
                tags:          q.tags,
                difficulty:    q.difficulty,
            });
        }

        // ─── Estadísticas del intento ──────────────────────────────────────────

        // Porcentaje de aciertos sobre las preguntas calificadas
        const scorePercent = totalCalificadas === 0
            ? 0
            : Math.round((totalCorrectas / totalCalificadas) * 100);

        // Dificultad promedio del quiz (basada en las preguntas calificadas)
        let difficultySum   = 0;
        let difficultyAvg   = 0;
        let difficultyLabel = '';

        if (totalCalificadas > 0) {
            difficultySum  = respuestasBD.reduce((acc, r) => acc + r.difficulty, 0);
            difficultyAvg  = difficultySum / totalCalificadas;
            difficultyLabel = difficultyAvg < 1.5 ? 'Fácil' : difficultyAvg < 2.3 ? 'Media' : 'Difícil';
        }

        // ─── Guardar intento en BD ─────────────────────────────────────────────

        await Attempt.create({
            userId,
            moduleTag:     typeof moduleTag === 'string' ? moduleTag.trim() : '',
            topicTags:     Array.isArray(topicTags)
                               ? topicTags.map(t => String(t).trim()).filter(Boolean)
                               : [],
            totalAnswered: respuestasNormalizadas.length,
            totalGraded:   totalCalificadas,
            correct:       totalCorrectas,
            scorePercent,
            difficultySum,
            difficultyAvg: Number(difficultyAvg.toFixed(2)),
            difficultyLabel,
            answers:       respuestasBD,
        });

        // ─── Respuesta al cliente ──────────────────────────────────────────────

        return res.status(200).json({
            ok:            true,
            totalAnswered: respuestasNormalizadas.length,
            totalGraded:   totalCalificadas,
            correct:       totalCorrectas,
            scorePercent,
            difficulty: {
                avg:   Number(difficultyAvg.toFixed(2)),
                label: difficultyLabel,
            },
            results: resultados,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al calificar el quiz.' });
    }
};

module.exports = { generarQuiz, calificarQuiz };
