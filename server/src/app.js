'use strict';
import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser'
import hpp from 'hpp';
import http from 'http';

import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { globalErrorHandler } from './middlewares/errorHandler.js';
import { AppError } from './utils/apiResponse.js';


import authRoutes from './routes/auth.routes.js';

const app = express();
const server = http.createServer(app);  // raw server - for socket.io

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // security Headers allow cloudinary image URLs
}));

// cors 
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (incomingOrigin, callback) => {
    if (!incomingOrigin || allowedOrigins.includes(incomingOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked : origin "${incomingOrigin}" not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// compression 
app.use(compression({ threshold: 1024 }));

// Body parser;
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// MongoDB Injection Sanitizer

// MongoDB NoSQL Injection Protection
app.use((req, res, next) => {

  // sanitize req.body
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body, {
      replaceWith: '_',
    });
  }

  // sanitize req.params
  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params, {
      replaceWith: '_',
    });
  }

  // sanitize req.query safely
  if (req.query) {
    const sanitizedQuery = mongoSanitize.sanitize(req.query, {
      replaceWith: '_',
    });

    // DO NOT overwrite req.query directly
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, sanitizedQuery);
  }

  next();
});

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
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
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
    success: true,
    status: 'healthy',
    environment: process.env.NODE_ENV,
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});


app.use(express.json());

// API Routes
app.use('/api/v1/auth', authRoutes);


app.get('/api/v1', (req, res) => {
  res.json({ success: true, message: 'Campus Placement Portal API v1 — running' });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} does not exist`, 404));
});

app.use(globalErrorHandler);

// server Startup
const PORT = process.env.PORT;

const startServer = async () => {
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

  // Graceful Shutdown

  const shutdown = async (signal) => {
    logger.info(`${signal} received — starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed — no new requests accepted');
      await disconnectDB();
      logger.info('Graceful shutdown complete ✓');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`UnhandledRejection: ${reason}`);
    shutdown('unhandledRejection');
  });


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
