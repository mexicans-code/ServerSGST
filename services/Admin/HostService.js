
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
const PORT = process.env.PORT || 3008;

app.use(express.json());
app.use(cors());


app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "Host Service",
        timestamp: new Date().toISOString()
    });
});

// ==================== READ ====================
app.get("/getHostData", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hosteleria')
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
        console.error('❌ Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== READ BY ID ====================
app.get("/getHostData/:id", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hosteleria')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('❌ Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== CREATE ====================
app.post("/createHost", async (req, res) => {
    const { id_anfitrion, nombre, descripcion, precio_por_noche, capacidad, ubicacion, image, estado } = req.body;

    try {
        const { data, error } = await supabase
            .from('hosteleria')
            .insert([{
                id_anfitrion,
                nombre,
                descripcion,
                precio_por_noche,
                capacidad,
                ubicacion,
                image,
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
            message: "Host creado exitosamente",
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







app.listen(PORT, () => {
    console.log(`🚀 Host Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});
