const { Schema, model } = require('mongoose');

const QuestionSchema = new Schema({

    text: {
        type: String,
        required: true,
        trim: true,
    },

    options: {
        type: [String],
        required: true,
        validate: {
            validator: v => v.length >= 2,
            message: 'La pregunta debe tener al menos 2 opciones',
        },
    },

    correctIndex: {
        type: Number,
        required: true,
        min: 0,
    },

    // Referencia directa al tema al que pertenece la pregunta
    topicTag: {
        type: Schema.Types.ObjectId,
        ref: 'Topic',
        required: true,
        index: true,
    },

    feedback: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
    },

    difficulty: {
        type: Number,
        default: 1,
        min: 1,
        max: 4,
        // 1 = fácil, 2 = medio, 3 = difícil, 4 = avanzado
    },

    tipo: {
        type: String,
        enum: ['literal', 'comprension', 'aplicacion', 'analisis', 'sintesis', 'mejor_respuesta'],
        default: 'literal',
    },

    active: {
        type: Boolean,
        default: true,
    },

}, {
    timestamps: true,
});

module.exports = model('Question', QuestionSchema);
