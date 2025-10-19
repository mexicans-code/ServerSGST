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
                usuario:id_usuario(*),
                hosteleria:id_hosteleria(*)
            `)
            .order('id_reserva', { ascending: false });

        if (error) {
            console.error('  Error en query inicial:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        console.log('📊 Datos crudos de Supabase:', JSON.stringify(data[0], null, 2));

        const enrichedData = await Promise.all(
            data.map(async (reserva) => {
                let direccionData = null;
                let anfitrionData = null;
                let experienciaData = null;

                // Obtener dirección (solo si es reserva de hostelería)
                if (reserva.hosteleria?.id_direccion) {
                    const { data: direccion } = await supabase
                        .from('direcciones')
                        .select('*')
                        .eq('id_direccion', reserva.hosteleria.id_direccion)
                        .single();
                    direccionData = direccion;
                }

                // Obtener datos del anfitrión (solo si es reserva de hostelería)
                if (reserva.hosteleria?.id_anfitrion) {
                    const { data: anfitrion } = await supabase
                        .from('usuario')
                        .select('*')
                        .eq('id_usuario', reserva.hosteleria.id_anfitrion)
                        .single();
                    anfitrionData = anfitrion;
                    console.log('👤 Anfitrión encontrado:', anfitrionData);
                }

                // Obtener datos de la experiencia turística (si existe)
                if (reserva.id_exptouristica) {
                    const { data: experiencia } = await supabase
                        .from('experiencias_turisticas')
                        .select('*')
                        .eq('id_experiencia', reserva.id_exptouristica)
                        .single();
                    experienciaData = experiencia;
                    console.log('🎯 Experiencia encontrada:', experienciaData);
                }

                // Construir datos del anfitrión de la experiencia (si aplica)
                let anfitrionExperienciaData = null;
                if (experienciaData?.id_anfitrion) {
                    const { data: anfitrionExp } = await supabase
                        .from('usuario')
                        .select('*')
                        .eq('id_usuario', experienciaData.id_anfitrion)
                        .single();
                    anfitrionExperienciaData = anfitrionExp;
                    console.log('👤 Anfitrión de experiencia encontrado:', anfitrionExperienciaData);
                }

                return {
                    // ========== DATOS DE LA RESERVA ==========
                    reserva: {
                        id_reserva: reserva.id_reserva,
                        fecha_inicio: reserva.fecha_inicio,
                        fecha_fin: reserva.fecha_fin,
                        personas: reserva.personas,
                        estado: reserva.estado,
                        precio_total: reserva.precio_total || null,
                        fecha_creacion: reserva.created_at || null,
                        tipo_reserva: reserva.id_exptouristica ? 'experiencia' : 'hosteleria'
                    },

                    // ========== DATOS DEL USUARIO (quien reservó) ==========
                    usuario: {
                        id_usuario: reserva.usuario?.id_usuario,
                        nombre: reserva.usuario?.nombre,
                        email: reserva.usuario?.email,
                        telefono: reserva.usuario?.telefono || null,
                        rol: reserva.usuario?.rol || 'usuario'
                    },

                    // ========== DATOS DEL ESTABLECIMIENTO (Hostelería) ==========
                    establecimiento: reserva.hosteleria ? {
                        id_hosteleria: reserva.hosteleria?.id_hosteleria,
                        nombre: reserva.hosteleria?.nombre,
                        descripcion: reserva.hosteleria?.descripcion || null,
                        tipo_propiedad: reserva.hosteleria?.tipo_propiedad || null,
                        precio_por_noche: reserva.hosteleria?.precio_por_noche,
                        capacidad: reserva.hosteleria?.capacidad || null,
                        habitaciones: reserva.hosteleria?.habitaciones || null,
                        banos: reserva.hosteleria?.banos || null,
                        image: reserva.hosteleria?.image || null,

                        direccion: {
                            calle: direccionData?.calle || null,
                            numero_exterior: direccionData?.numero_exterior || null,
                            colonia: direccionData?.colonia || null,
                            ciudad: direccionData?.ciudad || null,
                            estado: direccionData?.estado || null,
                            codigo_postal: direccionData?.codigo_postal || null,
                            pais: direccionData?.pais || 'México'
                        }
                    } : null,

                    // ========== DATOS DEL ANFITRIÓN (dueño del establecimiento) ==========
                    anfitrion: reserva.hosteleria ? {
                        id_usuario: anfitrionData?.id_usuario || null,
                        nombre: anfitrionData?.nombre || 'No disponible',
                        email: anfitrionData?.email || null,
                        telefono: anfitrionData?.telefono || null,
                        rol: anfitrionData?.rol || 'anfitrion'
                    } : null,

                    // ========== DATOS DE LA EXPERIENCIA TURÍSTICA ==========
                    experiencia: experienciaData ? {
                        id_experiencia: experienciaData?.id_experiencia,
                        titulo: experienciaData?.titulo || null,
                        descripcion: experienciaData?.descripcion || null,
                        fecha_experiencia: experienciaData?.fecha_experiencia || null,
                        calificacion: experienciaData?.calificacion || null,
                        estado: experienciaData?.estado || null,
                        image: experienciaData?.image || null,
                        precio: experienciaData?.precio || null,

                        // ========== DATOS DEL ANFITRIÓN DE LA EXPERIENCIA ==========
                        anfitrion: {
                            id_usuario: anfitrionExperienciaData?.id_usuario || null,
                            nombre: anfitrionExperienciaData?.nombre || 'No disponible',
                            email: anfitrionExperienciaData?.email || null,
                            telefono: anfitrionExperienciaData?.telefono || null,
                            rol: anfitrionExperienciaData?.rol || 'anfitrion'
                        },

                        id_direccion: experienciaData?.id_direccion || null
                    } : null
                };
            })
        );

        console.log('✅ Reservas enriquecidas:', enrichedData.length);
        console.log('    Ejemplo completo:', JSON.stringify(enrichedData[0], null, 2));

        return res.status(200).json({
            success: true,
            count: enrichedData?.length || 0,
            data: enrichedData
        });
    } catch (error) {
        console.error('  Error del servidor:', error);
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
        const { data: reserva, error } = await supabase
            .from("reserva")
            .select(`
                *,
                usuario:id_usuario(*),
                hosteleria:id_hosteleria(*)
            `)
            .eq('id_reserva', id)
            .single();

        if (error) {
            return res.status(404).json({
                success: false,
                error: "Reserva no encontrada"
            });
        }

        let direccionData = null;
        let anfitrionData = null;
        let experienciaData = null;
        let anfitrionExperienciaData = null;

        // Obtener dirección (solo si es reserva de hostelería)
        if (reserva.hosteleria?.id_direccion) {
            const { data: direccion } = await supabase
                .from('direcciones')
                .select('*')
                .eq('id_direccion', reserva.hosteleria.id_direccion)
                .single();
            direccionData = direccion;
        }

        // Obtener datos del anfitrión (solo si es reserva de hostelería)
        if (reserva.hosteleria?.id_anfitrion) {
            const { data: anfitrion } = await supabase
                .from('usuario')
                .select('*')
                .eq('id_usuario', reserva.hosteleria.id_anfitrion)
                .single();
            anfitrionData = anfitrion;
        }

        // Obtener datos de la experiencia turística (si existe)
        if (reserva.id_exptouristica) {
            const { data: experiencia } = await supabase
                .from('experiencias_turisticas')
                .select('*')
                .eq('id_experiencia', reserva.id_exptouristica)
                .single();
            experienciaData = experiencia;

            // Obtener datos del anfitrión de la experiencia
            if (experienciaData?.id_anfitrion) {
                const { data: anfitrionExp } = await supabase
                    .from('usuario')
                    .select('*')
                    .eq('id_usuario', experienciaData.id_anfitrion)
                    .single();
                anfitrionExperienciaData = anfitrionExp;
            }
        }

        const enrichedBooking = {
            reserva: {
                id_reserva: reserva.id_reserva,
                fecha_inicio: reserva.fecha_inicio,
                fecha_fin: reserva.fecha_fin,
                personas: reserva.personas,
                estado: reserva.estado,
                precio_total: reserva.precio_total || null,
                fecha_creacion: reserva.created_at || null,
                tipo_reserva: reserva.id_exptouristica ? 'experiencia' : 'hosteleria'
            },
            usuario: {
                id_usuario: reserva.usuario?.id_usuario,
                nombre: reserva.usuario?.nombre,
                email: reserva.usuario?.email,
                telefono: reserva.usuario?.telefono || null,
                rol: reserva.usuario?.rol || 'usuario'
            },
            establecimiento: reserva.hosteleria ? {
                id_hosteleria: reserva.hosteleria?.id_hosteleria,
                nombre: reserva.hosteleria?.nombre,
                descripcion: reserva.hosteleria?.descripcion || null,
                tipo_propiedad: reserva.hosteleria?.tipo_propiedad || null,
                precio_por_noche: reserva.hosteleria?.precio_por_noche,
                capacidad: reserva.hosteleria?.capacidad || null,
                habitaciones: reserva.hosteleria?.habitaciones || null,
                banos: reserva.hosteleria?.banos || null,
                image: reserva.hosteleria?.image || null,
                direccion: {
                    calle: direccionData?.calle || null,
                    numero_exterior: direccionData?.numero_exterior || null,
                    colonia: direccionData?.colonia || null,
                    ciudad: direccionData?.ciudad || null,
                    estado: direccionData?.estado || null,
                    codigo_postal: direccionData?.codigo_postal || null,
                    pais: direccionData?.pais || 'México'
                }
            } : null,
            anfitrion: reserva.hosteleria ? {
                id_usuario: anfitrionData?.id_usuario || null,
                nombre: anfitrionData?.nombre || 'No disponible',
                email: anfitrionData?.email || null,
                telefono: anfitrionData?.telefono || null,
                rol: anfitrionData?.rol || 'anfitrion'
            } : null,
            experiencia: experienciaData ? {
                id_experiencia: experienciaData?.id_experiencia,
                titulo: experienciaData?.titulo || null,
                descripcion: experienciaData?.descripcion || null,
                fecha_experiencia: experienciaData?.fecha_experiencia || null,
                calificacion: experienciaData?.calificacion || null,
                estado: experienciaData?.estado || null,
                image: experienciaData?.image || null,
                precio: experienciaData?.precio || null,
                anfitrion: {
                    id_usuario: anfitrionExperienciaData?.id_usuario || null,
                    nombre: anfitrionExperienciaData?.nombre || 'No disponible',
                    email: anfitrionExperienciaData?.email || null,
                    telefono: anfitrionExperienciaData?.telefono || null,
                    rol: anfitrionExperienciaData?.rol || 'anfitrion'
                },
                id_direccion: experienciaData?.id_direccion || null
            } : null
        };

        return res.status(200).json({
            success: true,
            data: enrichedBooking
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

// ==================== CREATE EXPERIENCE BOOKING ====================
app.post("/createExperienceBooking", async (req, res) => {
    const { id_usuario, id_exptouristica, fecha_inicio, personas, precio_total, estado } = req.body;

    // Validación de campos requeridos
    if (!id_usuario || !id_exptouristica || !fecha_inicio || !personas || !precio_total) {
        return res.status(400).json({
            success: false,
            error: "Todos los campos son requeridos: id_usuario, id_exptouristica, fecha_inicio, personas, precio_total"
        });
    }

    if (personas < 1) {
        return res.status(400).json({
            success: false,
            error: "El número de personas debe ser al menos 1"
        });
    }

    try {
        const newExperienceBooking = {
            id_usuario,
            id_exptouristica,
            fecha_inicio,
            fecha_fin: null,
            personas,
            precio_total,
            estado: estado || 'pendiente'
        };

        const { data, error } = await supabase
            .from('reserva')
            .insert([newExperienceBooking])
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
            message: "Reserva de experiencia creada exitosamente",
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
app.patch("/cancelBooking/:id", async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

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

// ==================== GET ALL EXPERIENCES ====================
app.get("/getExperiences", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("experiencias_turisticas")
            .select('*')
            .order('id_experiencia', { ascending: false });

        if (error) {
            console.error('  Error en query inicial:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        const enrichedData = await Promise.all(
            data.map(async (experiencia) => {
                let anfitrionData = null;
                let direccionData = null;

                // Obtener datos del anfitrión
                if (experiencia.id_anfitrion) {
                    const { data: anfitrion } = await supabase
                        .from('usuario')
                        .select('*')
                        .eq('id_usuario', experiencia.id_anfitrion)
                        .single();
                    anfitrionData = anfitrion;
                }

                // Obtener dirección si existe
                if (experiencia.id_direccion) {
                    const { data: direccion } = await supabase
                        .from('direcciones')
                        .select('*')
                        .eq('id_direccion', experiencia.id_direccion)
                        .single();
                    direccionData = direccion;
                }

                return {
                    experiencia: {
                        id_experiencia: experiencia.id_experiencia,
                        titulo: experiencia.titulo,
                        descripcion: experiencia.descripcion,
                        fecha_experiencia: experiencia.fecha_experiencia,
                        calificacion: experiencia.calificacion,
                        estado: experiencia.estado,
                        image: experiencia.image,
                        precio: experiencia.precio,
                        fecha_creacion: experiencia.created_at,
                        id_direccion: experiencia.id_direccion,
                        // ⭐ Anfitrión anidado dentro de experiencia
                        anfitrion: {
                            id_usuario: anfitrionData?.id_usuario || null,
                            nombre: anfitrionData?.nombre || 'No disponible',
                            email: anfitrionData?.email || null,
                            telefono: anfitrionData?.telefono || null,
                            rol: anfitrionData?.rol || 'anfitrion'
                        }
                    }
                };
            })
        );

        return res.status(200).json({
            success: true,
            count: enrichedData?.length || 0,
            data: enrichedData
        });
    } catch (error) {
        console.error('  Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== GET EXPERIENCE BY ID ====================
app.get("/getExperience/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const { data: experiencia, error } = await supabase
            .from("experiencias_turisticas")
            .select('*')
            .eq('id_experiencia', id)
            .single();

        if (error) {
            return res.status(404).json({
                success: false,
                error: "Experiencia no encontrada"
            });
        }

        let anfitrionData = null;
        let direccionData = null;

        // Obtener datos del anfitrión
        if (experiencia.id_anfitrion) {
            const { data: anfitrion } = await supabase
                .from('usuario')
                .select('*')
                .eq('id_usuario', experiencia.id_anfitrion)
                .single();
            anfitrionData = anfitrion;
        }

        // Obtener dirección si existe
        if (experiencia.id_direccion) {
            const { data: direccion } = await supabase
                .from('direcciones')
                .select('*')
                .eq('id_direccion', experiencia.id_direccion)
                .single();
            direccionData = direccion;
        }

        const enrichedExperience = {
            experiencia: {
                id_experiencia: experiencia.id_experiencia,
                titulo: experiencia.titulo,
                descripcion: experiencia.descripcion,
                fecha_experiencia: experiencia.fecha_experiencia,
                calificacion: experiencia.calificacion,
                estado: experiencia.estado,
                image: experiencia.image,
                precio: experiencia.precio,
                fecha_creacion: experiencia.created_at
            },
            anfitrion: {
                id_usuario: anfitrionData?.id_usuario || null,
                nombre: anfitrionData?.nombre || 'No disponible',
                email: anfitrionData?.email || null,
                telefono: anfitrionData?.telefono || null,
                rol: anfitrionData?.rol || 'anfitrion'
            },
            direccion: {
                calle: direccionData?.calle || null,
                numero_exterior: direccionData?.numero_exterior || null,
                colonia: direccionData?.colonia || null,
                ciudad: direccionData?.ciudad || null,
                estado: direccionData?.estado || null,
                codigo_postal: direccionData?.codigo_postal || null,
                pais: direccionData?.pais || 'México'
            }
        };

        return res.status(200).json({
            success: true,
            data: enrichedExperience
        });
    } catch (error) {
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== CREATE EXPERIENCE ====================
app.post("/createExperience", async (req, res) => {
    const { id_anfitrion, id_direccion, titulo, descripcion, fecha_experiencia, precio, image, estado } = req.body;

    // Validación de campos requeridos
    if (!id_anfitrion || !titulo || !descripcion || !fecha_experiencia || !precio) {
        return res.status(400).json({
            success: false,
            error: "Campos requeridos: id_anfitrion, titulo, descripcion, fecha_experiencia, precio"
        });
    }

    try {
        const newExperience = {
            id_anfitrion,
            id_direccion: id_direccion || null,
            titulo,
            descripcion,
            fecha_experiencia,
            precio,
            image: image || null,
            calificacion: 0,
            estado: estado || 'activa'
        };

        const { data, error } = await supabase
            .from('experiencias_turisticas')
            .insert([newExperience])
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
            message: "Experiencia creada exitosamente",
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

// ==================== UPDATE EXPERIENCE ====================
app.put("/updateExperience/:id", async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, fecha_experiencia, precio, image, estado, calificacion } = req.body;

    // Validar que al menos un campo esté presente
    if (!titulo && !descripcion && !fecha_experiencia && !precio && !image && !estado && calificacion === undefined) {
        return res.status(400).json({
            success: false,
            error: "Debe proporcionar al menos un campo para actualizar"
        });
    }

    try {
        const updateData = {};

        if (titulo !== undefined) updateData.titulo = titulo;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (fecha_experiencia !== undefined) updateData.fecha_experiencia = fecha_experiencia;
        if (precio !== undefined) updateData.precio = precio;
        if (image !== undefined) updateData.image = image;
        if (estado !== undefined) {
            const estadosValidos = ['activa', 'inactiva', 'cancelada'];
            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Estados permitidos: ${estadosValidos.join(', ')}`
                });
            }
            updateData.estado = estado;
        }
        if (calificacion !== undefined) updateData.calificacion = calificacion;

        const { data, error } = await supabase
            .from('experiencias_turisticas')
            .update(updateData)
            .eq('id_experiencia', id)
            .select('*')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: "Experiencia no encontrada"
                });
            }
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Experiencia actualizada exitosamente",
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

// ==================== DELETE EXPERIENCE ====================
app.delete("/deleteExperience/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si existe
        const { data: existingExperience, error: checkError } = await supabase
            .from('experiencias_turisticas')
            .select('id_experiencia')
            .eq('id_experiencia', id)
            .single();

        if (checkError || !existingExperience) {
            return res.status(404).json({
                success: false,
                error: "Experiencia no encontrada"
            });
        }

        const { error } = await supabase
            .from('experiencias_turisticas')
            .delete()
            .eq('id_experiencia', id);

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Experiencia eliminada exitosamente",
            id_experiencia: id
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