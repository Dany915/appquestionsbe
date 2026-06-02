const { Router } = require('express');
const { body, query, param } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const {
    crearPregunta,
    crearPreguntasMasivo,
    actualizarPregunta,
    cambiarEstado,
    obtenerPreguntas,
} = require('../controllers/question');

const router = Router();

const TIPOS_VALIDOS = ['recall', 'comprension', 'aplicacion', 'analisis', 'evaluacion'];

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/question
 * Lista preguntas con filtros opcionales.
 */
router.get('/', [
    query('difficulty')
        .optional()
        .isInt({ min: 1, max: 3 }).withMessage('difficulty debe ser 1 (fácil), 2 (medio) o 3 (difícil).'),

    query('tipo')
        .optional()
        .isIn(TIPOS_VALIDOS).withMessage(`tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`),

    query('active')
        .optional()
        .isIn(['true', 'false']).withMessage('active debe ser "true" o "false".'),

    validarCampos,
], obtenerPreguntas);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/question
 * Crea una sola pregunta.
 */
router.post('/', [
    body('text')
        .notEmpty().withMessage('El campo "text" es requerido.')
        .isString().withMessage('El campo "text" debe ser un texto.'),

    body('options')
        .isArray({ min: 2 }).withMessage('El campo "options" debe ser un arreglo con al menos 2 opciones.'),

    body('options.*')
        .isString().withMessage('Cada opción en "options" debe ser un texto.'),

    body('correctIndex')
        .notEmpty().withMessage('El campo "correctIndex" es requerido.')
        .isInt({ min: 0 }).withMessage('El campo "correctIndex" debe ser un número entero mayor o igual a 0.'),

    body('difficulty')
        .optional()
        .isInt({ min: 1, max: 3 }).withMessage('El campo "difficulty" debe ser 1 (fácil), 2 (medio) o 3 (difícil).'),

    body('tipo')
        .optional()
        .isIn(TIPOS_VALIDOS).withMessage(`El campo "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`),

    body('active')
        .optional()
        .isBoolean().withMessage('El campo "active" debe ser true o false.'),

    body('feedback')
        .optional()
        .isString().withMessage('El campo "feedback" debe ser un texto.'),

    body('tags')
        .optional()
        .isArray().withMessage('El campo "tags" debe ser un arreglo.'),

    validarCampos,
], crearPregunta);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/question/bulk
 * Crea múltiples preguntas en una sola petición.
 * Solo se valida que "questions" sea un arreglo no vacío.
 * La validación de cada pregunta individual la hace el controller.
 */
router.post('/bulk', [
    body('questions')
        .isArray({ min: 1 }).withMessage('El campo "questions" debe ser un arreglo con al menos 1 pregunta.'),

    validarCampos,
], crearPreguntasMasivo);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/question/:id
 * Actualiza una pregunta existente (parcial o total).
 */
router.put('/:id', [
    param('id')
        .isMongoId().withMessage('El ID proporcionado no tiene un formato válido.'),

    body('text')
        .optional()
        .notEmpty().withMessage('El campo "text" no puede estar vacío.'),

    body('options')
        .optional()
        .isArray({ min: 2 }).withMessage('El campo "options" debe tener al menos 2 opciones.'),

    body('correctIndex')
        .optional()
        .isInt({ min: 0 }).withMessage('El campo "correctIndex" debe ser un número entero mayor o igual a 0.'),

    body('difficulty')
        .optional()
        .isInt({ min: 1, max: 3 }).withMessage('El campo "difficulty" debe ser 1 (fácil), 2 (medio) o 3 (difícil).'),

    body('tipo')
        .optional()
        .isIn(TIPOS_VALIDOS).withMessage(`El campo "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`),

    body('active')
        .optional()
        .isBoolean().withMessage('El campo "active" debe ser true o false.'),

    validarCampos,
], actualizarPregunta);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/question/:id/estado
 * Activa o desactiva una pregunta.
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
