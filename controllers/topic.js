const { response } = require('express');
const mongoose    = require('mongoose');
const Topic       = require('../models/topic');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Valida que un tag solo tenga letras, números, guiones y guiones bajos.
 * Ej válido: "modulo_1", "mod_1_ley_1105"
 * Ej inválido: "modulo 1", "mod/1"
 */
const esTagValido = (valor) => {
    if (typeof valor !== 'string' || valor.trim().length === 0) return false;
    return /^[a-zA-Z0-9_-]+$/.test(valor.trim());
};

/**
 * Convierte strings "true"/"false" a booleano.
 * Necesario porque los query params siempre llegan como string.
 * Retorna null si el valor no es reconocible.
 */
const parsearBooleano = (valor) => {
    if (valor === undefined)          return null;
    if (typeof valor === 'boolean')   return valor;
    if (typeof valor !== 'string')    return null;
    const v = valor.trim().toLowerCase();
    if (v === 'true')  return true;
    if (v === 'false') return false;
    return null;
};

/**
 * Genera automáticamente el label del módulo a partir del moduleTag.
 * "modulo_1" → "Módulo 1"
 * Cualquier otro formato → primera letra en mayúscula
 */
const generarLabelModulo = (moduleTag) => {
    const m     = String(moduleTag || '').trim();
    const match = m.match(/^modulo_(\d+)$/i);
    if (match) return `Módulo ${match[1]}`;
    return m.charAt(0).toUpperCase() + m.slice(1);
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/topic
 * Crea un nuevo tema dentro de un módulo.
 *
 * Body: {
 *   moduleTag,       → tag del módulo al que pertenece, ej: "modulo_1"
 *   topicTag,        → tag único del tema, ej: "mod_1_ley_1105"
 *   label,           → texto visible para el usuario, ej: "Ley 1105"
 *   moduleTagLabel,  → (opcional) label del módulo, ej: "Módulo 1" — se auto-genera si no se envía
 *   active,          → (opcional) boolean, default true
 * }
 *
 * Regla de negocio: el topicTag debe iniciar con "mod_{N}_" donde N es el número del módulo.
 * Ej: si moduleTag = "modulo_1", el topicTag debe iniciar con "mod_1_"
 */
const crearTema = async (req, res = response) => {
    const { moduleTag, moduleTagLabel, topicTag, label, active } = req.body || {};

    // Validar moduleTag
    if (!esTagValido(moduleTag)) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "moduleTag" es requerido y solo puede contener letras, números, _ y -. Ej: "modulo_1".',
        });
    }

    // Validar topicTag
    if (!esTagValido(topicTag)) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "topicTag" es requerido y solo puede contener letras, números, _ y -. Ej: "mod_1_ley_1105".',
        });
    }

    // Validar que topicTag corresponda al módulo (convención de nombres)
    const numeroModulo   = moduleTag.replace('modulo_', '');
    const prefijoEsperado = `mod_${numeroModulo}_`;
    if (!topicTag.startsWith(prefijoEsperado)) {
        return res.status(400).json({
            ok: false,
            msg: `El "topicTag" debe iniciar con "${prefijoEsperado}" para pertenecer al módulo "${moduleTag}".`,
        });
    }

    // Validar label
    if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "label" es requerido (texto visible para el usuario, ej: "Ley 1105").',
        });
    }

    // Validar active (opcional)
    const safeActive = active ?? true;
    if (typeof safeActive !== 'boolean') {
        return res.status(400).json({ ok: false, msg: 'El campo "active" debe ser true o false.' });
    }

    // Si no viene moduleTagLabel se genera automáticamente
    const safeModuleTagLabel = (typeof moduleTagLabel === 'string' && moduleTagLabel.trim().length > 0)
        ? moduleTagLabel.trim()
        : generarLabelModulo(moduleTag);

    try {
        const nuevoTema = new Topic({
            moduleTag:      moduleTag.trim(),
            moduleTagLabel: safeModuleTagLabel,
            topicTag:       topicTag.trim(),
            label:          label.trim(),
            active:         safeActive,
        });

        const guardado = await nuevoTema.save();

        return res.status(201).json({
            ok: true,
            msg: 'Tema registrado correctamente.',
            topic: guardado,
        });
    } catch (error) {
        // Error 11000 = clave duplicada en MongoDB (topicTag ya existe)
        if (error?.code === 11000) {
            return res.status(409).json({ ok: false, msg: 'Ya existe un tema con ese topicTag.' });
        }
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al registrar el tema.' });
    }
};

/**
 * GET /api/topic
 * Devuelve los temas de un módulo específico.
 *
 * Query params:
 *   moduleTag  → (requerido) tag del módulo, ej: "modulo_1"
 *   active     → (opcional) "true" | "false" — filtra por estado (default: todos)
 */
const obtenerTemasPorModulo = async (req, res = response) => {
    const { moduleTag, active } = req.query;

    if (typeof moduleTag !== 'string' || moduleTag.trim().length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'El parámetro "moduleTag" es requerido. Ej: /api/topic?moduleTag=modulo_1',
        });
    }

    const activeBool = parsearBooleano(active);
    if (active !== undefined && activeBool === null) {
        return res.status(400).json({ ok: false, msg: 'El parámetro "active" debe ser "true" o "false".' });
    }

    try {
        const filtro = { moduleTag: moduleTag.trim() };
        if (activeBool !== null) filtro.active = activeBool;

        const temas = await Topic
            .find(filtro)
            .select('moduleTag moduleTagLabel topicTag label active')
            .sort({ label: 1 });

        return res.status(200).json({
            ok: true,
            moduleTag: moduleTag.trim(),
            count: temas.length,
            topics: temas,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener los temas.' });
    }
};

/**
 * GET /api/topic/modulos
 * Devuelve la lista de módulos disponibles (sin repetidos).
 * Agrupa los temas por moduleTag y devuelve uno por módulo.
 *
 * Query params:
 *   active → (opcional) "true" | "false" — filtra módulos que tengan temas en ese estado
 */
const obtenerModulos = async (req, res = response) => {
    const { active } = req.query;

    const activeBool = parsearBooleano(active);
    if (active !== undefined && activeBool === null) {
        return res.status(400).json({ ok: false, msg: 'El parámetro "active" debe ser "true" o "false".' });
    }

    try {
        const pipeline = [];

        // Filtrar por active si se envió
        if (activeBool !== null) {
            pipeline.push({ $match: { active: activeBool } });
        }

        // Agrupar por moduleTag y tomar el primer moduleTagLabel encontrado
        pipeline.push(
            {
                $group: {
                    _id:            '$moduleTag',
                    moduleTagLabel: { $first: '$moduleTagLabel' },
                },
            },
            {
                $project: {
                    _id:            0,
                    moduleTag:      '$_id',
                    moduleTagLabel: 1,
                },
            }
        );

        const modulos = await Topic.aggregate(pipeline);

        // Ordenar por número de módulo (modulo_1 antes que modulo_2, etc.)
        modulos.sort((a, b) => {
            const na = parseInt(String(a.moduleTag).split('_')[1] || '0', 10);
            const nb = parseInt(String(b.moduleTag).split('_')[1] || '0', 10);
            return na - nb;
        });

        return res.status(200).json({
            ok: true,
            count: modulos.length,
            modules: modulos,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener los módulos.' });
    }
};

/**
 * PUT /api/topic/:id
 * Actualiza los campos editables de un tema: label y/o moduleTagLabel.
 * El topicTag y moduleTag no se pueden cambiar (son identificadores).
 * Body: { label, moduleTagLabel }
 */
const actualizarTema = async (req, res = response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ ok: false, msg: 'El ID proporcionado no es válido.' });
    }

    const { label, moduleTagLabel } = req.body || {};

    // Al menos uno de los dos campos debe venir
    if (label === undefined && moduleTagLabel === undefined) {
        return res.status(400).json({
            ok: false,
            msg: 'Debes enviar al menos uno de estos campos: "label", "moduleTagLabel".',
        });
    }

    if (label !== undefined && (typeof label !== 'string' || label.trim().length === 0)) {
        return res.status(400).json({ ok: false, msg: 'El campo "label" debe ser un texto no vacío.' });
    }

    if (moduleTagLabel !== undefined && (typeof moduleTagLabel !== 'string' || moduleTagLabel.trim().length === 0)) {
        return res.status(400).json({ ok: false, msg: 'El campo "moduleTagLabel" debe ser un texto no vacío.' });
    }

    try {
        const tema = await Topic.findById(id);
        if (!tema) {
            return res.status(404).json({ ok: false, msg: 'Tema no encontrado.' });
        }

        if (label !== undefined)           tema.label          = label.trim();
        if (moduleTagLabel !== undefined)  tema.moduleTagLabel = moduleTagLabel.trim();

        const actualizado = await tema.save();

        return res.status(200).json({
            ok: true,
            msg: 'Tema actualizado correctamente.',
            topic: actualizado,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al actualizar el tema.' });
    }
};

/**
 * PATCH /api/topic/:id/estado
 * Activa o desactiva un tema sin modificar ningún otro campo.
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
        const tema = await Topic.findByIdAndUpdate(id, { active }, { new: true });

        if (!tema) {
            return res.status(404).json({ ok: false, msg: 'Tema no encontrado.' });
        }

        return res.status(200).json({
            ok: true,
            msg: active ? 'Tema activado.' : 'Tema desactivado.',
            topic: tema,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al cambiar el estado del tema.' });
    }
};

module.exports = {
    crearTema,
    obtenerTemasPorModulo,
    obtenerModulos,
    actualizarTema,
    cambiarEstado,
};
