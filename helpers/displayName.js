/**
 * Nombre visible del usuario (label).
 *
 * `username` es el identificador único e inmutable (el que se generó desde
 * Google o el que eligió al registrarse). `displayName` es solo la etiqueta
 * que se muestra en la app: no es única y el usuario puede cambiarla.
 * Si es null, se muestra el username.
 */

// Días que debe esperar el usuario entre un cambio de nombre y el siguiente
const DIAS_ENTRE_CAMBIOS = 7;

const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

// Letras de cualquier idioma (tildes, ñ), números, espacio y _ . -
// Al ser una lista blanca también bloquea caracteres invisibles (zero-width)
// y marcas RTL, que no entran en ninguna de estas categorías.
const CARACTERES_PERMITIDOS = /^[\p{L}\p{N} _.\-]+$/u;

// Evita que el label se use para meter enlaces en el ranking
const PARECE_URL = /(https?:\/\/|www\.|\.(com|net|org|co|io|app|es|xyz|me|tv|link)\b)/i;

// Palabras que no puede contener el nombre para no hacerse pasar por el equipo
const RESERVADAS = new Set([
    'admin', 'administrador', 'administradora',
    'moderador', 'moderadora', 'mod',
    'soporte', 'oficial', 'sistema', 'staff',
]);

/**
 * Nombre que se muestra en la app. Nunca devuelve vacío.
 */
const nombreVisible = (user) => user?.displayName || user?.username || 'Usuario';

/**
 * Normaliza y valida un displayName.
 * Retorna { ok: true, value } con el nombre limpio, o { ok: false, msg }.
 */
const validarDisplayName = (raw) => {
    if (typeof raw !== 'string') {
        return { ok: false, msg: 'El nombre es requerido.' };
    }

    // Recortar y colapsar espacios múltiples
    const value = raw.trim().replace(/\s+/g, ' ');

    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
        return { ok: false, msg: `El nombre debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres.` };
    }

    if (!CARACTERES_PERMITIDOS.test(value)) {
        return { ok: false, msg: 'El nombre solo puede tener letras, números, espacios y los símbolos _ . -' };
    }

    if (PARECE_URL.test(value)) {
        return { ok: false, msg: 'El nombre no puede contener enlaces.' };
    }

    // Se compara por palabras para bloquear "Admin Dany" pero permitir "Adminta"
    const palabras = value.toLowerCase().split(/[^\p{L}\p{N}]+/u);
    if (palabras.some((p) => RESERVADAS.has(p))) {
        return { ok: false, msg: 'Ese nombre está reservado.' };
    }

    return { ok: true, value };
};

/**
 * Fecha a partir de la cual el usuario puede volver a cambiar su nombre.
 * null = puede cambiarlo ahora (nunca lo ha cambiado o ya pasó la espera).
 */
const proximoCambioNombre = (user) => {
    if (!user?.displayNameChangedAt) return null;

    const proximo = new Date(user.displayNameChangedAt);
    proximo.setUTCDate(proximo.getUTCDate() + DIAS_ENTRE_CAMBIOS);

    return proximo > new Date() ? proximo : null;
};

module.exports = {
    DIAS_ENTRE_CAMBIOS,
    MIN_LENGTH,
    MAX_LENGTH,
    nombreVisible,
    validarDisplayName,
    proximoCambioNombre,
};
