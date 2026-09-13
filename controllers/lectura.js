const { response } = require('express');
const Lectura  = require('../models/lectura');
const Topic    = require('../models/topic');
const Question = require('../models/question');

// ─── Helpers ───────────────────────────────────────────────────────────────────

const esTagValido = (valor) =>
    typeof valor === 'string' && /^[a-zA-Z0-9_-]+$/.test(valor.trim());

/** Datos de la lectura sin el contenido: lo necesario para listas e índice. */
const resumen = (l, temasPorTag, preguntasPorTag) => ({
    lecturaTag:     l.lecturaTag,
    titulo:         l.titulo,
    descripcion:    l.descripcion,
    orden:          l.orden,
    temas:          l.topicTags
        .filter((tag) => temasPorTag.has(tag))
        .map((tag) => ({ topicTag: tag, label: temasPorTag.get(tag).label })),
    totalSecciones: l.secciones.length,
    totalPalabras:  l.totalPalabras,
    minutosLectura: l.minutosLectura,
    // Preguntas activas de sus temas: con 0 la app no ofrece "Hacer quiz"
    totalPreguntas: l.topicTags.reduce((n, tag) => n + (preguntasPorTag.get(tag) || 0), 0),
    version:        l.version,
    updatedAt:      l.updatedAt,
});

/** Preguntas activas por topicTag. Question referencia al tema por ObjectId. */
const contarPreguntas = async (temas) => {
    const porId = await Question.aggregate([
        { $match: { active: true, topicTag: { $in: temas.map((t) => t._id) } } },
        { $group: { _id: '$topicTag', n: { $sum: 1 } } },
    ]);
    const tagDeId = new Map(temas.map((t) => [String(t._id), t.topicTag]));
    return new Map(porId.map((p) => [tagDeId.get(String(p._id)), p.n]));
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/lectura
 * Lista las lecturas activas de un módulo o de un tema, sin su contenido.
 *
 * Query params (uno de los dos grupos):
 *   cursoTag + moduleTag → lecturas de todos los temas del módulo
 *   topicTag             → lecturas de un tema
 *
 * Se exige cursoTag junto a moduleTag porque distintos cursos pueden tener
 * módulos con el mismo nombre ("modulo_1").
 */
const obtenerLecturas = async (req, res = response) => {
    const { cursoTag, moduleTag, topicTag } = req.query;

    let filtroTemas;
    if (topicTag !== undefined) {
        if (!esTagValido(topicTag)) {
            return res.status(400).json({ ok: false, msg: 'El parámetro "topicTag" no es válido.' });
        }
        filtroTemas = { topicTag: topicTag.trim(), active: true };
    } else if (esTagValido(cursoTag) && esTagValido(moduleTag)) {
        filtroTemas = { cursoTag: cursoTag.trim(), moduleTag: moduleTag.trim(), active: true };
    } else {
        return res.status(400).json({
            ok: false,
            msg: 'Envía "cursoTag" y "moduleTag", o "topicTag". Ej: /api/lectura?cursoTag=sena&moduleTag=modulo_2',
        });
    }

    try {
        const temas = await Topic.find(filtroTemas)
            .select('topicTag label orden')
            .sort({ orden: 1, label: 1 })
            .lean();

        if (temas.length === 0) {
            return res.json({ ok: true, count: 0, lecturas: [] });
        }

        const temasPorTag = new Map(temas.map((t) => [t.topicTag, t]));
        const [lecturas, preguntasPorTag] = await Promise.all([
            Lectura.find({ active: true, topicTags: { $in: [...temasPorTag.keys()] } })
                .select('-secciones.bloques')
                .lean(),
            contarPreguntas(temas),
        ]);

        // Orden: el del tema dentro del módulo y, dentro del tema, el de la lectura
        const posTema = (l) => Math.min(
            ...l.topicTags.map((tag) => temas.indexOf(temasPorTag.get(tag))).filter((i) => i >= 0)
        );
        lecturas.sort((a, b) => posTema(a) - posTema(b) || a.orden - b.orden);

        return res.json({
            ok: true,
            count: lecturas.length,
            lecturas: lecturas.map((l) => resumen(l, temasPorTag, preguntasPorTag)),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener las lecturas.' });
    }
};

/**
 * GET /api/lectura/:lecturaTag
 * Lectura completa: metadatos, fuentes, aviso y todas las secciones con sus
 * bloques. La app la pide una vez y pasa de sección en local.
 */
const obtenerLectura = async (req, res = response) => {
    const { lecturaTag } = req.params;

    if (!esTagValido(lecturaTag)) {
        return res.status(400).json({ ok: false, msg: 'El "lecturaTag" no es válido.' });
    }

    try {
        const l = await Lectura.findOne({ lecturaTag: lecturaTag.trim(), active: true }).lean();
        if (!l) {
            return res.status(404).json({ ok: false, msg: 'No existe esa lectura.' });
        }

        const temas = await Topic.find({ topicTag: { $in: l.topicTags }, active: true })
            .select('topicTag label')
            .lean();
        const temasPorTag = new Map(temas.map((t) => [t.topicTag, t]));
        const preguntasPorTag = await contarPreguntas(temas);

        return res.json({
            ok: true,
            lectura: {
                ...resumen(l, temasPorTag, preguntasPorTag),
                fuentes:    l.fuentes,
                consultado: l.consultado,
                vigencia:   l.vigencia,
                aviso:      l.aviso,
                secciones:  l.secciones,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener la lectura.' });
    }
};

module.exports = { obtenerLecturas, obtenerLectura };
