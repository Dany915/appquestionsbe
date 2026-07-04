const User = require('../models/user');

// ─── Configuración del sistema de niveles ──────────────────────────────────────
//
// Curva de XP: para pasar del nivel n al n+1 se necesitan (25 * n) XP.
//   Nivel 1→2:   25 XP   (se logra con el primer quiz — enganche inmediato)
//   Nivel 10→11: 250 XP  (~2 días de juego activo)
//   Nivel 49→50: 1225 XP (~10 días de juego activo)
//   Total para nivel 50: 30,625 XP (~6-8 meses jugando a diario)
//
// El límite diario de XP (XP_DIARIA_MAX) evita que alguien llegue al nivel
// máximo en pocas semanas a base de farmear quizzes.

const MAX_LEVEL = 50;

// XP que otorga cada acción
const XP_BASE_CORRECTA   = 2;   // por respuesta correcta (+ dificultad de la pregunta 1-4 → 3 a 6 XP)
const XP_QUIZ_COMPLETADO = 10;  // por terminar un quiz
const XP_SCORE_ALTO      = 5;   // bonus si scorePercent >= 80
const XP_PERFECTO        = 10;  // bonus adicional si scorePercent === 100

// Los bonus de quiz solo aplican si se calificaron al menos estas preguntas
// (evita farmear el bonus con quizzes de 1 pregunta)
const MIN_PREGUNTAS_BONUS = 5;

// Máximo de XP que un usuario puede ganar por día (UTC)
const XP_DIARIA_MAX = 500;

// ─── Rangos ────────────────────────────────────────────────────────────────────
// Un rango cada 5 niveles. El usuario nunca ve el nivel máximo,
// solo su nivel, su XP y el nombre de su rango actual.

const RANGOS = [
    'Novato',        // 1-4
    'Aprendiz',      // 5-9
    'Explorador',    // 10-14
    'Estudioso',     // 15-19
    'Conocedor',     // 20-24
    'Erudito',       // 25-29
    'Maestro',       // 30-34
    'Gran Maestro',  // 35-39
    'Sabio',         // 40-44
    'Leyenda',       // 45-50
];

const rangoDeNivel = (nivel) => {
    // Niveles 1-4 → índice 0, 5-9 → 1, 10-14 → 2, ... 45-50 → 9
    const index = Math.min(Math.floor(nivel / 5), RANGOS.length - 1);
    return RANGOS[index];
};

// ─── Cálculos de nivel ─────────────────────────────────────────────────────────

// XP necesaria para pasar del nivel n al n+1 (null si ya está en el máximo)
const xpParaSiguienteNivel = (nivel) => (nivel >= MAX_LEVEL ? null : 25 * nivel);

// XP total acumulada necesaria para estar en el nivel n (nivel 1 = 0 XP)
// Suma de 25*k para k=1..n-1 → siempre entero porque n*(n-1) es par
const xpTotalParaNivel = (nivel) => 12.5 * nivel * (nivel - 1);

// Nivel que corresponde a una cantidad de XP total (tope en MAX_LEVEL)
const nivelDesdeXp = (xpTotal) => {
    let nivel = 1;
    while (nivel < MAX_LEVEL && xpTotal >= xpTotalParaNivel(nivel + 1)) {
        nivel++;
    }
    return nivel;
};

/**
 * Estado de progreso listo para mostrar en la app:
 * nivel, rango, XP total, XP dentro del nivel actual y % de la barra de progreso.
 * No expone el nivel máximo — en nivel 50, xpParaSubir es null y la barra queda al 100%.
 */
const progresoNivel = (xpTotal) => {
    const nivel       = nivelDesdeXp(xpTotal);
    const xpEnNivel   = xpTotal - xpTotalParaNivel(nivel);
    const xpParaSubir = xpParaSiguienteNivel(nivel);

    const progressPercent = xpParaSubir === null
        ? 100
        : Math.min(100, Math.round((xpEnNivel / xpParaSubir) * 100));

    return {
        nivel,
        rango: rangoDeNivel(nivel),
        xpTotal,
        xpEnNivel,
        xpParaSubir,
        progressPercent,
    };
};

// ─── XP de un quiz calificado ──────────────────────────────────────────────────

/**
 * Calcula la XP ganada en un quiz a partir de las respuestas calificadas.
 * Cada correcta vale XP_BASE_CORRECTA + dificultad de la pregunta (1-4).
 * Los bonus solo aplican con al menos MIN_PREGUNTAS_BONUS preguntas calificadas.
 */
const calcularXpQuiz = (respuestas, scorePercent, totalGraded) => {
    const respuestasCorrectas = respuestas.reduce(
        (acc, r) => acc + (r.isCorrect ? XP_BASE_CORRECTA + (r.difficulty || 1) : 0),
        0
    );

    let quizCompletado = 0;
    let scoreAlto      = 0;
    let perfecto       = 0;

    if (totalGraded >= MIN_PREGUNTAS_BONUS) {
        quizCompletado = XP_QUIZ_COMPLETADO;
        if (scorePercent >= 80)   scoreAlto = XP_SCORE_ALTO;
        if (scorePercent === 100) perfecto  = XP_PERFECTO;
    }

    return {
        respuestasCorrectas,
        quizCompletado,
        scoreAlto,
        perfecto,
        total: respuestasCorrectas + quizCompletado + scoreAlto + perfecto,
    };
};

// ─── Otorgar XP a un usuario ───────────────────────────────────────────────────

/**
 * Suma XP al usuario respetando el límite diario y actualiza su nivel.
 * Retorna la info necesaria para que la app muestre animaciones de
 * subida de nivel / rango, o null si el usuario no existe.
 */
const otorgarXp = async (userId, xpGanada) => {
    const user = await User.findById(userId);
    if (!user) return null;

    // XP acumulada hoy (UTC) para aplicar el límite diario
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    let xpHoy = 0;
    if (user.xpTodayDate) {
        const ultimoDia = new Date(user.xpTodayDate);
        ultimoDia.setUTCHours(0, 0, 0, 0);
        if (ultimoDia.getTime() === hoy.getTime()) {
            xpHoy = user.xpToday;
        }
    }

    const disponibleHoy = Math.max(0, XP_DIARIA_MAX - xpHoy);
    const xpAplicada    = Math.min(xpGanada, disponibleHoy);

    const xpAntes      = user.xp;
    const xpDespues    = xpAntes + xpAplicada;
    const nivelAntes   = nivelDesdeXp(xpAntes);
    const nivelDespues = nivelDesdeXp(xpDespues);
    const rangoAntes   = rangoDeNivel(nivelAntes);
    const rangoDespues = rangoDeNivel(nivelDespues);

    await User.findByIdAndUpdate(userId, {
        xp:          xpDespues,
        level:       nivelDespues,
        xpToday:     xpHoy + xpAplicada,
        xpTodayDate: new Date(),
    });

    return {
        xpAplicada,
        limiteDiarioAlcanzado: xpAplicada < xpGanada,
        nivelAntes,
        nivelDespues,
        subioNivel: nivelDespues > nivelAntes,
        rangoAntes,
        rangoDespues,
        subioRango: rangoDespues !== rangoAntes,
        progreso:   progresoNivel(xpDespues),
    };
};

module.exports = {
    MAX_LEVEL,
    RANGOS,
    rangoDeNivel,
    xpParaSiguienteNivel,
    xpTotalParaNivel,
    nivelDesdeXp,
    progresoNivel,
    calcularXpQuiz,
    otorgarXp,
};
