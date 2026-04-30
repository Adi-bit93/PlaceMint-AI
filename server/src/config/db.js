
import mongoose from 'mongoose'
import { logger } from './logger.js';

// ─── Connection Options ───────────────────────────────────────────────────────
const MONGO_OPTIONS = {
    // Connection Pool:
    maxPoolSize: 10,
    minPoolSize: 2,           // always keep 2 connections warm even when idle

    // How long to wait 
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,

    heartbeatFrequencyMS: 10000,

    // Force IPv4 — skips trying IPv6 first, faster connection in most environments
    family: 4,
};

// ─── Retry Logic ──────────────────────────────────────────────────────────────
// If MongoDB is briefly unavailable (deploy, restart, network blip),
// retry up to 5 times before giving up and crashing the process
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000; // wait 5 seconds between retries

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);

        logger.info(`MongoDB connected → Host: ${conn.connection.host} | DB: ${conn.connection.name}`);
        retryCount = 0; // reset on success

        // ── Connection event listeners ─────────────────────────────────────────
        // These fire whenever the connection state changes
        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected — attempting reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected successfully');
        });

        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`);
        });

    } catch (error) {
        logger.error(`MongoDB connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}): ${error.message}`);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            logger.warn(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            setTimeout(connectDB, RETRY_DELAY_MS);
        } else {
            // After 5 failed attempts, something is seriously wrong
            // Exit cleanly so the process manager (PM2/Docker) can restart us
            logger.error('Max retries reached. Shutting down.');
            process.exit(1);
        }
    }
};

// ─── Graceful Disconnect ──────────────────────────────────────────────────────
// Called during server shutdown (SIGTERM, SIGINT)
// Closes all pool connections cleanly instead of dropping them mid-query
const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed gracefully');
    } catch (error) {
        logger.error(`Error closing MongoDB: ${error.message}`);
    }
};

export {
    connectDB,
    disconnectDB
};