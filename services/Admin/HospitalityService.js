import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "Hospitality Service",
        timestamp: new Date().toISOString()
    });
});

// ==================== READ ====================
app.get("/getHotelData", async (req, res) => {
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

// ==================== CREATE ====================
app.post("/createHotel", async (req, res) => {
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
            message: "Hotel creado exitosamente",
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

// ==================== UPDATE ====================
app.put("/updateHotel/:id", async (req, res) => {
    const { id } = req.params;
    const { id_anfitrion, nombre, descripcion, precio_por_noche, capacidad, ubicacion, image, estado } = req.body;

    try {
        const updateData = {
            id_anfitrion,
            nombre,
            descripcion,
            precio_por_noche,
            capacidad,
            ubicacion,
            image,
            estado
        };

        const { data, error } = await supabase
            .from('hosteleria')
            .update(updateData)
            .eq('id_hosteleria', id)
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Hotel no encontrado"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Hotel actualizado exitosamente",
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
app.delete("/deleteHotel/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('hosteleria')
            .delete()
            .eq('id_hosteleria', id)
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Hotel no encontrado"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Hotel eliminado exitosamente",
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

app.post("/convertirseEnAnfitrion", async (req, res) => {
    const { id_usuario } = req.body;

    try {
        // Verificar si ya es anfitrión
        const { data: existente } = await supabase
            .from('usuario')
            .select('rol')
            .eq('id_usuario', id_usuario)
            .single();

        if (existente && existente.rol === 'anfitrion') {
            return res.status(200).json({
                success: true,
                message: "Ya eres anfitrión",
                id_usuario: id_usuario
            });
        }

        // Actualizar el rol a anfitrión
        const { data, error } = await supabase
            .from('usuario')
            .update({ rol: 'anfitrion' })
            .eq('id_usuario', id_usuario)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "¡Ahora eres anfitrión!",
            data: data
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== ERROR HANDLERS ====================
app.use((req, res) => {
    res.status(404).json({
        error: "Route not found",
        path: req.path,
        method: req.method
    });
});

app.use((err, req, res, next) => {  
    console.error('❌ Error no manejado:', err);
    res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Hospitality Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🏨 Hotel data: http://localhost:${PORT}/getHotelData`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});