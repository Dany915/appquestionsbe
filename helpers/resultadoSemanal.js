const User             = require('../models/user');
const WeeklyClose      = require('../models/weeklyClose');
const ResultadoSemanal = require('../models/resultadoSemanal');
const { filasSemana }       = require('./rankingSemanal');
const { idSemanaAnterior }  = require('./semana');

/**
 * Guarda la posición final de cada participante de una semana.
 *
 * Idempotente: el índice único (userId, semana) descarta los que ya existían,
 * así que se puede llamar varias veces o desde dos peticiones a la vez.
 *
 * @returns {Promise<number>} cuántos resultados nuevos se guardaron
 */
const generarResultados = async (idSemana) => {
    const [filas, anteriores] = await Promise.all([
        filasSemana(idSemana),
        filasSemana(idSemanaAnterior(idSemana)),
    ]);
    if (filas.length === 0) return 0;

    const posAnterior = new Map(anteriores.map((f, i) => [String(f._id), i + 1]));
    const xpEn = (pos) => filas[pos - 1]?.xpSemana ?? null;

    const activos = await User.find({ _id: { $in: filas.map((f) => f._id) }, active: true }, '_id').lean();
    const esActivo = new Set(activos.map((u) => String(u._id)));

    const docs = [];
    filas.forEach((f, i) => {
        if (!esActivo.has(String(f._id))) return;
        docs.push({
            userId:             f._id,
            semana:             idSemana,
            posicion:           i + 1,
            totalParticipantes: filas.length,
            xpSemana:           f.xpSemana,
            posicionAnterior:   posAnterior.get(String(f._id)) ?? null,
            xpPrimero:          xpEn(1),
            xpTercero:          xpEn(3),
            xpDecimo:           xpEn(10),
        });
    });

    try {
        const insertados = await ResultadoSemanal.insertMany(docs, { ordered: false });
        return insertados.length;
    } catch (error) {
        // Duplicados = ya estaban generados. Cualquier otro error sí importa
        const errores = error?.writeErrors || [];
        if (errores.length > 0 && errores.every((e) => (e.code ?? e.err?.code) === 11000)) {
            return error.insertedDocs?.length ?? 0;
        }
        throw error;
    }
};

/**
 * Asegura que los resultados de una semana cerrada existan. Las semanas que se
 * cerraron antes de existir esta función se generan la primera vez que alguien
 * los pide.
 */
const asegurarResultados = async (cierre) => {
    if (cierre.resultadosGenerados) return;
    await generarResultados(cierre.inicioSemana);
    await WeeklyClose.updateOne({ _id: cierre._id }, { resultadosGenerados: true });
};

module.exports = { generarResultados, asegurarResultados };
