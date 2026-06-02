const { Router } = require('express');
const { body, query, param } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const {
    crearTema,
    obtenerTemasPorModulo,
    obtenerModulos,
    actualizarTema,
    cambiarEstado,
} = require('../controllers/topic');

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/topic/modulos
 * Lista los módulos disponibles.
 */
router.get('/modulos', [
    query('active')
        .optional()
        .isIn(['true', 'false']).withMessage('active debe ser "true" o "false".'),

    validarCampos,
], obtenerModulos);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/topic
 * Lista los temas de un módulo específico.
 */
router.get('/', [
    query('moduleTag')
        .notEmpty().withMessage('El parámetro "moduleTag" es requerido. Ej: ?moduleTag=modulo_1'),

    query('active')
        .optional()
        .isIn(['true', 'false']).withMessage('active debe ser "true" o "false".'),

    validarCampos,
], obtenerTemasPorModulo);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/topic
 * Crea un nuevo tema dentro de un módulo.
 */
router.post('/', [
    body('moduleTag')
        .notEmpty().withMessage('El campo "moduleTag" es requerido. Ej: "modulo_1".')
        .isString().withMessage('El campo "moduleTag" debe ser un texto.'),

    body('topicTag')
        .notEmpty().withMessage('El campo "topicTag" es requerido. Ej: "mod_1_ley_1105".')
        .isString().withMessage('El campo "topicTag" debe ser un texto.'),

    body('label')
        .notEmpty().withMessage('El campo "label" es requerido (texto visible para el usuario, ej: "Ley 1105").')
        .isString().withMessage('El campo "label" debe ser un texto.'),

    body('moduleTagLabel')
        .optional()
        .isString().withMessage('El campo "moduleTagLabel" debe ser un texto.'),

    body('active')
        .optional()
        .isBoolean().withMessage('El campo "active" debe ser true o false.'),

    validarCampos,
], crearTema);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/topic/:id
 * Actualiza el label o moduleTagLabel de un tema.
 * El topicTag y moduleTag no se pueden cambiar.
 */
router.put('/:id', [
    param('id')
        .isMongoId().withMessage('El ID proporcionado no tiene un formato válido.'),

    body('label')
        .optional()
        .notEmpty().withMessage('El campo "label" no puede estar vacío.')
        .isString().withMessage('El campo "label" debe ser un texto.'),

    body('moduleTagLabel')
        .optional()
        .notEmpty().withMessage('El campo "moduleTagLabel" no puede estar vacío.')
        .isString().withMessage('El campo "moduleTagLabel" debe ser un texto.'),

    validarCampos,
], actualizarTema);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/topic/:id/estado
 * Activa o desactiva un tema.
 */
router.patch('/:id/estado', [
    param('id')
        .isMongoId().withMessage('El ID proporcionado no tiene un formato válido.'),

    body('active')
        .notEmpty().withMessage('El campo "active" es requerido.')
        .isBoolean().withMessage('El campo "active" debe ser true o false.'),

    validarCampos,
], cambiarEstado);

module.exports = router;
