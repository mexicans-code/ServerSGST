

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config({ path: '../../.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());


// ==================== GET ====================
app.get("/getUsers", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('usuario')
            .select('*');

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data
        });
    } catch (error) {
        console.error('  Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ==================== UPDATE ====================

app.put("/updateUser/:id_usuario", async (req, res) => {
    const { id_usuario } = req.params;
    const { nombre, apellido_p, apellido_m, email, password, rol, estado } = req.body;

    try {
        const updateData = {
            nombre,
            apellido_p,
            apellido_m,
            email,
            rol,
            estado
        };

        if (password && password.trim() !== '') {
            updateData.password = bcrypt.hashSync(password, 10);
        }

        const { data, error } = await supabase
            .from('usuario')
            .update(updateData)
            .eq('id_usuario', id_usuario)
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Usuario actualizado exitosamente",
            data: data
        });

    } catch (error) {
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==================== CREATE ====================
app.post("/createUser", async (req, res) => {
    const { nombre, apellido_p, apellido_m, email, password, rol, estado } = req.body;

    try {
        const { data, error } = await supabase
            .from('usuario')
            .insert([{
                nombre,
                apellido_p,
                apellido_m,
                email,
                password: bcrypt.hashSync(password, 10),
                rol: rol || 'usuario',
                estado: estado || 'activo'
            }])
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(201).json({
            success: true,
            message: "Usuario creado exitosamente",
            data: data
        });

    } catch (error) {
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

    
// ==================== DELETE ====================
app.delete("/deleteUser/:id_usuario", async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const { data, error } = await supabase
            .from('usuario')
            .delete()
            .eq('id_usuario', id_usuario)
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Usuario eliminado exitosamente",
            data: data
        });

    } catch (error) {
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});



app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "Admin User Service",
        timestamp: new Date().toISOString()
    });
});


app.listen(PORT, () => {
    console.log(`🚀 Admin User Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});
