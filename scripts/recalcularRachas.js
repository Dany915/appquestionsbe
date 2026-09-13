/**
 * Recalcula la racha de cada usuario desde su historial de intentos con la
 * regla de días de gracia (DIAS_GRACIA en helpers/racha.js). Es la recompensa
 * por la participación previa al cambio de regla.
 *
 *   node scripts/recalcularRachas.js            → solo muestra qué cambiaría
 *   node scripts/recalcularRachas.js --aplicar  → escribe los cambios
 *
 * ⚠️ Aplicar DESPUÉS de desplegar el backend con la regla nueva: con el código
 * viejo una racha recalculada cuyo último día fue hace 2-3 días se mostraría
 * como 0 y se reiniciaría en el siguiente intento.
 *
 * Qué hace:
 *   - currentStreak = max(guardada, recalculada). Solo si el último intento
 *     del historial cae el mismo día que lastAttemptDate; si no, el historial
 *     está incompleto y no se toca.
 *   - maxStreak = max(guardada, recalculada). Nunca se le quita racha a nadie.
 *   - Otorga los marcos de racha que alcance la nueva maxStreak (quedan en la
 *     cola de avisos para que la app los celebre).
 *
 * Es idempotente: ejecutarlo otra vez no cambia nada.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User    = require('../models/user');
const Attempt = require('../models/attempt');
const { DIAS_GRACIA, estadoRacha } = require('../helpers/racha');
const { offsetDe, inicioDiaLocal } = require('../helpers/diaLocal');
const { marcosPorRacha } = require('../helpers/frameRewards');
const { otorgarMarcos }  = require('../helpers/frames');

const DIA_MS  = 24 * 60 * 60 * 1000;
const APLICAR = process.argv.includes('--aplicar');

// Cuentas del dueño (pruebas): no se tocan
const EXCLUIDOS = new Set([
    '6a21f3b7adfdbeea0cda3ade', // darkfeizzer
    '6a21f674adfdbeea0cda3b22', // Daniel Martinez
    '6a4921617701ddc6aaaacb21', // messi
]);

/**
 * Racha máxima y racha al final del historial, contando días locales activos
 * y reiniciando cuando entre dos días activos pasan más de DIAS_GRACIA días.
 */
const rachasDesdeDias = (dias) => {
    let actual = 0;
    let maxima = 0;
    for (let i = 0; i < dias.length; i++) {
        const salto = i === 0 ? Infinity : Math.round((dias[i] - dias[i - 1]) / DIA_MS);
        actual = salto <= DIAS_GRACIA ? actual + 1 : 1;
        maxima = Math.max(maxima, actual);
    }
    return { actual, maxima };
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Conectado a MongoDB — modo ${APLICAR ? 'APLICAR' : 'simulación (sin escribir)'}`);
    console.log(`Días de gracia: ${DIAS_GRACIA}\n`);

    const [users, intentos] = await Promise.all([
        User.find({}, 'username displayName currentStreak maxStreak lastAttemptDate utcOffsetMin marcosDesbloqueados').lean(),
        Attempt.find({}, 'userId createdAt').lean(),
    ]);

    const fechasPorUsuario = new Map();
    for (const { userId, createdAt } of intentos) {
        const k = String(userId);
        if (!fechasPorUsuario.has(k)) fechasPorUsuario.set(k, []);
        fechasPorUsuario.get(k).push(createdAt);
    }

    const cambios = [];
    let sinHistorialCompleto = 0;

    for (const user of users) {
        const id = String(user._id);
        if (EXCLUIDOS.has(id)) continue;

        const fechas = fechasPorUsuario.get(id);
        if (!fechas?.length) continue;

        const offset = offsetDe(user);
        const dias = [...new Set(fechas.map((f) => inicioDiaLocal(f, offset).getTime()))].sort((a, b) => a - b);
        const { actual, maxima } = rachasDesdeDias(dias);

        const antesActual = user.currentStreak || 0;
        const antesMax    = user.maxStreak || 0;

        // La racha guardada corresponde al día de lastAttemptDate: solo se
        // puede sustituir si el historial termina ese mismo día.
        const historialCuadra = user.lastAttemptDate &&
            inicioDiaLocal(user.lastAttemptDate, offset).getTime() === dias[dias.length - 1];
        if (!historialCuadra) sinHistorialCompleto++;

        const nuevaActual = historialCuadra ? Math.max(antesActual, actual) : antesActual;
        const nuevoMax    = Math.max(antesMax, maxima, nuevaActual);

        const tiene = new Set(user.marcosDesbloqueados || []);
        const marcosNuevos = marcosPorRacha(nuevoMax).filter((m) => !tiene.has(m));

        if (nuevaActual === antesActual && nuevoMax === antesMax && marcosNuevos.length === 0) continue;

        cambios.push({
            user,
            antesActual, nuevaActual, antesMax, nuevoMax, marcosNuevos,
            // Lo que verá en la app con la regla nueva
            visibleHoy: estadoRacha({ ...user, currentStreak: nuevaActual }).rachaEfectiva,
        });
    }

    console.log('Usuario                     Racha guardada   Racha máx   Se ve hoy   Marcos nuevos');
    console.log('─'.repeat(90));
    for (const c of cambios) {
        const nombre = (c.user.displayName || c.user.username || '').slice(0, 26).padEnd(27);
        const actual = `${c.antesActual} → ${c.nuevaActual}`.padEnd(17);
        const max    = `${c.antesMax} → ${c.nuevoMax}`.padEnd(12);
        const hoy    = String(c.visibleHoy).padEnd(12);
        console.log(`${nombre} ${actual}${max}${hoy}${c.marcosNuevos.join(', ') || '—'}`);
    }
    console.log('─'.repeat(90));
    console.log(`${cambios.length} usuarios con cambios.`);
    if (sinHistorialCompleto) {
        console.log(`${sinHistorialCompleto} usuarios con historial que no termina en lastAttemptDate: solo se revisó su racha máxima.`);
    }

    if (!APLICAR) {
        console.log('\nSimulación: no se escribió nada. Usa --aplicar para guardar.');
        await mongoose.disconnect();
        return;
    }

    let aplicados = 0;
    let omitidos  = 0;
    for (const c of cambios) {
        // Si jugó mientras corría el script, su racha ya la movió el servidor
        const { modifiedCount, matchedCount } = await User.updateOne(
            { _id: c.user._id, lastAttemptDate: c.user.lastAttemptDate },
            { $set: { currentStreak: c.nuevaActual }, $max: { maxStreak: c.nuevoMax } },
        );
        if (matchedCount === 0) { omitidos++; continue; }
        if (c.marcosNuevos.length) await otorgarMarcos(c.user._id, c.marcosNuevos);
        if (modifiedCount || c.marcosNuevos.length) aplicados++;
    }

    console.log(`\nAplicado a ${aplicados} usuarios. Omitidos por jugar durante el script: ${omitidos}.`);
    await mongoose.disconnect();
})().catch(async (e) => {
    console.error('Error:', e.message);
    await mongoose.disconnect();
    process.exit(1);
});
