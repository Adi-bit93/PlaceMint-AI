import { createLogger, format, transports } from "winston";
require("winston-daily-rotate-file");
import path from "path";

const { combine, timestamp, errors, json, colorize, printf } = format;

// ─── Custom format for development console ────────────────────────────────────
// Shows: 14:23:05 [error]: Something broke  ← clean and readable
const devConsoleFormat = printf(({ level, timestamp, message, stack }) => {
    return `${timestamp} [${level}] : ${stack || message}`;
});

// ─── Rotating File Transport — combined logs ──────────────────────────────────
// New file every day → app-2025-03-15.log
// Files older than 14 days auto-deleted
// Files compressed to .gz after rotation → saves disk space
const combinedRotatingTransport = new transports.DailyRotateFile({
    filename: path.join(__dirname, '../../logs/app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info', // Only log 'info' and above to this file
});

const errorRotatingTransport = new transports.DailyRotateFile({
    filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
})

// ─── Create Logger ──────────────────────────────────

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        json()
    ),

    transports: [
        combinedRotatingTransport,
        errorRotatingTransport
    ],

    // Do NOT crash the process if logger itself has an error
    exitOnError: false,
})

// ─── Development: also print to console with colors ──────────────────────────
// In production we never log to console — it wastes resources
// and production environments capture stdout separately anyway
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        devConsoleFormat
      ),
    })
  );
}
 
// ─── Morgan HTTP stream ───────────────────────────────────────────────────────
// Morgan logs every HTTP request → pipes it into winston
// So all logs (HTTP + app) end up in same files
// Usage in app.js: morgan('combined', { stream: logger.stream })
logger.stream = {
  write: (message) => logger.http(message.trim()),
};
 
module.exports = logger;
 

