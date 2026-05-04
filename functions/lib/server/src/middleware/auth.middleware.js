"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const firebase_config_1 = require("../config/firebase.config");
const apiKeys_service_1 = require("../services/apiKeys.service");
const logger_1 = require("../utils/logger");
async function authMiddleware(req, res, next) {
    // ── API Key auth (X-API-Key header or ?api_key= query) ──────────────────────
    const apiKey = req.headers['x-api-key'] ?? req.query['api_key'];
    if (apiKey) {
        const keyData = await apiKeys_service_1.apiKeysService.validateKey(apiKey);
        if (!keyData) {
            res.status(401).json({ success: false, message: 'Invalid or expired API key' });
            return;
        }
        req.user = {
            uid: `apikey:${keyData.keyId}`,
            email: `${keyData.companyName}@api`,
            companyId: keyData.companyId,
            authMethod: 'apikey',
            apiKeyScopes: keyData.scopes,
        };
        next();
        return;
    }
    // ── Firebase ID Token (Bearer) ───────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const decodedToken = await (0, firebase_config_1.getAuth)().verifyIdToken(token);
        // Read role from Firestore (token custom claims may not have it)
        let role = decodedToken['role'];
        const uid = decodedToken.uid;
        if (!role) {
            try {
                const userDoc = await (0, firebase_config_1.getFirestore)().collection('users').doc(uid).get();
                role = userDoc.data()?.['role'];
            }
            catch { /* non-critical */ }
        }
        // Resolve companyId: prefer custom claim, then Firestore user doc, finally fall back to uid.
        // This handles invited users whose token hasn't been refreshed with the new custom claim yet.
        let companyId = decodedToken['companyId'];
        if (!companyId) {
            try {
                const userDoc = await (0, firebase_config_1.getFirestore)().collection('users').doc(uid).get();
                companyId = userDoc.data()?.['companyId'];
            }
            catch { /* non-critical */ }
        }
        if (!companyId)
            companyId = uid;
        req.user = {
            uid,
            email: decodedToken.email ?? '',
            companyId,
            role,
            authMethod: 'firebase',
        };
        next();
    }
    catch (error) {
        logger_1.logger.warn('Invalid Firebase ID token', { error: error.message });
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=auth.middleware.js.map