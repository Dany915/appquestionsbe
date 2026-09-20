// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const {
    AVATARES_LOGRO, avataresPorEstadisticas, condicionDeAvatar, faltanAvatares,
} = require('../helpers/avatarRewards');
const {
    MARCOS_TIEMPO, marcosPorHoras, faltanMarcosTiempo, CATALOGO_MARCOS,
} = require('../helpers/frameRewards');
const { CATALOGO_AVATARES, esAvatarValido } = require('../helpers/avatars');
const { FRAME_IDS } = require('../helpers/frames');

// Usuario sin nada hecho
const CERO = { quizzes: 0, correctas: 0, horas: 0, perfectos: 0, nivel: 1 };
const stats = (extra) => ({ ...CERO, ...extra });

// ─── Avatares ──────────────────────────────────────────────────────────────────

test('los 12 avatares de logro existen en el catálogo y no son gratuitos', () => {
    assert.equal(AVATARES_LOGRO.length, 12);
    for (const a of AVATARES_LOGRO) {
        assert.ok(esAvatarValido(a.id), `${a.id} no está en el catálogo`);
        const dato = CATALOGO_AVATARES.find((c) => c.id === a.id);
        assert.equal(dato.acceso, 'logro', `${a.id} no es desbloqueable`);
        assert.ok(a.condicion.length > 5, `${a.id} sin texto de condición`);
    }
});

test('ya no queda ningún avatar de logro sin condición asignada', () => {
    const sinCondicion = CATALOGO_AVATARES
        .filter((a) => a.acceso === 'logro' && !condicionDeAvatar(a.id));
    assert.deepEqual(sinCondicion, []);
});

test('sin actividad no se desbloquea ningún avatar', () => {
    assert.deepEqual(avataresPorEstadisticas(CERO), []);
});

test('cada eje desbloquea solo lo suyo', () => {
    assert.deepEqual(avataresPorEstadisticas(stats({ quizzes: 10 })), ['zorro/zorro_gafas']);
    assert.deepEqual(avataresPorEstadisticas(stats({ correctas: 100 })), ['gato/gatorosa_gafas']);
    assert.deepEqual(avataresPorEstadisticas(stats({ perfectos: 3 })), ['dragon/dragon_confiado_01']);
    assert.deepEqual(avataresPorEstadisticas(stats({ horas: 1 })), ['dragon/dragon_frio_01']);
    assert.deepEqual(avataresPorEstadisticas(stats({ nivel: 5 })), ['dragon/dragon_gorra_01']);
});

test('los umbrales altos incluyen a los bajos', () => {
    const r = avataresPorEstadisticas(stats({ quizzes: 150 }));
    assert.deepEqual(r, ['zorro/zorro_gafas', 'zorro/zorro_gorra', 'zorro/zorro_enojado']);
});

test('justo por debajo del umbral no se otorga', () => {
    assert.deepEqual(avataresPorEstadisticas(stats({ quizzes: 9, correctas: 99, horas: 0.99, perfectos: 2, nivel: 4 })), []);
});

test('un usuario que lo ha hecho todo se lleva los 12', () => {
    const todo = { quizzes: 150, correctas: 1500, horas: 5, perfectos: 15, nivel: 15 };
    assert.equal(avataresPorEstadisticas(todo).length, 12);
    assert.equal(faltanAvatares(avataresPorEstadisticas(todo)), false);
    assert.equal(faltanAvatares([]), true);
});

// ─── Marcos por horas de práctica ──────────────────────────────────────────────

test('los 6 marcos volcánicos son ids válidos y suben de 1 a 100 horas', () => {
    assert.deepEqual(MARCOS_TIEMPO.map((m) => m.horas), [1, 3, 10, 25, 50, 100]);
    for (const m of MARCOS_TIEMPO) {
        assert.ok(FRAME_IDS.includes(m.marco), `${m.marco} no existe`);
        assert.ok(m.marco.startsWith('volcanic.'), `${m.marco} no es volcánico`);
    }
});

test('las horas otorgan todos los umbrales alcanzados', () => {
    assert.deepEqual(marcosPorHoras(0.5), []);
    assert.deepEqual(marcosPorHoras(1), ['volcanic.static']);
    assert.deepEqual(marcosPorHoras(3.5), ['volcanic.static', 'volcanic.breathe']);
    assert.equal(marcosPorHoras(100).length, 6);
    assert.equal(faltanMarcosTiempo(marcosPorHoras(100)), false);
    assert.equal(faltanMarcosTiempo(['volcanic.static']), true);
});

test('los 6 volcánicos están en el catálogo visible, en la categoría Dedicación', () => {
    const dedicacion = CATALOGO_MARCOS.filter((m) => m.categoria === 'Dedicación');
    assert.deepEqual(dedicacion.map((m) => m.id), MARCOS_TIEMPO.map((m) => m.marco));
});

test('nebulosa y arcoíris siguen sin condición asignada', () => {
    const asignados = new Set(CATALOGO_MARCOS.map((m) => m.id));
    const pendientes = FRAME_IDS.filter((id) => !asignados.has(id));
    assert.equal(pendientes.length, 10);
    assert.ok(pendientes.every((id) => id.startsWith('rainbow.') || id.startsWith('nebula.')));
});
