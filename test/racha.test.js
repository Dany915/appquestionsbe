// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const { DIAS_GRACIA, estadoRacha } = require('../helpers/racha');

const H   = 60 * 60 * 1000;
const DIA = 24 * H;

// Domingo 13-09-2026, 16:00 en Colombia (21:00 UTC)
const AHORA = new Date('2026-09-13T21:00:00Z');

// Usuario que jugó hace `dias` días locales, a las 10 am de Colombia
const jugoHace = (dias, extra = {}) => ({
    currentStreak:   5,
    utcOffsetMin:    -300,
    lastAttemptDate: new Date(Date.parse('2026-09-13T15:00:00Z') - dias * DIA),
    ...extra,
});

test('la gracia es de 3 días', () => {
    assert.equal(DIAS_GRACIA, 3);
});

test('jugó hoy: racha viva, cubierto y sin riesgo; expira al terminar el día +3', () => {
    const r = estadoRacha(jugoHace(0), AHORA);
    assert.equal(r.diasSinJugar, 0);
    assert.equal(r.jugoHoy, true);
    assert.equal(r.rachaEfectiva, 5);
    assert.equal(r.cubiertoHoy, true);
    assert.equal(r.enRiesgo, false);
    // Medianoche de Colombia del 17-09 = 05:00 UTC
    assert.equal(r.expiraEn.toISOString(), '2026-09-17T05:00:00.000Z');
});

test('días 1 y 2 sin jugar: sigue viva y hoy no hace falta jugar', () => {
    for (const dias of [1, 2]) {
        const r = estadoRacha(jugoHace(dias), AHORA);
        assert.equal(r.jugoHoy, false);
        assert.equal(r.rachaViva, true);
        assert.equal(r.rachaEfectiva, 5);
        assert.equal(r.cubiertoHoy, true);
        assert.equal(r.enRiesgo, false);
    }
});

test('día 3 sin jugar: último día, en riesgo y expira esta medianoche', () => {
    const r = estadoRacha(jugoHace(3), AHORA);
    assert.equal(r.rachaEfectiva, 5);
    assert.equal(r.cubiertoHoy, false);
    assert.equal(r.enRiesgo, true);
    assert.equal(r.expiraEn.toISOString(), '2026-09-14T05:00:00.000Z');
});

test('día 4 sin jugar: la racha se perdió', () => {
    const r = estadoRacha(jugoHace(4), AHORA);
    assert.equal(r.rachaViva, false);
    assert.equal(r.rachaEfectiva, 0);
    assert.equal(r.cubiertoHoy, false);
    assert.equal(r.enRiesgo, false);
    assert.equal(r.expiraEn, null);
});

test('los días se cuentan en hora local, no en horas transcurridas', () => {
    // Jugó el 10-09 a las 23:30 de Colombia (04:30 UTC del 11): son 3 días
    // locales hasta el 13, aunque en UTC ya sea el 11.
    const user = { currentStreak: 2, utcOffsetMin: -300, lastAttemptDate: new Date('2026-09-11T04:30:00Z') };
    const r = estadoRacha(user, AHORA);
    assert.equal(r.diasSinJugar, 3);
    assert.equal(r.enRiesgo, true);
});

test('sin intentos: sin racha', () => {
    const r = estadoRacha({ currentStreak: 0, lastAttemptDate: null }, AHORA);
    assert.equal(r.diasSinJugar, null);
    assert.equal(r.rachaViva, false);
    assert.equal(r.rachaEfectiva, 0);
    assert.equal(r.cubiertoHoy, false);
    assert.equal(r.expiraEn, null);
});

test('cambio de zona horaria que deja el último intento "en el futuro": cuenta como hoy', () => {
    // Jugó a las 23:00 de Colombia y ahora el usuario está en UTC-10, donde
    // todavía es el día anterior
    const user = { currentStreak: 4, utcOffsetMin: -600, lastAttemptDate: new Date('2026-09-14T04:00:00Z') };
    const r = estadoRacha(user, new Date('2026-09-14T04:30:00Z'));
    assert.equal(r.diasSinJugar, 0);
    assert.equal(r.jugoHoy, true);
    assert.equal(r.rachaEfectiva, 4);
});
