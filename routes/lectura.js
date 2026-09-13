const { Router } = require('express');
const { query, param } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }    = require('../middlewares/validar-jwt');
const { obtenerLecturas, obtenerLectura } = require('../controllers/lectura');

// Las lecturas se crean y actualizan con scripts/importarLectura.js, no por API.
// Son gratuitas para todo usuario con sesión: no se deben poner tras el plan Pro.

const router = Router();

/**
 * GET /api/lectura?cursoTag=sena&moduleTag=modulo_2
 * GET /api/lectura?topicTag=mod_2_und_tec_sena
 * Lista las lecturas (sin contenido).
 */
router.get('/', [validarJWT,
    query('cursoTag').optional().isString().withMessage('El parámetro "cursoTag" debe ser un texto.'),
    query('moduleTag').optional().isString().withMessage('El parámetro "moduleTag" debe ser un texto.'),
    query('topicTag').optional().isString().withMessage('El parámetro "topicTag" debe ser un texto.'),
    validarCampos,
], obtenerLecturas);

/**
 * GET /api/lectura/:lecturaTag
 * Lectura completa con todas sus secciones.
 */
router.get('/:lecturaTag', [validarJWT,
    param('lecturaTag')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('El "lecturaTag" solo admite letras, números, _ y -.'),
    validarCampos,
], obtenerLectura);

module.exports = router;
