const { response } = require('express');
const mongoose     = require('mongoose');

const User = require('../models/user');
const { esMarcoValido, otorgarMarcos } = require('../helpers/frames');
const { CATALOGO_MARCOS } = require('../helpers/frameRewards');

/**
 * GET /api/frames
 * Marcos del usuario autenticado: cuáles tiene desbloqueados y cuál lleva puesto.
 *
 * Devuelve también el catálogo completo para que la app pueda mostrar los
 * bloqueados en gris (sirve de incentivo: ver lo que falta motiva más que ocultarlo).
 */
const misMarcos = async (req, res = response) => {
    try {
        const user = await User.findById(
            req.uid,
            'marcosDesbloqueados marcoEquipado marcosPendientesAviso'
        );
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        const desbloqueados = user.marcosDesbloqueados || [];

        return res.status(200).json({
            ok: true,
            equipado: user.marcoEquipado || null,
            desbloqueados,
            // Marcos ganados que aún no se le han celebrado
            pendientes: user.marcosPendientesAviso || [],
            // Solo los marcos con recompensa asignada: los bloqueados se
            // muestran en gris con su condición, como objetivo a conseguir.
            catalogo: CATALOGO_MARCOS.map((m) => ({
                ...m,
                desbloqueado: desbloqueados.includes(m.id),
            })),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener los marcos.' });
    }
};

/**
 * POST /api/frames/vistos
 * Body: { marcos: [...] }  → sin body, vacía toda la cola.
 *
 * Marca avisos como mostrados para que no se repitan.
 */
const marcarAvisosVistos = async (req, res = response) => {
    const { marcos } = req.body || {};

    try {
        if (Array.isArray(marcos) && marcos.length > 0) {
            await User.findByIdAndUpdate(req.uid, {
                $pull: { marcosPendientesAviso: { $in: marcos } },
            });
        } else {
            await User.findByIdAndUpdate(req.uid, {
                $set: { marcosPendientesAviso: [] },
            });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al marcar los avisos.' });
    }
};

/**
 * PUT /api/frames/equipar
 * Body: { marcoId }  →  null o "" para quitarse el marco.
 *
 * Solo permite equipar marcos que el usuario tenga desbloqueados.
 */
const equiparMarco = async (req, res = response) => {
    const { marcoId } = req.body || {};

    // null / "" → quitar el marco
    const quitar = marcoId === null || marcoId === undefined || marcoId === '';

    if (!quitar && !esMarcoValido(marcoId)) {
        return res.status(400).json({ ok: false, msg: 'El marco indicado no existe.' });
    }

    try {
        const user = await User.findById(req.uid, 'marcosDesbloqueados marcoEquipado');
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        if (!quitar && !(user.marcosDesbloqueados || []).includes(marcoId)) {
            return res.status(403).json({
                ok: false,
                msg: 'Aún no has desbloqueado ese marco.',
            });
        }

        const nuevo = quitar ? null : marcoId;
        await User.findByIdAndUpdate(req.uid, { marcoEquipado: nuevo });

        return res.status(200).json({
            ok: true,
            msg: quitar ? 'Marco retirado.' : 'Marco equipado.',
            equipado: nuevo,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al equipar el marco.' });
    }
};

/**
 * POST /api/frames/otorgar   (solo admin)
 * Body: { uid, marcos: ["gold.static", ...] }
 *
 * Concesión manual de marcos. Sirve para pruebas mientras se definen las
 * condiciones de desbloqueo, y a futuro para premios puntuales o soporte.
 */
const otorgarMarcosAdmin = async (req, res = response) => {
    const { uid, marcos } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(uid)) {
        return res.status(400).json({ ok: false, msg: 'El uid proporcionado no es válido.' });
    }

    if (!Array.isArray(marcos) || marcos.length === 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Envía "marcos" como un array de ids. Ej: ["gold.static"].',
        });
    }

    const invalidos = marcos.filter((m) => !esMarcoValido(m));
    if (invalidos.length > 0) {
        return res.status(400).json({
            ok:  false,
            msg: `Estos marcos no existen: ${invalidos.join(', ')}.`,
        });
    }

    try {
        const user = await User.findById(uid, 'username');
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        const nuevos = await otorgarMarcos(uid, marcos);

        return res.status(200).json({
            ok: true,
            msg: nuevos.length > 0
                ? `Se otorgaron ${nuevos.length} marco(s) a ${user.username}.`
                : 'El usuario ya tenía todos esos marcos.',
            nuevos,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al otorgar los marcos.' });
    }
};

module.exports = {
    misMarcos,
    equiparMarco,
    marcarAvisosVistos,
    otorgarMarcosAdmin,
};
