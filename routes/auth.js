const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT } = require('../middlewares/validar-jwt');
const { register, login, googleLogin, renovarToken } = require('../controllers/auth');

const router = Router();

// POST /api/auth/register
router.post('/register', [
    check('username', 'El username es requerido (mín. 3 caracteres)').isLength({ min: 3 }),
    check('email', 'El email no es válido').isEmail(),
    check('password', 'La contraseña debe tener mínimo 6 caracteres').isLength({ min: 6 }),
    validarCampos,
], register);

// POST /api/auth/login
router.post('/login', [
    check('email', 'El email no es válido').isEmail(),
    check('password', 'La contraseña es requerida').not().isEmpty(),
    validarCampos,
], login);

// POST /api/auth/google
router.post('/google', [
    check('token', 'El token de Google es requerido').not().isEmpty(),
    validarCampos,
], googleLogin);

// GET /api/auth/renew  (token requerido)
router.get('/renew', validarJWT, renovarToken);

module.exports = router;
