"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogMiddleware = auditLogMiddleware;
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
// Actions to audit (method + path pattern → action label)
const AUDIT_RULES = [
    // Documents
    { pattern: /\/api\/data\/documents$/, method: 'POST', action: 'document.upload', resource: 'documents' },
    { pattern: /\/api\/data\/documents\/\w+$/, method: 'DELETE', action: 'document.delete', resource: 'documents' },
    { pattern: /\/api\/data\/documents$/, method: 'GET', action: 'document.list', resource: 'documents' },
    // Conversations
    { pattern: /\/api\/chat\/conversations$/, method: 'POST', action: 'conversation.create', resource: 'conversations' },
    { pattern: /\/api\/chat\/conversations\/\w+$/, method: 'DELETE', action: 'conversation.delete', resource: 'conversations' },
    // Agent / AI
    { pattern: /\/api\/agent\/conversations\/\w+\/messages$/, method: 'POST', action: 'agent.message', resource: 'agent' },
    // Auth
    { pattern: /\/api\/auth\/register$/, method: 'POST', action: 'auth.register', resource: 'auth' },
    // GDPR
    { pattern: /\/api\/gdpr\/export$/, method: 'GET', action: 'gdpr.export', resource: 'gdpr' },
    { pattern: /\/api\/gdpr\/delete$/, method: 'DELETE', action: 'gdpr.delete', resource: 'gdpr' },
    // API Keys
    { pattern: /\/api\/apikeys$/, method: 'POST', action: 'apikey.create', resource: 'apikeys' },
    { pattern: /\/api\/apikeys\/\w+$/, method: 'DELETE', action: 'apikey.revoke', resource: 'apikeys' },
    // Faces
    { pattern: /\/api\/faces$/, method: 'POST', action: 'face.register', resource: 'faces' },
    { pattern: /\/api\/faces\/\w+$/, method: 'DELETE', action: 'face.delete', resource: 'faces' },
    // Settings
    { pattern: /\/api\/auth\/company\/settings$/, method: 'PATCH', action: 'settings.update', resource: 'settings' },
];
function matchAuditRule(method, path) {
    return AUDIT_RULES.find((r) => r.method === method && r.pattern.test(path));
}
/**
 * Async fire-and-forget audit logger. Never blocks the request.
 */
async function writeAuditLog(entry) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection('auditLogs').add(entry);
    }
    catch (err) {
        logger_1.logger.error('[AuditLog] Failed to write audit log', { error: err });
    }
}
/**
 * Express middleware — attaches to all protected routes.
 * Fires after the response is sent (non-blocking).
 */
function auditLogMiddleware(req, res, next) {
    const rule = matchAuditRule(req.method, req.path);
    if (!rule || !req.user) {
        next();
        return;
    }
    // Capture response status after it's sent
    const originalEnd = res.end.bind(res);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (...args) {
        const result = originalEnd(...args);
        // Extract resourceId from URL path (last segment if it looks like an ID)
        const pathParts = req.path.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        const resourceId = /^[a-zA-Z0-9_-]{8,}$/.test(lastPart) ? lastPart : undefined;
        setImmediate(() => {
            writeAuditLog({
                companyId: req.user?.companyId ?? 'unknown',
                userId: req.user?.uid ?? 'unknown',
                userEmail: req.user?.email ?? 'unknown',
                action: rule.action,
                resource: rule.resource,
                resourceId,
                method: req.method,
                path: req.path,
                ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? 'unknown',
                userAgent: req.headers['user-agent'] ?? 'unknown',
                status: res.statusCode,
                details: rule.resource === 'documents' ? { fileName: req.body?.['fileName'] } : undefined,
                timestamp: firestore_1.FieldValue.serverTimestamp(),
            });
        });
        return result;
    };
    next();
}
//# sourceMappingURL=auditLog.middleware.js.map