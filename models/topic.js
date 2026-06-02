const { Schema, model } = require('mongoose');

const TopicSchema = new Schema(
  {
    // Tag del módulo (sirve para agrupar temas en la UI)
    // Ej: "modulo_1"
    moduleTag: {
      type: String,
      required: true,
      trim: true,
    },

    moduleTagLabel: {
      type: String,
      required: true,
      trim: true,
    },

    // Tag único del tema (este es el que usarás para filtrar preguntas)
    // Ej: "mod_1_ley_1105"
    topicTag: {
      type: String,
      required: true,
      trim: true,
      unique: true, // evita duplicados a nivel BD
      index: true,  // acelera búsquedas por topicTag
    },

    // Texto amigable para mostrar al usuario
    // Ej: "Ley 1105"
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // Permite desactivar un tema sin borrarlo
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto útil para listar por módulo rápidamente
TopicSchema.index({ moduleTag: 1, active: 1 });

module.exports = model('Topic', TopicSchema);
