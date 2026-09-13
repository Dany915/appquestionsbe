/**
 * Importa (o actualiza) una lectura desde su archivo de contenido.
 *
 *   node scripts/importarLectura.js contenido/lecturas/sena_acuerdo_12_1985.lectura.txt
 *   node scripts/importarLectura.js <archivo> --aplicar
 *
 * Sin --aplicar solo simula: valida el archivo, comprueba que existan los
 * temas y muestra qué cambiaría. Nada se escribe.
 *
 * Con --aplicar crea la lectura o la reemplaza por lecturaTag. La versión
 * sube solo si el contenido cambió. Es idempotente y NO borra nada: para
 * retirar una lectura se marca active: false.
 *
 * Ojo: escribe en la base de MONGO_URI del .env. El host se imprime antes de
 * hacer nada para que no haya dudas de a qué base se apunta.
 */
require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const mongoose = require('mongoose');

const Lectura = require('../models/lectura');
const Topic   = require('../models/topic');
const { parsearLectura } = require('../helpers/lecturaMarkup');

const args    = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const archivo = args.find((a) => !a.startsWith('--'));

if (!archivo) {
    console.error('Uso: node scripts/importarLectura.js <archivo.lectura.txt> [--aplicar]');
    process.exit(1);
}

const hostDe = (uri) => {
    try {
        return new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).host;
    } catch {
        return '(URI no reconocida)';
    }
};

(async () => {
    // 1. Parsear y validar el contenido antes de tocar la base
    const fuente = fs.readFileSync(path.resolve(archivo), 'utf8');
    const { lectura, avisos } = parsearLectura(fuente);

    console.log(`Lectura:   ${lectura.titulo} (${lectura.lecturaTag})`);
    console.log(`Temas:     ${lectura.topicTags.join(', ')}`);
    console.log(`Secciones: ${lectura.secciones.length} · ${lectura.totalPalabras} palabras · ~${lectura.minutosLectura} min`);
    for (const s of lectura.secciones) {
        console.log(`  ${String(s.orden).padStart(2)}. ${s.slug.padEnd(12)} ${String(s.palabras).padStart(5)} pal. ${String(s.minutos).padStart(2)} min  ${s.titulo}`);
    }
    console.log(`Correcciones declaradas: ${lectura.correcciones.length}`);
    for (const a of avisos) console.log(`  ⚠ ${a}`);

    // La huella ignora campos derivados del momento de importación
    const hash = crypto.createHash('sha256').update(JSON.stringify(lectura)).digest('hex');

    // 2. Conectar
    console.log(`\nBase de datos: ${hostDe(process.env.MONGO_URI || '')}`);
    console.log(aplicar ? 'Modo: APLICAR (se escribirá)\n' : 'Modo: simulación (no se escribe nada)\n');
    await mongoose.connect(process.env.MONGO_URI);

    // 3. Los temas deben existir
    const temas = await Topic.find({ topicTag: { $in: lectura.topicTags } }).select('topicTag label active').lean();
    const faltan = lectura.topicTags.filter((t) => !temas.some((x) => x.topicTag === t));
    if (faltan.length > 0) {
        throw new Error(`No existen los temas: ${faltan.join(', ')}. Créalos antes de importar.`);
    }
    for (const t of temas) {
        console.log(`✓ Tema ${t.topicTag} → "${t.label}"${t.active ? '' : ' (inactivo)'}`);
    }

    // 4. Comparar con lo que hay
    const actual = await Lectura.findOne({ lecturaTag: lectura.lecturaTag }).select('+hash').lean();
    let version = 1;
    if (!actual) {
        console.log('→ La lectura no existe: se creará con versión 1.');
    } else if (actual.hash === hash) {
        console.log(`✓ Sin cambios respecto a la versión ${actual.version}.`);
        version = actual.version;
    } else {
        version = actual.version + 1;
        const antes = new Set(actual.secciones.map((s) => s.slug));
        const despues = new Set(lectura.secciones.map((s) => s.slug));
        const nuevas = [...despues].filter((s) => !antes.has(s));
        const quitadas = [...antes].filter((s) => !despues.has(s));
        console.log(`→ Cambió el contenido: versión ${actual.version} → ${version}.`);
        if (nuevas.length) console.log(`  Secciones nuevas: ${nuevas.join(', ')}`);
        if (quitadas.length) console.log(`  Secciones que desaparecen: ${quitadas.join(', ')} (el progreso de lectura de esas se pierde)`);
    }

    // 5. Escribir
    if (!aplicar) {
        console.log('\nSimulación terminada. Repite con --aplicar para guardar.');
    } else if (actual && actual.hash === hash) {
        console.log('\nNada que guardar.');
    } else {
        await Lectura.findOneAndUpdate(
            { lecturaTag: lectura.lecturaTag },
            // active no se toca al actualizar: si alguien la retiró, sigue retirada
            { $set: { ...lectura, version, hash }, $setOnInsert: { active: true } },
            { upsert: true, runValidators: true }
        );
        console.log(`\n✓ Lectura guardada (versión ${version}).`);
    }

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('ERROR en la importación:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
