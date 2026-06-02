const jwt = require('jsonwebtoken');
const User = require('../models/user');

const validarJWT = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ ok: false, msg: 'No hay token en la petición.' });
    }

    try {
        const { uid } = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(uid);

        if (!user) {
            return res.status(401).json({ ok: false, msg: 'Token no válido - usuario no existe.' });
        }

        if (!user.active) {
            return res.status(401).json({ ok: false, msg: 'Token no válido - usuario desactivado.' });
        }

        req.uid = uid;
        req.user = user;

        next();
    } catch (error) {
        return res.status(401).json({ ok: false, msg: 'Token no válido.' });
    }
};

module.exports = { validarJWT };
