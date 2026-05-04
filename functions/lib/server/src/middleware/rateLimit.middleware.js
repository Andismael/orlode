"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRateLimiter = exports.authRateLimiter = exports.aiRateLimiter = exports.apiRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// General API rate limiter
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: {
        success: false,
        message: 'Too many requests. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Strict limiter for AI endpoints (expensive operations)
exports.aiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
        success: false,
        message: 'AI request limit reached. Max 20 requests per minute.',
        code: 'AI_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit per user if authenticated
        const authReq = req;
        return authReq.user?.uid ?? req.ip ?? 'unknown';
    },
});
// Auth rate limiter
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        success: false,
        message: 'Too many auth attempts. Try again in 1 hour.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
    skipSuccessfulRequests: true,
});
// Upload rate limiter
exports.uploadRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: {
        success: false,
        message: 'Upload limit reached. Max 50 uploads per hour.',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    },
});
//# sourceMappingURL=rateLimit.middleware.js.map