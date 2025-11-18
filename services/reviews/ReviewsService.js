import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({ override: true });


const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});


app.post('/addReview', async (req, res) => {
    try {
        const { id_reserva, id_usuario, calificacion, comentario } = req.body;

        // Validar que los campos requeridos estén presentes
        if (!id_reserva || !id_usuario || !calificacion) {
            return res.status(400).json({
                error: 'Faltan campos requeridos',
                details: 'Se requiere id_reserva, id_usuario y calificacion'
            });
        }

        // Validar que la calificación esté entre 1 y 5
        if (calificacion < 1 || calificacion > 5) {
            return res.status(400).json({
                error: 'Calificación inválida',
                details: 'La calificación debe estar entre 1 y 5'
            });
        }

        console.log('    Verificando si el usuario ya dejó una reseña...');

        // Verificar si el usuario ya dejó una reseña para esta reserva
        const { data: existingReviews, error: checkError } = await supabase
            .from('reseña')
            .select('id_reseña')
            .eq('id_reserva', id_reserva)
            .eq('id_usuario', id_usuario);

        if (checkError) {
            console.error('  Error al verificar reseña existente:', checkError);
            return res.status(500).json({
                error: 'Error al verificar reseña existente',
                details: checkError.message
            });
        }

        // Si hay al menos una reseña, rechazar
        if (existingReviews && existingReviews.length > 0) {
            console.log('⚠️ El usuario ya dejó una reseña para esta reserva');
            console.log('Reseñas existentes:', existingReviews);
            return res.status(409).json({
                success: false,
                error: 'Ya has dejado una reseña para esta reservación',
                details: 'Solo puedes dejar una reseña por reservación'
            });
        }

        console.log('  Usuario puede dejar reseña, insertando...');

        // Insertar la nueva reseña
        const { data, error } = await supabase
            .from('reseña')
            .insert([
                {
                    id_reserva: id_reserva,
                    id_usuario: id_usuario,
                    calificacion: calificacion,
                    comentario: comentario || null,
                    fecha_reseña: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('  Error al agregar reseña:', error);
            return res.status(500).json({
                error: 'Error al agregar reseña',
                details: error.message
            });
        }

        console.log('  Reseña agregada exitosamente:', data.id_reseña);
        return res.status(201).json({
            success: true,
            data,
            message: 'Reseña agregada exitosamente'
        });
    } catch (error) {
        console.error('  Error general al agregar reseña:', error);
        return res.status(500).json({
            error: 'Error al agregar reseña',
            details: error.message
        });
    }
});

app.get('/getReviews', async (req, res) => {
    try {
        const { id_reserva, id_hosteleria, id_experiencia } = req.query;

        console.log('    Parámetros recibidos:', { id_reserva, id_hosteleria, id_experiencia });

        // Opción 1: Buscar por id_reserva específica (para una reserva individual)
        if (id_reserva && id_reserva !== 'undefined') {
            const id_reserva_num = parseInt(id_reserva, 10);

            if (isNaN(id_reserva_num)) {
                return res.status(400).json({
                    error: 'id_reserva debe ser un número válido',
                    recibido: id_reserva
                });
            }

            console.log('  Buscando reviews para id_reserva:', id_reserva_num);

            const { data, error } = await supabase
                .from('reseña')
                .select('*')
                .eq('id_reserva', id_reserva_num);

            if (error) {
                console.error('  Error de Supabase:', error);
                return res.status(500).json({
                    error: 'Error al obtener calificaciones',
                    details: error.message
                });
            }

            console.log('  Reviews encontradas:', data.length);

            // Obtener información de usuarios de forma manual
            const formattedData = await Promise.all(data.map(async (review) => {
                const { data: usuario } = await supabase
                    .from('usuario')
                    .select('nombre, email')
                    .eq('id_usuario', review.id_usuario)
                    .single();

                return {
                    ...review,
                    nombre_usuario: usuario?.nombre || 'Usuario',
                    fecha_reseña: review.fecha_reseña || review.created_at
                };
            }));

            return res.status(200).json({ success: true, data: formattedData });
        }

        // Opción 2: Buscar por id_hosteleria (todas las reviews de una propiedad)
        if (id_hosteleria && id_hosteleria !== 'undefined') {
            const id_hosteleria_num = parseInt(id_hosteleria, 10);

            if (isNaN(id_hosteleria_num)) {
                return res.status(400).json({
                    error: 'id_hosteleria debe ser un número válido',
                    recibido: id_hosteleria
                });
            }

            console.log('  Buscando reviews para id_hosteleria:', id_hosteleria_num);

            // Primero obtener todas las reservas de esta propiedad
            const { data: reservas, error: errorReservas } = await supabase
                .from('reserva')
                .select('id_reserva')
                .eq('id_hosteleria', id_hosteleria_num);

            if (errorReservas) {
                console.error('  Error al obtener reservas:', errorReservas);
                return res.status(500).json({
                    error: 'Error al obtener reservas',
                    details: errorReservas.message
                });
            }

            if (!reservas || reservas.length === 0) {
                console.log('   No hay reservas para esta propiedad');
                return res.status(200).json({ success: true, data: [] });
            }

            const ids_reservas = reservas.map(r => r.id_reserva);
            console.log('📋 IDs de reservas encontradas:', ids_reservas);

            // Ahora obtener todas las reseñas de esas reservas
            const { data: reviews, error: errorReviews } = await supabase
                .from('reseña')
                .select('*')
                .in('id_reserva', ids_reservas);

            if (errorReviews) {
                console.error('  Error al obtener reseñas:', errorReviews);
                return res.status(500).json({
                    error: 'Error al obtener reseñas',
                    details: errorReviews.message
                });
            }

            console.log('  Reviews encontradas:', reviews?.length || 0);

            if (!reviews || reviews.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }

            // Obtener información de usuarios de forma manual
            const formattedData = await Promise.all(reviews.map(async (review) => {
                const { data: usuario } = await supabase
                    .from('usuario')
                    .select('nombre, email')
                    .eq('id_usuario', review.id_usuario)
                    .single();

                return {
                    ...review,
                    nombre_usuario: usuario?.nombre || 'Usuario',
                    fecha_reseña: review.fecha_reseña || review.created_at
                };
            }));

            return res.status(200).json({ success: true, data: formattedData });

            return res.status(200).json({ success: true, data: formattedData });
        }

        // Opción 3: Buscar por id_experiencia (todas las reviews de una experiencia)
        if (id_experiencia && id_experiencia !== 'undefined') {
            const id_experiencia_num = parseInt(id_experiencia, 10);

            if (isNaN(id_experiencia_num)) {
                return res.status(400).json({
                    error: 'id_experiencia debe ser un número válido',
                    recibido: id_experiencia
                });
            }

            console.log('  Buscando reviews para id_experiencia:', id_experiencia_num);

            // Primero obtener todas las reservas de esta experiencia
            const { data: reservas, error: errorReservas } = await supabase
                .from('reserva')
                .select('id_reserva')
                .eq('id_experiencia', id_experiencia_num);

            if (errorReservas) {
                console.error('  Error al obtener reservas:', errorReservas);
                return res.status(500).json({
                    error: 'Error al obtener reservas',
                    details: errorReservas.message
                });
            }

            if (!reservas || reservas.length === 0) {
                console.log('   No hay reservas para esta experiencia');
                return res.status(200).json({ success: true, data: [] });
            }

            const ids_reservas = reservas.map(r => r.id_reserva);
            console.log('📋 IDs de reservas encontradas:', ids_reservas);

            // Ahora obtener todas las reseñas de esas reservas
            const { data: reviews, error: errorReviews } = await supabase
                .from('reseña')
                .select('*')
                .in('id_reserva', ids_reservas);

            if (errorReviews) {
                console.error('  Error al obtener reseñas:', errorReviews);
                return res.status(500).json({
                    error: 'Error al obtener reseñas',
                    details: errorReviews.message
                });
            }

            console.log('  Reviews encontradas:', reviews?.length || 0);

            if (!reviews || reviews.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }

            // Obtener información de usuarios de forma manual
            const formattedData = await Promise.all(reviews.map(async (review) => {
                const { data: usuario } = await supabase
                    .from('usuario')
                    .select('nombre, email')
                    .eq('id_usuario', review.id_usuario)
                    .single();

                return {
                    ...review,
                    nombre_usuario: usuario?.nombre || 'Usuario',
                    fecha_reseña: review.fecha_reseña || review.created_at
                };
            }));

            return res.status(200).json({ success: true, data: formattedData });
        }

        // Si no se proporcionó ningún parámetro válido
        return res.status(400).json({
            error: 'Se requiere id_reserva, id_hosteleria o id_experiencia',
            recibido: { id_reserva, id_hosteleria, id_experiencia }
        });

    } catch (error) {
        console.error('  Error general:', error);
        return res.status(500).json({ error: 'Error al obtener calificaciones' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});