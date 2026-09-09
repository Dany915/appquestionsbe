// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const {
    OFFSET_SEMANA, idSemanaDe, ventanaSemana, idSemanaAnterior,
} = require('../helpers/semana');

const iso  = (d) => new Date(d).toISOString();
const H    = 60 * 60 * 1000;
const DIA  = 24 * H;

// Como lo hacía el código viejo, para contrastar.
const inicioSemanaUTCViejo = (fecha) => {
    const d = new Date(fecha);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d;
};

test('la zona de referencia es Colombia', () => {
    assert.equal(OFFSET_SEMANA, -300);
});

test('el id de la semana no cambió: sigue siendo el lunes 00:00 guardado en la BD', () => {
    // Los 9 cierres que ya existen en producción están en estas claves.
    const guardados = [
        '2026-07-06T00:00:00.000Z', '2026-07-13T00:00:00.000Z',
        '2026-07-20T00:00:00.000Z', '2026-07-27T00:00:00.000Z',
        '2026-08-03T00:00:00.000Z', '2026-08-10T00:00:00.000Z',
        '2026-08-17T00:00:00.000Z', '2026-08-24T00:00:00.000Z',
        '2026-08-31T00:00:00.000Z',
    ];
    for (const clave of guardados) {
        // Un miércoles al mediodía de esa semana tiene que dar la misma clave.
        const miercoles = new Date(new Date(clave).getTime() + 2 * DIA + 12 * H);
        assert.equal(iso(idSemanaDe(miercoles)), clave);
    }
});

test('EL BUG: un quiz del domingo a las 7:30 pm cuenta en la semana que termina', () => {
    // Domingo 6 de septiembre, 19:30 en Colombia = lunes 7, 00:30 UTC.
    const domingoNoche = new Date('2026-09-07T00:30:00.000Z');

    // Antes caía en la semana del 7 de septiembre: la XP se le sumaba a la
    // semana siguiente y el ranking del domingo ya se había cerrado.
    assert.equal(iso(inicioSemanaUTCViejo(domingoNoche)), '2026-09-07T00:00:00.000Z');

    // Ahora cae donde el usuario espera: la semana del 31 de agosto.
    const id = idSemanaDe(domingoNoche);
    assert.equal(iso(id), '2026-08-31T00:00:00.000Z');

    const { inicio, fin } = ventanaSemana(id);
    assert.ok(domingoNoche >= inicio && domingoNoche < fin);
});

test('la ventana va de lunes 00:00 a lunes 00:00 hora Colombia', () => {
    const { inicio, fin } = ventanaSemana(new Date('2026-09-07T00:00:00.000Z'));
    assert.equal(iso(inicio), '2026-09-07T05:00:00.000Z'); // lunes 00:00 en Colombia
    assert.equal(iso(fin),    '2026-09-14T05:00:00.000Z');
    assert.equal(fin - inicio, 7 * DIA);
});

test('el primer y el último segundo de la semana caen dentro', () => {
    const id = idSemanaDe(new Date('2026-09-09T15:00:00.000Z'));
    const { inicio, fin } = ventanaSemana(id);

    for (const dentro of [inicio, new Date(fin.getTime() - 1000)]) {
        assert.equal(iso(idSemanaDe(dentro)), iso(id), `${iso(dentro)} debería ser de esta semana`);
    }
    for (const fuera of [new Date(inicio.getTime() - 1000), fin]) {
        assert.notEqual(iso(idSemanaDe(fuera)), iso(id), `${iso(fuera)} no debería ser de esta semana`);
    }
});

test('las semanas encajan sin huecos ni solapes', () => {
    const id = idSemanaDe(new Date('2026-09-09T15:00:00.000Z'));
    for (let i = 0; i < 8; i++) {
        const previa  = ventanaSemana(idSemanaAnterior(id, i + 1));
        const actual  = ventanaSemana(idSemanaAnterior(id, i));
        assert.equal(iso(previa.fin), iso(actual.inicio));
    }
});

test('la semana anterior está exactamente 7 días antes', () => {
    const id = new Date('2026-09-07T00:00:00.000Z');
    assert.equal(iso(idSemanaAnterior(id)),    '2026-08-31T00:00:00.000Z');
    assert.equal(iso(idSemanaAnterior(id, 4)), '2026-08-10T00:00:00.000Z');
});

test('cualquier instante pertenece a una sola semana', () => {
    // Barrido hora a hora durante 10 semanas: todo instante tiene que caer
    // dentro de la ventana de la semana que su propio id dice.
    const desde = new Date('2026-07-01T00:00:00.000Z').getTime();
    for (let t = desde; t < desde + 70 * DIA; t += H) {
        const cuando = new Date(t);
        const { inicio, fin } = ventanaSemana(idSemanaDe(cuando));
        assert.ok(
            cuando >= inicio && cuando < fin,
            `${iso(cuando)} quedó fuera de ${iso(inicio)}..${iso(fin)}`
        );
    }
});

test('el lunes de madrugada el ranking sigue mostrando la semana que no ha cerrado', () => {
    // Lunes 03:00 UTC son las 10 pm del domingo en Colombia: la semana sigue viva.
    const lunesMadrugada = new Date('2026-09-14T03:00:00.000Z');
    assert.equal(iso(idSemanaDe(lunesMadrugada)), '2026-09-07T00:00:00.000Z');

    // Y a las 05:00 UTC (medianoche del lunes en Colombia) ya cambió.
    const lunesMedianoche = new Date('2026-09-14T05:00:00.000Z');
    assert.equal(iso(idSemanaDe(lunesMedianoche)), '2026-09-14T00:00:00.000Z');
});
