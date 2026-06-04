const mongoose = require('mongoose');
const Question  = require('../models/question');
const Topic     = require('../models/topic');

const MAX_BULK = 200;

const TIPOS_VALIDOS = ['literal', 'comprension', 'aplicacion', 'analisis', 'sintesis', 'mejor_respuesta'];

// ─── Helper de validación ──────────────────────────────────────────────────────

const validarPregunta = (body) => {
    const { text, options, correctIndex, topicTag, difficulty, tipo, feedback, active } = body;

    if (typeof text !== 'string' || text.trim().length === 0) {
        return { ok: false, msg: 'El campo "text" es requerido y debe ser un texto no vacío.' };
    }

    if (!Array.isArray(options)) {
        return { ok: false, msg: 'El campo "options" debe ser un arreglo.' };
    }
    const cleanOptions = options
        .filter(o => typeof o === 'string')
        .map(o => o.trim())
        .filter(o => o.length > 0);
    if (cleanOptions.length < 2) {
        return { ok: false, msg: 'El campo "options" debe tener al menos 2 opciones válidas.' };
    }

    if (!Number.isInteger(correctIndex)) {
        return { ok: false, msg: 'El campo "correctIndex" debe ser un número entero.' };
    }
    if (correctIndex < 0 || correctIndex >= cleanOptions.length) {
        return { ok: false, msg: `El campo "correctIndex" debe estar entre 0 y ${cleanOptions.length - 1}.` };
    }

    // topicTag: ObjectId del tema al que pertenece la pregunta
    if (!topicTag || !mongoose.Types.ObjectId.isValid(topicTag)) {
        return { ok: false, msg: 'El campo "topicTag" es requerido y debe ser un ID de tema válido.' };
    }

    const safeDifficulty = difficulty ?? 1;
    if (!Number.isInteger(safeDifficulty) || safeDifficulty < 1 || safeDifficulty > 4) {
        return { ok: false, msg: 'El campo "difficulty" debe ser 1 (fácil), 2 (medio), 3 (difícil) o 4 (avanzado).' };
    }

    const safeTipo = tipo ?? 'literal';
    if (!TIPOS_VALIDOS.includes(safeTipo)) {
        return { ok: false, msg: `El campo "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` };
    }

    const safeActive = active ?? true;
    if (typeof safeActive !== 'boolean') {
        return { ok: false, msg: 'El campo "active" debe ser true o false.' };
    }

    const safeFeedback = typeof feedback === 'string' ? feedback.trim() : '';

    return {
        ok: true,
        data: {
            text: text.trim(),
            options: cleanOptions,
            correctIndex,
            topicTag,
            difficulty: safeDifficulty,
            tipo: safeTipo,
            active: safeActive,
            feedback: safeFeedback,
        },
    };
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/question
 * Body: { text, options[], correctIndex, topicTag, difficulty?, tipo?, feedback?, active? }
 * topicTag → _id del documento Topic al que pertenece la pregunta
 */
const crearPregunta = async (req, res) => {
    const validacion = validarPregunta(req.body);
    if (!validacion.ok) {
        return res.status(400).json({ ok: false, msg: validacion.msg });
    }

    // Verificar que el tema existe
    const temaExiste = await Topic.exists({ _id: validacion.data.topicTag });
    if (!temaExiste) {
        return res.status(404).json({ ok: false, msg: 'El tema indicado en "topicTag" no existe.' });
    }

    try {
        const pregunta = new Question(validacion.data);
        await pregunta.save();

        return res.status(201).json({
            ok: true,
            msg: 'Pregunta creada correctamente.',
            question: pregunta,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al crear la pregunta.' });
    }
};

/**
 * POST /api/question/bulk
 * Crea hasta 200 preguntas en una sola petición.
 * Body: { questions: [ { text, options[], correctIndex, topicTag, ... }, ... ] }
 */
const crearPreguntasMasivo = async (req, res) => {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ ok: false, msg: 'El body debe incluir "questions" como un arreglo no vacío.' });
    }

    if (questions.length > MAX_BULK) {
        return res.status(413).json({
            ok: false,
            msg: `Máximo ${MAX_BULK} preguntas por petición. Enviaste ${questions.length}.`,
        });
    }

    const validDocs = [];
    const errors    = [];

    questions.forEach((q, index) => {
        const validacion = validarPregunta(q);
        if (!validacion.ok) {
            errors.push({ index, reason: validacion.msg });
        } else {
            validDocs.push(validacion.data);
        }
    });

    if (validDocs.length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Ninguna pregunta pasó las validaciones.',
            inserted: 0,
            failed: errors.length,
            errors,
        });
    }

    try {
        const inserted = await Question.insertMany(validDocs, { ordered: false });

        return res.status(201).json({
            ok: true,
            msg: 'Carga masiva procesada.',
            inserted: inserted.length,
            failed: errors.length,
            errors,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al procesar la carga masiva.' });
    }
};

/**
 * PUT /api/question/:id
 * Actualiza una pregunta. Solo reemplaza los campos enviados; los demás se conservan.
 */
const actualizarPregunta = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ ok: false, msg: 'El ID proporcionado no es válido.' });
    }

    try {
        const pregunta = await Question.findById(id);
        if (!pregunta) {
            return res.status(404).json({ ok: false, msg: 'Pregunta no encontrada.' });
        }

        const body = req.body || {};

        const estadoFinal = {
            text:         body.text         ?? pregunta.text,
            options:      body.options      ?? pregunta.options,
            correctIndex: body.correctIndex ?? pregunta.correctIndex,
            topicTag:     body.topicTag     ?? String(pregunta.topicTag),
            difficulty:   body.difficulty   ?? pregunta.difficulty,
            tipo:         body.tipo         ?? pregunta.tipo,
            feedback:     body.feedback     ?? pregunta.feedback,
            active:       body.active       ?? pregunta.active,
        };

        const validacion = validarPregunta(estadoFinal);
        if (!validacion.ok) {
            return res.status(400).json({ ok: false, msg: validacion.msg });
        }

        // Si el topicTag cambió, verificar que el nuevo tema existe
        if (body.topicTag && body.topicTag !== String(pregunta.topicTag)) {
            const temaExiste = await Topic.exists({ _id: body.topicTag });
            if (!temaExiste) {
                return res.status(404).json({ ok: false, msg: 'El tema indicado en "topicTag" no existe.' });
            }
        }

        pregunta.set(validacion.data);
        const actualizada = await pregunta.save();

        return res.status(200).json({
            ok: true,
            msg: 'Pregunta actualizada correctamente.',
            question: actualizada,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al actualizar la pregunta.' });
    }
};

/**
 * PATCH /api/question/:id/estado
 * Solo activa o desactiva una pregunta.
 * Body: { active: true | false }
 */
const cambiarEstado = async (req, res) => {
    const { id }     = req.params;
    const { active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ ok: false, msg: 'El ID proporcionado no es válido.' });
    }

    if (typeof active !== 'boolean') {
        return res.status(400).json({ ok: false, msg: 'El campo "active" debe ser true o false.' });
    }

    try {
        const pregunta = await Question.findByIdAndUpdate(id, { active }, { new: true });

        if (!pregunta) {
            return res.status(404).json({ ok: false, msg: 'Pregunta no encontrada.' });
        }

        return res.status(200).json({
            ok: true,
            msg: active ? 'Pregunta activada.' : 'Pregunta desactivada.',
            question: pregunta,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al cambiar el estado.' });
    }
};

/**
 * GET /api/question
 * Lista preguntas con filtros opcionales.
 * Query params:
 *   topicTag   → _id del tema (ObjectId) para filtrar por tema
 *   difficulty → 1 | 2 | 3 | 4
 *   tipo       → uno de los tipos cognitivos
 *   active     → "true" | "false" (default: true)
 */
const obtenerPreguntas = async (req, res) => {
    try {
        const { topicTag, difficulty, tipo, active } = req.query;

        const filtro = {};

        filtro.active = active === 'false' ? false : true;

        if (topicTag) {
            if (!mongoose.Types.ObjectId.isValid(topicTag)) {
                return res.status(400).json({ ok: false, msg: 'El parámetro "topicTag" debe ser un ID de tema válido.' });
            }
            filtro.topicTag = topicTag;
        }

        if (difficulty !== undefined) {
            const diff = parseInt(difficulty, 10);
            if (!Number.isInteger(diff) || diff < 1 || diff > 4) {
                return res.status(400).json({ ok: false, msg: 'El parámetro "difficulty" debe ser 1, 2, 3 o 4.' });
            }
            filtro.difficulty = diff;
        }

        if (tipo !== undefined) {
            if (!TIPOS_VALIDOS.includes(tipo)) {
                return res.status(400).json({ ok: false, msg: `El parámetro "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` });
            }
            filtro.tipo = tipo;
        }

        const preguntas = await Question.find(filtro)
            .populate('topicTag', 'topicTag label moduleTag')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            ok: true,
            count: preguntas.length,
            questions: preguntas,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener las preguntas.' });
    }
};

module.exports = {
    crearPregunta,
    crearPreguntasMasivo,
    actualizarPregunta,
    cambiarEstado,
    obtenerPreguntas,
};
