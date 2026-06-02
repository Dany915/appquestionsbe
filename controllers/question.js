const { response } = require('express');
const mongoose    = require('mongoose');
const Question    = require('../models/question');

// ─── Constantes ────────────────────────────────────────────────────────────────

// Límite de seguridad para la carga masiva (evita peticiones que saturen el servidor)
const MAX_BULK = 200;

// Valores permitidos para el campo "tipo" (niveles cognitivos de Bloom)
const TIPOS_VALIDOS = ['recall', 'comprension', 'aplicacion', 'analisis', 'evaluacion'];

// ─── Helper de validación ──────────────────────────────────────────────────────

/**
 * Valida y sanitiza todos los campos de una pregunta.
 * Se usa tanto al crear como al actualizar para no repetir la lógica.
 *
 * @param {object} body - Campos a validar (pueden ser parciales en updates si se pre-mezclan con los valores actuales)
 * @returns {{ ok: true, data: object } | { ok: false, msg: string }}
 */
const validarPregunta = (body) => {
    const { text, options, correctIndex, tags, difficulty, tipo, feedback, active } = body;

    // text: obligatorio, string no vacío
    if (typeof text !== 'string' || text.trim().length === 0) {
        return { ok: false, msg: 'El campo "text" es requerido y debe ser un texto no vacío.' };
    }

    // options: arreglo con al menos 2 strings no vacíos
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

    // correctIndex: entero dentro del rango de options
    if (!Number.isInteger(correctIndex)) {
        return { ok: false, msg: 'El campo "correctIndex" debe ser un número entero.' };
    }
    if (correctIndex < 0 || correctIndex >= cleanOptions.length) {
        return { ok: false, msg: `El campo "correctIndex" debe estar entre 0 y ${cleanOptions.length - 1}.` };
    }

    // difficulty: 1 (fácil) | 2 (medio) | 3 (difícil) — default 1
    const safeDifficulty = difficulty ?? 1;
    if (!Number.isInteger(safeDifficulty) || safeDifficulty < 1 || safeDifficulty > 3) {
        return { ok: false, msg: 'El campo "difficulty" debe ser 1 (fácil), 2 (medio) o 3 (difícil).' };
    }

    // tipo: nivel cognitivo — default 'recall'
    const safeTipo = tipo ?? 'recall';
    if (!TIPOS_VALIDOS.includes(safeTipo)) {
        return { ok: false, msg: `El campo "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` };
    }

    // active: booleano — default true
    const safeActive = active ?? true;
    if (typeof safeActive !== 'boolean') {
        return { ok: false, msg: 'El campo "active" debe ser true o false.' };
    }

    // feedback: texto libre opcional — default ''
    const safeFeedback = typeof feedback === 'string' ? feedback.trim() : '';

    // tags: arreglo de strings opcional — default []
    const safeTags = Array.isArray(tags)
        ? tags.filter(t => typeof t === 'string').map(t => t.trim()).filter(t => t.length > 0)
        : [];

    return {
        ok: true,
        data: {
            text: text.trim(),
            options: cleanOptions,
            correctIndex,
            difficulty: safeDifficulty,
            tipo: safeTipo,
            active: safeActive,
            feedback: safeFeedback,
            tags: safeTags,
        },
    };
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/question
 * Crea una sola pregunta.
 * Body: { text, options[], correctIndex, tags[], difficulty, tipo, feedback, active }
 */
const crearPregunta = async (req, res = response) => {
    const validacion = validarPregunta(req.body);
    if (!validacion.ok) {
        return res.status(400).json({ ok: false, msg: validacion.msg });
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
 * Crea múltiples preguntas en una sola petición.
 * Inserta las válidas y reporta cuáles fallaron sin cancelar toda la operación.
 * Body: { questions: [ { text, options[], correctIndex, ... }, ... ] }
 */
const crearPreguntasMasivo = async (req, res = response) => {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'El body debe incluir "questions" como un arreglo no vacío.',
        });
    }

    if (questions.length > MAX_BULK) {
        return res.status(413).json({
            ok: false,
            msg: `Máximo ${MAX_BULK} preguntas por petición. Enviaste ${questions.length}.`,
        });
    }

    // Validar cada pregunta por separado
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
        // ordered: false → intenta insertar todas las válidas aunque alguna falle en BD
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
 * Actualiza una pregunta existente (parcial o total).
 * Solo se reemplazan los campos que vengan en el body; los demás conservan su valor.
 * Se valida el estado final completo para garantizar consistencia
 * (ej: si cambian options, el correctIndex actual debe seguir siendo válido).
 */
const actualizarPregunta = async (req, res = response) => {
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

        // Mezclar: si el campo viene en el body se usa el nuevo valor, sino se conserva el actual
        const estadoFinal = {
            text:         body.text         ?? pregunta.text,
            options:      body.options      ?? pregunta.options,
            correctIndex: body.correctIndex ?? pregunta.correctIndex,
            tags:         body.tags         ?? pregunta.tags,
            difficulty:   body.difficulty   ?? pregunta.difficulty,
            tipo:         body.tipo         ?? pregunta.tipo,
            feedback:     body.feedback     ?? pregunta.feedback,
            active:       body.active       ?? pregunta.active,
        };

        // Validar el estado final completo antes de guardar
        const validacion = validarPregunta(estadoFinal);
        if (!validacion.ok) {
            return res.status(400).json({ ok: false, msg: validacion.msg });
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
 * Activa o desactiva una pregunta sin modificar ningún otro campo.
 * Body: { active: true | false }
 */
const cambiarEstado = async (req, res = response) => {
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
 *   tags        → "tag1,tag2"   filtra por tags (OR: devuelve si tiene al menos uno)
 *   difficulty  → 1 | 2 | 3    filtra por nivel de dificultad
 *   tipo        → "recall" etc  filtra por tipo cognitivo
 *   active      → true | false  filtra por estado (default: true — solo activas)
 */
const obtenerPreguntas = async (req, res = response) => {
    try {
        const { tags, difficulty, tipo, active } = req.query;

        const filtro = {};

        // Por defecto solo se muestran preguntas activas
        filtro.active = active === 'false' ? false : true;

        // Filtro por tags (OR)
        if (tags) {
            const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            if (tagsArray.length > 0) {
                filtro.tags = { $in: tagsArray };
            }
        }

        // Filtro por dificultad
        if (difficulty !== undefined) {
            const diff = parseInt(difficulty, 10);
            if (!Number.isInteger(diff) || diff < 1 || diff > 3) {
                return res.status(400).json({ ok: false, msg: 'El parámetro "difficulty" debe ser 1, 2 o 3.' });
            }
            filtro.difficulty = diff;
        }

        // Filtro por tipo cognitivo
        if (tipo !== undefined) {
            if (!TIPOS_VALIDOS.includes(tipo)) {
                return res.status(400).json({ ok: false, msg: `El parámetro "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` });
            }
            filtro.tipo = tipo;
        }

        const preguntas = await Question.find(filtro).sort({ createdAt: -1 });

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
