const { Router } = require('express');
const { body }   = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }    = require('../middlewares/validar-jwt');
const { validarAdmin }  = require('../middlewares/validar-admin');
const {
    misMarcos,
    equiparMarco,
    marcarAvisosVistos,
    otorgarMarcosAdmin,
} = require('../controllers/frames');

const router = Router();

// Todos los endpoints requieren autenticación
router.use(validarJWT);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/frames
 * Marcos desbloqueados del usuario + cuál lleva equipado + catálogo completo.
 */
router.get('/', misMarcos);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/frames/equipar
 * Equipa un marco ya desbloqueado. marcoId null o "" lo retira.
 */
router.put('/equipar', [
    body('marcoId')
        .optional({ nullable: true })
        .isString().withMessage('El campo "marcoId" debe ser un texto.'),
    validarCampos,
], equiparMarco);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/frames/vistos
 * Marca avisos de desbloqueo como mostrados. Sin body vacía toda la cola.
 */
router.post('/vistos', [
    body('marcos')
        .optional()
        .isArray().withMessage('El campo "marcos" debe ser un array de ids.'),
    validarCampos,
], marcarAvisosVistos);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/frames/otorgar   (solo admin)
 * Concesión manual de marcos: pruebas, premios puntuales y soporte.
 */
router.post('/otorgar', [validarAdmin,
    body('uid')
        .isMongoId().withMessage('El campo "uid" debe ser un id válido.'),
    body('marcos')
        .isArray({ min: 1 }).withMessage('Envía "marcos" como un array con al menos un id.'),
    validarCampos,
], otorgarMarcosAdmin);

module.exports = router;
