import express from 'express';
import cors from 'cors';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

const SERVICES = {
    hospitality: process.env.HOSPITALITY_SERVICE_URL || 'http://localhost:3001',
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    pay: process.env.PAY_SERVICE_URL || 'http://localhost:3004',
    adminUser: process.env.ADMIN_USER_SERVICE_URL || 'http://localhost:3005',
    adminBooking: process.env.ADMIN_BOOKING_SERVICE_URL || 'http://localhost:3006',
    adminProfile: process.env.ADMIN_PROFILE_SERVICE_URL || 'http://localhost:3007',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
    adminTouristExperiences: process.env.ADMIN_TOURIST_EXPERIENCES_SERVICE_URL || 'http://localhost:3009',
    reviews: process.env.REVIEWS_SERVICE_URL || 'http://localhost:3010',
};

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    console.log('🔐 GATEWAY: Verificando token...');
    console.log('🔑 JWT_SECRET existe:', !!JWT_SECRET);
    console.log('🎫 Token recibido:', token ? 'Sí' : 'No');

    if (!token) {
        console.log('❌ GATEWAY: Token no proporcionado');
        return res.status(403).json({
            success: false,
            error: "Token no proporcionado"
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('✅ GATEWAY: Token válido para usuario:', decoded.id_usuario);
        req.usuario = decoded;
        next();
    } catch (error) {
        console.log('❌ GATEWAY: Error verificando token:', error.message);
        return res.status(401).json({
            success: false,
            error: "Token inválido o expirado",
            detalle: error.message
        });
    }
};

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'API Gateway',
        timestamp: new Date().toISOString()
    });
});

// ===== RUTAS DE AUTENTICACIÓN =====
app.post('/api/auth/register', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.auth}/register`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de autenticación' }
        );
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.auth}/login`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de autenticación' }
        );
    }
});

app.post('/api/auth/google-login', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.auth}/google-login`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de autenticación' }
        );
    }
});

// ===== RUTAS DE HOSPITALIDAD =====
app.get('/api/hospitality/getHotelData', async (req, res) => {
    try {
        const response = await axios.get(`${SERVICES.hospitality}/getHotelData`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de hospitalidad' }
        );
    }
});

app.post('/api/hospitality/createHotel', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.hospitality}/createHotel`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de hospitalidad' }
        );
    }
});

app.put('/api/hospitality/updateHotel/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.put(`${SERVICES.hospitality}/updateHotel/${id}`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de hospitalidad' }
        );
    }
});

app.delete('/api/hospitality/deleteHotel/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.delete(`${SERVICES.hospitality}/deleteHotel/${id}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de hospitalidad' }
        );
    }
});

app.post('/api/hospitality/convertirseEnAnfitrion', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.hospitality}/convertirseEnAnfitrion`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de hospitalidad' }
        );
    }
});

// ===== RUTAS DE PAGO =====
app.post('/api/pay/purchase', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.pay}/purchase`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de pago' }
        );
    }
});

app.post('/api/pay/mercadopago', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.pay}/mercadopago`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de pago' }
        );
    }
});

// ===== RUTAS DE ADMINISTRACIÓN DE USUARIOS =====
app.get('/api/adminUser/getUsers', async (req, res) => {
    try {
        const response = await axios.get(`${SERVICES.adminUser}/getUsers`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de administración de usuarios' }
        );
    }
});

app.post('/api/adminUser/createUser', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.adminUser}/createUser`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de administración de usuarios' }
        );
    }
});

app.put('/api/adminUser/updateUser/:id_usuario', async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const response = await axios.put(`${SERVICES.adminUser}/updateUser/${id_usuario}`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de administración de usuarios' }
        );
    }
});

app.delete('/api/adminUser/deleteUser/:id_usuario', async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const response = await axios.delete(`${SERVICES.adminUser}/deleteUser/${id_usuario}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de administración de usuarios' }
        );
    }
});

// ===== RUTAS DE ADMINISTRACIÓN DE RESERVAS =====
app.get('/api/booking/getBookings', async (req, res) => {
    try {
        const response = await axios.get(`${SERVICES.adminBooking}/getBookings`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de reservas' }
        );
    }
});

app.get('/api/booking/getBooking/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.get(`${SERVICES.adminBooking}/getBooking/${id}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de reservas' }
        );
    }
});

app.post('/api/booking/createBooking', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.adminBooking}/createBooking`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de reservas' }
        );
    }
});

app.put('/api/booking/updateBooking/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.put(`${SERVICES.adminBooking}/updateBooking/${id}`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de reservas' }
        );
    }
});

app.delete('/api/booking/deleteBooking/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.delete(`${SERVICES.adminBooking}/deleteBooking/${id}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de reservas' }
        );
    }
});

app.get('/api/booking/getExperiences', async (req, res) => {
    try {
        const response = await axios.get(`${SERVICES.adminBooking}/getExperiences`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de reservas' }
        );
    }
});

// ===== RUTAS DE EXPERIENCIAS TURÍSTICAS =====
app.get('/api/adminTouristExperiences/getTouristExperiences', async (req, res) => {
    try {
        const response = await axios.get(`${SERVICES.adminTouristExperiences}/getTouristExperiences`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de experiencias turísticas' }
        );
    }
});

app.post('/api/adminTouristExperiences/createTouristExperience', async (req, res) => {
    try {
        const response = await axios.post(`${SERVICES.adminTouristExperiences}/createTouristExperience`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de experiencias turísticas' }
        );
    }
});

app.put('/api/adminTouristExperiences/updateTouristExperience/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.put(`${SERVICES.adminTouristExperiences}/updateTouristExperience/${id}`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de experiencias turísticas' }
        );
    }
});

app.delete('/api/adminTouristExperiences/deleteTouristExperience/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.delete(`${SERVICES.adminTouristExperiences}/deleteTouristExperience/${id}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de experiencias turísticas' }
        );
    }
});

// ===== RUTAS DE ADMINISTRACIÓN DE PERFIL =====
app.get('/api/adminProfile/getProfile', verifyToken, async (req, res) => {
    try {
        const response = await axios.get(`${SERVICES.adminProfile}/getProfile`, {
            headers: {
                'Authorization': req.headers['authorization']
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de perfil' }
        );
    }
});

app.put('/api/adminProfile/updateProfile', verifyToken, async (req, res) => {
    try {
        const response = await axios.put(
            `${SERVICES.adminProfile}/updateProfile`,
            req.body,
            {
                headers: {
                    'Authorization': req.headers['authorization']
                }
            }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de perfil' }
        );
    }
});

// ===== RUTAS DE RESEÑAS =====
app.get('/api/reviews/getReviews', async (req, res) => {
    try {
        console.log('🔍 req.query:', req.query);
        const { id_reserva, id_hosteleria, id_experiencia } = req.query;

        console.log('Parámetros recibidos:', { id_reserva, id_hosteleria, id_experiencia });

        if (!id_reserva && !id_hosteleria && !id_experiencia) {
            return res.status(400).json({
                error: 'Se requiere id_reserva, id_hosteleria o id_experiencia'
            });
        }

        let queryParams = [];
        if (id_reserva) queryParams.push(`id_reserva=${id_reserva}`);
        if (id_hosteleria) queryParams.push(`id_hosteleria=${id_hosteleria}`);
        if (id_experiencia) queryParams.push(`id_experiencia=${id_experiencia}`);

        const queryString = queryParams.join('&');
        const fullUrl = `${SERVICES.reviews}/getReviews?${queryString}`;

        console.log('🔗 Enviando a:', fullUrl);

        const response = await axios.get(fullUrl);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en reseñas' }
        );
    }
});

app.post('/api/reviews/addReview', async (req, res) => {
    try {
        console.log('📝 Agregando reseña:', req.body);

        const fullUrl = `${SERVICES.reviews}/addReview`;
        console.log('🔗 Enviando a:', fullUrl);

        const response = await axios.post(fullUrl, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('❌ Error al agregar reseña:', error.message);
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error al agregar reseña' }
        );
    }
});

// ===== RUTAS DE CHAT =====
app.use('/api/chat', verifyToken, async (req, res) => {
    try {
        const response = await axios({
            method: req.method,
            url: `${SERVICES.chat}${req.path}`,
            data: req.body,
            headers: {
                'Authorization': req.headers['authorization'],
                'Content-Type': 'application/json'
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: 'Error en el servicio de chat' }
        );
    }
});

// ===== MANEJO DE ERRORES =====
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`🚀 API Gateway corriendo en puerto ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('\n📡 Servicios configurados:');
    Object.entries(SERVICES).forEach(([name, url]) => {
        console.log(`   - ${name}: ${url}`);
    });
});