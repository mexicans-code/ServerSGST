const multer = require('multer');
const cloudinary = require('./Admin/cloudinaryConfig');

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
          { width: 1200, height: 800, crop: 'limit' }, // Optimizar tamaño
          { quality: 'auto' }, // Calidad automática
          { fetch_format: 'auto' } // Formato automático (WebP cuando sea posible)
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

app.post("/uploadImage", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ninguna imagen'
      });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: 'Imagen subida exitosamente',
      imageUrl: result.secure_url,
      publicId: result.public_id // Guardar para poder eliminarla después
    });

  } catch (error) {
    console.error('Error al subir imagen:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al subir la imagen: ' + error.message
    });
  }
});