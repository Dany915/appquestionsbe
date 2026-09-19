/**
 * Título y mensaje del resultado semanal según la posición final.
 *
 * Se escriben aquí (y no en la app) para poder cambiarlos sin publicar una
 * versión nueva. Cada grupo tiene variantes para que no se repita siempre la
 * misma frase; la variante sale de una semilla estable (usuario + semana), así
 * que el mensaje no cambia si la app pide el resultado dos veces.
 *
 * Grupos: nº 1 · podio (2-3) · top 10 · mitad superior · resto.
 */

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const TITULOS = {
    primero: ['¡Campeón de la semana!', '¡Nº 1 de la semana!'],
    podio:   ['¡Estuviste en el podio!', '¡Podio!'],
    top10:   ['¡Top 10!', '¡Entraste al top 10!'],
    mitad:   ['¡Buena semana!', '¡Vas por buen camino!'],
    resto:   ['Semana terminada', '¡Sigue sumando!'],
};

/** Índice estable a partir de un texto (usuario + semana). */
const variante = (semilla) => {
    let h = 0;
    for (const c of String(semilla)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
};

const elegir = (lista, semilla) => lista[variante(semilla) % lista.length];

/** XP que le faltaron para superar a quien tenía `xpObjetivo`. */
const faltaron = (xpObjetivo, xp) => Math.max(1, xpObjetivo - xp + 1);

/**
 * @param r  { posicion, totalParticipantes, xpSemana, posicionAnterior,
 *             xpPrimero, xpTercero, xpDecimo }
 * @param semilla texto estable para elegir variante (ej: userId + semana)
 * @returns {{ grupo, titulo, mensaje }}
 */
const mensajeResultado = (r, semilla = '') => {
    const { posicion: pos, totalParticipantes: total, xpSemana: xp } = r;
    const subio = r.posicionAnterior ? r.posicionAnterior - pos : 0;
    const deTotal = `Quedaste ${pos}º de ${total} jugadores.`;
    const subioTxt = subio > 0 ? `Subiste ${plural(subio, 'puesto', 'puestos')}.` : null;

    let grupo;
    let partes;

    if (pos === 1) {
        grupo = 'primero';
        if (r.posicionAnterior === 1) {
            return {
                grupo,
                titulo:  '¡Campeón otra vez!',
                mensaje: `Repetiste el nº 1 con ${xp} XP. Nadie sumó más que tú.`,
            };
        }
        partes = [total > 1
            ? `Nadie sumó más XP que tú: quedaste nº 1 de ${total} jugadores.`
            : `Terminaste en lo más alto del ranking con ${xp} XP.`];
    } else if (pos <= 3) {
        grupo = 'podio';
        partes = [deTotal, subioTxt || `Te faltaron ${faltaron(r.xpPrimero, xp)} XP para el nº 1.`];
    } else if (pos <= 10) {
        grupo = 'top10';
        partes = [deTotal, subioTxt || `Te faltaron ${faltaron(r.xpTercero, xp)} XP para el podio.`];
    } else if (pos <= Math.ceil(total / 2)) {
        grupo = 'mitad';
        partes = [deTotal, subioTxt || `Te faltaron ${faltaron(r.xpDecimo, xp)} XP para el top 10.`];
    } else {
        grupo = 'resto';
        partes = [deTotal, subioTxt || 'La nueva semana ya empezó: cada quiz cuenta.'];
    }

    return {
        grupo,
        titulo:  elegir(TITULOS[grupo], semilla),
        mensaje: partes.join(' '),
    };
};

module.exports = { mensajeResultado };
