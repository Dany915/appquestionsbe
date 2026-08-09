const { Schema, model } = require('mongoose');

/**
 * Registro de una semana del ranking ya cerrada y premiada.
 *
 * Su función principal es actuar como **cerrojo**: `inicioSemana` es único, así
 * que solo la primera petición que consiga insertar el documento reparte los
 * premios. Cualquier otra petición simultánea chocará con el índice y no
 * volverá a premiar.
 */
const WeeklyCloseSchema = new Schema(
    {
        // Lunes 00:00 UTC de la semana cerrada
        inicioSemana: {
            type: Date,
            required: true,
            unique: true,
            index: true,
        },

        // 'procesando' → alguien está repartiendo premios ahora mismo
        // 'completada' → premios ya entregados
        estado: {
            type: String,
            enum: ['procesando', 'completada'],
            default: 'procesando',
        },

        totalParticipantes: {
            type: Number,
            default: 0,
        },

        // Foto del podio de esa semana (para histórico y auditoría)
        top: [
            {
                _id:      false,
                userId:   { type: Schema.Types.ObjectId, ref: 'User' },
                username: String,
                position: Number,
                xpSemana: Number,
            },
        ],
    },
    { timestamps: true }
);

module.exports = model('WeeklyClose', WeeklyCloseSchema);
