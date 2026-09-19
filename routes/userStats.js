const { Router } = require('express');
const { query, param, body } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT }    = require('../middlewares/validar-jwt');
const {
    dashboard,
    porTema,
    porNivel,
    evolucion,
    nivelUsuario,
    rankingSemanal,
    perfilPublico,
    resultadoSemana,
    marcarResultadoVisto,
} = require('../controllers/userStats');

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
 * GET /api/user-stats/nivel
 * Progreso de nivel: nivel, rango, XP y % de la barra de progreso.
 */
router.get('/nivel', nivelUsuario);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/ranking-semanal?limit=10
 * Ranking de XP de la semana actual: top N + posición del usuario + vecinos.
 */
router.get('/ranking-semanal', [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('limit debe ser un número entre 1 y 50.'),
    validarCampos,
], rankingSemanal);

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

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/perfil/:uid
 * Perfil público de otro usuario (se abre desde el ranking).
 * Solo datos públicos: nunca email, rol ni plan.
 */
router.get('/perfil/:uid', [
    param('uid')
        .isMongoId().withMessage('El ID proporcionado no tiene un formato válido.'),
    validarCampos,
], perfilPublico);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/user-stats/resultado-semana
 * Posición final del usuario en la última semana cerrada + mensaje.
 * `resultado: null` si no participó o ya lo vio.
 */
router.get('/resultado-semana', resultadoSemana);

/**
 * POST /api/user-stats/resultado-semana/visto
 * Body: { semana } — el valor `semana` que devolvió el GET.
 */
router.post('/resultado-semana/visto', [
    body('semana')
        .isISO8601().withMessage('El campo "semana" debe ser una fecha ISO.'),
    validarCampos,
], marcarResultadoVisto);

module.exports = router;
