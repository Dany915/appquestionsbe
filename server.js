const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { dbConnection } = require('./database/config');

class Server {

    constructor() {
        this.app  = express();
        this.port = process.env.PORT;
        this.paths = {
            auth:      '/api/auth',
            question:  '/api/question',
            quiz:      '/api/quiz',
            topic:     '/api/topic',
            stats:     '/api/stats',
            userStats: '/api/user-stats',
        };

        this.conectarBD();
        this.middlewares();
        this.routes();
    }

    async conectarBD() {
        await dbConnection();
    }

    middlewares() {
        this.app.use(cors());
        this.app.use(express.json());
        // Archivos públicos (política de privacidad, etc.)
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    routes() {
        // Política de privacidad — URL para la ficha de Google Play
        this.app.get('/privacidad', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'privacidad.html'));
        });

        // Eliminación de cuenta/datos — URL requerida por Google Play
        this.app.get('/eliminar-cuenta', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'eliminar-cuenta.html'));
        });

        this.app.use(this.paths.auth,     require('./routes/auth'));
        this.app.use(this.paths.question, require('./routes/question'));
        this.app.use(this.paths.quiz,     require('./routes/quiz'));
        this.app.use(this.paths.topic,    require('./routes/topic'));
        this.app.use(this.paths.stats,     require('./routes/stats'));
        this.app.use(this.paths.userStats, require('./routes/userStats'));
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log('Servidor corriendo en puerto', this.port);
        });
    }
}

module.exports = Server;
