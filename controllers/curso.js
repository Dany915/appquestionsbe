const { response } = require('express');
const mongoose     = require('mongoose');

const Curso = require('../models/curso');
const Topic = require('../models/topic');
const User  = require('../models/user');

// ─── Helpers ───────────────────────────────────────────────────────────────────

const esTagValido = (valor) => {
    if (typeof valor !== 'string' || valor.trim().length === 0) return false;
    return /^[a-z0-9_-]+$/.test(valor.trim());
};

/** Texto recortado, o undefined si viene vacío. Para campos opcionales. */
const textoOpcional = (valor) => {
    if (typeof valor !== 'string') return undefined;
    const v = valor.trim();
    return v.length > 0 ? v : undefined;
};

/**
 * Campos visuales del curso, normalizados en un solo objeto.
 * La app debe usar el primer icono informado: iconAsset > iconUrl > emoji.
 */
const visualDeCurso = (c) => ({
    emoji:           c.emoji || '📚',
    iconAsset:       c.iconAsset || null,
    iconUrl:         c.iconUrl || null,
    imagenUrl:       c.imagenUrl || null,
    color:           c.color || null,
    colorSecundario: c.colorSecundario || null,
});

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/curso
 * Lista los cursos disponibles: el nivel más alto que elige el usuario
 * antes de entrar a los módulos.
 *
 * Query params opcionales:
 *   active=true      → solo cursos activos (recomendado en la app)
 *   conContenido=true → solo cursos que ya tengan temas activos
 */
const obtenerCursos = async (req, res = response) => {
    const soloActivos     = req.query.active === 'true';
    const soloConContenido = req.query.conContenido === 'true';

    try {
        const filtro = soloActivos ? { active: true } : {};
        const cursos = await Curso.find(filtro).sort({ orden: 1, label: 1 });

        // Cuántos temas activos tiene cada curso: sirve para ocultar los vacíos
        // y para mostrar "N temas" en la tarjeta de selección.
        const conteos = await Topic.aggregate([
            { $match: { active: true } },
            { $group: { _id: '$cursoTag', temas: { $sum: 1 } } },
        ]);
        const porCurso = new Map(conteos.map((c) => [c._id, c.temas]));

        let salida = cursos.map((c) => ({
            cursoTag:    c.cursoTag,
            label:       c.label,
            descripcion: c.descripcion || '',
            orden:       c.orden,
            active:      c.active,
            totalTemas:  porCurso.get(c.cursoTag) || 0,
            ...visualDeCurso(c),
        }));

        if (soloConContenido) {
            salida = salida.filter((c) => c.totalTemas > 0);
        }

        return res.status(200).json({
            ok: true,
            count: salida.length,
            cursos: salida,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener los cursos.' });
    }
};

/**
 * POST /api/curso   (solo admin)
 * Body: { cursoTag, label, descripcion, orden, active,
 *         emoji, iconAsset, iconUrl, imagenUrl, color, colorSecundario }
 *
 * Los campos visuales son todos opcionales: se puede crear el curso solo con
 * emoji y añadirle icono propio más adelante sin tocar nada más.
 */
const crearCurso = async (req, res = response) => {
    const {
        cursoTag, label, descripcion, orden, active,
        emoji, iconAsset, iconUrl, imagenUrl, color, colorSecundario,
    } = req.body || {};

    if (!esTagValido(cursoTag)) {
        return res.status(400).json({
            ok: false,
            msg: 'El "cursoTag" es requerido y solo admite minúsculas, números, _ y -. Ej: "sena".',
        });
    }

    if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'El campo "label" es requerido (nombre visible, ej: "SENA").',
        });
    }

    try {
        const nuevo = new Curso({
            cursoTag:        cursoTag.trim(),
            label:           label.trim(),
            descripcion:     textoOpcional(descripcion),
            orden:           typeof orden === 'number' ? orden : 0,
            active:          typeof active === 'boolean' ? active : true,
            // Visual
            emoji:           textoOpcional(emoji),
            iconAsset:       textoOpcional(iconAsset),
            iconUrl:         textoOpcional(iconUrl),
            imagenUrl:       textoOpcional(imagenUrl),
            color:           textoOpcional(color),
            colorSecundario: textoOpcional(colorSecundario),
        });

        const guardado = await nuevo.save();

        return res.status(201).json({
            ok: true,
            msg: 'Curso creado correctamente.',
            curso: guardado,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ ok: false, msg: 'Ya existe un curso con ese cursoTag.' });
        }
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al crear el curso.' });
    }
};

/**
 * PUT /api/curso/:id   (solo admin)
 * Actualiza los campos editables. El cursoTag no se puede cambiar: es el
 * identificador al que apuntan los temas.
 */
const actualizarCurso = async (req, res = response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ ok: false, msg: 'El ID proporcionado no es válido.' });
    }

    const {
        label, descripcion, orden,
        emoji, iconAsset, iconUrl, imagenUrl, color, colorSecundario,
    } = req.body || {};

    const editables = {
        label, descripcion, orden,
        emoji, iconAsset, iconUrl, imagenUrl, color, colorSecundario,
    };

    if (Object.values(editables).every((v) => v === undefined)) {
        return res.status(400).json({
            ok: false,
            msg: 'Envía al menos uno de: ' + Object.keys(editables).map((k) => `"${k}"`).join(', ') + '.',
        });
    }

    try {
        const curso = await Curso.findById(id);
        if (!curso) {
            return res.status(404).json({ ok: false, msg: 'Curso no encontrado.' });
        }

        if (label !== undefined) {
            if (typeof label !== 'string' || label.trim().length === 0) {
                return res.status(400).json({ ok: false, msg: 'El "label" debe ser un texto no vacío.' });
            }
            curso.label = label.trim();
        }
        if (descripcion !== undefined) {
            curso.descripcion = textoOpcional(descripcion) ?? undefined;
        }
        if (orden !== undefined) curso.orden = Number(orden) || 0;

        // El emoji nunca queda vacío: es el respaldo cuando no hay icono.
        if (emoji !== undefined) curso.emoji = textoOpcional(emoji) ?? '📚';

        // Enviar cadena vacía en cualquiera de estos limpia el campo.
        if (iconAsset !== undefined)       curso.iconAsset       = textoOpcional(iconAsset) ?? null;
        if (iconUrl !== undefined)         curso.iconUrl         = textoOpcional(iconUrl) ?? null;
        if (imagenUrl !== undefined)       curso.imagenUrl       = textoOpcional(imagenUrl) ?? null;
        if (color !== undefined)           curso.color           = textoOpcional(color) ?? null;
        if (colorSecundario !== undefined) curso.colorSecundario = textoOpcional(colorSecundario) ?? null;

        const actualizado = await curso.save();

        return res.status(200).json({
            ok: true,
            msg: 'Curso actualizado correctamente.',
            curso: actualizado,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al actualizar el curso.' });
    }
};

/**
 * PATCH /api/curso/:id/estado   (solo admin)
 * Activa o desactiva un curso sin borrarlo.
 */
const cambiarEstadoCurso = async (req, res = response) => {
    const { id }     = req.params;
    const { active } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ ok: false, msg: 'El ID proporcionado no es válido.' });
    }

    if (typeof active !== 'boolean') {
        return res.status(400).json({ ok: false, msg: 'El campo "active" debe ser true o false.' });
    }

    try {
        const curso = await Curso.findByIdAndUpdate(id, { active }, { new: true });
        if (!curso) {
            return res.status(404).json({ ok: false, msg: 'Curso no encontrado.' });
        }

        return res.status(200).json({
            ok: true,
            msg: active ? 'Curso activado.' : 'Curso desactivado.',
            curso,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al cambiar el estado del curso.' });
    }
};

/**
 * PUT /api/curso/activo
 * Body: { cursoTag }  →  null para dejar de tener curso activo.
 *
 * Fija el curso en el que estudia el usuario. La app entra directo a sus
 * módulos en lugar de pedirle que lo elija cada vez.
 */
const fijarCursoActivo = async (req, res = response) => {
    const { cursoTag } = req.body || {};

    const quitar = cursoTag === null || cursoTag === undefined || cursoTag === '';

    try {
        if (!quitar) {
            const curso = await Curso.findOne({
                cursoTag: String(cursoTag).trim(),
                active: true,
            });
            if (!curso) {
                return res.status(404).json({
                    ok: false,
                    msg: 'El curso indicado no existe o no está disponible.',
                });
            }
        }

        const nuevo = quitar ? null : String(cursoTag).trim();
        await User.findByIdAndUpdate(req.uid, { cursoActivo: nuevo });

        return res.status(200).json({
            ok: true,
            msg: quitar ? 'Curso activo retirado.' : 'Curso activo actualizado.',
            cursoActivo: nuevo,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al fijar el curso activo.' });
    }
};

module.exports = {
    obtenerCursos,
    crearCurso,
    actualizarCurso,
    cambiarEstadoCurso,
    fijarCursoActivo,
};
