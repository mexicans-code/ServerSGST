import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secret-key-super-seguro-cambialo-en-produccion';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "Auth Service",
        timestamp: new Date().toISOString()
    });
});

// Función para generar JWT
const generateToken = (usuario) => {
    const payload = {
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        rol: usuario.rol,
        nombre: usuario.nombre
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '24h'
    });
};

// Middleware para verificar token
export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({
            success: false,
            error: "Token no proporcionado"
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: "Token inválido o expirado"
        });
    }
};

// ==================== REGISTER ====================
app.post("/register", async (req, res) => {
    const { nombre, apellido_p, apellido_m, email, password, telefono } = req.body;

    if (!nombre || !apellido_p || !apellido_m || !email || !password || !telefono) {
        return res.status(400).json({ 
            success: false,
            error: "Todos los campos son requeridos" 
        });
    }

    try {
        // Verificar si el email ya existe
        const { data: usuarioExistente } = await supabase
            .from('usuario')
            .select('email')
            .eq('email', email)
            .single();

        if (usuarioExistente) {
            return res.status(400).json({ 
                success: false, 
                error: "El email ya está registrado" 
            });
        }

        // Crear usuario
        const { data: usuario, error: errorUsuario } = await supabase
            .from('usuario')
            .insert({
                nombre,
                apellido_p,
                apellido_m,
                email,
                password: bcrypt.hashSync(password, 10),
                rol: 'usuario',
                estado: 'activo'
            })
            .select('*')
            .single();

        if (errorUsuario) {
            console.error('Error al crear usuario:', errorUsuario);
            return res.status(500).json({ 
                success: false, 
                error: errorUsuario.message 
            });
        }

        // Crear perfil
        const { data: perfil, error: errorPerfil } = await supabase
            .from('perfil')
            .insert({
                id_usuario: usuario.id_usuario,
                telefono: telefono
            })
            .select('*')
            .single();

        if (errorPerfil) {
            console.error('Error al crear perfil:', errorPerfil);
            return res.status(500).json({ 
                success: false, 
                error: errorPerfil.message 
            });
        }

        const token = generateToken(usuario);
        const { password: _, ...usuarioSinPassword } = usuario;

        return res.status(201).json({
            success: true,
            message: "Usuario registrado exitosamente",
            token: token,
            usuario: usuarioSinPassword,
            perfil: perfil
        });
    } catch (error) {
        console.error('Error en registro:', error);
        return res.status(500).json({ 
            success: false, 
            error: "Error al registrar usuario" 
        });
    }
});

// ==================== LOGIN ====================
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: "Email y contraseña son requeridos"
        });
    }

    try {
        const { data: usuario, error: errorUsuario } = await supabase
            .from('usuario')
            .select('*')
            .eq('email', email)
            .single();

        if (errorUsuario || !usuario) {
            return res.status(401).json({
                success: false,
                error: "Credenciales inválidas"
            });
        }

        if (usuario.estado !== 'activo') {
            return res.status(403).json({
                success: false,
                error: "Usuario inactivo. Contacte al administrador"
            });
        }

        const validPassword = bcrypt.compareSync(password, usuario.password);

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: "Credenciales inválidas"
            });
        }

        const token = generateToken(usuario);
        const { password: _, ...usuarioSinPassword } = usuario;

        return res.status(200).json({
            success: true,
            message: "Login exitoso",
            token: token,
            usuario: usuarioSinPassword
        });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({
            success: false,
            error: "Error al procesar login"
        });
    }
});

// ==================== GOOGLE LOGIN ====================
app.post('/google-login', async (req, res) => {
    try {
        const { credential } = req.body;

        // ===== LOGS DE DEBUG =====
        console.log('\n========== GOOGLE LOGIN DEBUG ==========');
        console.log('1. GOOGLE_CLIENT_ID en backend:', GOOGLE_CLIENT_ID);
        console.log('2. Credential recibido (primeros 50 chars):', credential?.substring(0, 50));
        
        // Decodificar el token para ver el audience
        if (credential) {
            try {
                const base64Url = credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const decoded = JSON.parse(jsonPayload);
                
                console.log('3. Audience (aud) en el token:', decoded.aud);
                console.log('4. Issuer (iss) en el token:', decoded.iss);
                console.log('5. ¿Coinciden?', decoded.aud === GOOGLE_CLIENT_ID);
            } catch (decodeError) {
                console.log('Error al decodificar token:', decodeError.message);
            }
        }
        console.log('========================================\n');

        if (!credential) {
            return res.status(400).json({
                success: false,
                error: "Credential de Google no proporcionado"
            });
        }

        if (!GOOGLE_CLIENT_ID) {
            console.error('GOOGLE_CLIENT_ID no está configurado en las variables de entorno');
            return res.status(500).json({
                success: false,
                error: "Configuración de Google OAuth no disponible"
            });
        }

        // Verificar el token de Google
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        console.log('Usuario de Google autenticado:', { email, name, googleId });

        // Buscar usuario por email
        const { data: usuarioExistente, error: errorBusqueda } = await supabase
            .from('usuario')
            .select('*')
            .eq('email', email)
            .single();

        let usuario;

        if (usuarioExistente) {
            // Usuario existe - simplemente usarlo
            usuario = usuarioExistente;

            // Actualizar foto en perfil si existe la foto de Google
            if (picture) {
                await supabase
                    .from('perfil')
                    .update({ foto: picture })
                    .eq('id_usuario', usuarioExistente.id_usuario);
            }
        } else {
            // Usuario nuevo - crear cuenta
            const nombrePartes = name.split(' ');
            const nombre = nombrePartes[0] || name;
            const apellido_p = nombrePartes[1] || '';
            const apellido_m = nombrePartes[2] || '';

            const { data: nuevoUsuario, error: errorCrear } = await supabase
                .from('usuario')
                .insert({
                    nombre: nombre,
                    apellido_p: apellido_p,
                    apellido_m: apellido_m,
                    email: email,
                    password: bcrypt.hashSync(Math.random().toString(36), 10), // Password random
                    rol: 'usuario',
                    estado: 'activo'
                })
                .select('*')
                .single();

            if (errorCrear) {
                console.error('Error al crear usuario con Google:', errorCrear);
                return res.status(500).json({
                    success: false,
                    error: "Error al crear usuario"
                });
            }

            // Crear perfil básico con foto de Google
            await supabase
                .from('perfil')
                .insert({
                    id_usuario: nuevoUsuario.id_usuario,
                    telefono: '',
                    foto: picture || null
                });

            usuario = nuevoUsuario;
        }

        // Verificar estado del usuario
        if (usuario.estado !== 'activo') {
            return res.status(403).json({
                success: false,
                error: "Usuario inactivo. Contacte al administrador"
            });
        }

        // Generar token JWT
        const token = generateToken(usuario);
        const { password: _, ...usuarioSinPassword } = usuario;

        return res.status(200).json({
            success: true,
            message: "Login con Google exitoso",
            token: token,
            usuario: usuarioSinPassword
        });

    } catch (error) {
        console.error('Error en Google login:', error);
        console.error('Error completo:', error.stack);
        return res.status(500).json({
            success: false,
            error: error.message || "Error al procesar login con Google"
        });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false,
        error: "Error interno del servidor" 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server started on port ${PORT}`);
    console.log(`📡 Auth API available at: http://localhost:${PORT}`);
    console.log(`🔐 JWT Secret configured: ${JWT_SECRET ? 'Yes' : 'No (using default)'}`);
    console.log(`🔑 Google OAuth configured: ${GOOGLE_CLIENT_ID ? 'Yes' : 'No'}`);
    console.log(`🔑 GOOGLE_CLIENT_ID value: ${GOOGLE_CLIENT_ID}`);
});