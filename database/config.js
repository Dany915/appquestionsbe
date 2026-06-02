const mongoose = require('mongoose');

const dbConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Base de datos conectada');
    } catch (error) {
        console.error(error);
        throw new Error('Error al iniciar la base de datos');
    }
};

module.exports = { dbConnection };
