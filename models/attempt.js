const { Schema, model } = require('mongoose');

const AttemptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Contexto del intento (lo que el usuario pidió)
    moduleTag: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    // Temas seleccionados (tus topicTags compuestos)
    topicTags: {
      type: [String],
      default: [],
      index: true,
    },

    // Resumen del resultado
    totalAnswered: { type: Number, required: true },
    totalGraded: { type: Number, required: true },
    correct: { type: Number, required: true },
    scorePercent: { type: Number, required: true },

    // Dificultad (opcional, pero útil para tus stats)
    difficultySum: { type: Number, default: 0 },
    difficultyAvg: { type: Number, default: 0 },
    difficultyLabel: { type: String, default: '' }, // "Fácil/Media/Difícil"

    // Detalle por pregunta respondida
    answers: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedIndex: { type: Number, required: true },
        correctIndex: { type: Number, required: true },
        isCorrect: { type: Boolean, required: true },

        // Guardamos tags de esa pregunta para stats por tema
        tags: { type: [String], default: [] },

        // Guardamos difficulty por pregunta para stats
        difficulty: { type: Number, default: 1 },
      },
    ],
  },
  { timestamps: true }
);

// Índices útiles
AttemptSchema.index({ userId: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, moduleTag: 1, createdAt: -1 });


module.exports = model('Attempt', AttemptSchema);
