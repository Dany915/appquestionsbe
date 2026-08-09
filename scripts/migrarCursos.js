/**
 * Migración: introduce el nivel "Curso" por encima de los módulos.
 *
 *   node scripts/migrarCursos.js
 *
 * Qué hace:
 *   1. Crea el curso SENA si no existe.
 *   2. Asigna cursoTag: "sena" a los temas que aún no tengan curso.
 *
 * Es idempotente y NO borra nada: se puede ejecutar varias veces sin efecto.
 * Las preguntas no se tocan — apuntan al tema por ObjectId y ese vínculo
 * no cambia.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const Curso = require('../models/curso');
const Topic = require('../models/topic');

// Curso al que se asignan los temas que ya existían
const CURSO_POR_DEFECTO = {
    cursoTag:    'sena',
    label:       'SENA',
    descripcion: 'Prepárate para el concurso del SENA',
    emoji:       '🎓',
    orden:       1,
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB\n');

    // 1. Curso por defecto
    let curso = await Curso.findOne({ cursoTag: CURSO_POR_DEFECTO.cursoTag });
    if (curso) {
        console.log(`✓ El curso "${curso.label}" ya existía`);
    } else {
        curso = await Curso.create(CURSO_POR_DEFECTO);
        console.log(`✓ Curso creado: ${curso.label} (${curso.cursoTag})`);
    }

    // 2. Temas huérfanos → curso por defecto
    const sinCurso = await Topic.countDocuments({
        $or: [{ cursoTag: { $exists: false } }, { cursoTag: null }, { cursoTag: '' }],
    });

    if (sinCurso === 0) {
        console.log('✓ Todos los temas ya tienen curso asignado');
    } else {
        const res = await Topic.updateMany(
            { $or: [{ cursoTag: { $exists: false } }, { cursoTag: null }, { cursoTag: '' }] },
            { $set: { cursoTag: CURSO_POR_DEFECTO.cursoTag } }
        );
        console.log(`✓ ${res.modifiedCount} tema(s) asignados a "${CURSO_POR_DEFECTO.cursoTag}"`);
    }

    // 3. Resumen
    console.log('\nEstado final:');
    const resumen = await Topic.aggregate([
        { $group: { _id: '$cursoTag', temas: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    for (const r of resumen) {
        console.log(`  ${String(r._id).padEnd(24)} ${r.temas} tema(s)`);
    }

    await mongoose.disconnect();
    console.log('\nMigración completada.');
})().catch((err) => {
    console.error('ERROR en la migración:', err.message);
    process.exit(1);
});
