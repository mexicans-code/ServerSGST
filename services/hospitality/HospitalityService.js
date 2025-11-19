import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken'; 



dotenv.config({ override: true });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('☁️ Cloudinary configurado:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '  Falta',
    api_key: process.env.CLOUDINARY_API_KEY ? '✅ OK' : '  Falta',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ OK' : '  Falta'
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'hotels',
                resource_type: 'image',
                transformation: [
                    { width: 1200, height: 800, crop: 'limit' },
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
};

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ==================== HEALTH CHECK ====================
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "Hospitality Service",
        timestamp: new Date().toISOString()
    });
});

// ==================== TEST CLOUDINARY ====================
app.get("/test-cloudinary", async (req, res) => {
    try {
        const result = await cloudinary.api.ping();
        res.json({
            success: true,
            message: 'Cloudinary está configurado correctamente',
            status: result.status,
            cloud_name: cloudinary.config().cloud_name
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al conectar con Cloudinary: ' + error.message
        });
    }
});

app.post("/uploadImage", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No se proporcionó ninguna imagen"
            });
        }

        const result = await uploadToCloudinary(req.file.buffer);

        return res.status(200).json({
            success: true,
            message: "Imagen subida exitosamente",
            imageUrl: result.secure_url
        });

    } catch (error) {
        console.error("  Error al subir imagen:", error);
        return res.status(500).json({
            success: false,
            error: "Error al subir la imagen: " + error.message
        });
    }
});


app.get("/getHotelData", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hosteleria')
            .select(`
        *,
        direcciones (
          ciudad,
          estado,
          pais,
          calle,
          colonia,
          numero_exterior,
          numero_interior
        )
      `);

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }

        return res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data,
        });
    } catch (error) {
        console.error('Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});


// ==================== CREATE ====================
app.post("/createHotel", async (req, res) => {
    try {
        const {
            id_anfitrion,
            nombre,
            descripcion,
            precio_por_noche,
            capacidad,
            habitaciones,
            banos,
            tipo_propiedad,
            estado,
            descuento_semanal,
            descuento_mensual,
            image // URL de Cloudinary ya subida
        } = req.body;

        const direccion = JSON.parse(req.body.direccion);

        console.log('📝 Datos recibidos:', {
            nombre,
            image,
            id_anfitrion
        });

        // Crear dirección
        const { data: direccionData, error: direccionError } = await supabase
            .from('direcciones')
            .insert([{
                calle: direccion.calle,
                ciudad: direccion.ciudad,
                estado: direccion.estado,
                codigo_postal: direccion.codigo_postal,
                pais: direccion.pais
            }])
            .select('id_direccion')
            .single();

        if (direccionError) {
            console.error('  Error al crear dirección:', direccionError);
            return res.status(500).json({
                success: false,
                error: 'Error al crear dirección: ' + direccionError.message
            });
        }

        // Crear hotel
        const { data: hotelData, error: hotelError } = await supabase
            .from('hosteleria')
            .insert([{
                id_anfitrion,
                id_direccion: direccionData.id_direccion,
                nombre,
                descripcion,
                precio_por_noche: parseFloat(precio_por_noche),
                capacidad: parseInt(capacidad),
                habitaciones: habitaciones ? parseInt(habitaciones) : 1,
                banos: banos ? parseInt(banos) : 1,
                tipo_propiedad: tipo_propiedad || 'Casa completa',
                image: image || null, // URL de Cloudinary
                estado: estado || 'activo',
                descuento_semanal: descuento_semanal ? parseFloat(descuento_semanal) : null,
                descuento_mensual: descuento_mensual ? parseFloat(descuento_mensual) : null
            }])
            .select('*')
            .single();

        if (hotelError) {
            console.error('  Error al crear hotel:', hotelError);
            // Rollback: eliminar dirección creada
            await supabase
                .from('direcciones')
                .delete()
                .eq('id_direccion', direccionData.id_direccion);

            return res.status(500).json({
                success: false,
                error: 'Error al crear hotel: ' + hotelError.message
            });
        }

        console.log('✅ Hotel creado exitosamente:', hotelData);

        return res.status(201).json({
            success: true,
            message: "Hotel creado exitosamente",
            data: hotelData
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
app.put("/updateHotel/:id", async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio_por_noche, habitaciones, banos, capacidad, estado, direccion } = req.body;

    if (!nombre && !descripcion && !precio_por_noche && !habitaciones && !banos && !capacidad && !estado && !direccion) {
        return res.status(400).json({
            success: false,
            error: "Debe proporcionar al menos un campo para actualizar"
        });
    }

    try {
        const { data: propertyData, error: propertyError } = await supabase
            .from('hosteleria')
            .select('id_direccion')
            .eq('id_hosteleria', id)
            .single();

        if (propertyError || !propertyData) {
            return res.status(404).json({
                success: false,
                error: "Propiedad no encontrada"
            });
        }

        if (direccion && propertyData.id_direccion) {
            const updateDireccion = {};
            if (direccion.calle !== undefined) updateDireccion.calle = direccion.calle;
            if (direccion.ciudad !== undefined) updateDireccion.ciudad = direccion.ciudad;
            if (direccion.estado !== undefined) updateDireccion.estado = direccion.estado;
            if (direccion.pais !== undefined) updateDireccion.pais = direccion.pais;
            if (direccion.colonia !== undefined) updateDireccion.colonia = direccion.colonia;
            if (direccion.numero_exterior !== undefined) updateDireccion.numero_exterior = direccion.numero_exterior;
            if (direccion.numero_interior !== undefined) updateDireccion.numero_interior = direccion.numero_interior;

            const { error: direccionError } = await supabase
                .from('direcciones')
                .update(updateDireccion)
                .eq('id_direccion', propertyData.id_direccion);

            if (direccionError) {
                return res.status(500).json({
                    success: false,
                    error: `Error al actualizar dirección: ${direccionError.message}`
                });
            }
        }

        const updateHosteleria = {};
        if (nombre !== undefined) updateHosteleria.nombre = nombre;
        if (descripcion !== undefined) updateHosteleria.descripcion = descripcion;
        if (precio_por_noche !== undefined) {
            if (precio_por_noche < 0) {
                return res.status(400).json({
                    success: false,
                    error: "El precio por noche no puede ser negativo"
                });
            }
            updateHosteleria.precio_por_noche = precio_por_noche;
        }
        if (habitaciones !== undefined) updateHosteleria.habitaciones = habitaciones;
        if (banos !== undefined) updateHosteleria.banos = banos;
        if (capacidad !== undefined) updateHosteleria.capacidad = capacidad;
        if (estado !== undefined) {
            const estadosValidos = ['activo', 'inactivo', 'pendiente'];
            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Estados permitidos: ${estadosValidos.join(', ')}`
                });
            }
            updateHosteleria.estado = estado;
        }

        const { data, error } = await supabase
            .from('hosteleria')
            .update(updateHosteleria)
            .eq('id_hosteleria', id)
            .select(`
        *,
        direcciones (*)
      `)
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "Propiedad actualizada exitosamente",
            data: {
                ...data,
                direccion: data.direcciones
            }
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
        // Primero verificar si hay reservas asociadas
        const { data: reservas, error: checkError } = await supabase
            .from('reserva')
            .select('id_reserva')
            .eq('id_hosteleria', id);

        if (checkError) {
            console.error('Error al verificar reservas:', checkError);
        }

        // Si hay reservas, no permitir la eliminación
        if (reservas && reservas.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar la propiedad porque tiene reservas asociadas',
                code: 'HAS_BOOKINGS'
            });
        }

        // Si no hay reservas, proceder con la eliminación
        const { data, error } = await supabase
            .from('hosteleria')
            .delete()
            .eq('id_hosteleria', id)
            .select('*')
            .single();

        if (error) {
            // Capturar específicamente el error de foreign key constraint
            if (error.code === '23503' || error.message.includes('foreign key constraint')) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar la propiedad porque tiene reservas asociadas',
                    code: 'HAS_BOOKINGS'
                });
            }

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

        // Capturar el error de constraint en el catch también
        if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar la propiedad porque tiene reservas asociadas',
                code: 'HAS_BOOKINGS'
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==================== DELETE IMAGE ====================
app.delete("/deleteImage/:publicId", async (req, res) => {
    try {
        const { publicId } = req.params;
        const decodedPublicId = decodeURIComponent(publicId);

        const result = await cloudinary.uploader.destroy(decodedPublicId);

        if (result.result === 'ok') {
            return res.status(200).json({
                success: true,
                message: 'Imagen eliminada exitosamente'
            });
        } else {
            return res.status(404).json({
                success: false,
                error: 'Imagen no encontrada'
            });
        }

    } catch (error) {
        console.error('Error al eliminar imagen:', error);
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
        console.error('  Error del servidor:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== CONVERTIRSE EN ANFITRIÓN ====================
app.post("/convertirseEnAnfitrion", async (req, res) => {
    const { id_usuario } = req.body;

    // Validación del id_usuario
    if (!id_usuario) {
        return res.status(400).json({
            success: false,
            error: "Se requiere el ID de usuario"
        });
    }

    try {
        // Verificar si el usuario ya es anfitrión
        const { data: existente } = await supabase
            .from('usuario')
            .select('*')
            .eq('id_usuario', id_usuario)
            .single();

        if (!existente) {
            return res.status(404).json({
                success: false,
                error: "Usuario no encontrado"
            });
        }

        if (existente.rol === 'anfitrion') {
            // Generar token aunque ya sea anfitrión (por si acaso)
            const token = jwt.sign(
                {
                    id_usuario: existente.id_usuario,
                    email: existente.email,
                    nombre: existente.nombre,
                    rol: 'anfitrion'
                },
                process.env.JWT_SECRET, // Tu clave secreta del archivo .env
                { expiresIn: '24h' }
            );

            return res.status(200).json({
                success: true,
                message: "Ya eres anfitrión",
                data: existente,
                token: token
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

        // Generar NUEVO token JWT con el rol actualizado
        const newToken = jwt.sign(
            {
                id_usuario: data.id_usuario,
                email: data.email,
                nombre: data.nombre,
                rol: 'anfitrion' // Rol actualizado
            },
            process.env.JWT_SECRET, // Tu clave secreta del archivo .env
            { expiresIn: '24h' } // Tiempo de expiración (ajusta según necesites)
        );

        return res.status(200).json({
            success: true,
            message: "¡Ahora eres anfitrión!",
            data: data,
            token: newToken // Devolver el nuevo token
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
    console.error('  Error no manejado:', err);
    res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
    console.log("🚀 Hospitality Service started successfully!");
    console.log(`📍 Running on PORT: ${PORT}`);
    console.log(`🏨 Hotel data route: /getHotelData`);
    console.log(`📤 Upload image: /uploadImage`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});

