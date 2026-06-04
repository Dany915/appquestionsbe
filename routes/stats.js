const { Router } = require('express');
const { query }  = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { temasMasDificiles, tiempoPorNivel, rachaMasLarga, eficiencia } = require('../controllers/stats');

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/temas-dificiles
 * Temas con menor tasa de acierto global (mínimo 5 respuestas).
 */
router.get('/temas-dificiles', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('limit debe ser un número entre 1 y 50.'),
    validarCampos,
], temasMasDificiles);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/tiempo-por-nivel
 * Tiempo promedio y score promedio por nivel (curioso/analitico/estratega/genio).
 */
router.get('/tiempo-por-nivel', tiempoPorNivel);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/racha
 * Top usuarios con mayor racha histórica de días consecutivos.
 */
router.get('/racha', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('limit debe ser un número entre 1 y 50.'),
    validarCampos,
], rachaMasLarga);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/eficiencia
 * Top usuarios: mejor score con menor tiempo. Un resultado por usuario.
 * ?nivel=curioso filtra por nivel específico.
 */
router.get('/eficiencia', [
    query('nivel')
        .optional()
        .isIn(['curioso', 'analitico', 'estratega', 'genio'])
        .withMessage('nivel debe ser: curioso, analitico, estratega o genio.'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('limit debe ser un número entre 1 y 50.'),
    validarCampos,
], eficiencia);

module.exports = router;
