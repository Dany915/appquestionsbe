const { Schema, model } = require('mongoose');

/**
 * Nivel más alto de la jerarquía de contenidos:
 *
 *   Curso  →  Módulo  →  Tema  →  Pregunta
 *
 * Ej: "SENA" contiene el Módulo 1, que contiene el tema "Ley 1105".
 *
 * A diferencia de los módulos (que se derivan agrupando temas), el curso sí es
 * una colección propia porque necesita metadatos para pintar la pantalla de
 * selección: nombre, descripción, emoji y color.
 */
const CursoSchema = new Schema(
    {
        // Id estable, en minúsculas. Ej: "sena", "sistemas_teleinformaticos"
        cursoTag: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },

        // Nombre visible. Ej: "SENA"
        label: {
            type: String,
            required: true,
            trim: true,
        },

        // Frase corta para la tarjeta de selección
        descripcion: {
            type: String,
            trim: true,
            maxlength: 200,
        },

        // ─── Identidad visual ──────────────────────────────────────────────
        //
        // Tres vías para el icono, de mayor a menor prioridad al pintarlo:
        //   1. iconAsset → recurso empaquetado en la app (nítido y offline)
        //   2. iconUrl   → imagen remota (permite añadir cursos sin publicar
        //                  una versión nueva de la app)
        //   3. emoji     → siempre presente, sirve de respaldo
        //
        // La app debe usar el primero que venga informado. Así se puede
        // empezar con emojis y migrar a iconos propios sin tocar el backend.

        // Respaldo universal. Ej: "🎓"
        emoji: {
            type: String,
            trim: true,
            default: '📚',
        },

        // Ruta del recurso dentro de la app. Ej: "assets/cursos/sena.svg"
        iconAsset: {
            type: String,
            trim: true,
            default: null,
        },

        // Icono alojado fuera. Ej: "https://…/sena.png"
        iconUrl: {
            type: String,
            trim: true,
            default: null,
        },

        // Imagen amplia para cabeceras o tarjetas grandes (opcional)
        imagenUrl: {
            type: String,
            trim: true,
            default: null,
        },

        // Color de acento propio (hex). Opcional: si falta se usa el del tema.
        color: {
            type: String,
            trim: true,
            default: null,
        },

        // Segundo color: permite pintar el curso con degradado propio
        colorSecundario: {
            type: String,
            trim: true,
            default: null,
        },

        // Orden de aparición (menor primero)
        orden: {
            type: Number,
            default: 0,
        },

        // Permite ocultar un curso sin borrarlo
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

CursoSchema.index({ active: 1, orden: 1 });

module.exports = model('Curso', CursoSchema);
