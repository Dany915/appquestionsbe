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
// Los bloqueados llevan `condicion`: es lo que la app enseña debajo del
// avatar en gris. Mientras no tengan un logro asignado se muestran como
// "Próximamente" y solo se pueden conceder a mano (POST /api/avatars/otorgar).
//
// Este catálogo existe para VALIDAR (que nadie equipe un avatar que la app no
// tiene) y para que la app pinte en gris los que faltan, con su condición.

const CATEGORIAS_AVATAR = {
    zorro:  'Zorro',
    gato:   'Gato rosa',
    dragon: 'Dragón',
};

// Condición provisional de los desbloqueables hasta que tengan logro asignado
const PROXIMAMENTE = 'Próximamente';

const CATALOGO_AVATARES = [
    // Gratuitos: el "default" de cada personaje
    { id: 'zorro/zorro_default',       nombre: 'Zorro',     categoria: 'zorro',  acceso: 'free' },
    { id: 'gato/gatorosa_default',     nombre: 'Gato rosa', categoria: 'gato',   acceso: 'free' },
    { id: 'dragon/dragon_default_01',  nombre: 'Dragón',    categoria: 'dragon', acceso: 'free' },
    { id: 'dragon/dragon_default_02',  nombre: 'Dragón',    categoria: 'dragon', acceso: 'free' },

    // Desbloqueables: pendientes de asignar su logro
    { id: 'zorro/zorro_gafas',     nombre: 'Zorro cool',      categoria: 'zorro', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'zorro/zorro_gorra',     nombre: 'Zorro con gorra', categoria: 'zorro', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'zorro/zorro_enojado',   nombre: 'Zorro enojado',   categoria: 'zorro', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'gato/gatorosa_gafas',   nombre: 'Gato cool',       categoria: 'gato',  acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'gato/gatorosa_gorra',   nombre: 'Gato con gorra',  categoria: 'gato',  acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'gato/gatorosa_enojado', nombre: 'Gato enojado',    categoria: 'gato',  acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'dragon/dragon_confiado_01', nombre: 'Dragón confiado', categoria: 'dragon', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'dragon/dragon_confiado_02', nombre: 'Dragón confiado', categoria: 'dragon', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'dragon/dragon_frio_01',     nombre: 'Dragón frío',     categoria: 'dragon', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'dragon/dragon_frio_02',     nombre: 'Dragón frío',     categoria: 'dragon', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'dragon/dragon_gorra_01',    nombre: 'Dragón con gorra', categoria: 'dragon', acceso: 'logro', condicion: PROXIMAMENTE },
    { id: 'dragon/dragon_gorra_02',    nombre: 'Dragón con gorra', categoria: 'dragon', acceso: 'logro', condicion: PROXIMAMENTE },
];

// Qué eligió mostrar el usuario. 'google' no se guarda: es lo que resulta de
// 'auto' cuando hay foto.
const AVATAR_TIPOS = ['auto', 'inicial', 'catalogo'];

const porId = new Map(CATALOGO_AVATARES.map((a) => [a.id, a]));

const avatarDelCatalogo = (id) => porId.get(id) || null;
const esAvatarValido    = (id) => typeof id === 'string' && porId.has(id);

/** Ids que se otorgan al activar el plan pro (hoy ninguno). */
const AVATARES_PRO = CATALOGO_AVATARES
    .filter((a) => a.acceso === 'pro')
    .map((a) => a.id);

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
 */
const otorgarAvatars = async (userId, ids) => {
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
            avatarsDesbloqueados:   { $each: nuevos },
            avatarsPendientesAviso: { $each: nuevos },
        },
    });

    return nuevos;
};

module.exports = {
    CATEGORIAS_AVATAR,
    CATALOGO_AVATARES,
    AVATAR_TIPOS,
    AVATARES_PRO,
    avatarDelCatalogo,
    esAvatarValido,
    puedeUsar,
    avatarVisible,
    otorgarAvatars,
};
