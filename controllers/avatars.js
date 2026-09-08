const { response } = require('express');
const mongoose     = require('mongoose');

const User = require('../models/user');
const {
    CATEGORIAS_AVATAR,
    CATALOGO_AVATARES,
    AVATAR_TIPOS,
    avatarDelCatalogo,
    esAvatarValido,
    puedeUsar,
    avatarVisible,
    otorgarAvatars,
} = require('../helpers/avatars');

/**
 * GET /api/avatars
 * Avatar del usuario autenticado + catálogo completo con qué puede usar.
 *
 * `fotoGoogle` va aparte de `avatar`: si lleva puesto uno del catálogo,
 * `avatar` viene vacío, pero el selector necesita la foto para ofrecer
 * "volver a mi foto de Google".
 */
const misAvatars = async (req, res = response) => {
    try {
        const user = await User.findById(
            req.uid,
            'avatar avatarTipo avatarId avatarsDesbloqueados avatarsPendientesAviso'
        );
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        return res.status(200).json({
            ok: true,
            ...avatarVisible(user),
            fotoGoogle:    user.avatar || '',
            desbloqueados: user.avatarsDesbloqueados || [],
            // Avatares ganados que aún no se le han celebrado
            pendientes:    user.avatarsPendientesAviso || [],
            // Etiquetas de las categorías, para los títulos del selector
            categorias:    CATEGORIAS_AVATAR,
            catalogo: CATALOGO_AVATARES.map((a) => ({
                ...a,
                disponible: puedeUsar(user, a.id),
            })),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener los avatares.' });
    }
};

/**
 * PUT /api/avatars/equipar
 * Body: { avatarTipo: 'auto' | 'inicial' | 'catalogo', avatarId? }
 *
 *   auto     → foto de Google si la tiene, si no iniciales
 *   inicial  → iniciales
 *   catalogo → requiere avatarId; solo si es gratuito o lo tiene desbloqueado
 *
 * Responde con el avatar ya resuelto (mismos campos que login/dashboard).
 */
const equiparAvatar = async (req, res = response) => {
    const { avatarTipo, avatarId } = req.body || {};

    if (!AVATAR_TIPOS.includes(avatarTipo)) {
        return res.status(400).json({
            ok:  false,
            msg: `"avatarTipo" debe ser uno de: ${AVATAR_TIPOS.join(', ')}.`,
        });
    }

    try {
        const user = req.user;

        if (avatarTipo === 'catalogo') {
            if (!esAvatarValido(avatarId)) {
                return res.status(400).json({ ok: false, msg: 'El avatar indicado no existe.' });
            }
            if (!puedeUsar(user, avatarId)) {
                return res.status(403).json({ ok: false, msg: 'Aún no has desbloqueado ese avatar.' });
            }
            user.avatarTipo = 'catalogo';
            user.avatarId   = avatarId;
        } else {
            user.avatarTipo = avatarTipo;
            user.avatarId   = null;
        }

        await user.save();

        return res.status(200).json({
            ok:  true,
            msg: 'Avatar actualizado.',
            ...avatarVisible(user),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al cambiar el avatar.' });
    }
};

/**
 * POST /api/avatars/vistos
 * Body: { avatars: [...] }  → sin body, vacía toda la cola.
 */
const marcarAvisosVistos = async (req, res = response) => {
    const { avatars } = req.body || {};

    try {
        if (Array.isArray(avatars) && avatars.length > 0) {
            await User.findByIdAndUpdate(req.uid, {
                $pull: { avatarsPendientesAviso: { $in: avatars } },
            });
        } else {
            await User.findByIdAndUpdate(req.uid, {
                $set: { avatarsPendientesAviso: [] },
            });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al marcar los avisos.' });
    }
};

/**
 * POST /api/avatars/otorgar   (solo admin)
 * Body: { uid, avatars: ["gato/gatorosa_gafas", ...] }
 *
 * Concesión manual: pruebas, premios puntuales y soporte. Los gratuitos no se
 * otorgan (no hace falta) y se avisa para no confundir.
 */
const otorgarAvatarsAdmin = async (req, res = response) => {
    const { uid, avatars } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(uid)) {
        return res.status(400).json({ ok: false, msg: 'El uid proporcionado no es válido.' });
    }

    if (!Array.isArray(avatars) || avatars.length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Envía "avatars" como un array de ids. Ej: ["gato/gatorosa_gafas"].',
        });
    }

    const invalidos = avatars.filter((a) => !esAvatarValido(a));
    if (invalidos.length > 0) {
        return res.status(400).json({
            ok:  false,
            msg: `Estos avatares no existen: ${invalidos.join(', ')}.`,
        });
    }

    const gratuitos = avatars.filter((a) => avatarDelCatalogo(a).acceso === 'free');
    if (gratuitos.length > 0) {
        return res.status(400).json({
            ok:  false,
            msg: `Estos avatares son gratuitos, no hace falta otorgarlos: ${gratuitos.join(', ')}.`,
        });
    }

    try {
        const user = await User.findById(uid, 'username');
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        const nuevos = await otorgarAvatars(uid, avatars);

        return res.status(200).json({
            ok: true,
            msg: nuevos.length > 0
                ? `Se otorgaron ${nuevos.length} avatar(es) a ${user.username}.`
                : 'El usuario ya tenía todos esos avatares.',
            nuevos,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al otorgar los avatares.' });
    }
};

module.exports = {
    misAvatars,
    equiparAvatar,
    marcarAvisosVistos,
    otorgarAvatarsAdmin,
};
