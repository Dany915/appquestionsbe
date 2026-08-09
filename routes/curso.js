const { Router } = require('express');
const { body, query, param } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }    = require('../middlewares/validar-jwt');
const { validarAdmin }  = require('../middlewares/validar-admin');
const {
    obtenerCursos,
    crearCurso,
    actualizarCurso,
    cambiarEstadoCurso,
    fijarCursoActivo,
} = require('../controllers/curso');

const router = Router();

const soloAdmin = [validarJWT, validarAdmin];

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/curso
 * Lista los cursos disponibles (nivel más alto: SENA, Sistemas…).
 */
router.get('/', [
    query('active')
        .optional()
        .isIn(['true', 'false']).withMessage('active debe ser "true" o "false".'),

    query('conContenido')
        .optional()
        .isIn(['true', 'false']).withMessage('conContenido debe ser "true" o "false".'),

    validarCampos,
], obtenerCursos);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/curso/activo
 * Fija el curso en el que estudia el usuario autenticado.
 * Debe ir ANTES de "/:id" para que "activo" no se interprete como un id.
 */
router.put('/activo', [validarJWT,
    body('cursoTag')
        .optional({ nullable: true })
        .isString().withMessage('El campo "cursoTag" debe ser un texto.'),
    validarCampos,
], fijarCursoActivo);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/curso   (solo admin)
 */
router.post('/', [...soloAdmin,
    body('cursoTag')
        .notEmpty().withMessage('El campo "cursoTag" es requerido. Ej: "sena".')
        .isString().withMessage('El campo "cursoTag" debe ser un texto.'),

    body('label')
        .notEmpty().withMessage('El campo "label" es requerido. Ej: "SENA".')
        .isString().withMessage('El campo "label" debe ser un texto.'),

    body('descripcion')
        .optional()
        .isString().withMessage('El campo "descripcion" debe ser un texto.')
        .isLength({ max: 200 }).withMessage('La descripción no puede superar los 200 caracteres.'),

    // Identidad visual (todos opcionales)
    body('emoji').optional().isString(),
    body('iconAsset').optional().isString(),
    body('iconUrl').optional().isString(),
    body('imagenUrl').optional().isString(),
    body('color').optional().isString(),
    body('colorSecundario').optional().isString(),

    body('orden').optional().isInt().withMessage('El campo "orden" debe ser un número.'),
    body('active').optional().isBoolean(),

    validarCampos,
], crearCurso);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/curso/:id   (solo admin)
 */
router.put('/:id', [...soloAdmin,
    param('id').isMongoId().withMessage('El ID proporcionado no tiene un formato válido.'),

    body('label').optional().notEmpty().isString(),
    body('descripcion').optional().isString().isLength({ max: 200 }),
    body('orden').optional().isInt(),

    // Identidad visual: enviar "" limpia el campo
    body('emoji').optional().isString(),
    body('iconAsset').optional().isString(),
    body('iconUrl').optional().isString(),
    body('imagenUrl').optional().isString(),
    body('color').optional().isString(),
    body('colorSecundario').optional().isString(),

    validarCampos,
], actualizarCurso);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/curso/:id/estado   (solo admin)
 */
router.patch('/:id/estado', [...soloAdmin,
    param('id').isMongoId().withMessage('El ID proporcionado no tiene un formato válido.'),

    body('active')
        .notEmpty().withMessage('El campo "active" es requerido.')
        .isBoolean().withMessage('El campo "active" debe ser true o false.'),

    validarCampos,
], cambiarEstadoCurso);

module.exports = router;
