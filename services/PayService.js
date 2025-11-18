import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({ path: '../.env' });
import { MercadoPagoConfig, Payment } from 'mercadopago';

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

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const paymentClient = new Payment(client);

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

// Endpoint para procesar pagos con Mercado Pago
app.post("/mercadopago", async (req, res) => {
    const startTime = Date.now();

    console.log('📦 BODY COMPLETO:', JSON.stringify(req.body, null, 2));

    try {
        const {
            token,
            issuer_id,
            payment_method_id,
            transaction_amount,
            installments,
            payer,
            reserva,
            reservationId,
            usuarioData,
            tipo,
            pricing
        } = req.body;

        console.log('📥 Procesando pago con Mercado Pago...');
        console.log('Tipo de reserva:', tipo);
        console.log('Payer data:', payer);

        // Determinar descripción según el tipo
        let descripcion = '';
        let metadata = {
            reservation_id: reservationId,
            user_id: usuarioData.id_usuario,
            tipo: tipo || 'hosteleria'
        };

        if (tipo === 'tourism') {
            const { experiencia } = req.body;
            descripcion = `Reserva ${reservationId} - ${experiencia.nombre}`;
            metadata.id_experiencia = reserva.id_experiencia;
        } else {
            const { hosteleria } = req.body;
            descripcion = `Reserva ${reservationId} - ${hosteleria.nombre}`;
            metadata.id_hosteleria = reserva.id_hosteleria;
        }

        // Crear el pago en Mercado Pago
        const payment_data = {
            token: token,
            issuer_id: issuer_id,
            payment_method_id: payment_method_id,
            transaction_amount: Number(transaction_amount),
            installments: Number(installments),
            description: descripcion,
            payer: {
                email: payer.email,
                identification: {
                    type: payer.identification?.type || "RFC",
                    number: payer.identification?.number || "XAXX010101000"
                }
            },
            external_reference: reservationId,
            metadata: metadata
        };

        const response = await paymentClient.create({ body: payment_data });
        console.log(`✅ Respuesta de MP: ${response.status} (${Date.now() - startTime}ms)`);

        if (response.status === 'approved') {
            let id_reserva, id_pago;

            if (tipo === 'tourism') {
                // ============= PROCESAR RESERVA DE TURISMO =============
                const { experiencia } = req.body;

                // Insertar en tabla de reservas
                const { data: reservaData, error: reservaError } = await supabase
                    .from('reserva')
                    .insert([{
                        id_usuario: reserva.id_usuario,
                        id_exptouristica: reserva.id_exptouristica,
                        id_hosteleria: null,
                        fecha_inicio: null,
                        fecha_fin: null,
                        personas: null,
                        estado: 'confirmada'
                    }])
                    .select('id_reserva')
                    .single();

                if (reservaError) {
                    console.error('  Error al crear reserva de turismo:', reservaError);
                    throw reservaError;
                }

                id_reserva = reservaData.id_reserva;

                // Insertar Pago
                const { data: pagoData, error: pagoError } = await supabase
                    .from('pago')
                    .insert([{
                        id_reserva: id_reserva,
                        monto: transaction_amount,
                        metodo: 'mercadopago',
                        fecha_pago: new Date().toISOString(),
                        estado: 'completado',
                        payment_id_mp: response.id
                    }])
                    .select('id_pago')
                    .single();

                if (pagoError) {
                    await supabase.from('reserva').delete().eq('id_reserva', id_reserva);
                    throw pagoError;
                }

                id_pago = pagoData.id_pago;

                // Responder exitosamente
                res.status(200).json({
                    status: response.status,
                    status_detail: response.status_detail,
                    payment_id: response.id,
                    reservationId: reservationId,
                    id_reserva: id_reserva,
                    id_pago: id_pago,
                    tipo: 'tourism',
                    message: 'Pago aprobado exitosamente'
                });

                // Encolar email para turismo
                emailQueue.push({
                    tipo: 'tourism',
                    email: usuarioData.email,
                    nombre: usuarioData.nombre,
                    id_reserva: id_reserva,
                    id_pago: id_pago,
                    experiencia: experiencia,
                    participantes: reserva.participantes,
                    total: transaction_amount,
                    reservationId: reservationId,
                    punto_encuentro: experiencia.punto_encuentro
                });

                // Procesar email


            } else {
                // ============= PROCESAR RESERVA DE HOSTELERÍA =============
                const { hosteleria } = req.body;

                const { data: reservaData, error: reservaError } = await supabase
                    .from('reserva')
                    .insert([{
                        id_usuario: reserva.id_usuario,
                        id_hosteleria: reserva.id_hosteleria,
                        fecha_inicio: reserva.fecha_inicio,
                        fecha_fin: reserva.fecha_fin,
                        personas: reserva.personas,
                        estado: 'confirmada'
                    }])
                    .select('id_reserva')
                    .single();

                if (reservaError) throw reservaError;

                id_reserva = reservaData.id_reserva;

                // Insertar Pago
                const { data: pagoData, error: pagoError } = await supabase
                    .from('pago')
                    .insert([{
                        id_reserva: id_reserva,
                        monto: transaction_amount,
                        metodo: 'mercadopago',
                        fecha_pago: new Date().toISOString(),
                        estado: 'completado',
                        payment_id_mp: response.id
                    }])
                    .select('id_pago')
                    .single();

                if (pagoError) {
                    await supabase.from('reserva').delete().eq('id_reserva', id_reserva);
                    throw pagoError;
                }

                id_pago = pagoData.id_pago;

                // Responder exitosamente
                res.status(200).json({
                    status: response.status,
                    status_detail: response.status_detail,
                    payment_id: response.id,
                    reservationId: reservationId,
                    id_reserva: id_reserva,
                    id_pago: id_pago,
                    tipo: 'hosteleria',
                    message: 'Pago aprobado exitosamente'
                });

                // Encolar email para hostelería
                emailQueue.push({
                    tipo: 'hosteleria',
                    email: usuarioData.email,
                    nombre: usuarioData.nombre,
                    id_reserva: id_reserva,
                    id_pago: id_pago,
                    hosteleria: hosteleria,
                    fecha_inicio: reserva.fecha_inicio,
                    fecha_fin: reserva.fecha_fin,
                    total: transaction_amount,
                    reservationId: reservationId,
                    personas: reserva.personas
                });
            }

            setImmediate(() => processEmailQueue());

        } else {
            // Pago no aprobado
            res.status(200).json({
                status: response.status,
                status_detail: response.status_detail,
                payment_id: response.id,
                message: 'Pago no aprobado'
            });
        }

    } catch (error) {
        console.error(`  Error con Mercado Pago (${Date.now() - startTime}ms):`, error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Error al procesar el pago",
                error: error.message
            });
        }
    }
});

app.post("/purchase", async (req, res) => {
    const startTime = Date.now();

    console.log('📦 BODY COMPLETO:', JSON.stringify(req.body, null, 2));

    try {
        const {
            reservationId,
            tipo,
            reserva,
            pago,
            usuarioData,
            experiencia,
            hosteleria,
            pricing
        } = req.body;

        console.log('📥 Procesando compra directa...');
        console.log('Tipo de reserva:', tipo);

        let id_reserva, id_pago;

        if (tipo === 'tourism') {
            // ============= PROCESAR RESERVA DE TURISMO =============

            // Insertar en tabla de reservas
            const { data: reservaData, error: reservaError } = await supabase
                .from('reserva')
                .insert([{
                    id_usuario: reserva.id_usuario,
                    id_exptouristica: reserva.id_experiencia,
                    id_hosteleria: null,
                    fecha_inicio: reserva.fecha,
                    fecha_fin: null,
                    personas: reserva.participantes,
                    estado: reserva.estado || 'confirmada'
                }])
                .select('id_reserva')
                .single();

            if (reservaError) {
                console.error('  Error al crear reserva de turismo:', reservaError);
                throw reservaError;
            }

            id_reserva = reservaData.id_reserva;

            // Insertar Pago
            const { data: pagoData, error: pagoError } = await supabase
                .from('pago')
                .insert([{
                    id_reserva: id_reserva,
                    monto: pago.monto,
                    metodo: pago.metodo,
                    fecha_pago: pago.fecha_pago || new Date().toISOString(),
                    estado: pago.estado || 'completado',
                    payment_id_mp: null
                }])
                .select('id_pago')
                .single();

            if (pagoError) {
                console.error('  Error al crear pago:', pagoError);
                // Rollback: eliminar reserva
                await supabase.from('reserva').delete().eq('id_reserva', id_reserva);
                throw pagoError;
            }

            id_pago = pagoData.id_pago;

            // ================= ACTUALIZAR CAPACIDAD =================
            const { data: expData, error: expError } = await supabase
                .from("experiencias_turisticas")
                .select("capacidad")
                .eq("id_experiencia", reserva.id_experiencia)
                .single();

            if (expError) {
                console.error("  Error al obtener capacidad actual:", expError);
                throw expError;
            }

            const capacidadActual = expData.capacidad;
            const nuevaCapacidad = capacidadActual - reserva.participantes;

            if (nuevaCapacidad < 0) {
                console.error("  No hay lugares suficientes.");
                throw new Error("No hay suficientes lugares disponibles.");
            }

            const { error: updateError } = await supabase
                .from("experiencias_turisticas")
                .update({ capacidad: nuevaCapacidad })
                .eq("id_experiencia", reserva.id_experiencia);

            if (updateError) {
                console.error("  Error al actualizar capacidad:", updateError);
                throw updateError;
            }

            console.log(`🟦 Capacidad actualizada: ${capacidadActual} → ${nuevaCapacidad}`);

            // Responder exitosamente
            res.status(200).json({
                success: true,
                reservationId: reservationId,
                id_reserva: id_reserva,
                id_pago: id_pago,
                tipo: 'tourism',
                message: 'Compra procesada exitosamente'
            });

            // Encolar email para turismo
            emailQueue.push({
                tipo: 'tourism',
                email: usuarioData.email,
                nombre: usuarioData.nombre,
                id_reserva: id_reserva,
                id_pago: id_pago,
                experiencia: experiencia,
                participantes: reserva.participantes,
                total: pago.monto,
                reservationId: reservationId,
                punto_encuentro: experiencia.punto_encuentro
            });

            // Procesar email en background
            setImmediate(() => processEmailQueue());

        } else {
            // ============= PROCESAR RESERVA DE HOSTELERÍA =============

            const { data: reservaData, error: reservaError } = await supabase
                .from('reserva')
                .insert([{
                    id_usuario: reserva.id_usuario,
                    id_hosteleria: reserva.id_hosteleria,
                    fecha_inicio: reserva.fecha_inicio,
                    fecha_fin: reserva.fecha_fin,
                    personas: reserva.personas,
                    estado: reserva.estado || 'confirmada'
                }])
                .select('id_reserva')
                .single();

            if (reservaError) {
                console.error('  Error al crear reserva de hostelería:', reservaError);
                throw reservaError;
            }

            id_reserva = reservaData.id_reserva;

            // Insertar Pago
            const { data: pagoData, error: pagoError } = await supabase
                .from('pago')
                .insert([{
                    id_reserva: id_reserva,
                    monto: pago.monto,
                    metodo: pago.metodo,
                    fecha_pago: pago.fecha_pago || new Date().toISOString(),
                    estado: pago.estado || 'completado',
                    payment_id_mp: null
                }])
                .select('id_pago')
                .single();

            if (pagoError) {
                console.error('  Error al crear pago:', pagoError);
                // Rollback: eliminar reserva
                await supabase.from('reserva').delete().eq('id_reserva', id_reserva);
                throw pagoError;
            }

            id_pago = pagoData.id_pago;
            

            // Responder exitosamente
            res.status(200).json({
                success: true,
                reservationId: reservationId,
                id_reserva: id_reserva,
                id_pago: id_pago,
                tipo: 'hosteleria',
                message: 'Compra procesada exitosamente'
            });

            // Encolar email para hostelería
            emailQueue.push({
                tipo: 'hosteleria',
                email: usuarioData.email,
                nombre: usuarioData.nombre,
                id_reserva: id_reserva,
                id_pago: id_pago,
                hosteleria: hosteleria,
                fecha_inicio: reserva.fecha_inicio,
                fecha_fin: reserva.fecha_fin,
                total: pago.monto,
                reservationId: reservationId,
                personas: reserva.personas
            });

            // Procesar email en background
            setImmediate(() => processEmailQueue());
        }

        console.log(`✅ Compra procesada exitosamente (${Date.now() - startTime}ms)`);

    } catch (error) {
        console.error(`  Error al procesar compra (${Date.now() - startTime}ms):`, error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Error al procesar la compra",
                error: error.message
            });
        }
    }
});

// Endpoint para verificar el estado del email
app.get("/email-status/:reservationId", async (req, res) => {
    const { reservationId } = req.params;

    res.json({
        success: true,
        message: "Endpoint de tracking de emails",
        pending: emailQueue.length
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