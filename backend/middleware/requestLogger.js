/**
 * middleware/requestLogger.js — HTTP request logging middleware
 */

const requestLogger = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
};

module.exports = requestLogger;
