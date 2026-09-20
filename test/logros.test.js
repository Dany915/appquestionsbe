// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const {
    AVATARES_LOGRO, MAX_LARGO_CONDICION, avataresPorEstadisticas,
    condicionDeAvatar, faltanAvatares,
} = require('../helpers/avatarRewards');
const {
    MARCOS_TIEMPO, marcosPorHoras, faltanMarcosTiempo, CATALOGO_MARCOS,
} = require('../helpers/frameRewards');
const {
    CATALOGO_AVATARES, CATEGORIAS_AVATAR, CONDICION_POR_DEFECTO,
    AVATARES_PRO, faltanAvataresPro, puedeUsar, esAvatarValido,
} = require('../helpers/avatars');
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

test('las condiciones caben en la celda del selector', () => {
    // Textos largos desbordaban la celda de la rejilla (pasó con los dragones)
    for (const a of AVATARES_LOGRO) {
        assert.ok(
            a.condicion.length <= MAX_LARGO_CONDICION,
            `"${a.condicion}" mide ${a.condicion.length}, máximo ${MAX_LARGO_CONDICION}`,
        );
    }
});

test('las llamas son lo único que sigue sin logro asignado', () => {
    // Mientras estén aquí, el selector las pinta como "Próximamente" y solo
    // se pueden conceder a mano. Al darles logro, este test avisa.
    const sinCondicion = CATALOGO_AVATARES
        .filter((a) => a.acceso === 'logro' && !condicionDeAvatar(a.id))
        .map((a) => a.id);
    assert.deepEqual(sinCondicion, ['llama/llama_aurora', 'llama/llama_supernova']);
});

test('el catálogo está bien formado: id único, en su carpeta y con etiqueta', () => {
    const vistos = new Set();
    for (const a of CATALOGO_AVATARES) {
        assert.ok(!vistos.has(a.id), `${a.id} está repetido`);
        vistos.add(a.id);
        // El id es la ruta del asset sin extensión: "carpeta/archivo"
        assert.match(a.id, /^[a-z]+\/[a-z0-9_]+$/, `${a.id} no es "carpeta/archivo"`);
        assert.equal(a.id.split('/')[0], a.categoria, `${a.id} no vive en su categoría`);
        assert.ok(CATEGORIAS_AVATAR[a.categoria], `la categoría "${a.categoria}" no tiene etiqueta`);
        assert.ok(a.nombre.length > 0, `${a.id} sin nombre visible`);
        assert.ok(['free', 'pro', 'logro'].includes(a.acceso), `${a.id} con acceso "${a.acceso}"`);
    }
});

test('los gratuitos son el "default" de cada personaje', () => {
    const free = CATALOGO_AVATARES.filter((a) => a.acceso === 'free').map((a) => a.id);
    assert.deepEqual(free, [
        'zorro/zorro_default',
        'gato/gatorosa_default',
        'gato/gatarosa_default',
        'gato/gatonegro_default',
        'dragon/dragon_default_01',
        'dragon/dragon_default_02',
    ]);
    assert.ok(free.every((id) => id.includes('_default')), 'algún gratuito no es un "default"');
});

test('los textos por defecto también caben en la celda', () => {
    for (const [acceso, texto] of Object.entries(CONDICION_POR_DEFECTO)) {
        assert.ok(
            texto.length <= MAX_LARGO_CONDICION,
            `"${texto}" (${acceso}) mide ${texto.length}, máximo ${MAX_LARGO_CONDICION}`,
        );
    }
});

test('los 13 avatares del plan pro se reparten con el plan', () => {
    const enCatalogo = CATALOGO_AVATARES.filter((a) => a.acceso === 'pro').map((a) => a.id);
    assert.equal(enCatalogo.length, 13);
    assert.deepEqual(AVATARES_PRO, enCatalogo);
    // Un free no los tiene; en cuanto se otorgan, deja de faltarle nada
    assert.equal(faltanAvataresPro([]), true);
    assert.equal(faltanAvataresPro(AVATARES_PRO), false);
    // Y no se le pueden dar sueltos por la vía de admin sin ser del plan
    for (const id of AVATARES_PRO) {
        assert.equal(puedeUsar({ avatarsDesbloqueados: [] }, id), false, `${id} es gratis`);
        assert.equal(puedeUsar({ avatarsDesbloqueados: [id] }, id), true, `${id} no se puede equipar`);
    }
});

test('ningún avatar del plan pro tiene condición de logro', () => {
    // Su texto sale de CONDICION_POR_DEFECTO.pro, no de la tabla de logros
    for (const a of CATALOGO_AVATARES.filter((c) => c.acceso === 'pro')) {
        assert.equal(condicionDeAvatar(a.id), null, `${a.id} está en la tabla de logros`);
    }
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
