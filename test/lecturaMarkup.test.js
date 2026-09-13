// npm test
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

const {
    parsearLectura, textoNormativo, compactar, aplicarCorrecciones, LecturaMarkupError,
} = require('../helpers/lecturaMarkup');

const CABECERA = `@lectura prueba
@titulo Prueba
@temas mod_1_prueba
`;

const parsear = (cuerpo) => parsearLectura(CABECERA + cuerpo).lectura;

// ─── Parser ─────────────────────────────────────────────────────────────────

test('lee la cabecera', () => {
    const { lectura } = parsearLectura(`@lectura sena_x
@titulo Acuerdo X
@temas a, b
@orden 2
@fuente SENA | https://sena.edu.co
@consultado 2026-09-13
@vigencia derogada | Ya no rige.
@correccion e1 => el | typo
@seccion s1 | Uno
Texto.
`);
    assert.equal(lectura.lecturaTag, 'sena_x');
    assert.deepEqual(lectura.topicTags, ['a', 'b']);
    assert.equal(lectura.orden, 2);
    assert.deepEqual(lectura.fuentes, [{ nombre: 'SENA', url: 'https://sena.edu.co' }]);
    assert.deepEqual(lectura.vigencia, { estado: 'derogada', nota: 'Ya no rige.' });
    assert.deepEqual(lectura.correcciones, [{ original: 'e1', corregido: 'el', motivo: 'typo' }]);
});

test('artículo con epígrafe, lista y párrafo final', () => {
    const l = parsear(`@seccion cap-1 | Capítulo I | Arts. 1–3
# Capítulo I
## Fundamentos.
@art 3° | Objetivos.
Los objetivos son:
1. El Aprender a Aprender.
2. El Aprender a Hacer.
Dada la naturaleza, el eje es el Aprender a Hacer.
`);
    const [s] = l.secciones;
    assert.equal(s.rango, 'Arts. 1–3');
    assert.deepEqual(s.bloques.map((b) => b.tipo),
        ['encabezado', 'encabezado', 'articulo', 'parrafo', 'item', 'item', 'parrafo']);
    assert.deepEqual(s.bloques[2], {
        tipo: 'articulo', ancla: 'art-3', numero: '3°', epigrafe: 'Objetivos.', texto: '',
    });
    assert.deepEqual(s.bloques[4], { tipo: 'item', marca: '1.', texto: 'El Aprender a Aprender.', nivel: 0 });
});

test('artículo sin epígrafe con texto en la misma línea', () => {
    const [b] = parsear('@seccion s | S\n@art 43. | | Todos los funcionarios.\n').secciones[0].bloques;
    assert.equal(b.epigrafe, '');
    assert.equal(b.texto, 'Todos los funcionarios.');
});

test('la sangría anida elementos y parágrafos', () => {
    const bloques = parsear(`@seccion s | S
1. Organización:
  a. La relación.
  @par Parágrafo:
    1. La consecución.
@par Parágrafo: | Estas fases.
`).secciones[0].bloques;
    assert.deepEqual(bloques.map((b) => [b.tipo, b.nivel]),
        [['item', 0], ['item', 1], ['paragrafo', 1], ['item', 2], ['paragrafo', 0]]);
    assert.equal(bloques[4].texto, 'Estas fases.');
});

test('marcas: "1°" y "-" pegados, pero "1." exige espacio', () => {
    const bloques = parsear(`@seccion s | S
1° Que el SENA.
-Programación.
1985.Texto que no es lista
\\1. Esto es un párrafo
`).secciones[0].bloques;
    assert.deepEqual(bloques.map((b) => [b.tipo, b.marca]),
        [['item', '1°'], ['item', '-'], ['parrafo', undefined], ['parrafo', undefined]]);
    assert.equal(bloques[3].texto, '1. Esto es un párrafo');
});

test('firmas: una línea en blanco separa firmantes', () => {
    const [b] = parsear(`@seccion s | S
@firmas
ANTONIO DIAZ
Presidente

BERNARDO VARGAS
Secretario
Secretario General
`).secciones[0].bloques;
    assert.deepEqual(b.firmantes, [
        { nombre: 'ANTONIO DIAZ', cargos: ['Presidente'] },
        { nombre: 'BERNARDO VARGAS', cargos: ['Secretario', 'Secretario General'] },
    ]);
});

test('calcula palabras y minutos', () => {
    const texto = Array(360).fill('palabra').join(' ');
    const l = parsear(`@seccion s | S\n${texto}\n`);
    assert.equal(l.secciones[0].palabras, 360);
    assert.equal(l.secciones[0].minutos, 2);
    assert.equal(l.minutosLectura, 2);
});

test('errores de formato', () => {
    const casos = [
        ['@seccion s | S\n@art 1 | A\n@art 1° | B\n', /artículo repetido/],
        ['@seccion s | S\nx\n@seccion s | T\ny\n', /slug repetido/],
        ['@seccion s | S\n@seccion t | T\ny\n', /está vacía/],
        ['@seccion s | S\n@desconocida x\n', /desconocida/],
        ['@seccion s | S\n   tres espacios\n', /múltiplo de 2/],
        ['texto suelto\n', /antes de la primera @seccion/],
    ];
    for (const [cuerpo, error] of casos) {
        assert.throws(() => parsear(cuerpo), (e) => e instanceof LecturaMarkupError && error.test(e.message), cuerpo);
    }
    assert.throws(() => parsearLectura('@titulo X\n@temas t\n@seccion s | S\nx\n'), /falta @lectura/);
    assert.throws(() => parsearLectura(CABECERA + '@vigencia quizas\n@seccion s | S\nx\n'), /@vigencia/);
});

test('avisa de secciones largas y listas sin separar', () => {
    const largo = Array(1300).fill('p').join(' ');
    const { avisos } = parsearLectura(CABECERA + `@seccion s | S\n${largo}\nSerán: 1. Flexibles y 2. Dinámicos\n`);
    assert.equal(avisos.length, 2);
});

// ─── Acuerdo 12 de 1985: fidelidad con la fuente ───────────────────────────

const DIR = path.join(__dirname, '..', 'contenido', 'lecturas');
const acuerdo = parsearLectura(
    fs.readFileSync(path.join(DIR, 'sena_acuerdo_12_1985.lectura.txt'), 'utf8')
);

test('Acuerdo 12: estructura esperada', () => {
    const { lectura, avisos } = acuerdo;
    assert.deepEqual(avisos, []);
    assert.deepEqual(lectura.topicTags, ['mod_2_und_tec_sena']);
    assert.deepEqual(lectura.secciones.map((s) => s.slug),
        ['preambulo', 'cap-1', 'cap-2', 'cap-3', 'cap-4', 'cap-5', 'cap-6', 'cap-7-8']);

    const bloques = lectura.secciones.flatMap((s) => s.bloques);
    const anclas = bloques.filter((b) => b.tipo === 'articulo').map((b) => b.ancla);
    assert.deepEqual(anclas, Array.from({ length: 45 }, (_, i) => `art-${i + 1}`));

    const considerandos = lectura.secciones[0].bloques.filter((b) => b.tipo === 'item' && b.nivel === 0);
    assert.equal(considerandos.length, 9);

    // Art. 2: 13 principios. Art. 3: 3 objetivos + el "eje" como párrafo aparte.
    const cap1 = lectura.secciones[1].bloques;
    const desde = (n) => cap1.findIndex((b) => b.ancla === `art-${n}`);
    assert.equal(cap1.slice(desde(2) + 1, desde(3)).filter((b) => b.tipo === 'item').length, 13);
    const art3 = cap1.slice(desde(3) + 1, desde(4));
    assert.equal(art3.filter((b) => b.tipo === 'item').length, 3);
    assert.match(art3[art3.length - 1].texto, /el eje de la misma es el Aprender a Hacer\.$/);

    for (const s of lectura.secciones) assert.ok(s.palabras <= 1200, s.slug);
    assert.ok(lectura.minutosLectura >= 25 && lectura.minutosLectura <= 32, String(lectura.minutosLectura));
});

test('Acuerdo 12: el texto coincide con la fuente salvo las correcciones declaradas', () => {
    const fuente = fs.readFileSync(path.join(DIR, 'fuentes', 'acuerdo_12_1985.txt'), 'utf8');
    const { texto, sinCoincidencia } = aplicarCorrecciones(compactar(fuente), acuerdo.lectura.correcciones);
    assert.deepEqual(sinCoincidencia, [], 'correcciones que no aparecen en la fuente');

    const lectura = compactar(textoNormativo(acuerdo.lectura));
    if (lectura !== texto) {
        // Muestra dónde empieza la diferencia en vez de volcar 30 KB.
        let i = 0;
        while (i < texto.length && texto[i] === lectura[i]) i++;
        assert.fail(`Difiere en la posición ${i}:\n  fuente:  …${texto.slice(Math.max(0, i - 40), i + 40)}…\n  lectura: …${lectura.slice(Math.max(0, i - 40), i + 40)}…`);
    }
});
