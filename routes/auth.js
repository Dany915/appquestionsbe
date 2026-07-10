const { Router } = require('express');
const { check, param } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarAdmin } = require('../middlewares/validar-admin');
const { register, login, googleLogin, renovarToken, cambiarPlan } = require('../controllers/auth');

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

// PUT /api/auth/plan/:userId  (solo admin) — cambia el plan free/pro de un usuario
router.put('/plan/:userId', [
    validarJWT,
    validarAdmin,
    param('userId', 'El userId no es válido').isMongoId(),
    check('plan', 'El plan debe ser "free" o "pro"').isIn(['free', 'pro']),
    validarCampos,
], cambiarPlan);

module.exports = router;
