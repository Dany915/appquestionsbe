const { Router } = require('express');
const { query }  = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }    = require('../middlewares/validar-jwt');
const { dashboard, porTema, porNivel, evolucion } = require('../controllers/userStats');

const router = Router();

// Todos los endpoints requieren autenticación
router.use(validarJWT);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/dashboard
 * Resumen general: totales, racha, nivel favorito.
 */
router.get('/dashboard', dashboard);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/por-tema
 * Rendimiento por tema, ordenado de peor a mejor.
 */
router.get('/por-tema', porTema);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/por-nivel
 * Rendimiento por cada nivel (curioso/analitico/estratega/genio).
 */
router.get('/por-nivel', porNivel);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/evolucion?limit=20
 * Últimos N intentos para graficar la tendencia de mejora.
 */
router.get('/evolucion', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('limit debe ser un número entre 1 y 50.'),
    validarCampos,
], evolucion);

module.exports = router;
