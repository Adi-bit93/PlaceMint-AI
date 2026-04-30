'use strict';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import http from 'http';

import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { globalErrorHandler } from './middlewares/errorHandler.js';
import { AppError } from './utils/apiResponse.js';


const app = express();
const server = http.createServer(app);  // raw server - for socket.io

app.set('trust proxy', 1);

app.use(helmet({
    crossOriginResourcePolicy: { policy : 'cross-origin'}, // security Headers allow cloudinary image URLs
}));

// cors 
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000',
].filter(Boolean);

app.use(cors({
    origin: (incomingOrigin, callback ) => {
        if (!incomingOrigin || allowedOrigins.includes(incomingOrigin)) {
            callback(null, true);
        } else { 
            callback(new Error(`CORS blocked : origin "${incomingOrigin}" not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge:86400,
}))

// compression 
app.use(compression({threshold: 1024}));

// Body parser;
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser()); // parse cookies → needed to read httpOnly refresh token

// MongoDB Injection Sanitizer

app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        logger.warn(`NoSQL injection attempt blocked - key: ${key} | IP: ${req.ip}`);
    }
}));

// HTTP Parameter Pollution Prevention.

app.use(hpp({
  whitelist: ['skills', 'branches', 'status', 'role'],
}));

// HTTP Request Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}


dotenv.config({
    path: './.env'
});

app.use(express.json());


app.get('/', (req, res) => {
  res.send('server is running');
});

const PORT = process.env.PORT ;

console.log('PORT', PORT)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


export default app;
