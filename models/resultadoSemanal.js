const { Schema, model } = require('mongoose');

/**
 * Posición final de un usuario en una semana ya cerrada del ranking.
 *
 * Se genera para TODOS los que ganaron XP esa semana (no solo el top 10 que
 * guarda WeeklyClose) y la app lo muestra una vez al abrir, con un mensaje
 * según la posición. Ver helpers/resultadoSemanal.js.
 */
const ResultadoSemanalSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // Id de la semana (mismo valor que WeeklyClose.inicioSemana)
        semana: {
            type: Date,
            required: true,
        },

        posicion:           { type: Number, required: true },
        totalParticipantes: { type: Number, required: true },
        xpSemana:           { type: Number, required: true },

        // Posición en la semana anterior. null si no participó
        posicionAnterior: { type: Number, default: null },

        // XP de las posiciones de referencia, para "te faltaron N XP".
        // null si esa semana hubo menos jugadores
        xpPrimero: { type: Number, default: null },
        xpTercero: { type: Number, default: null },
        xpDecimo:  { type: Number, default: null },

        // Ya se le mostró en la app
        visto: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Uno por usuario y semana: además hace idempotente la generación
ResultadoSemanalSchema.index({ userId: 1, semana: 1 }, { unique: true });
ResultadoSemanalSchema.index({ semana: 1 });

module.exports = model('ResultadoSemanal', ResultadoSemanalSchema);
