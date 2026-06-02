const { Schema, model } = require('mongoose');

const QuestionSchema = new Schema({

    // _id lo crea MongoDB automáticamente
    // Identificador único de la pregunta

    text: {
        type: String,
        required: true,
        trim: true
        // Enunciado de la pregunta
        // Ej: "¿Cuánto es 2 + 2?"
    },

    options: {
        type: [String],
        required: true,
        validate: {
            validator: function (v) {
                return v.length >= 2;
            },
            message: 'La pregunta debe tener al menos 2 opciones'
        }
        // Arreglo de opciones de respuesta
        // Ej: ["3", "4", "5", "22"]
    },

    correctIndex: {
        type: Number,
        required: true,
        min: 0
        // Índice de la opción correcta
        // Ej: 1 → corresponde a options[1]
    },

    tags: {
        type: [String],
        default: []
        // Etiquetas o temas de la pregunta
        // Ej: ["matematicas", "algebra"]
        // Sirve para filtrar quizzes
    },

    feedback: {
        type: String,
        default: '',   // si no hay, queda vacío
        trim: true,
        maxlength: 1000, // evita textos gigantes
    },

    difficulty: {
        type: Number,
        default: 1,
        min: 1,
        max: 3
        // Nivel de dificultad
        // 1 = fácil, 2 = medio, 3 = difícil
    },

    tipo: {
        type: String,
        enum: ['recall', 'comprension', 'aplicacion', 'analisis', 'evaluacion'],
        default: 'recall'
        // Nivel cognitivo de la pregunta (Taxonomía de Bloom simplificada)
        // recall      → Recordar hechos o definiciones
        // comprension → Entender y explicar conceptos
        // aplicacion  → Usar el conocimiento en situaciones
        // analisis    → Comparar, descomponer, relacionar
        // evaluacion  → Juzgar, valorar, argumentar
    },

    active: {
        type: Boolean,
        default: true
        // Indica si la pregunta está activa
        // false = no se usa en quizzes pero no se borra
    }

}, {
    timestamps: true
    // Agrega automáticamente:
    // createdAt → fecha de creación
    // updatedAt → última actualización
});

module.exports = model('Question', QuestionSchema);
