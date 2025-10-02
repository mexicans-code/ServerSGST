import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

dotenv.config({ path: '../../.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());
app.use(cors());

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido', detalle: err.message });
        }
        req.usuario = decoded;
        next();
    });
};

// GET - Obtener perfil del usuario
app.get("/getProfile", verifyToken, async (req, res) => {
    try {
        const { data: dataUsuario, error: errorUsuario } = await supabase
            .from("usuario")
            .select("*")
            .eq('id_usuario', req.usuario.id_usuario)
            .single();

        if (errorUsuario) {
            return res.status(400).json({ success: false, error: errorUsuario.message });
        }

        if (!dataUsuario) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        const { data: dataPerfil, error: errorPerfil } = await supabase
            .from("perfil")
            .select("*")
            .eq('id_usuario', req.usuario.id_usuario)
            .single();

        if (errorPerfil && errorPerfil.code !== 'PGRST116') {
            console.log('Advertencia al obtener perfil:', errorPerfil);
        }

        delete dataUsuario.password;
        const resultado = {
            ...dataUsuario,
            telefono: dataPerfil?.telefono || '',
            direccion: dataPerfil?.direccion || '',
            foto: dataPerfil?.foto || ''
        };

        res.json({ success: true, data: resultado });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put("/updateProfile", verifyToken, async (req, res) => {
    try {
        const { nombre, email, apellido_p, apellido_m, telefono, direccion, foto, password } = req.body;

        const updateDataUsuario = {};

        if (nombre !== undefined) updateDataUsuario.nombre = nombre;
        if (email !== undefined) updateDataUsuario.email = email;
        if (apellido_p !== undefined) updateDataUsuario.apellido_p = apellido_p;
        if (apellido_m !== undefined) updateDataUsuario.apellido_m = apellido_m;

        if (password) {
            updateDataUsuario.password = await bcrypt.hash(password, 10);
        }

        const { data: dataUsuario, error: errorUsuario } = await supabase
            .from("usuario")
            .update(updateDataUsuario)
            .eq('id_usuario', req.usuario.id_usuario)
            .select('*')
            .single();

        if (errorUsuario) {
            return res.status(400).json({ success: false, error: errorUsuario.message });
        }

        const updateDataPerfil = {};

        if (telefono !== undefined) updateDataPerfil.telefono = telefono;
        if (direccion !== undefined) updateDataPerfil.direccion = direccion;
        if (foto !== undefined) updateDataPerfil.foto = foto;

        const { data: dataPerfil, error: errorPerfil } = await supabase
            .from("perfil")
            .update(updateDataPerfil)
            .eq('id_usuario', req.usuario.id_usuario)
            .select('*')
            .single();

        if (errorPerfil) {
            return res.status(400).json({ success: false, error: errorPerfil.message });
        }

        delete dataUsuario.password;
        const resultado = {
            ...dataUsuario,
            telefono: dataPerfil.telefono,
            direccion: dataPerfil.direccion,
            foto: dataPerfil.foto
        };

        res.json({ success: true, data: resultado });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Profile Admin Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});