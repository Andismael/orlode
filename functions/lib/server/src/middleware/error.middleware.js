"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorMiddleware = errorMiddleware;
exports.notFoundMiddleware = notFoundMiddleware;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function errorMiddleware(err, req, res, _next) {
    // Multer errors
    if (err.message.includes('File too large')) {
        res.status(413).json({
            success: false,
            message: 'File too large. Maximum size is 50MB.',
            code: 'FILE_TOO_LARGE',
        });
        return;
    }
    if (err.message.includes('Unexpected field') || err.message.includes('is not supported')) {
        res.status(400).json({
            success: false,
            message: err.message,
            code: 'INVALID_FILE_TYPE',
        });
        return;
    }
    // App errors (expected)
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
        });
        return;
    }
    // Unexpected errors
    logger_1.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
    });
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        code: 'INTERNAL_ERROR',
    });
}
function notFoundMiddleware(req, res) {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND',
    });
}
//# sourceMappingURL=error.middleware.js.map