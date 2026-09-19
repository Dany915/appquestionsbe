// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const { ESTILOS_NOMBRE, estiloNombrePorRacha } = require('../helpers/estiloNombre');

test('los 6 estilos con sus umbrales, en orden ascendente', () => {
    assert.deepEqual(ESTILOS_NOMBRE.map((e) => [e.id, e.dias]), [
        ['plata', 7], ['plata_reluciente', 14], ['oro', 30],
        ['oro_reluciente', 60], ['diamante', 100], ['diamante_reluciente', 150],
    ]);
});

test('sin racha o por debajo de 7 días el nombre es normal', () => {
    for (const r of [0, 1, 6]) assert.equal(estiloNombrePorRacha(r), null);
});

test('cada umbral da su estilo y se mantiene hasta el siguiente', () => {
    const casos = [
        [7, 'plata'], [13, 'plata'],
        [14, 'plata_reluciente'], [29, 'plata_reluciente'],
        [30, 'oro'], [59, 'oro'],
        [60, 'oro_reluciente'], [99, 'oro_reluciente'],
        [100, 'diamante'], [149, 'diamante'],
        [150, 'diamante_reluciente'], [900, 'diamante_reluciente'],
    ];
    for (const [racha, estilo] of casos) assert.equal(estiloNombrePorRacha(racha), estilo, `racha ${racha}`);
});
