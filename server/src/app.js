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

// Global Rate Limiter

app.use('/api', rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true, // adds RateLimit * headers so frontend knows limits
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP. Please try gain after 15 minutes.'
    },
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit hit - IP:${req.ip} | URL: ${req.originalUrl}`);
        res.status(options.statusCode).json(options.message);
    },
}));

app.get('/health', (req, res) => {
  res.status(200).json({
    success:     true,
    status:      'healthy',
    environment: process.env.NODE_ENV,
    uptime:      `${Math.floor(process.uptime())}s`,
    timestamp:   new Date().toISOString(),
  });
});


dotenv.config({
    path: './.env'
});

app.use(express.json());

// API Routes
app.get('/api/v1', (req, res) => {
  res.json({ success: true, message: 'Campus Placement Portal API v1 — running' });
});

app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} does not exist`, 404));
});

app.use(globalErrorHandler);

// server Startup

const PORT = process.env.PORT ;

const startServer = async () => {
  // Connect to DB first — don't accept requests before DB is ready
  await connectDB();
 
  server.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════╗
║    Campus Placement Portal — Server      ║
╠══════════════════════════════════════════╣
║  Port    : ${String(PORT).padEnd(30)}║
║  Env     : ${String(process.env.NODE_ENV || 'development').padEnd(30)}║
║  Status  : Running                       ║
╚══════════════════════════════════════════╝`);
  });
 
  // ─── Graceful Shutdown ─────────────────────────────────────────────────────
  // When Render/Docker sends SIGTERM to stop the container:
  // 1. Stop accepting NEW requests (server.close)
  // 2. Let IN-FLIGHT requests finish
  // 3. Close DB connections cleanly
  // 4. Exit with code 0 (success)
  //
  // Without this: mid-query DB operations get cut off → data corruption risk
  const shutdown = async (signal) => {
    logger.info(`${signal} received — starting graceful shutdown...`);
 
    server.close(async () => {
      logger.info('HTTP server closed — no new requests accepted');
      await disconnectDB();
      logger.info('Graceful shutdown complete ✓');
      process.exit(0);
    });
 
    // Safety net: force exit after 10s if shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10_000);
  };
 
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Render/Docker stop
  process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C in terminal
 
  // Catch async errors that slipped past asyncHandler
  process.on('unhandledRejection', (reason) => {
    logger.error(`UnhandledRejection: ${reason}`);
    shutdown('unhandledRejection');
  });
 
  // Catch synchronous bugs (null dereference, etc.)
  process.on('uncaughtException', (err) => {
    logger.error(`UncaughtException: ${err.message}`, { stack: err.stack });
    shutdown('uncaughtException');
  });
};
 
startServer();

export { 
    app,
    server
} 
