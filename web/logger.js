'use strict';

/**
 * logger.js — Structured logging for LitAssist
 *
 * Outputs JSON to stdout (Docker/Railway friendly).
 * Use LOG_LEVEL env var to control verbosity (default: 'info').
 * In development (NODE_ENV != production), logs are human-readable.
 */

const winston = require('winston');

const IS_PROD = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug');

// ── Formats ──────────────────────────────────────────────────────────────────

const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const devFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, jobId, ...meta }) => {
        const job    = jobId ? ` [${jobId}]` : '';
        const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} ${level}${job}: ${message}${extras}`;
    })
);

// ── Logger instance ───────────────────────────────────────────────────────────

const IS_TEST = process.env.NODE_ENV === 'test';

const logger = winston.createLogger({
    level: LOG_LEVEL,
    silent: IS_TEST,   // suppress all output during jest runs
    transports: [
        new winston.transports.Console({
            format: IS_PROD ? jsonFormat : devFormat,
        }),
    ],
});

// ── Convenience child factory ─────────────────────────────────────────────────
// Usage: const jobLog = logger.child({ jobId: '2a44007cb5df' });
//        jobLog.info('Scraper done', { count: 10 });

logger.job = (jobId) => logger.child({ jobId });

module.exports = logger;