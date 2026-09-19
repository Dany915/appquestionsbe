// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const { mensajeResultado } = require('../helpers/mensajeSemana');

// Semana de 48 jugadores: el 1º hizo 2000 XP, el 3º 1500 y el 10º 900
const base = { totalParticipantes: 48, xpPrimero: 2000, xpTercero: 1500, xpDecimo: 900, posicionAnterior: null };
const res  = (posicion, xpSemana, extra = {}) => mensajeResultado({ ...base, posicion, xpSemana, ...extra }, 'u1:semana');

test('nº 1', () => {
    const m = res(1, 2000);
    assert.equal(m.grupo, 'primero');
    assert.match(m.titulo, /Campeón|Nº 1/);
    assert.equal(m.mensaje, 'Nadie sumó más XP que tú: quedaste nº 1 de 48 jugadores.');
});

test('nº 1 repetido', () => {
    const m = res(1, 2000, { posicionAnterior: 1 });
    assert.equal(m.titulo, '¡Campeón otra vez!');
});

test('único jugador de la semana', () => {
    const m = mensajeResultado({ posicion: 1, totalParticipantes: 1, xpSemana: 300, xpPrimero: 300 }, 'x');
    assert.equal(m.mensaje, 'Terminaste en lo más alto del ranking con 300 XP.');
});

test('podio: XP que faltó para el nº 1', () => {
    const m = res(2, 1800);
    assert.equal(m.grupo, 'podio');
    assert.equal(m.mensaje, 'Quedaste 2º de 48 jugadores. Te faltaron 201 XP para el nº 1.');
});

test('top 10: XP que faltó para el podio', () => {
    const m = res(7, 1380);
    assert.equal(m.grupo, 'top10');
    assert.equal(m.mensaje, 'Quedaste 7º de 48 jugadores. Te faltaron 121 XP para el podio.');
});

test('mitad superior: XP que faltó para el top 10', () => {
    const m = res(17, 700);
    assert.equal(m.grupo, 'mitad');
    assert.equal(m.mensaje, 'Quedaste 17º de 48 jugadores. Te faltaron 201 XP para el top 10.');
});

test('resto: mensaje de ánimo', () => {
    const m = res(35, 80);
    assert.equal(m.grupo, 'resto');
    assert.equal(m.mensaje, 'Quedaste 35º de 48 jugadores. La nueva semana ya empezó: cada quiz cuenta.');
});

test('si subió puestos se dice eso en lugar de la XP que faltó', () => {
    assert.equal(res(17, 700, { posicionAnterior: 23 }).mensaje, 'Quedaste 17º de 48 jugadores. Subiste 6 puestos.');
    assert.equal(res(4, 1400, { posicionAnterior: 5 }).mensaje, 'Quedaste 4º de 48 jugadores. Subiste 1 puesto.');
});

test('si bajó no se menciona', () => {
    assert.equal(res(35, 80, { posicionAnterior: 12 }).mensaje, 'Quedaste 35º de 48 jugadores. La nueva semana ya empezó: cada quiz cuenta.');
});

test('empate en XP con el objetivo: falta 1 XP', () => {
    assert.match(res(4, 1500).mensaje, /Te faltaron 1 XP para el podio/);
});

test('la variante del título es estable para la misma semilla', () => {
    const a = mensajeResultado({ ...base, posicion: 7, xpSemana: 1000 }, 'abc:2026-09-07');
    const b = mensajeResultado({ ...base, posicion: 7, xpSemana: 1000 }, 'abc:2026-09-07');
    assert.equal(a.titulo, b.titulo);
});
