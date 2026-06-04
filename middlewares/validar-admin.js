const validarAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            ok:  false,
            msg: 'No tienes permisos para realizar esta acción.',
        });
    }
    next();
};

module.exports = { validarAdmin };
