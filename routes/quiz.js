const { Router }      = require('express');
const { body, query } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }  = require('../middlewares/validar-jwt');
const { generarQuiz, calificarQuiz } = require('../controllers/quiz');

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/quiz
 * Genera un quiz con preguntas aleatorias.
 * Requiere: autenticación (validarJWT)
 * Enviar uno de los dos: ?topicTag=... o ?moduleTag=...
 */
router.get('/', [
    validarJWT,

    query('count')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('El parámetro "count" debe ser un número entre 1 y 50.'),

    validarCampos,
], generarQuiz);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/quiz/calificar
 * Califica las respuestas de un quiz y guarda el intento.
 * Requiere: autenticación (validarJWT)
 */
router.post('/calificar', [
    validarJWT,

    body('answers')
        .isArray({ min: 1 }).withMessage('El campo "answers" debe ser un arreglo con al menos 1 respuesta.'),

    body('answers.*.questionId')
        .notEmpty().withMessage('Cada respuesta debe incluir un "questionId".')
        .isMongoId().withMessage('El "questionId" de una de las respuestas no tiene un formato válido.'),

    body('answers.*.selectedIndex')
        .notEmpty().withMessage('Cada respuesta debe incluir un "selectedIndex".')
        .isInt({ min: 0 }).withMessage('El "selectedIndex" debe ser un número entero mayor o igual a 0.'),

    body('topicTags')
        .optional()
        .isArray().withMessage('El campo "topicTags" debe ser un arreglo.'),

    body('moduleTag')
        .optional()
        .isString().withMessage('El campo "moduleTag" debe ser un texto.'),

    validarCampos,
], calificarQuiz);

module.exports = router;
