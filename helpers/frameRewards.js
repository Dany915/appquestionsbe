const Attempt = require('../models/attempt');
const User    = require('../models/user');
const { otorgarMarcos } = require('./frames');

// ─── Qué marco entrega cada logro ──────────────────────────────────────────────
//
// Convención de rareza (de menor a mayor): static < breathe < shimmer < pulse
// < sparkle < rays. Cada familia de logros usa un tema de color propio.
//
// Estado actual:
//   aurora.*                  → rachas de días consecutivos   [IMPLEMENTADO]
//   gold.*                    → ranking semanal               [IMPLEMENTADO]
//   blue_star/nebula static   → primer quiz superado          [IMPLEMENTADO]
//   blue_star/nebula breathe  → primer quiz superado          [IMPLEMENTADO]
//   blue_star shimmer→rays    → volumen y maestría en quizzes [IMPLEMENTADO]
//   resto                     → pendiente de asignar
//
// Añadir una categoría nueva = añadir su tabla aquí y llamar al evaluador
// correspondiente. Nada más del backend necesita cambiar.

/** Racha de días consecutivos → marco. Orden ascendente obligatorio. */
const MARCOS_RACHA = [
    { dias: 7,   marco: 'aurora.static'  },
    { dias: 30,  marco: 'aurora.breathe' },
    { dias: 50,  marco: 'aurora.shimmer' },
    { dias: 100, marco: 'aurora.pulse'   },
    { dias: 150, marco: 'aurora.sparkle' },
    { dias: 200, marco: 'aurora.rays'    },
];

/**
 * Primer quiz superado en cada dificultad → marco.
 * "Superado" = score >= SCORE_MINIMO_APROBADO.
 *
 * No hace falta comprobar que sea el primero: `otorgarMarcos` es idempotente,
 * así que a partir del segundo intento la concesión no hace nada.
 */
const MARCOS_PRIMER_QUIZ = {
    curioso:   'blue_star.static',
    analitico: 'nebula.static',
    estratega: 'blue_star.breathe',
    genio:     'nebula.breathe',
};

const SCORE_MINIMO_APROBADO = 70;

// Un quiz solo cuenta para estos logros si tuvo suficientes preguntas: evita
// farmear marcos encadenando quizzes de 5 preguntas.
const MIN_PREGUNTAS_MARCO = 10;

/**
 * Logros por volumen y maestría acumulada en quizzes.
 * Todos exigen quizzes de al menos MIN_PREGUNTAS_MARCO preguntas.
 */
const MARCOS_QUIZZES = {
    // Constancia: quizzes aprobados (>= 70%) en cualquier dificultad
    aprobados20: { marco: 'blue_star.shimmer', cantidad: 20 },
    aprobados50: { marco: 'blue_star.pulse',   cantidad: 50 },
    // Maestría: quizzes perfectos (100%) en las dificultades altas
    perfectosAltos: {
        marco: 'blue_star.sparkle',
        cantidad: 30,
        niveles: ['estratega', 'genio'],
    },
    perfectosGenio: {
        marco: 'blue_star.rays',
        cantidad: 25,
        niveles: ['genio'],
    },
};

/** Logros del ranking semanal → marco. */
const MARCOS_RANKING = {
    top10:          'gold.static',   // entrar al top 10 de la semana
    top3:           'gold.breathe',  // entrar al top 3
    top1:           'gold.shimmer',  // quedar nº 1
    top1x3:         'gold.pulse',    // nº 1 en 3 semanas distintas
    top1x10:        'gold.sparkle',  // nº 1 en 10 semanas distintas
    top3Seguidas5:  'gold.rays',     // top 3 durante 5 semanas seguidas
};

// ─── Evaluadores ───────────────────────────────────────────────────────────────

/**
 * Marcos que corresponden a una racha. Devuelve TODOS los umbrales alcanzados,
 * no solo el último: así un usuario que llegue a 50 sin haber pasado por la app
 * en el hito de 30 recibe ambos.
 */
const marcosPorRacha = (racha) =>
    MARCOS_RACHA.filter((m) => racha >= m.dias).map((m) => m.marco);

/**
 * Evalúa y otorga los marcos de racha. Idempotente: `otorgarMarcos` ignora los
 * que el usuario ya tenga. Devuelve solo los recién desbloqueados.
 */
const evaluarMarcosRacha = async (userId, racha) => {
    const candidatos = marcosPorRacha(racha);
    if (candidatos.length === 0) return [];
    return otorgarMarcos(userId, candidatos);
};

/**
 * Evalúa y otorga el marco de "primer quiz superado" de una dificultad.
 * Devuelve el marco si es la primera vez que lo consigue, o [] si ya lo tenía
 * o no llegó al mínimo.
 */
const evaluarMarcosPrimerQuiz = async (userId, nivel, scorePercent) => {
    if (scorePercent < SCORE_MINIMO_APROBADO) return [];
    const marco = MARCOS_PRIMER_QUIZ[nivel];
    if (!marco) return [];
    return otorgarMarcos(userId, marco);
};

/**
 * Evalúa los marcos por volumen y maestría acumulada.
 *
 * Solo recuenta cuando el quiz recién calificado puede haber movido algún
 * contador (suficientes preguntas y aprobado), y solo consulta los criterios
 * cuyo marco el usuario aún no tiene. Así el coste habitual es cero consultas.
 */
const evaluarMarcosQuizzes = async (userId, { scorePercent, totalGraded, nivel }) => {
    // Ningún criterio se cumple con quizzes cortos o suspendidos
    if (totalGraded < MIN_PREGUNTAS_MARCO) return [];
    if (scorePercent < SCORE_MINIMO_APROBADO) return [];

    const user = await User.findById(userId, 'marcosDesbloqueados');
    const tiene = new Set(user?.marcosDesbloqueados || []);

    const base = {
        userId,
        totalGraded: { $gte: MIN_PREGUNTAS_MARCO },
    };
    const candidatos = [];

    // ── Constancia: quizzes aprobados ──
    const { aprobados20, aprobados50 } = MARCOS_QUIZZES;
    const faltaAprobados =
        !tiene.has(aprobados20.marco) || !tiene.has(aprobados50.marco);

    if (faltaAprobados) {
        const aprobados = await Attempt.countDocuments({
            ...base,
            scorePercent: { $gte: SCORE_MINIMO_APROBADO },
        });
        if (aprobados >= aprobados20.cantidad) candidatos.push(aprobados20.marco);
        if (aprobados >= aprobados50.cantidad) candidatos.push(aprobados50.marco);
    }

    // ── Maestría: solo si este quiz fue perfecto ──
    if (scorePercent === 100) {
        for (const clave of ['perfectosAltos', 'perfectosGenio']) {
            const regla = MARCOS_QUIZZES[clave];
            if (tiene.has(regla.marco)) continue;
            // Si el quiz no es de esos niveles, el contador no ha cambiado
            if (!regla.niveles.includes(nivel)) continue;

            const perfectos = await Attempt.countDocuments({
                ...base,
                scorePercent: 100,
                nivel: { $in: regla.niveles },
            });
            if (perfectos >= regla.cantidad) candidatos.push(regla.marco);
        }
    }

    if (candidatos.length === 0) return [];
    return otorgarMarcos(userId, candidatos);
};

/**
 * Marcos que corresponden al cierre de una semana, según la posición obtenida
 * y los contadores históricos del usuario.
 *
 * @param posicion       posición final en la semana (1 = primero)
 * @param semanasTop1    veces que ha sido nº 1 (contando esta)
 * @param rachaTop3      semanas seguidas en top 3 (contando esta)
 */
const marcosPorRanking = ({ posicion, semanasTop1, rachaTop3 }) => {
    const marcos = [];

    if (posicion <= 10) marcos.push(MARCOS_RANKING.top10);
    if (posicion <= 3)  marcos.push(MARCOS_RANKING.top3);
    if (posicion === 1) marcos.push(MARCOS_RANKING.top1);

    if (semanasTop1 >= 3)  marcos.push(MARCOS_RANKING.top1x3);
    if (semanasTop1 >= 10) marcos.push(MARCOS_RANKING.top1x10);
    if (rachaTop3   >= 5)  marcos.push(MARCOS_RANKING.top3Seguidas5);

    return marcos;
};

// ─── Catálogo visible para el usuario ──────────────────────────────────────────
//
// SOLO los marcos con condición asignada. Los que aún no tienen recompensa
// definida no se exponen: el usuario no debe ver marcos imposibles de obtener.
//
// El orden es el de la pantalla "Mis marcos": por categoría y de menor a mayor
// dificultad dentro de cada una.

const CATALOGO_MARCOS = [
    // Primeros pasos
    { id: 'blue_star.static',  categoria: 'Primeros pasos', condicion: 'Supera tu primer quiz de Curioso' },
    { id: 'nebula.static',     categoria: 'Primeros pasos', condicion: 'Supera tu primer quiz de Analítico' },
    { id: 'blue_star.breathe', categoria: 'Primeros pasos', condicion: 'Supera tu primer quiz de Estratega' },
    { id: 'nebula.breathe',    categoria: 'Primeros pasos', condicion: 'Supera tu primer quiz de Genio' },

    // Constancia
    { id: 'aurora.static',  categoria: 'Constancia', condicion: 'Mantén una racha de 7 días' },
    { id: 'aurora.breathe', categoria: 'Constancia', condicion: 'Mantén una racha de 30 días' },
    { id: 'aurora.shimmer', categoria: 'Constancia', condicion: 'Mantén una racha de 50 días' },
    { id: 'aurora.pulse',   categoria: 'Constancia', condicion: 'Mantén una racha de 100 días' },
    { id: 'aurora.sparkle', categoria: 'Constancia', condicion: 'Mantén una racha de 150 días' },
    { id: 'aurora.rays',    categoria: 'Constancia', condicion: 'Mantén una racha de 200 días' },

    // Dominio
    { id: 'blue_star.shimmer', categoria: 'Dominio', condicion: 'Aprueba 20 quizzes de 10+ preguntas' },
    { id: 'blue_star.pulse',   categoria: 'Dominio', condicion: 'Aprueba 50 quizzes de 10+ preguntas' },
    { id: 'blue_star.sparkle', categoria: 'Dominio', condicion: '30 quizzes perfectos en Estratega o Genio' },
    { id: 'blue_star.rays',    categoria: 'Dominio', condicion: '25 quizzes perfectos en Genio' },

    // Ranking semanal
    { id: 'gold.static',  categoria: 'Ranking semanal', condicion: 'Entra al top 10 de la semana' },
    { id: 'gold.breathe', categoria: 'Ranking semanal', condicion: 'Entra al top 3 de la semana' },
    { id: 'gold.shimmer', categoria: 'Ranking semanal', condicion: 'Queda nº 1 de la semana' },
    { id: 'gold.pulse',   categoria: 'Ranking semanal', condicion: 'Sé nº 1 en 3 semanas' },
    { id: 'gold.sparkle', categoria: 'Ranking semanal', condicion: 'Sé nº 1 en 10 semanas' },
    { id: 'gold.rays',    categoria: 'Ranking semanal', condicion: 'Top 3 durante 5 semanas seguidas' },
];

/** Condición de un marco, o null si no está asignado. */
const condicionDeMarco = (id) =>
    CATALOGO_MARCOS.find((m) => m.id === id) || null;

module.exports = {
    CATALOGO_MARCOS,
    condicionDeMarco,
    MARCOS_RACHA,
    MARCOS_RANKING,
    MARCOS_PRIMER_QUIZ,
    MARCOS_QUIZZES,
    SCORE_MINIMO_APROBADO,
    MIN_PREGUNTAS_MARCO,
    marcosPorRacha,
    evaluarMarcosRacha,
    evaluarMarcosPrimerQuiz,
    evaluarMarcosQuizzes,
    marcosPorRanking,
};
