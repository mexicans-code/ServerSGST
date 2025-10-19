import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Server } from "socket.io";
import { createServer } from "http";
import jwt from "jsonwebtoken";

dotenv.config({ path: '../.env' });

const port = process.env.CHAT_PORT || 4000;
const app = express();
const server = createServer(app);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    },
    connectionStateRecovery: {}
});

app.use(logger("dev"));

// Middleware de autenticación
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("No token provided"));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id_usuario;
        socket.userName = decoded.nombre;
        socket.userRole = decoded.rol;
        next();
    } catch (error) {
        next(new Error("Invalid token"));
    }
});

io.on("connection", async (socket) => {
    console.log(`✅ Usuario conectado: ${socket.userName} (ID: ${socket.userId})`);

    // 🔑 UNIRSE A UNA SALA DE CHAT ESPECÍFICA
    socket.on("join chat", async ({ establecimiento_id, anfitrion_id }) => {
        // Crear ID único para esta conversación
        const roomId = `chat_${establecimiento_id}_${anfitrion_id}`;

        socket.join(roomId);
        socket.currentRoom = roomId;

        console.log(`📨 ${socket.userName} se unió a la sala: ${roomId}`);

        try {
            // Cargar solo los mensajes de ESTA conversación
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('establecimiento_id', establecimiento_id)
                .eq('anfitrion_id', anfitrion_id)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;

            // Enviar mensajes solo a este usuario
            socket.emit("previous messages", messages || []);

        } catch (error) {
            console.error("  Error cargando mensajes:", error);
            socket.emit("error", { message: "Error al cargar mensajes" });
        }
    });

    socket.on("disconnect", () => {
        console.log(`  Usuario desconectado: ${socket.userName}`);
    });

    socket.on("chat message", async (data) => {
        try {
            if (!data.message || typeof data.message !== 'string') {
                return socket.emit("error", { message: "Mensaje inválido" });
            }

            const message = data.message.trim();

            if (message.length === 0 || message.length > 500) {
                return socket.emit("error", { message: "Mensaje muy largo o vacío" });
            }

            if (!data.anfitrion_id || !data.establecimiento_id) {
                return socket.emit("error", { message: "Faltan datos de la conversación" });
            }

            const sanitizedMessage = message
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            const { data: savedMessage, error } = await supabase
                .from('messages')
                .insert([{
                    user_id: socket.userId,
                    user_name: socket.userName,
                    content: sanitizedMessage,
                    anfitrion_id: data.anfitrion_id,
                    establecimiento_id: data.establecimiento_id,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // 🔑 ENVIAR SOLO A LA SALA ESPECÍFICA
            const roomId = `chat_${data.establecimiento_id}_${data.anfitrion_id}`;
            io.to(roomId).emit("chat message", savedMessage);

            console.log(`📤 Mensaje enviado a sala: ${roomId}`);

        } catch (error) {
            console.error("  Error guardando mensaje:", error);
            socket.emit("error", { message: "Error al enviar mensaje" });
        }
    });
});

server.listen(port, () => {
    console.log(`🚀 Servidor de chat corriendo en puerto ${port}`);
});