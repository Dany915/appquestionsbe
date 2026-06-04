const { Schema, model } = require('mongoose');

const AttemptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Nivel de dificultad solicitado por el usuario al generar el quiz
    nivel: {
      type: String,
      enum: ['curioso', 'analitico', 'estratega', 'genio'],
      default: 'curioso',
      index: true,
    },

    moduleTag: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    // topicTag strings usados al generar el quiz (ej: ["mod_1_ley_1105"])
    topicTags: {
      type: [String],
      default: [],
      index: true,
    },

    // Tiempo que tardó el usuario en completar el quiz (en segundos)
    timeTakenSecs: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Resumen del resultado
    totalAnswered: { type: Number, required: true },
    totalGraded:   { type: Number, required: true },
    correct:       { type: Number, required: true },
    scorePercent:  { type: Number, required: true },

    // Dificultad numérica promedio de las preguntas del quiz (1-4)
    difficultySum: { type: Number, default: 0 },
    difficultyAvg: { type: Number, default: 0 },

    // Detalle por pregunta respondida
    answers: [
      {
        questionId:    { type: Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedIndex: { type: Number, required: true },
        correctIndex:  { type: Number, required: true },
        isCorrect:     { type: Boolean, required: true },
        topicTag:      { type: Schema.Types.ObjectId, ref: 'Topic' },
        difficulty:    { type: Number, default: 1 },
      },
    ],
  },
  { timestamps: true }
);

// Índices compuestos para stats de usuario y globales
AttemptSchema.index({ userId: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, nivel: 1, createdAt: -1 });
AttemptSchema.index({ nivel: 1, scorePercent: -1 });   // leaderboard global por nivel

module.exports = model('Attempt', AttemptSchema);
