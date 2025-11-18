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
const PORT = process.env.PORT || 3011;
app.use(express.json());
app.use(cors());

// ==================== LOG DE PETICIONES ====================
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ==================== HEALTH CHECK ====================
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "Dashboard Data Service",
        message: "Servicio activo y listo para consultar datos",
        timestamp: new Date().toISOString(),
    });
});

// ==================== RESEÑAS ====================
app.get("/getResenas", async (req, res) => {
    try {
        // 1️⃣ Obtenemos reseñas, reservas y hostelerías
        const { data: resenas, error: errorResenas } = await supabase.from("reseña").select("*");
        if (errorResenas) throw errorResenas;

        const { data: reservas, error: errorReservas } = await supabase.from("reserva").select("id_reserva, id_hosteleria");
        if (errorReservas) throw errorReservas;

        const { data: hostelerias, error: errorHosteleria } = await supabase.from("hosteleria").select("id_hosteleria, id_anfitrion, nombre");
        if (errorHosteleria) throw errorHosteleria;

        // 2️⃣ Si no hay reseñas
        if (!resenas || resenas.length === 0) {
            return res.status(200).json({
                success: true,
                total_resenas: 0,
                promedio_general: 0,
                por_hosteleria: [],
                por_anfitrion: []
            });
        }

        // 3️⃣ Cálculo general
        const totalResenas = resenas.length;
        const promedioGeneral = (resenas.reduce((acc, r) => acc + (r.calificacion || 0), 0) / totalResenas).toFixed(2);

        // 4️⃣ Agrupar por hostelería
        const statsHosteleria = {};
        resenas.forEach(r => {
            const reserva = reservas.find(rv => rv.id_reserva === r.id_reserva);
            if (!reserva || !reserva.id_hosteleria) return;

            const hotel = hostelerias.find(h => h.id_hosteleria === reserva.id_hosteleria);
            if (!hotel) return;

            if (!statsHosteleria[hotel.id_hosteleria]) {
                statsHosteleria[hotel.id_hosteleria] = {
                    id_hosteleria: hotel.id_hosteleria,
                    nombre: hotel.nombre,
                    total_resenas: 0,
                    promedio_calificacion: 0
                };
            }

            statsHosteleria[hotel.id_hosteleria].total_resenas++;
            statsHosteleria[hotel.id_hosteleria].promedio_calificacion += r.calificacion;
        });

        // Calcular promedio por hostelería
        Object.values(statsHosteleria).forEach(h => {
            h.promedio_calificacion = (h.promedio_calificacion / h.total_resenas).toFixed(2);
        });

        // 5️⃣ Agrupar por anfitrión
        const statsAnfitrion = {};
        resenas.forEach(r => {
            const reserva = reservas.find(rv => rv.id_reserva === r.id_reserva);
            if (!reserva || !reserva.id_hosteleria) return;

            const hotel = hostelerias.find(h => h.id_hosteleria === reserva.id_hosteleria);
            if (!hotel) return;

            if (!statsAnfitrion[hotel.id_anfitrion]) {
                statsAnfitrion[hotel.id_anfitrion] = {
                    id_anfitrion: hotel.id_anfitrion,
                    total_resenas: 0,
                    promedio_calificacion: 0
                };
            }

            statsAnfitrion[hotel.id_anfitrion].total_resenas++;
            statsAnfitrion[hotel.id_anfitrion].promedio_calificacion += r.calificacion;
        });

        Object.values(statsAnfitrion).forEach(a => {
            a.promedio_calificacion = (a.promedio_calificacion / a.total_resenas).toFixed(2);
        });

        // 6️⃣ Devolver datos
        return res.status(200).json({
            success: true,
            total_resenas: totalResenas,
            promedio_general: promedioGeneral,
            por_hosteleria: Object.values(statsHosteleria),
            por_anfitrion: Object.values(statsAnfitrion)
        });

    } catch (error) {
        console.error("Error al obtener reseñas:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener reseñas y calcular promedios",
            error: error.message
        });
    }
});

// ==================== GENERAL ====================
app.get("/dashboardResumen", async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // ==================== PAGOS ====================
        const { data: pagos, error: errorPagos } = await supabase.from("pago").select("*");
        if (errorPagos) throw errorPagos;

        const totalPagos = pagos.length || 0;

        // Estados fijos esperados
        const estadosPagos = { completado: 0, pendiente: 0, cancelado: 0 };

        pagos.forEach(pago => {
            const estado = pago.estado?.toLowerCase();
            if (estado && estadosPagos.hasOwnProperty(estado)) {
                estadosPagos[estado]++;
            }
        });

        const porcentajesPagos = Object.keys(estadosPagos).reduce((acc, estado) => {
            acc[estado] = totalPagos > 0
                ? ((estadosPagos[estado] / totalPagos) * 100).toFixed(2) + "%"
                : "0.00%";
            return acc;
        }, {});

        const pagosCompletados = pagos.filter(p => p.estado?.toLowerCase() === "completado");

        // ==================== RESERVAS ====================
        const { data: reservas, error: errorReservas } = await supabase.from("reserva").select("*");
        if (errorReservas) throw errorReservas;

        const totalReservas = reservas.length || 0;

        const estadosReservas = { confirmada: 0, cancelada: 0, pendiente: 0 };
        reservas.forEach(r => {
            const estado = r.estado?.toLowerCase();
            if (estado && estadosReservas.hasOwnProperty(estado)) {
                estadosReservas[estado]++;
            }
        });

        const porcentajesReservas = Object.keys(estadosReservas).reduce((acc, estado) => {
            acc[estado] = totalReservas > 0
                ? ((estadosReservas[estado] / totalReservas) * 100).toFixed(2) + "%"
                : "0.00%";
            return acc;
        }, {});

        // ==================== INGRESOS Y RESERVAS POR MES ====================
        const ingresosPorMes = {};
        const reservasPorMes = {};
        for (let m = 1; m <= 12; m++) {
            const keyMes = `${year}-${m.toString().padStart(2, "0")}`;
            ingresosPorMes[keyMes] = 0;
            reservasPorMes[keyMes] = 0;
        }

        pagosCompletados.forEach(pago => {
            const fecha = new Date(pago.fecha_pago);
            if (!isNaN(fecha) && fecha.getFullYear() === year) {
                const keyMes = `${year}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
                ingresosPorMes[keyMes] += pago.monto;
            }
        });

        reservas.forEach(r => {
            const fecha = new Date(r.fecha_inicio || r.fecha_fin);
            if (!isNaN(fecha) && fecha.getFullYear() === year) {
                const keyMes = `${year}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
                reservasPorMes[keyMes] += 1;
            }
        });

        // ==================== INGRESOS Y RESERVAS POR AÑO ====================
        const ingresosPorAno = {};
        const reservasPorAno = {};

        pagosCompletados.forEach(pago => {
            const ano = new Date(pago.fecha_pago).getFullYear();
            if (!isNaN(ano)) ingresosPorAno[ano] = (ingresosPorAno[ano] || 0) + pago.monto;
        });

        reservas.forEach(r => {
            const fecha = new Date(r.fecha_inicio || r.fecha_fin);
            const ano = fecha.getFullYear();
            if (!isNaN(ano)) reservasPorAno[ano] = (reservasPorAno[ano] || 0) + 1;
        });

        // ==================== RESPUESTA ====================
        return res.status(200).json({
            success: true,
            resumenPagos: {
                totalPagos,
                pagosPorEstado: estadosPagos,
                porcentajesPorEstado: porcentajesPagos
            },
            resumenReservas: {
                totalReservas,
                estados: estadosReservas,
                porcentajes: porcentajesReservas
            },
            ingresosPorMes,
            reservasPorMes,
            ingresosPorAno,
            reservasPorAno
        });

    } catch (error) {
        console.error("❌ Error en dashboardResumen:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener el resumen del dashboard",
            error: error.message
        });
    }
});

// ==================== INGRESOS POR HOSTELERÍA ====================
app.get("/getIngresosHosteleria", async (req, res) => {
    try {
        const { data: pagos } = await supabase
            .from("pago")
            .select("*")
            .eq("estado", "completado");

        const { data: reservas } = await supabase
            .from("reserva")
            .select("id_reserva, id_hosteleria");

        const { data: hostelerias } = await supabase
            .from("hosteleria")
            .select("id_hosteleria, nombre");

        const ingresosHosteleria = {};

        pagos.forEach((pago) => {
            const reserva = reservas.find((r) => r.id_reserva === pago.id_reserva);
            if (!reserva) return;

            const host = hostelerias.find((h) => h.id_hosteleria === reserva.id_hosteleria);
            if (!host) return;

            if (!ingresosHosteleria[host.id_hosteleria]) {
                ingresosHosteleria[host.id_hosteleria] = {
                    nombre: host.nombre,
                    ingresos_totales: 0,
                    total_reservas: 0,
                };
            }

            ingresosHosteleria[host.id_hosteleria].ingresos_totales += pago.monto;
            ingresosHosteleria[host.id_hosteleria].total_reservas++;
        });

        // Transformamos a array y redondeamos ingresos (opcional)
        const data = Object.values(ingresosHosteleria).map((h) => ({
            nombre: h.nombre.trim(),
            ingresos_totales: h.ingresos_totales,
            total_reservas: h.total_reservas,
        }));

        res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        console.error("❌ Error al calcular ingresos por hostelería:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener ingresos por hostelería",
            error: error.message,
        });
    }
});

// ==================== INGRESOS POR ANFITRIÓN ====================
app.get("/getIngresosAnfitrion", async (req, res) => {
    try {
        // 1️⃣ Obtener datos necesarios de las tablas
        const { data: pagos } = await supabase
            .from("pago")
            .select("*")
            .eq("estado", "completado");

        const { data: reservas } = await supabase
            .from("reserva")
            .select("id_reserva, id_hosteleria");

        const { data: hostelerias } = await supabase
            .from("hosteleria")
            .select("id_hosteleria, id_anfitrion, nombre");

        const { data: usuarios } = await supabase
            .from("usuario")
            .select("id_usuario, nombre, apellido_p");

        // 2️⃣ Estructura para agrupar los ingresos por anfitrión
        const ingresosAnfitrion = {};

        pagos.forEach((pago) => {
            const reserva = reservas.find((r) => r.id_reserva === pago.id_reserva);
            if (!reserva) return;

            const host = hostelerias.find((h) => h.id_hosteleria === reserva.id_hosteleria);
            if (!host) return;

            const usuario = usuarios.find((u) => u.id_usuario === host.id_anfitrion);
            if (!usuario) return;

            const nombreAnfitrion = `${usuario.nombre?.trim() || ""} ${usuario.apellido_p?.trim() || ""}`.trim();

            if (!ingresosAnfitrion[nombreAnfitrion]) {
                ingresosAnfitrion[nombreAnfitrion] = {
                    nombre_anfitrion: nombreAnfitrion,
                    hostelerias: [],
                    ingresos_totales: 0,
                    total_reservas: 0,
                };
            }

            ingresosAnfitrion[nombreAnfitrion].ingresos_totales += pago.monto;
            ingresosAnfitrion[nombreAnfitrion].total_reservas++;

            if (!ingresosAnfitrion[nombreAnfitrion].hostelerias.includes(host.nombre.trim())) {
                ingresosAnfitrion[nombreAnfitrion].hostelerias.push(host.nombre.trim());
            }
        });

        // 3️⃣ Convertir a array y ordenar por ingresos
        const data = Object.values(ingresosAnfitrion).sort(
            (a, b) => b.ingresos_totales - a.ingresos_totales
        );

        // 4️⃣ Responder al cliente
        res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        console.error("❌ Error al calcular ingresos por anfitrión:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener ingresos por anfitrión",
            error: error.message,
        });
    }
});

// ==================== DASHBOARD ANFITRIÓN ====================
app.get("/dashboardAnfitrion/:id_anfitrion", async (req, res) => {
    try {
        const id_anfitrion = parseInt(req.params.id_anfitrion);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        if (isNaN(id_anfitrion)) {
            return res.status(400).json({
                success: false,
                message: "ID de anfitrión inválido"
            });
        }

        // 1️⃣ Obtener hostelerías del anfitrión
        const { data: hostelerias, error: errorHostelerias } = await supabase
            .from("hosteleria")
            .select("id_hosteleria, nombre")
            .eq("id_anfitrion", id_anfitrion);

        if (errorHostelerias) throw errorHostelerias;

        if (!hostelerias || hostelerias.length === 0) {
            return res.status(200).json({
                success: true,
                message: "El anfitrión no tiene hostelerías registradas",
                resumen: {}
            });
        }

        const idsHosteleria = hostelerias.map(h => h.id_hosteleria);

        // 2️⃣ Obtener reservas solo de sus hostelerías
        const { data: reservas, error: errorReservas } = await supabase
            .from("reserva")
            .select("*")
            .in("id_hosteleria", idsHosteleria);

        if (errorReservas) throw errorReservas;

        const idsReservas = reservas.map(r => r.id_reserva);

        // 3️⃣ Obtener pagos de esas reservas
        const { data: pagos, error: errorPagos } = await supabase
            .from("pago")
            .select("*")
            .in("id_reserva", idsReservas);

        if (errorPagos) throw errorPagos;

        // 4️⃣ Obtener reseñas de esas reservas
        const { data: resenas, error: errorResenas } = await supabase
            .from("reseña")
            .select("*")
            .in("id_reserva", idsReservas);

        if (errorResenas) throw errorResenas;

        // ==================== PAGOS ====================
        const totalPagos = pagos.length || 0;
        const estadosPagos = { completado: 0, pendiente: 0, cancelado: 0 };

        pagos.forEach(p => {
            const estado = p.estado?.toLowerCase();
            if (estado && estadosPagos.hasOwnProperty(estado)) {
                estadosPagos[estado]++;
            }
        });

        const porcentajesPagos = Object.keys(estadosPagos).reduce((acc, estado) => {
            acc[estado] = totalPagos > 0
                ? ((estadosPagos[estado] / totalPagos) * 100).toFixed(2) + "%"
                : "0.00%";
            return acc;
        }, {});

        const pagosCompletados = pagos.filter(p => p.estado?.toLowerCase() === "completado");

        // ==================== RESERVAS ====================
        const totalReservas = reservas.length || 0;
        const estadosReservas = { confirmada: 0, cancelada: 0, pendiente: 0 };

        reservas.forEach(r => {
            const estado = r.estado?.toLowerCase();
            if (estado && estadosReservas.hasOwnProperty(estado)) {
                estadosReservas[estado]++;
            }
        });

        const porcentajesReservas = Object.keys(estadosReservas).reduce((acc, estado) => {
            acc[estado] = totalReservas > 0
                ? ((estadosReservas[estado] / totalReservas) * 100).toFixed(2) + "%"
                : "0.00%";
            return acc;
        }, {});

        // ==================== INGRESOS Y RESERVAS POR MES ====================
        const ingresosPorMes = {};
        const reservasPorMes = {};

        for (let m = 1; m <= 12; m++) {
            const keyMes = `${year}-${m.toString().padStart(2, "0")}`;
            ingresosPorMes[keyMes] = 0;
            reservasPorMes[keyMes] = 0;
        }

        pagosCompletados.forEach(p => {
            const fecha = new Date(p.fecha_pago);
            if (!isNaN(fecha) && fecha.getFullYear() === year) {
                const keyMes = `${year}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
                ingresosPorMes[keyMes] += p.monto;
            }
        });

        reservas.forEach(r => {
            const fecha = new Date(r.fecha_inicio || r.fecha_fin);
            if (!isNaN(fecha) && fecha.getFullYear() === year) {
                const keyMes = `${year}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
                reservasPorMes[keyMes]++;
            }
        });

        // ==================== INGRESOS Y RESERVAS POR AÑO ====================
        const ingresosPorAno = {};
        const reservasPorAno = {};

        pagosCompletados.forEach(p => {
            const ano = new Date(p.fecha_pago).getFullYear();
            if (!isNaN(ano)) ingresosPorAno[ano] = (ingresosPorAno[ano] || 0) + p.monto;
        });

        reservas.forEach(r => {
            const ano = new Date(r.fecha_inicio || r.fecha_fin).getFullYear();
            if (!isNaN(ano)) reservasPorAno[ano] = (reservasPorAno[ano] || 0) + 1;
        });

        // ==================== RESEÑAS POR HOSTELERÍA ====================
        const hosteleriaStats = {};

        // Inicializamos todas las hostelerías (aunque no tengan reseñas)
        hostelerias.forEach(h => {
            hosteleriaStats[h.id_hosteleria] = {
                id_hosteleria: h.id_hosteleria,
                nombre: h.nombre,
                total_reservas: reservas.filter(r => r.id_hosteleria === h.id_hosteleria).length,
                total_resenas: 0,
                promedio_calificacion: 0
            };
        });

        // Recorremos reseñas y acumulamos datos
        resenas.forEach(resena => {
            const reserva = reservas.find(r => r.id_reserva === resena.id_reserva);
            if (!reserva) return;

            const host = hostelerias.find(h => h.id_hosteleria === reserva.id_hosteleria);
            if (!host) return;

            const entry = hosteleriaStats[host.id_hosteleria];
            entry.total_resenas++;
            entry.promedio_calificacion += resena.calificacion;
        });

        // Calculamos los promedios finales
        Object.values(hosteleriaStats).forEach(h => {
            h.promedio_calificacion = h.total_resenas > 0
                ? (h.promedio_calificacion / h.total_resenas).toFixed(2)
                : "0.00";
        });

        // ==================== PROMEDIO GENERAL DEL ANFITRIÓN ====================
        const hosteleriasFinal = Object.values(hosteleriaStats);
        const promedioGeneral =
            hosteleriasFinal.length > 0
                ? (
                    hosteleriasFinal.reduce((sum, h) => sum + parseFloat(h.promedio_calificacion), 0) /
                    hosteleriasFinal.length
                ).toFixed(2)
                : "0.00";

        // ==================== RESPUESTA FINAL ====================
        return res.status(200).json({
            success: true,
            anfitrion: id_anfitrion,
            resumenPagos: {
                totalPagos,
                pagosPorEstado: estadosPagos,
                porcentajesPorEstado: porcentajesPagos
            },
            resumenReservas: {
                totalReservas,
                estados: estadosReservas,
                porcentajes: porcentajesReservas
            },
            ingresosPorMes,
            reservasPorMes,
            ingresosPorAno,
            reservasPorAno,
            hostelerias: hosteleriasFinal,
            promedioGeneral
        });

    } catch (error) {
        console.error("❌ Error en dashboardAnfitrion:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener dashboard del anfitrión",
            error: error.message
        });
    }
});

app.get("/getHotelData/:id_anfitrion", async (req, res) => {
    try {
        const { id_anfitrion } = req.params;

        const { data, error } = await supabase
            .from("hosteleria")
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
            `)
            .eq("id_anfitrion", id_anfitrion); // 🔹 Filtra por id_anfitrion

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
        console.error("Error del servidor:", error);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

app.get('/getTouristExperiences/:id_anfitrion', async (req, res) => {
    try {
        const { id_anfitrion } = req.params;

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
            .eq('id_anfitrion', id_anfitrion); // 🔹 Filtro por anfitrión

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


// ==================== ERROR HANDLER ====================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Ruta no encontrada",
        path: req.path,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        success: false,
        error: "Ocurrió un error en el servidor"
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 Dashboard Data Service corriendo en http://localhost:${PORT}`);
    console.log(`📍 Endpoints disponibles:`);
    console.log(`   - GET /getResenas`);
    console.log(`   - GET /dashboardResumen`);
    console.log(`   - GET /getIngresosHosteleria`);
    console.log(`   - GET /getIngresosAnfitrion`);
    console.log(`   - GET /dashboardAnfitrion/:id_anfitrion`);

    console.log(`⏰ Iniciado: ${new Date().toISOString()}`);
});
