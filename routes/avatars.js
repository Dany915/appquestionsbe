const { Router } = require('express');
const { body }   = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }    = require('../middlewares/validar-jwt');
const { validarAdmin }  = require('../middlewares/validar-admin');
const {
    misAvatars,
    equiparAvatar,
    marcarAvisosVistos,
    otorgarAvatarsAdmin,
} = require('../controllers/avatars');

const router = Router();

// Todos los endpoints requieren autenticación
router.use(validarJWT);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/avatars
 * Avatar actual del usuario + catálogo completo con cuáles puede usar.
 */
router.get('/', misAvatars);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/avatars/equipar
 * Body: { avatarTipo: 'auto' | 'inicial' | 'catalogo', avatarId? }
 */
router.put('/equipar', [
    body('avatarTipo')
        .isString().withMessage('El campo "avatarTipo" es requerido.'),
    body('avatarId')
        .optional({ nullable: true })
        .isString().withMessage('El campo "avatarId" debe ser un texto.'),
    validarCampos,
], equiparAvatar);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/avatars/vistos
 * Marca avisos de desbloqueo como mostrados. Sin body vacía toda la cola.
 */
router.post('/vistos', [
    body('avatars')
        .optional()
        .isArray().withMessage('El campo "avatars" debe ser un array de ids.'),
    validarCampos,
], marcarAvisosVistos);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/avatars/otorgar   (solo admin)
 * Concesión manual de avatares no gratuitos.
 */
router.post('/otorgar', [validarAdmin,
    body('uid')
        .isMongoId().withMessage('El campo "uid" debe ser un id válido.'),
    body('avatars')
        .isArray({ min: 1 }).withMessage('Envía "avatars" como un array con al menos un id.'),
    validarCampos,
], otorgarAvatarsAdmin);

module.exports = router;
