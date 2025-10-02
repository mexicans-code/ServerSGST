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
const PORT = process.env.PORT || 3006;

app.use(express.json());
app.use(cors());


// ==================== GET ALL BOOKINGS ====================
app.get("/getBookings", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("reserva")
            .select(`
                *,
                usuario:id_usuario(id_usuario, nombre, email),
                hosteleria:id_hosteleria(id_hosteleria, nombre, ubicacion, precio_por_noche)
            `)
            .order('id_reserva', { ascending: false });

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
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== GET BOOKING BY ID ====================
app.get("/getBooking/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from("reserva")
            .select(`
                *,
                usuario:id_usuario(nombre, email, telefono),
                hosteleria:id_hosteleria(nombre, ubicacion, precio_por_noche)
            `)
            .eq('id_reserva', id)
            .single();

        if (error) {
            return res.status(404).json({
                success: false,
                error: "Reserva no encontrada"
            });
        }

        return res.status(200).json({
            success: true,
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


// ==================== CREATE BOOKING ====================
app.post("/createBooking", async (req, res) => {
    const { id_usuario, id_hosteleria, fecha_inicio, fecha_fin, personas, precio_total, estado } = req.body;

    // Validación de campos requeridos
    if (!id_usuario || !id_hosteleria || !fecha_inicio || !fecha_fin || !personas || !precio_total) {
        return res.status(400).json({
            success: false,
            error: "Todos los campos son requeridos: id_usuario, id_hosteleria, fecha_inicio, fecha_fin, personas, precio_total"
        });
    }

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    
    if (inicio >= fin) {
        return res.status(400).json({
            success: false,
            error: "La fecha de fin debe ser posterior a la fecha de inicio"
        });
    }

    if (personas < 1) {
        return res.status(400).json({
            success: false,
            error: "El número de personas debe ser al menos 1"
        });
    }

    try {
        const newBooking = {
            id_usuario,
            id_hosteleria,
            fecha_inicio,
            fecha_fin,
            personas,
            precio_total,
            estado: estado || 'pendiente'
        };

        const { data, error } = await supabase
            .from('reserva')
            .insert([newBooking])
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
            message: "Reserva creada exitosamente",
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


// ==================== UPDATE BOOKING ====================
// SOLO permite editar: fecha_inicio, fecha_fin, personas, y estado
// NO permite editar: id_reserva, id_usuario, id_hosteleria, precio_total (calculado)
app.put("/updateBooking/:id", async (req, res) => {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, personas, estado } = req.body;

    // Validar que al menos un campo editable esté presente
    if (!fecha_inicio && !fecha_fin && !personas && !estado) {
        return res.status(400).json({
            success: false,
            error: "Debe proporcionar al menos un campo para actualizar (fecha_inicio, fecha_fin, personas, estado)"
        });
    }

    try {
        // Construir objeto solo con campos editables
        const updateData = {};
        
        if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio;
        if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin;
        if (personas !== undefined) {
            if (personas < 1) {
                return res.status(400).json({
                    success: false,
                    error: "El número de personas debe ser al menos 1"
                });
            }
            updateData.personas = personas;
        }
        if (estado !== undefined) {
            // Validar estados permitidos
            const estadosValidos = ['pendiente', 'confirmada', 'cancelada', 'completada'];
            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Estados permitidos: ${estadosValidos.join(', ')}`
                });
            }
            updateData.estado = estado;
        }

        // Validar fechas si ambas están presentes
        if (updateData.fecha_inicio && updateData.fecha_fin) {
            const inicio = new Date(updateData.fecha_inicio);
            const fin = new Date(updateData.fecha_fin);
            
            if (inicio >= fin) {
                return res.status(400).json({
                    success: false,
                    error: "La fecha de fin debe ser posterior a la fecha de inicio"
                });
            }
        }

        const { data, error } = await supabase
            .from('reserva')
            .update(updateData)
            .eq('id_reserva', id)
            .select('*')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: "Reserva no encontrada"
                });
            }
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reserva actualizada exitosamente",
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


// ==================== CANCEL BOOKING ====================
// Endpoint específico para cancelar (más seguro que permitir editar estado directamente)
app.patch("/cancelBooking/:id", async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body; // Opcional: razón de la cancelación

    try {
        // Verificar que la reserva existe y su estado actual
        const { data: reservaActual, error: checkError } = await supabase
            .from('reserva')
            .select('estado')
            .eq('id_reserva', id)
            .single();

        if (checkError || !reservaActual) {
            return res.status(404).json({
                success: false,
                error: "Reserva no encontrada"
            });
        }

        // No permitir cancelar reservas ya completadas o canceladas
        if (reservaActual.estado === 'cancelada') {
            return res.status(400).json({
                success: false,
                error: "La reserva ya está cancelada"
            });
        }

        if (reservaActual.estado === 'completada') {
            return res.status(400).json({
                success: false,
                error: "No se puede cancelar una reserva completada"
            });
        }

        const { data, error } = await supabase
            .from('reserva')
            .update({ estado: 'cancelada' })
            .eq('id_reserva', id)
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
            message: "Reserva cancelada exitosamente",
            data: data,
            motivo: motivo || "No especificado"
        });

    } catch (error) {
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==================== DELETE BOOKING ====================
// Solo para admins - eliminar definitivamente (considerar soft delete en producción)
app.delete("/deleteBooking/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si existe
        const { data: existingBooking, error: checkError } = await supabase
            .from('reserva')
            .select('id_reserva, estado')
            .eq('id_reserva', id)
            .single();

        if (checkError || !existingBooking) {
            return res.status(404).json({
                success: false,
                error: "Reserva no encontrada"
            });
        }

        // Advertencia: en producción considera usar soft delete
        // Solo permitir eliminar reservas canceladas o pendientes
        if (existingBooking.estado === 'confirmada' || existingBooking.estado === 'completada') {
            return res.status(400).json({
                success: false,
                error: "No se puede eliminar una reserva confirmada o completada. Considere cancelarla primero."
            });
        }

        const { error } = await supabase
            .from('reserva')
            .delete()
            .eq('id_reserva', id);

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reserva eliminada exitosamente",
            id_reserva: id
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
    console.log(`🚀 Booking Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
}); 