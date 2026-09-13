const { Schema, model } = require('mongoose');
const { VIGENCIAS } = require('../helpers/lecturaMarkup');

/**
 * Material de lectura de uno o varios temas (ej: el texto de una norma).
 *
 * No se crea a mano: lo genera scripts/importarLectura.js a partir de un
 * archivo contenido/lecturas/*.lectura.txt, que es la fuente de verdad.
 * Ver helpers/lecturaMarkup.js para el formato y los tipos de bloque.
 *
 * Las secciones van embebidas: una lectura se lee completa y de corrido, y
 * aun la más larga prevista (la Constitución) queda muy por debajo del
 * límite de tamaño de un documento. El listado excluye los bloques.
 */

const SeccionSchema = new Schema(
    {
        // Id estable dentro de la lectura. Ej: "cap-1"
        slug:     { type: String, required: true, trim: true },
        orden:    { type: Number, required: true },
        // Título editorial para el índice. Ej: "Fundamentos de la FPI"
        titulo:   { type: String, required: true, trim: true },
        // Qué abarca. Ej: "Capítulo I · Arts. 1–7"
        rango:    { type: String, default: '', trim: true },
        palabras: { type: Number, default: 0 },
        minutos:  { type: Number, default: 1 },
        // Contenido tipado: encabezado, parrafo, item, articulo, paragrafo,
        // firmas, nota. La app ignora los tipos que no conozca.
        bloques:  { type: [Schema.Types.Mixed], default: [] },
    },
    { _id: false }
);

const LecturaSchema = new Schema(
    {
        // Id estable. Ej: "sena_acuerdo_12_1985"
        lecturaTag: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: /^[a-z0-9_-]+$/,
        },

        // Temas a los que sirve de material de estudio (Topic.topicTag).
        // Es una lista para poder reutilizar un texto en varios temas o cursos.
        topicTags: {
            type: [String],
            required: true,
            validate: {
                validator: (v) => v.length > 0,
                message: 'La lectura debe pertenecer al menos a un tema',
            },
        },

        titulo:      { type: String, required: true, trim: true },
        descripcion: { type: String, default: '', trim: true, maxlength: 300 },

        // Orden entre las lecturas de un mismo tema (menor primero)
        orden: { type: Number, default: 0 },

        // De dónde sale el texto y cuándo se consultó (se muestra al usuario)
        fuentes: {
            type: [{ nombre: String, url: String, _id: false }],
            default: [],
        },
        consultado: { type: String, default: null },

        // Advertencia de vigencia redactada por nosotros. Nunca copiar las
        // notas de vigencia del Normograma: tienen derechos de autor.
        vigencia: {
            estado: { type: String, enum: VIGENCIAS, default: 'sin_verificar' },
            nota:   { type: String, default: '' },
        },

        // Aviso legal / de no afiliación que acompaña la lectura
        aviso: { type: String, default: '' },

        // Erratas corregidas respecto a la fuente (trazabilidad, no se envía)
        correcciones: {
            type: [{ original: String, corregido: String, motivo: String, _id: false }],
            default: [],
            select: false,
        },

        secciones:      { type: [SeccionSchema], default: [] },
        totalPalabras:  { type: Number, default: 0 },
        minutosLectura: { type: Number, default: 1 },

        // Sube cada vez que cambia el contenido. La app la usa para saber si
        // su copia y el progreso guardado siguen al día.
        version: { type: Number, default: 1 },
        // Huella del contenido importado, para no subir la versión sin cambios
        hash: { type: String, select: false },

        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

LecturaSchema.index({ topicTags: 1, active: 1 });

module.exports = model('Lectura', LecturaSchema);
