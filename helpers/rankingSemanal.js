const Attempt = require('../models/attempt');
const { ventanaSemana } = require('./semana');

/**
 * XP ganada por cada usuario en una semana, de mayor a menor. La posición de
 * cada usuario es su índice + 1.
 *
 * Es la única fuente del orden del ranking: la usan la pantalla del ranking,
 * el cierre semanal (premios) y los resultados que se muestran al usuario,
 * para que los tres coincidan también en los empates (a igual XP va primero
 * quien la consiguió con menos quizzes).
 *
 * @param idSemana id de la semana (ver `semana.js`)
 * @returns {Promise<Array<{_id, xpSemana, quizzes}>>}
 */
const filasSemana = (idSemana) => {
    const { inicio, fin } = ventanaSemana(idSemana);
    return Attempt.aggregate([
        { $match: { createdAt: { $gte: inicio, $lt: fin }, xpGanada: { $gt: 0 } } },
        {
            $group: {
                _id:      '$userId',
                xpSemana: { $sum: '$xpGanada' },
                quizzes:  { $sum: 1 },
            },
        },
        { $sort: { xpSemana: -1, quizzes: 1, _id: 1 } },
    ]);
};

module.exports = { filasSemana };
