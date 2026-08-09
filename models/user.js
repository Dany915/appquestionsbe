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

        // Plan del usuario — define los límites diarios de XP
        // free: intentos con XP limitados por día · pro: intentos ilimitados
        plan: {
            type: String,
            enum: ['free', 'pro'],
            default: 'free',
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

        // Intentos que ganaron XP en el día actual (UTC) — límite del plan free
        xpAttemptsToday: {
            type: Number,
            default: 0,
        },

        // Fecha de la última ganancia de XP (UTC) — resetea xpToday al cambiar de día
        xpTodayDate: {
            type: Date,
            default: null,
        },

        // Curso que el usuario está estudiando (cursoTag). Al entrar a
        // Practicar se va directo a sus módulos, sin volver a elegir.
        // null = todavía no ha seleccionado ninguno.
        cursoActivo: {
            type: String,
            default: null,
        },

        // ─── Marcos de avatar ──────────────────────────────────────────────
        // Ids "tema.estilo" (ej: "volcanic.static") que el usuario ha
        // desbloqueado. Se otorgan por logros; nunca se quitan.
        marcosDesbloqueados: {
            type: [String],
            default: [],
        },

        // Marco que lleva puesto. null = sin marco (avatar normal).
        // Debe estar dentro de marcosDesbloqueados.
        marcoEquipado: {
            type: String,
            default: null,
        },

        // Marcos desbloqueados que el usuario aún no ha visto celebrar.
        // Es una cola: da igual dónde se otorgaron (quiz, cierre semanal,
        // plan pro…), la app los muestra cuando puede y luego los marca vistos.
        marcosPendientesAviso: {
            type: [String],
            default: [],
        },

        // ─── Historial del ranking semanal ─────────────────────────────────
        // Se actualizan al cerrar cada semana. Alimentan los marcos dorados.

        // Veces que ha quedado nº 1 de la semana
        semanasTop1: {
            type: Number,
            default: 0,
        },

        // Semanas consecutivas dentro del top 3 (se reinicia si falla una)
        rachaTop3: {
            type: Number,
            default: 0,
        },

        // Inicio de la última semana en la que estuvo en top 3 — sirve para
        // saber si la siguiente es consecutiva
        ultimaSemanaTop3: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = model('User', UserSchema);
