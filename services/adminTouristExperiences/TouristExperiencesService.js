import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ override: true });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Tourist Experience Service API is running',
        timestamp: new Date().toISOString()
    });
});

// ==================== GET ALL EXPERIENCES ====================
app.get('/getTouristExperiences', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('experiencias_turisticas')
            .select(`
                *,
                direcciones:id_direccion (
                    *
                ),
                usuario:id_anfitrion (
                    id_usuario,
                    nombre,
                    apellido_p,
                    apellido_m,
                    email
                )
            `);

        if (error) {
            console.error('❌ Supabase error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data || []
        });
    } catch (error) {
        console.error('❌ Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ==================== GET EXPERIENCE BY ID ====================
app.get('/getTouristExperience/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('experiencias_turisticas')
            .select(`
                *,
                direcciones:id_direccion (
                    *
                ),
                usuario:id_anfitrion (
                    id_usuario,
                    nombre,
                    apellido_p,
                    apellido_m,
                    email
                )
            `)
            .eq('id_experiencia', id)
            .single();

        if (error) {
            console.error('❌ Supabase error:', error);
            return res.status(404).json({
                success: false,
                error: 'Tourist experience not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('❌ Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ==================== CREATE EXPERIENCE ====================
app.post('/createTouristExperience', async (req, res) => {
    try {
        const {
            id_anfitrion,
            titulo,
            descripcion,
            fecha_experiencia,
            capacidad,
            duracion,
            tipo_experiencia,
            precio,
            direccion,
            image
        } = req.body;

        // Validate required fields
        if (!id_anfitrion || !titulo || !precio || !capacidad || !fecha_experiencia) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id_anfitrion, titulo, precio, capacidad, fecha_experiencia'
            });
        }

        // Parse address JSON if it's a string
        let addressData;
        try {
            addressData = typeof direccion === 'string' ? JSON.parse(direccion) : direccion;
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid address format'
            });
        }

        // Insert address first
        const { data: addressInserted, error: addressError } = await supabase
            .from('direcciones')
            .insert([{
                calle: addressData.calle || '',
                ciudad: addressData.ciudad || '',
                estado: addressData.estado || '',
                codigo_postal: addressData.codigo_postal || '',
                pais: addressData.pais || 'México',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (addressError) {
            console.error('❌ Address insert error:', addressError);
            return res.status(500).json({
                success: false,
                error: 'Failed to create address'
            });
        }

        // Insert experience
        const { data: experienceData, error: experienceError } = await supabase
            .from('experiencias_turisticas')
            .insert([{
                id_anfitrion: parseInt(id_anfitrion),
                id_direccion: addressInserted.id_direccion,
                titulo,
                descripcion,
                fecha_experiencia,
                precio: parseFloat(precio),
                capacidad: parseInt(capacidad),
                duracion,
                tipo_experiencia,
                estado: 'activo',
                image: image || null,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (experienceError) {
            console.error('❌ Experience insert error:', experienceError);
            return res.status(500).json({
                success: false,
                error: 'Failed to create experience'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Tourist experience created successfully',
            data: experienceData
        });

    } catch (error) {
        console.error('❌ Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ==================== UPDATE EXPERIENCE ====================
app.put('/updateExperience/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            titulo,
            descripcion,
            fecha_experiencia,
            precio,
            capacidad,
            duracion,
            incluye,
            no_incluye,
            requisitos,
            idiomas,
            tipo_experiencia,
            estado,
            image,
            direccion
        } = req.body;

        // Get current experience data
        const { data: currentData, error: fetchError } = await supabase
            .from('experiencias_turisticas')
            .select('id_direccion')
            .eq('id_experiencia', id)
            .single();

        if (fetchError) {
            return res.status(404).json({
                success: false,
                error: 'Experience not found'
            });
        }

        // Update address if provided
        if (direccion) {
            let addressData;
            try {
                addressData = typeof direccion === 'string' ? JSON.parse(direccion) : direccion;
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format'
                });
            }

            await supabase
                .from('direcciones')
                .update({
                    calle: addressData.calle,
                    ciudad: addressData.ciudad,
                    estado: addressData.estado,
                    codigo_postal: addressData.codigo_postal,
                    pais: addressData.pais,
                    updated_at: new Date().toISOString()
                })
                .eq('id_direccion', currentData.id_direccion);
        }

        // Update experience
        const updateData = {};
        if (titulo) updateData.titulo = titulo;
        if (descripcion) updateData.descripcion = descripcion;
        if (fecha_experiencia) updateData.fecha_experiencia = fecha_experiencia;
        if (precio) updateData.precio = parseFloat(precio);
        if (capacidad) updateData.capacidad = parseInt(capacidad);
        if (duracion) updateData.duracion = duracion;
        if (incluye) updateData.incluye = incluye;
        if (no_incluye) updateData.no_incluye = no_incluye;
        if (requisitos) updateData.requisitos = requisitos;
        if (idiomas) updateData.idiomas = idiomas;
        if (tipo_experiencia) updateData.tipo_experiencia = tipo_experiencia;
        if (estado) updateData.estado = estado;
        if (image) updateData.image = image;

        const { data: updatedData, error: updateError } = await supabase
            .from('experiencias_turisticas')
            .update(updateData)
            .eq('id_experiencia', id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Update error:', updateError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update experience'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Experience updated successfully',
            data: updatedData
        });

    } catch (error) {
        console.error('❌ Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ==================== DELETE EXPERIENCE ====================
app.delete('/deleteTouristExperience/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if experience has active reservations
        const { data: reservations, error: reservError } = await supabase
            .from('reserva')
            .select('id_reserva')
            .eq('id_exptouristica', id)
            .in('estado', ['confirmada', 'pendiente']);

        if (reservError) {
            console.error('❌ Reservation check error:', reservError);
            return res.status(500).json({
                success: false,
                error: 'Failed to check reservations'
            });
        }

        if (reservations && reservations.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete experience with active reservations'
            });
        }

        // Get address ID before deleting
        const { data: experienceData, error: fetchError } = await supabase
            .from('experiencias_turisticas')
            .select('id_direccion')
            .eq('id_experiencia', id)
            .single();

        if (fetchError) {
            return res.status(404).json({
                success: false,
                error: 'Experience not found'
            });
        }

        // Delete experience
        const { error: deleteError } = await supabase
            .from('experiencias_turisticas')
            .delete()
            .eq('id_experiencia', id);

        if (deleteError) {
            console.error('❌ Delete error:', deleteError);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete experience'
            });
        }

        // Optionally delete address (if not used by other records)
        await supabase
            .from('direcciones')
            .delete()
            .eq('id_direccion', experienceData.id_direccion);

        return res.status(200).json({
            success: true,
            message: 'Experience deleted successfully'
        });

    } catch (error) {
        console.error('❌ Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ==================== UPLOAD IMAGE ====================
app.post('/uploadImage', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        // Upload to Cloudinary
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'tourist_experiences',
                    resource_type: 'auto'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        return res.status(200).json({
            success: true,
            imageUrl: result.secure_url,
            publicId: result.public_id
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to upload image'
        });
    }
});

// ==================== DELETE IMAGE ====================
app.delete('/deleteImage/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;
        const decodedPublicId = decodeURIComponent(publicId);

        await cloudinary.uploader.destroy(decodedPublicId);

        return res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete image error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete image'
        });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Tourist Experience Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
