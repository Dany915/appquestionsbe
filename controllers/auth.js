const { response }    = require('express');
const bcrypt          = require('bcryptjs');
const jwt             = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/user');

// ─── Configuración ────────���────────────────────────────────────────────────────

// Se instancia una sola vez al cargar el módulo (no en cada petición).
// GOOGLE_CLIENT_ID admite varios IDs separados por coma (ej: el cliente web
// que usa la app Flutter como serverClientId + otros clientes del proyecto).
// El token se acepta si su `aud` coincide con cualquiera de la lista.
const googleClientIds = (process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const googleClient = new OAuth2Client(googleClientIds[0]);

// ─── Helpers ──────────────────────────────────────────────────���────────────────

/**
 * Genera un JWT firmado con el ID del usuario.
 * La duración se toma de JWT_EXPIRES_IN en el .env (default: 2h).
 */
const generarJWT = (uid) => {
    return new Promise((resolve, reject) => {
        jwt.sign(
            { uid },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '2h' },
            (err, token) => {
                if (err) reject('No se pudo generar el token.');
                else resolve(token);
            }
        );
    });
};

/**
 * Retorna solo los campos del usuario que se envían al cliente.
 * Evita exponer la contraseña hasheada u otros campos internos.
 */
const formatearUsuario = (user) => ({
    uid:      user._id,
    username: user.username,
    email:    user.email,
    role:     user.role,
    plan:     user.plan || 'free',
    avatar:   user.avatar,
});

// ─── Endpoints ─────────────────────────────────────────────────��───────────────

/**
 * POST /api/auth/register
 * Crea una cuenta nueva con email y contraseña.
 * Body: { username, email, password }
 */
const register = async (req, res = response) => {
    const { username, email, password } = req.body;

    try {
        // Verificar unicidad de email y username en una sola consulta
        const existente = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username }],
        });

        if (existente) {
            const msg = existente.email === email.toLowerCase()
                ? 'El email ya está registrado.'
                : 'El nombre de usuario ya está en uso.';
            return res.status(400).json({ ok: false, msg });
        }

        // Hashear la contraseña antes de guardar
        const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync());

        const nuevoUsuario = new User({
            username,
            email:    email.toLowerCase(),
            password: passwordHash,
        });

        await nuevoUsuario.save();

        const token = await generarJWT(nuevoUsuario._id);

        return res.status(201).json({
            ok: true,
            token,
            user: formatearUsuario(nuevoUsuario),
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al registrar el usuario.' });
    }
};

/**
 * POST /api/auth/login
 * Inicia sesión con email y contraseña.
 * Body: { email, password }
 *
 * NOTA: Se usa el mismo mensaje "Credenciales incorrectas" tanto si el email
 * no existe como si la contraseña es incorrecta. Esto es intencional para no
 * revelar si un email está o no registrado.
 */
const login = async (req, res = response) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email: email.toLowerCase() });

        // Email no encontrado (mismo mensaje que contraseña incorrecta por seguridad)
        if (!user) {
            return res.status(400).json({ ok: false, msg: 'Credenciales incorrectas.' });
        }

        if (!user.active) {
            return res.status(401).json({ ok: false, msg: 'Tu cuenta ha sido desactivada.' });
        }

        // Esta cuenta fue creada con Google y no tiene contraseña
        if (!user.password) {
            return res.status(400).json({
                ok:  false,
                msg: 'Esta cuenta fue registrada con Google. Usa el botón de Google para ingresar.',
            });
        }

        // Verificar contraseña
        const passwordValida = bcrypt.compareSync(password, user.password);
        if (!passwordValida) {
            return res.status(400).json({ ok: false, msg: 'Credenciales incorrectas.' });
        }

        const token = await generarJWT(user._id);

        return res.status(200).json({
            ok: true,
            token,
            user: formatearUsuario(user),
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al iniciar sesión.' });
    }
};

/**
 * POST /api/auth/google
 * Inicia sesión o registra al usuario usando Google Sign-In.
 * Body: { token } → el ID token que entrega Google al hacer Sign-In en Flutter/web.
 *
 * Flujo:
 *   1. Verifica el token con Google
 *   2. Busca al usuario por googleId, luego por email
 *   3. Si no existe → crea la cuenta automáticamente
 *   4. Si existe → vincula el googleId si aún no lo tenía
 *   5. Retorna JWT propio de la app
 */
const googleLogin = async (req, res = response) => {
    const { token } = req.body;

    try {
        // Verificar el token con Google (lanza error si es inválido o expirado)
        const ticket = await googleClient.verifyIdToken({
            idToken:  token,
            audience: googleClientIds,
        });

        const { sub: googleId, email, name, picture } = ticket.getPayload();

        // Buscar usuario existente: primero por googleId, luego por email
        // (el segundo caso vincula una cuenta existente con Google)
        let user = await User.findOne({ googleId })
                ?? await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Usuario nuevo: generar un username único a partir del nombre de Google
            const base    = name.replace(/\s+/g, '').toLowerCase().substring(0, 20);
            let username  = base;
            let contador  = 1;

            // Incrementar hasta encontrar un username disponible
            while (await User.findOne({ username })) {
                username = `${base}${contador}`;
                contador++;
            }

            user = new User({
                username,
                email:    email.toLowerCase(),
                googleId,
                avatar:   picture || '',
                password: null, // sin contraseña — solo puede entrar por Google
            });

        } else {
            // Usuario existente: vincular googleId si aún no lo tiene y
            // sincronizar el avatar con la foto actual de Google en cada login
            if (!user.googleId) user.googleId = googleId;
            if (picture)        user.avatar   = picture;
        }

        if (!user.active) {
            return res.status(401).json({ ok: false, msg: 'Tu cuenta ha sido desactivada.' });
        }

        await user.save();

        const jwtToken = await generarJWT(user._id);

        return res.status(200).json({
            ok:    true,
            token: jwtToken,
            user:  formatearUsuario(user),
        });

    } catch (error) {
        console.error(error);

        // Errores conocidos de google-auth-library
        if (error.message?.includes('Invalid token') || error.message?.includes('Token used too late')) {
            return res.status(401).json({ ok: false, msg: 'El token de Google es inválido o ha expirado.' });
        }
        // Audiencia incorrecta: el token viene de un client ID no registrado en GOOGLE_CLIENT_ID
        if (error.message?.includes('audience') || error.message?.includes('Wrong recipient')) {
            return res.status(401).json({ ok: false, msg: 'El token de Google no corresponde a esta aplicación.' });
        }

        return res.status(500).json({ ok: false, msg: 'Error interno al autenticar con Google.' });
    }
};

/**
 * GET /api/auth/renew
 * Renueva el JWT del usuario autenticado. Requiere token válido (validarJWT).
 * Útil para que Flutter renueve el token antes de que expire sin pedir login de nuevo.
 */
const renovarToken = async (req, res = response) => {
    try {
        const token = await generarJWT(req.uid);

        return res.status(200).json({
            ok:    true,
            token,
            user:  formatearUsuario(req.user),
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al renovar el token.' });
    }
};

/**
 * PUT /api/auth/plan/:userId
 * Cambia el plan de un usuario (free/pro). Solo admin.
 *
 * Uso temporal para pruebas y gestión manual. Cuando se integre la suscripción
 * de Google Play Billing, el plan se actualizará automáticamente al verificar
 * el purchaseToken — este endpoint quedará como herramienta de soporte.
 */
const cambiarPlan = async (req, res = response) => {
    const { userId } = req.params;
    const { plan }   = req.body;

    try {
        const user = await User.findByIdAndUpdate(userId, { plan }, { new: true });

        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        return res.status(200).json({
            ok:   true,
            msg:  `Plan actualizado a "${plan}".`,
            user: formatearUsuario(user),
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error interno al cambiar el plan.' });
    }
};

module.exports = { register, login, googleLogin, renovarToken, cambiarPlan };
