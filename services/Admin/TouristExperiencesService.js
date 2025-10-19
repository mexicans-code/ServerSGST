import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config({ path: '../../.env' });

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Supabase client initialization
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Express app initialization
const app = express();
const PORT = process.env.PORT || 3009;

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Tourist Service API is running',
        timestamp: new Date().toISOString()
    });
});

// Get all tourist experiences with address information
app.get('/getTouristExperiences', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('experiencias_turisticas')
            .select(`
                *,
                direcciones:id_direccion (
                    *
                )
            `);

        if (error) {
            console.error('  Supabase error:', error);
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
        console.error('  Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get tourist experience by ID with address information
app.get('/getTouristExperience/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('experiencias_turisticas')
            .select(`
                *,
                direcciones:id_direccion (
                    *
                )
            `)
            .eq('id_experiencia', id)
            .single();

        if (error) {
            console.error('  Supabase error:', error);
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
        console.error('  Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.use((err, req, res, next) => {
    console.error('  Unhandled error:', err);
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
    console.log(`🚀 Tourist Service started successfully!`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});