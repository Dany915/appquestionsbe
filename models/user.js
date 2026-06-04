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
    },
    { timestamps: true }
);

module.exports = model('User', UserSchema);
