const { otorgarAvatars } = require('./avatars');

// ─── Qué desbloquea cada avatar ────────────────────────────────────────────────
//
// Los avatares son el camino ACCESIBLE: lo primero cae en los primeros días y
// cada personaje premia una forma distinta de jugar, para que no todo dependa
// de jugar mucho. Los marcos siguen siendo el prestigio (helpers/frameRewards).
//
//   zorro  → volumen de quizzes
//   gato   → respuestas correctas
//   dragón → precisión, tiempo de práctica y nivel
//
// `condicion` es el texto que la app pinta en gris bajo el avatar bloqueado, y
// esta tabla es su única fuente: el catálogo de helpers/avatars.js solo dice
// qué avatares existen.
//
// Las estadísticas las calcula helpers/logros.js. Un "quiz" cuenta solo si
// tuvo 5 preguntas o más, para que no se farmeen encadenando quizzes de una.

const AVATARES_LOGRO = [
    // Zorro · volumen
    { id: 'zorro/zorro_gafas',   condicion: 'Resuelve 10 quizzes',  cumple: (s) => s.quizzes >= 10 },
    { id: 'zorro/zorro_gorra',   condicion: 'Resuelve 50 quizzes',  cumple: (s) => s.quizzes >= 50 },
    { id: 'zorro/zorro_enojado', condicion: 'Resuelve 150 quizzes', cumple: (s) => s.quizzes >= 150 },

    // Gato · aciertos
    { id: 'gato/gatorosa_gafas',   condicion: 'Acierta 100 preguntas',   cumple: (s) => s.correctas >= 100 },
    { id: 'gato/gatorosa_gorra',   condicion: 'Acierta 500 preguntas',   cumple: (s) => s.correctas >= 500 },
    { id: 'gato/gatorosa_enojado', condicion: 'Acierta 1.500 preguntas', cumple: (s) => s.correctas >= 1500 },

    // Dragón · precisión, dedicación y nivel
    { id: 'dragon/dragon_confiado_01', condicion: 'Haz 3 quizzes perfectos de 10+ preguntas',  cumple: (s) => s.perfectos >= 3 },
    { id: 'dragon/dragon_confiado_02', condicion: 'Haz 15 quizzes perfectos de 10+ preguntas', cumple: (s) => s.perfectos >= 15 },
    { id: 'dragon/dragon_frio_01',     condicion: 'Practica 1 hora en total',                  cumple: (s) => s.horas >= 1 },
    { id: 'dragon/dragon_frio_02',     condicion: 'Practica 5 horas en total',                 cumple: (s) => s.horas >= 5 },
    { id: 'dragon/dragon_gorra_01',    condicion: 'Llega al nivel 5',                          cumple: (s) => s.nivel >= 5 },
    { id: 'dragon/dragon_gorra_02',    condicion: 'Llega al nivel 15',                         cumple: (s) => s.nivel >= 15 },
];

const porId = new Map(AVATARES_LOGRO.map((a) => [a.id, a]));

/** Texto de la condición de un avatar, o null si aún no tiene logro asignado. */
const condicionDeAvatar = (id) => porId.get(id)?.condicion || null;

/** Ids de los avatares que corresponden a unas estadísticas. */
const avataresPorEstadisticas = (stats) =>
    AVATARES_LOGRO.filter((a) => a.cumple(stats)).map((a) => a.id);

/** true si al usuario aún le falta algún avatar de logro. */
const faltanAvatares = (desbloqueados = []) => {
    const tiene = new Set(desbloqueados);
    return AVATARES_LOGRO.some((a) => !tiene.has(a.id));
};

/**
 * Otorga los avatares que ya se haya ganado. Idempotente: `otorgarAvatars`
 * ignora los que ya tiene. Devuelve solo los nuevos, para celebrarlos.
 */
const evaluarAvatares = async (userId, stats) => {
    const candidatos = avataresPorEstadisticas(stats);
    if (candidatos.length === 0) return [];
    return otorgarAvatars(userId, candidatos);
};

module.exports = {
    AVATARES_LOGRO,
    condicionDeAvatar,
    avataresPorEstadisticas,
    faltanAvatares,
    evaluarAvatares,
};
