/**
 * Professional logging utility for the LiveATC Pipeline
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Processing segment', segmentId);
 *   logger.error('Failed to process', error);
 * 
 * In production, only errors and warnings are logged.
 * In development, all log levels are shown.
 */

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Don't log anything in test environment unless explicitly needed
const shouldLog = !isTest;

export const logger = {
    /**
     * Log informational messages (development only)
     */
    info: (...args) => {
        if (shouldLog && isDev) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Log error messages (always logged)
     */
    error: (...args) => {
        if (shouldLog) {
            console.error('[ERROR]', ...args);
        }
    },

    /**
     * Log warning messages (always logged)
     */
    warn: (...args) => {
        if (shouldLog) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Log debug messages (development only)
     */
    debug: (...args) => {
        if (shouldLog && isDev) {
            console.debug('[DEBUG]', ...args);
        }
    },

    /**
     * Log success messages (development only)
     */
    success: (...args) => {
        if (shouldLog && isDev) {
            console.log('[SUCCESS]', ...args);
        }
    }
};

// Default export for convenience
export default logger;
