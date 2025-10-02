import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({ path: '../.env' });

import { enviarBoleto } from "./EmailService.js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Cola de emails pendientes (para procesar en background)
const emailQueue = [];
let processingEmails = false;

// Procesar emails en background
async function processEmailQueue() {
    if (processingEmails || emailQueue.length === 0) return;
    
    processingEmails = true;
    
    while (emailQueue.length > 0) {
        const emailData = emailQueue.shift();
        try {
            await enviarBoleto(emailData);
            console.log(`✅ Email enviado a ${emailData.email}`);
        } catch (error) {
            console.error(`⚠️ Error enviando email a ${emailData.email}:`, error.message);
        }
    }
    
    processingEmails = false;
}

app.post("/purchase", async (req, res) => {
    const startTime = Date.now();
    
    try {
        const {
            reservationId,
            reserva,
            pago,
            usuarioData,
            hosteleria,
            pricing,
            timestamp
        } = req.body;

        // Validación rápida
        if (!reservationId || !reserva || !pago || !usuarioData) {
            return res.status(400).json({
                success: false,
                message: "Faltan datos requeridos"
            });
        }

        console.log("📝 Iniciando transacción...");

        const metodosMap = {
            'card': 'tarjeta',
            'paypal': 'paypal',
            'oxxo': 'efectivo'
        };
        
        const metodoValido = metodosMap[pago.metodo] || 'tarjeta';

        // OPTIMIZACIÓN 1: Usar transacción RPC si es posible, o insertar ambos registros
        // Preparar ambos inserts
        const reservaInsert = {
            id_usuario: reserva.id_usuario,
            id_hosteleria: reserva.id_hosteleria,
            fecha_inicio: reserva.fecha_inicio,
            fecha_fin: reserva.fecha_fin,
            personas: reserva.personas,
            estado: reserva.estado
        };

        // 1. Insertar Reserva
        const { data: reservaData, error: reservaError } = await supabase
            .from('reserva')
            .insert([reservaInsert])
            .select('id_reserva')
            .single();

        if (reservaError) {
            console.error("❌ Error en reserva:", reservaError);
            throw reservaError;
        }

        const id_reserva = reservaData.id_reserva;
        console.log(`✅ Reserva creada: ${id_reserva} (${Date.now() - startTime}ms)`);

        // 2. Insertar Pago inmediatamente
        const pagoInsert = {
            id_reserva: id_reserva,
            monto: pago.monto,
            metodo: metodoValido,
            fecha_pago: pago.fecha_pago,
            estado: pago.estado
        };

        const { data: pagoData, error: pagoError } = await supabase
            .from('pago')
            .insert([pagoInsert])
            .select('id_pago')
            .single();

        if (pagoError) {
            console.error("❌ Error en pago, rollback reserva");
            // Rollback: eliminar reserva
            await supabase.from('reserva').delete().eq('id_reserva', id_reserva);
            throw pagoError;
        }

        console.log(`✅ Pago registrado: ${pagoData.id_pago} (${Date.now() - startTime}ms)`);

        // OPTIMIZACIÓN 2: Enviar respuesta ANTES de enviar email
        const responseData = {
            success: true,
            message: "Reservación confirmada exitosamente",
            data: {
                reservationId: reservationId,
                id_reserva: id_reserva,
                id_pago: pagoData.id_pago,
                id_usuario: reserva.id_usuario,
                id_hosteleria: reserva.id_hosteleria,
                total: pago.monto,
                fecha_inicio: reserva.fecha_inicio,
                fecha_fin: reserva.fecha_fin,
                estado_reserva: reserva.estado,
                estado_pago: pago.estado
            }
        };

        // Responder inmediatamente
        res.status(200).json(responseData);
        
        console.log(`✅ Respuesta enviada (${Date.now() - startTime}ms)`);

        // OPTIMIZACIÓN 3: Encolar email para procesar en background
        emailQueue.push({
            email: usuarioData.email,
            nombre: usuarioData.nombre,
            id_reserva: id_reserva,
            id_pago: pagoData.id_pago,
            hosteleria: hosteleria,
            fecha_inicio: reserva.fecha_inicio,
            fecha_fin: reserva.fecha_fin,
            total: pago.monto,
            reservationId: reservationId,
            personas: reserva.personas
        });

        // Procesar cola de emails sin bloquear
        setImmediate(() => processEmailQueue());

    } catch (error) {
        console.error(`❌ Error procesando la compra (${Date.now() - startTime}ms):`, error);
        
        // Solo responder si no se ha enviado la respuesta
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Error al procesar la reservación",
                error: error.message
            });
        }
    }
});

// Endpoint para verificar el estado del email
app.get("/email-status/:reservationId", async (req, res) => {
    const { reservationId } = req.params;
    
    // Aquí podrías implementar un sistema de tracking de emails
    res.json({
        success: true,
        message: "Endpoint de tracking de emails",
        pending: emailQueue.length
    });
});

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: 'OK',
        service: 'Payment Service',
        emailQueueSize: emailQueue.length,
        timestamp: new Date().toISOString()
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
        res.status(500).json({ 
            success: false,
            error: "Something went wrong!" 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Payment Service started on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
});