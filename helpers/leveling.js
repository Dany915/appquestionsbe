const User = require('../models/user');

// ─── Configuración del sistema de niveles ──────────────────────────────────────
//
// Curva de XP: para pasar del nivel n al n+1 se necesitan (25 * n) XP.
//   Nivel 1→2:   25 XP   (se logra con el primer quiz — enganche inmediato)
//   Nivel 10→11: 250 XP  (~2 días de juego activo)
//   Nivel 49→50: 1225 XP (~10 días de juego activo)
//   Total para nivel 50: 30,625 XP (~6-8 meses jugando a diario)
//
// Anti-farming:
//   - La XP depende de la dificultad REAL de cada pregunta (calculada en el
//     servidor), no del nivel que el cliente declare en el body.
//   - Puerta de score: por debajo de SCORE_MINIMO_XP no se gana nada (responder
//     al azar con 4 opciones da ~25%); entre el mínimo y SCORE_XP_COMPLETA solo
//     se gana una fracción; los bonus exigen score >= SCORE_XP_COMPLETA.
//   - Límites por plan: los usuarios free tienen intentos con XP limitados por
//     día (pueden seguir jugando, pero ganan 0 XP); los pro no tienen límite de
//     intentos pero sí un tope diario de XP para proteger el ranking semanal.

const MAX_LEVEL = 50;

// XP por respuesta correcta según la dificultad real de la pregunta (1-4).
// Un quiz de máxima dificultad rinde ~2.7x más que uno básico.
const XP_POR_DIFICULTAD = { 1: 3, 2: 4, 3: 6, 4: 8 };

// Bonus por quiz (solo si score >= SCORE_XP_COMPLETA y >= MIN_PREGUNTAS_BONUS calificadas)
const XP_QUIZ_COMPLETADO = 10;  // por terminar un quiz
const XP_SCORE_ALTO      = 5;   // bonus si scorePercent >= 80
const XP_PERFECTO        = 10;  // bonus adicional si scorePercent === 100

// Los bonus de quiz solo aplican si se calificaron al menos estas preguntas
// (evita farmear el bonus con quizzes de 1 pregunta)
const MIN_PREGUNTAS_BONUS = 5;

// Puerta de score anti-farming
const SCORE_MINIMO_XP    = 40;   // debajo de esto → 0 XP (azar puro)
const SCORE_XP_COMPLETA  = 70;   // desde aquí → XP completa + bonus
const MULT_SCORE_PARCIAL = 0.4;  // entre 40% y 69% → solo el 40% de la XP base

// Límites diarios (UTC) según el plan del usuario
//   intentosConXpPorDia: null = ilimitado. Solo consumen cupo los intentos
//   que efectivamente ganaron XP — fallar un quiz no gasta intentos.
const LIMITES_PLAN = {
    free: { xpDiariaMax: 500,  intentosConXpPorDia: 5 },
    pro:  { xpDiariaMax: 1000, intentosConXpPorDia: null },
};

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
 *
 * XP base = suma de XP_POR_DIFICULTAD por cada correcta, multiplicada por la
 * puerta de score (0 si < 40%, 40% si está entre 40-69%, completa si >= 70%).
 * Los bonus exigen score >= 70% y al menos MIN_PREGUNTAS_BONUS calificadas.
 */
const calcularXpQuiz = (respuestas, scorePercent, totalGraded) => {
    const xpBase = respuestas.reduce(
        (acc, r) => acc + (r.isCorrect ? (XP_POR_DIFICULTAD[r.difficulty] || XP_POR_DIFICULTAD[1]) : 0),
        0
    );

    let multiplicadorScore = 1;
    if (scorePercent < SCORE_MINIMO_XP) {
        multiplicadorScore = 0;
    } else if (scorePercent < SCORE_XP_COMPLETA) {
        multiplicadorScore = MULT_SCORE_PARCIAL;
    }

    const respuestasCorrectas = Math.round(xpBase * multiplicadorScore);

    let quizCompletado = 0;
    let scoreAlto      = 0;
    let perfecto       = 0;

    if (totalGraded >= MIN_PREGUNTAS_BONUS && scorePercent >= SCORE_XP_COMPLETA) {
        quizCompletado = XP_QUIZ_COMPLETADO;
        if (scorePercent >= 80)   scoreAlto = XP_SCORE_ALTO;
        if (scorePercent === 100) perfecto  = XP_PERFECTO;
    }

    return {
        respuestasCorrectas,
        quizCompletado,
        scoreAlto,
        perfecto,
        multiplicadorScore,
        total: respuestasCorrectas + quizCompletado + scoreAlto + perfecto,
    };
};

// ─── Otorgar XP a un usuario ───────────────────────────────────────────────────

/**
 * Suma XP al usuario respetando los límites de su plan y actualiza su nivel.
 *
 * Límites aplicados en orden:
 *   1. Cupo de intentos con XP del día (solo plan free) → si se agotó, 0 XP
 *   2. Tope diario de XP del plan → recorta lo que exceda
 *
 * Solo los intentos que efectivamente ganaron XP consumen cupo diario.
 * Retorna la info necesaria para animaciones de subida de nivel/rango,
 * o null si el usuario no existe.
 */
const otorgarXp = async (userId, xpGanada) => {
    const user = await User.findById(userId);
    if (!user) return null;

    const limites = LIMITES_PLAN[user.plan] || LIMITES_PLAN.free;

    // XP e intentos acumulados hoy (UTC) — se resetean al cambiar de día
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    let xpHoy       = 0;
    let intentosHoy = 0;

    if (user.xpTodayDate) {
        const ultimoDia = new Date(user.xpTodayDate);
        ultimoDia.setUTCHours(0, 0, 0, 0);
        if (ultimoDia.getTime() === hoy.getTime()) {
            xpHoy       = user.xpToday;
            intentosHoy = user.xpAttemptsToday;
        }
    }

    const sinCupoIntentos =
        limites.intentosConXpPorDia !== null && intentosHoy >= limites.intentosConXpPorDia;

    let xpAplicada = 0;
    if (!sinCupoIntentos) {
        const disponibleHoy = Math.max(0, limites.xpDiariaMax - xpHoy);
        xpAplicada = Math.min(xpGanada, disponibleHoy);
    }

    const consumeIntento = xpAplicada > 0;

    const xpAntes      = user.xp;
    const xpDespues    = xpAntes + xpAplicada;
    const nivelAntes   = nivelDesdeXp(xpAntes);
    const nivelDespues = nivelDesdeXp(xpDespues);
    const rangoAntes   = rangoDeNivel(nivelAntes);
    const rangoDespues = rangoDeNivel(nivelDespues);

    await User.findByIdAndUpdate(userId, {
        xp:              xpDespues,
        level:           nivelDespues,
        xpToday:         xpHoy + xpAplicada,
        xpAttemptsToday: intentosHoy + (consumeIntento ? 1 : 0),
        xpTodayDate:     new Date(),
    });

    const intentosRestantes = limites.intentosConXpPorDia === null
        ? null
        : Math.max(0, limites.intentosConXpPorDia - intentosHoy - (consumeIntento ? 1 : 0));

    return {
        xpAplicada,
        limiteDiarioAlcanzado:   !sinCupoIntentos && xpAplicada < xpGanada,
        limiteIntentosAlcanzado: sinCupoIntentos,
        intentosConXpRestantes:  intentosRestantes,   // null = ilimitado (pro)
        plan: user.plan || 'free',
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
    LIMITES_PLAN,
    rangoDeNivel,
    xpParaSiguienteNivel,
    xpTotalParaNivel,
    nivelDesdeXp,
    progresoNivel,
    calcularXpQuiz,
    otorgarXp,
};
