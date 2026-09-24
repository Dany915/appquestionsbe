const User = require('../models/user');

// ─── Catálogo de avatares ──────────────────────────────────────────────────────
//
// Las ilustraciones viven en la app Flutter, en assets/avatar/. El backend
// nunca ve una imagen: solo guarda ids. El id es la ruta dentro de esa carpeta
// sin extensión, y es el contrato con Flutter:
//
//   'zorro/zorro_gafas'  →  assets/avatar/zorro/zorro_gafas.webp
//
// Así la app resuelve el archivo sin tablas ni consultas, y mover una
// ilustración de carpeta es solo cambiar su id aquí.
//
// acceso:
//   free  → lo puede usar cualquiera; no hay nada que desbloquear
//   pro   → se otorga al activar el plan pro y se queda para siempre
//   logro → se otorga al cumplir su condición y se queda para siempre
//
// La condición que la app enseña bajo cada avatar bloqueado sale de
// helpers/avatarRewards.js, que es donde vive la tabla de logros. Un avatar
// sin logro asignado se muestra como "Próximamente" y solo se puede conceder
// a mano (POST /api/avatars/otorgar).
//
// Este catálogo existe para VALIDAR (que nadie equipe un avatar que la app no
// tiene) y para que la app pinte en gris los que faltan, con su condición.

const CATEGORIAS_AVATAR = {
    zorro:  'Zorro',
    gato:   'Gatos',
    dragon: 'Dragón',
    llama:  'Llamas',
    pro:    'Plan Pro',
};

/**
 * Qué se le enseña al usuario bajo un avatar bloqueado cuando no tiene logro
 * asignado en helpers/avatarRewards.js. Los de pago no son un "próximamente":
 * ya se pueden conseguir, solo que pagando.
 *
 * Máximo 25 caracteres — es lo que cabe en la celda del selector
 * (MAX_LARGO_CONDICION en helpers/avatarRewards.js).
 */
const CONDICION_POR_DEFECTO = {
    pro:   'Incluido en el plan Pro',
    logro: 'Próximamente',
};

const CATALOGO_AVATARES = [
    // Gratuitos: el "default" de cada personaje
    { id: 'zorro/zorro_default',       nombre: 'Zorro',      categoria: 'zorro',  acceso: 'free' },
    { id: 'gato/gatorosa_default',     nombre: 'Gato rosa',  categoria: 'gato',   acceso: 'free' },
    { id: 'gato/gatarosa_default',     nombre: 'Gata rosa',  categoria: 'gato',   acceso: 'free' },
    { id: 'gato/gatonegro_default',    nombre: 'Gato negro', categoria: 'gato',   acceso: 'free' },
    { id: 'dragon/dragon_default_01',  nombre: 'Dragón',     categoria: 'dragon', acceso: 'free' },
    { id: 'dragon/dragon_default_02',  nombre: 'Dragón',     categoria: 'dragon', acceso: 'free' },

    // Desbloqueables: pendientes de asignar su logro
    { id: 'zorro/zorro_gafas',     nombre: 'Zorro cool',      categoria: 'zorro', acceso: 'logro' },
    { id: 'zorro/zorro_gorra',     nombre: 'Zorro con gorra', categoria: 'zorro', acceso: 'logro' },
    { id: 'zorro/zorro_enojado',   nombre: 'Zorro enojado',   categoria: 'zorro', acceso: 'logro' },
    { id: 'gato/gatorosa_gafas',   nombre: 'Gato cool',       categoria: 'gato',  acceso: 'logro' },
    { id: 'gato/gatorosa_gorra',   nombre: 'Gato con gorra',  categoria: 'gato',  acceso: 'logro' },
    { id: 'gato/gatorosa_enojado', nombre: 'Gato enojado',    categoria: 'gato',  acceso: 'logro' },
    { id: 'dragon/dragon_confiado_01', nombre: 'Dragón confiado', categoria: 'dragon', acceso: 'logro' },
    { id: 'dragon/dragon_confiado_02', nombre: 'Dragón confiado', categoria: 'dragon', acceso: 'logro' },
    { id: 'dragon/dragon_frio_01',     nombre: 'Dragón frío',     categoria: 'dragon', acceso: 'logro' },
    { id: 'dragon/dragon_frio_02',     nombre: 'Dragón frío',     categoria: 'dragon', acceso: 'logro' },
    { id: 'dragon/dragon_gorra_01',    nombre: 'Dragón con gorra', categoria: 'dragon', acceso: 'logro' },
    { id: 'dragon/dragon_gorra_02',    nombre: 'Dragón con gorra', categoria: 'dragon', acceso: 'logro' },

    // Llamas: pendientes de asignar su logro (salen como "Próximamente")
    { id: 'llama/llama_aurora',    nombre: 'Llama aurora',    categoria: 'llama', acceso: 'logro' },
    { id: 'llama/llama_supernova', nombre: 'Llama supernova', categoria: 'llama', acceso: 'logro' },

    // Plan Pro. Van todos juntos en su propia sección —y no repartidos entre
    // Gatos y un personaje nuevo— para que al usuario free le quede claro de
    // un vistazo qué se lleva con el plan.
    { id: 'pro/gatarosa_glam',        nombre: 'Gata glam',       categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatarosa_disenadora',  nombre: 'Gata diseñadora', categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatarosa_formal',      nombre: 'Gata elegante',   categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatarosa_gotica',      nombre: 'Gata gótica',     categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatonegro_rockero',    nombre: 'Gato rockero',    categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatonegro_rebelde',    nombre: 'Gato rebelde',    categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatonegro_explorador', nombre: 'Gato explorador', categoria: 'pro', acceso: 'pro' },
    { id: 'pro/gatonegro_diablo',     nombre: 'Gato diablo',     categoria: 'pro', acceso: 'pro' },
    { id: 'pro/lobogris_cachorro',    nombre: 'Lobo cachorro',   categoria: 'pro', acceso: 'pro' },
    { id: 'pro/lobogris_rapero',      nombre: 'Lobo rapero',     categoria: 'pro', acceso: 'pro' },
    { id: 'pro/lobogris_luchador',    nombre: 'Lobo luchador',   categoria: 'pro', acceso: 'pro' },
    { id: 'pro/lobogris_enfadado',    nombre: 'Lobo enfadado',   categoria: 'pro', acceso: 'pro' },
    { id: 'pro/lobogris_swat',        nombre: 'Lobo SWAT',       categoria: 'pro', acceso: 'pro' },
];

// Qué eligió mostrar el usuario. 'google' no se guarda: es lo que resulta de
// 'auto' cuando hay foto.
const AVATAR_TIPOS = ['auto', 'inicial', 'catalogo'];

const porId = new Map(CATALOGO_AVATARES.map((a) => [a.id, a]));

const avatarDelCatalogo = (id) => porId.get(id) || null;
const esAvatarValido    = (id) => typeof id === 'string' && porId.has(id);

/**
 * Ids que se otorgan al activar el plan pro: al activarlo (controllers/auth.js)
 * y retroactivamente a quien ya era pro (helpers/logros.js). Una vez dados no
 * se quitan, aunque la suscripción caduque.
 */
const AVATARES_PRO = CATALOGO_AVATARES
    .filter((a) => a.acceso === 'pro')
    .map((a) => a.id);

/** true si a un usuario pro aún le falta algún avatar de su plan. */
const faltanAvataresPro = (desbloqueados = []) => {
    const tiene = new Set(desbloqueados);
    return AVATARES_PRO.some((id) => !tiene.has(id));
};

/**
 * Si el usuario puede equipar ese avatar: los gratuitos siempre, el resto solo
 * si está en su lista de desbloqueados. No mira el plan actual a propósito:
 * lo desbloqueado es para siempre.
 */
const puedeUsar = (user, id) => {
    const a = avatarDelCatalogo(id);
    if (!a) return false;
    if (a.acceso === 'free') return true;
    return (user?.avatarsDesbloqueados || []).includes(id);
};

/**
 * Lo que la app debe pintar para este usuario. Se usa en TODAS las respuestas
 * que llevan avatar (login, dashboard, ranking, perfil público), así la app
 * nunca tiene que decidir nada.
 *
 *   { avatar, avatarTipo, avatarId }
 *
 * - avatar:     URL de la foto de Google, o '' si no se muestra. Mantiene el
 *               significado que siempre tuvo: las versiones viejas de la app
 *               siguen funcionando (ven foto o iniciales).
 * - avatarTipo: 'google' | 'inicial' | 'catalogo'  (ya resuelto, no 'auto')
 * - avatarId:   id del catálogo cuando avatarTipo === 'catalogo', si no null
 *
 * Si el avatar elegido ya no está en el catálogo (se retiró una ilustración),
 * cae a foto/iniciales en vez de mandar un id que la app no sabría pintar.
 */
const avatarVisible = (user) => {
    const foto = user?.avatar || '';

    if (user?.avatarTipo === 'catalogo' && esAvatarValido(user.avatarId)) {
        return { avatar: '', avatarTipo: 'catalogo', avatarId: user.avatarId };
    }
    if (user?.avatarTipo === 'inicial' || !foto) {
        return { avatar: '', avatarTipo: 'inicial', avatarId: null };
    }
    return { avatar: foto, avatarTipo: 'google', avatarId: null };
};

/**
 * Otorga avatares a un usuario. Idempotente ($addToSet): repetir la llamada no
 * duplica nada. Devuelve solo los que NO tenía, para que la app los celebre.
 * Los gratuitos se ignoran: no hay nada que otorgar.
 *
 * `avisar: false` los entrega sin encolarlos en avatarsPendientesAviso. Es lo
 * que se hace con el lote del plan pro: la app celebra los pendientes de uno
 * en uno, y soltar 13 diálogos seguidos al activar el plan sería insufrible.
 * Esa celebración le toca a la pantalla de bienvenida Pro, en bloque.
 */
const otorgarAvatars = async (userId, ids, { avisar = true } = {}) => {
    const validos = (Array.isArray(ids) ? ids : [ids])
        .filter((id) => esAvatarValido(id) && avatarDelCatalogo(id).acceso !== 'free');
    if (validos.length === 0) return [];

    const user = await User.findById(userId, 'avatarsDesbloqueados');
    if (!user) return [];

    const yaTiene = new Set(user.avatarsDesbloqueados || []);
    const nuevos  = validos.filter((id) => !yaTiene.has(id));
    if (nuevos.length === 0) return [];

    await User.findByIdAndUpdate(userId, {
        $addToSet: {
            avatarsDesbloqueados: { $each: nuevos },
            ...(avisar && { avatarsPendientesAviso: { $each: nuevos } }),
        },
    });

    return nuevos;
};

/**
 * Entrega los avatares del plan a un usuario pro al que le falten. Devuelve
 * los recién otorgados, o [] si no era pro o ya los tenía.
 *
 * Se llama desde las tres puertas por las que puede pasar un usuario pro:
 * al activar el plan (controllers/auth.js), al abrir el selector
 * (controllers/avatars.js) y al terminar un quiz (helpers/logros.js). Es
 * idempotente y sin coste cuando no falta nada, así que sobra con que pase
 * por cualquiera de ellas.
 */
const sincronizarAvatarsPro = async (user) => {
    if (user?.plan !== 'pro') return [];
    if (!faltanAvataresPro(user.avatarsDesbloqueados)) return [];
    return otorgarAvatars(user._id, AVATARES_PRO, { avisar: false });
};

module.exports = {
    CATEGORIAS_AVATAR,
    CONDICION_POR_DEFECTO,
    CATALOGO_AVATARES,
    AVATAR_TIPOS,
    AVATARES_PRO,
    faltanAvataresPro,
    avatarDelCatalogo,
    esAvatarValido,
    puedeUsar,
    avatarVisible,
    otorgarAvatars,
    sincronizarAvatarsPro,
};
