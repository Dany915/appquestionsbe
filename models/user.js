const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },

        // null para usuarios que solo usan Google
        password: {
            type: String,
            default: null,
        },

        googleId: {
            type: String,
            default: null,
            index: true,
        },

        avatar: {
            type: String,
            default: '',
        },

        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },

        active: {
            type: Boolean,
            default: true,
        },

        // Racha actual de días consecutivos con al menos un intento
        currentStreak: {
            type: Number,
            default: 0,
        },

        // Mejor racha histórica
        maxStreak: {
            type: Number,
            default: 0,
            index: true,
        },

        // Fecha del último intento (UTC) — usada para calcular la racha
        lastAttemptDate: {
            type: Date,
            default: null,
        },

        // ─── Sistema de niveles ────────────────────────────────────────────
        // XP total acumulada — el nivel siempre se deriva de este valor
        xp: {
            type: Number,
            default: 0,
        },

        // Nivel actual (1-50), sincronizado con xp al otorgar XP.
        // Se guarda para poder indexar leaderboards por nivel.
        level: {
            type: Number,
            default: 1,
            index: true,
        },

        // XP ganada en el día actual (UTC) — usada para el límite diario
        xpToday: {
            type: Number,
            default: 0,
        },

        // Fecha de la última ganancia de XP (UTC) — resetea xpToday al cambiar de día
        xpTodayDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = model('User', UserSchema);
