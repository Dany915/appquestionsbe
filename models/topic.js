const { Schema, model } = require('mongoose');

const TopicSchema = new Schema(
  {
    // Curso al que pertenece el tema — nivel más alto de la jerarquía.
    // Ej: "sena". Ver models/curso.js
    cursoTag: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

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

    // Breve descripción de lo que trata el tema (opcional).
    // Ej: "Regula el uso del espectro radioeléctrico y sus concesiones."
    // Si el tema no tiene descripción el campo simplemente no se guarda,
    // en lugar de almacenarse como cadena vacía.
    descripcion: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    // Orden de aparición dentro del módulo (menor primero).
    // Los temas se listan por este campo y, a igualdad, por label. Así el
    // orden lo decide la secuencia pedagógica y no el alfabeto: sin él,
    // "Ejecución del mantenimiento" saldría antes que "Preparar el
    // mantenimiento". Los temas antiguos se quedan en 0 y siguen ordenándose
    // alfabéticamente entre ellos.
    orden: {
      type: Number,
      default: 0,
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

// Índices compuestos para los listados habituales
TopicSchema.index({ moduleTag: 1, active: 1 });
TopicSchema.index({ cursoTag: 1, active: 1 });
TopicSchema.index({ cursoTag: 1, moduleTag: 1, active: 1 });

module.exports = model('Topic', TopicSchema);
