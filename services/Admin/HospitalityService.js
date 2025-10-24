import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: '../../.env' });

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

    try {
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
    console.error('  Error no manejado:', err);
    res.status(500).json({ error: "Something went wrong!" });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 Hospitality Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🏨 Hotel data: http://localhost:${PORT}/getHotelData`);
    console.log(`📤 Upload image: http://localhost:${PORT}/uploadImage`);
    console.log(`✅ Test Cloudinary: http://localhost:${PORT}/test-cloudinary`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});
