const { response } = require('express');
const mongoose    = require('mongoose');
const Topic       = require('../models/topic');
const Curso       = require('../models/curso');

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
 *   descripcion,     → (opcional) breve descripción de lo que trata el tema
 *   moduleTagLabel,  → (opcional) label del módulo, ej: "Módulo 1" — se auto-genera si no se envía
 *   active,          → (opcional) boolean, default true
 * }
 *
 * Regla de negocio: el topicTag debe iniciar con "mod_{N}_" donde N es el número del módulo.
 * Ej: si moduleTag = "modulo_1", el topicTag debe iniciar con "mod_1_"
 */
const crearTema = async (req, res = response) => {
    const { cursoTag, moduleTag, moduleTagLabel, topicTag, label, descripcion, orden, active } = req.body || {};

    // Validar cursoTag — el tema debe colgar de un curso existente
    if (!esTagValido(cursoTag)) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "cursoTag" es requerido y solo admite letras, números, _ y -. Ej: "sena".',
        });
    }

    const curso = await Curso.findOne({ cursoTag: cursoTag.trim() });
    if (!curso) {
        return res.status(404).json({
            ok: false,
            msg: `No existe el curso "${cursoTag}". Créalo antes de añadirle temas.`,
        });
    }

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

    // Validar que topicTag corresponda al módulo (convención de nombres).
    // Se admiten dos formas, para poder distinguir módulos homónimos de
    // cursos distintos:  "mod_1_ley_1105"  o  "sena_mod_1_ley_1105"
    const numeroModulo = moduleTag.replace('modulo_', '');
    const prefijos = [
        `mod_${numeroModulo}_`,
        `${cursoTag.trim()}_mod_${numeroModulo}_`,
    ];
    if (!prefijos.some((p) => topicTag.startsWith(p))) {
        return res.status(400).json({
            ok: false,
            msg: `El "topicTag" debe iniciar con "${prefijos[0]}" o "${prefijos[1]}" `
               + `para pertenecer al módulo "${moduleTag}" del curso "${cursoTag}".`,
        });
    }

    // Validar label
    if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "label" es requerido (texto visible para el usuario, ej: "Ley 1105").',
        });
    }

    // Validar descripcion (opcional)
    if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
        return res.status(400).json({ ok: false, msg: 'El campo "descripcion" debe ser un texto.' });
    }
    const safeDescripcion = typeof descripcion === 'string' ? descripcion.trim() : '';
    if (safeDescripcion.length > 300) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "descripcion" no puede superar los 300 caracteres.',
        });
    }

    // Validar active (opcional)
    const safeActive = active ?? true;
    if (typeof safeActive !== 'boolean') {
        return res.status(400).json({ ok: false, msg: 'El campo "active" debe ser true o false.' });
    }

    // Validar orden (opcional): posición del tema dentro del módulo
    const safeOrden = orden ?? 0;
    if (!Number.isInteger(safeOrden) || safeOrden < 0) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "orden" debe ser un número entero mayor o igual a 0.',
        });
    }

    // Si no viene moduleTagLabel se genera automáticamente
    const safeModuleTagLabel = (typeof moduleTagLabel === 'string' && moduleTagLabel.trim().length > 0)
        ? moduleTagLabel.trim()
        : generarLabelModulo(moduleTag);

    try {
        const nuevoTema = new Topic({
            cursoTag:       cursoTag.trim(),
            moduleTag:      moduleTag.trim(),
            moduleTagLabel: safeModuleTagLabel,
            topicTag:       topicTag.trim(),
            label:          label.trim(),
            orden:          safeOrden,
            active:         safeActive,
            // Solo se incluye si trae contenido: los temas sin descripción
            // no guardan el campo en la base de datos.
            ...(safeDescripcion.length > 0 && { descripcion: safeDescripcion }),
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
    const { moduleTag, cursoTag, active } = req.query;

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
        // Sin cursoTag se devolverían los temas de módulos homónimos de otros
        // cursos: conviene enviarlo siempre desde la app.
        if (cursoTag) filtro.cursoTag = String(cursoTag).trim();
        if (activeBool !== null) filtro.active = activeBool;

        const temas = await Topic
            .find(filtro)
            .select('cursoTag moduleTag moduleTagLabel topicTag label descripcion orden active')
            // El orden manda; el label solo desempata entre temas sin orden fijado
            .sort({ orden: 1, label: 1 });

        return res.status(200).json({
            ok: true,
            moduleTag: moduleTag.trim(),
            cursoTag: cursoTag ? String(cursoTag).trim() : null,
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
    const { active, cursoTag } = req.query;

    const activeBool = parsearBooleano(active);
    if (active !== undefined && activeBool === null) {
        return res.status(400).json({ ok: false, msg: 'El parámetro "active" debe ser "true" o "false".' });
    }

    try {
        const pipeline = [];
        const match = {};

        if (activeBool !== null) match.active = activeBool;
        if (cursoTag) match.cursoTag = String(cursoTag).trim();
        if (Object.keys(match).length > 0) pipeline.push({ $match: match });

        // Se agrupa por curso + módulo: dos cursos pueden tener "modulo_1" y
        // agrupar solo por moduleTag los fusionaría en uno.
        pipeline.push(
            {
                $group: {
                    _id: { cursoTag: '$cursoTag', moduleTag: '$moduleTag' },
                    moduleTagLabel: { $first: '$moduleTagLabel' },
                    totalTemas:     { $sum: 1 },
                },
            },
            {
                $project: {
                    _id:            0,
                    cursoTag:       '$_id.cursoTag',
                    moduleTag:      '$_id.moduleTag',
                    moduleTagLabel: 1,
                    totalTemas:     1,
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
            cursoTag: cursoTag ? String(cursoTag).trim() : null,
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
 * Actualiza los campos editables de un tema: label, moduleTagLabel y/o descripcion.
 * El topicTag y moduleTag no se pueden cambiar (son identificadores).
 * Body: { label, moduleTagLabel, descripcion }
 *
 * Enviar "descripcion" como cadena vacía elimina la descripción del tema.
 */
const actualizarTema = async (req, res = response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ ok: false, msg: 'El ID proporcionado no es válido.' });
    }

    const { label, moduleTagLabel, descripcion, orden } = req.body || {};

    // Al menos uno de los campos editables debe venir
    if (label === undefined && moduleTagLabel === undefined && descripcion === undefined && orden === undefined) {
        return res.status(400).json({
            ok: false,
            msg: 'Debes enviar al menos uno de estos campos: "label", "moduleTagLabel", "descripcion", "orden".',
        });
    }

    if (orden !== undefined && (!Number.isInteger(orden) || orden < 0)) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "orden" debe ser un número entero mayor o igual a 0.',
        });
    }

    if (label !== undefined && (typeof label !== 'string' || label.trim().length === 0)) {
        return res.status(400).json({ ok: false, msg: 'El campo "label" debe ser un texto no vacío.' });
    }

    if (moduleTagLabel !== undefined && (typeof moduleTagLabel !== 'string' || moduleTagLabel.trim().length === 0)) {
        return res.status(400).json({ ok: false, msg: 'El campo "moduleTagLabel" debe ser un texto no vacío.' });
    }

    // La descripción sí admite cadena vacía: se usa para borrarla
    if (descripcion !== undefined && typeof descripcion !== 'string') {
        return res.status(400).json({ ok: false, msg: 'El campo "descripcion" debe ser un texto.' });
    }

    if (typeof descripcion === 'string' && descripcion.trim().length > 300) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "descripcion" no puede superar los 300 caracteres.',
        });
    }

    try {
        const tema = await Topic.findById(id);
        if (!tema) {
            return res.status(404).json({ ok: false, msg: 'Tema no encontrado.' });
        }

        if (label !== undefined)           tema.label          = label.trim();
        if (moduleTagLabel !== undefined)  tema.moduleTagLabel = moduleTagLabel.trim();
        if (orden !== undefined)           tema.orden          = orden;

        if (descripcion !== undefined) {
            const limpia = descripcion.trim();
            // Cadena vacía → se elimina el campo del documento (no se guarda "")
            tema.descripcion = limpia.length > 0 ? limpia : undefined;
        }

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
