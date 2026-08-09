const User = require('../models/user');

// ─── Catálogo de marcos de avatar ──────────────────────────────────────────────
//
// 6 temas x 6 estilos = 36 marcos. El id es "<tema>.<estilo>" y es el contrato
// con Flutter: el backend solo guarda ids, el cliente sabe cómo dibujarlos.
//
// Este catálogo existe para VALIDAR: que nadie equipe un marco inventado ni se
// otorgue un id que el cliente no sabría pintar.

const FRAME_THEMES = ['gold', 'blue_star', 'aurora', 'volcanic', 'nebula', 'rainbow'];
const FRAME_STYLES = ['static', 'breathe', 'shimmer', 'pulse', 'sparkle', 'rays'];

const FRAME_IDS = FRAME_THEMES.flatMap(
    (tema) => FRAME_STYLES.map((estilo) => `${tema}.${estilo}`)
);

const esMarcoValido = (id) => typeof id === 'string' && FRAME_IDS.includes(id);

/**
 * Otorga marcos a un usuario. Idempotente: usa $addToSet, así que repetir la
 * llamada no duplica nada y es seguro invocarla en cada evaluación de logros.
 *
 * Devuelve solo los marcos que el usuario NO tenía (los recién desbloqueados),
 * para que la app pueda celebrarlos.
 */
const otorgarMarcos = async (userId, ids) => {
    const validos = (Array.isArray(ids) ? ids : [ids]).filter(esMarcoValido);
    if (validos.length === 0) return [];

    // Se consulta antes para saber cuáles son nuevos de verdad
    const user = await User.findById(userId, 'marcosDesbloqueados');
    if (!user) return [];

    const yaTiene = new Set(user.marcosDesbloqueados || []);
    const nuevos  = validos.filter((id) => !yaTiene.has(id));
    if (nuevos.length === 0) return [];

    await User.findByIdAndUpdate(userId, {
        $addToSet: {
            marcosDesbloqueados: { $each: nuevos },
            // Cola de avisos: se muestran cuando la app pueda, sin importar
            // dónde se otorgaron (quiz, cierre semanal, compra…).
            marcosPendientesAviso: { $each: nuevos },
        },
    });

    return nuevos;
};

module.exports = {
    FRAME_THEMES,
    FRAME_STYLES,
    FRAME_IDS,
    esMarcoValido,
    otorgarMarcos,
};
