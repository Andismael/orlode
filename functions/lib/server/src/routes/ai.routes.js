"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * AI key routes — per-tenant API keys for direct browser calls (e.g. Gemini Live).
 *
 * SECURITY: returns the tenant's own Gemini API key (decrypted) so the browser
 * can open a WebSocket to Google directly. Never returns the platform's key.
 * Rejects if the caller has no BYOE config with a Gemini key.
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const encryption_1 = require("../config/encryption");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/ai/live-key-status — does this company have a Gemini key configured?
router.get('/live-key-status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    // Super admin bypass — can use the platform key for testing
    const userDoc = await db.collection('users').doc(req.user.uid).get().catch(() => null);
    const isSuperAdmin = userDoc?.data()?.['superAdmin'] === true;
    const tenantDoc = await db.collection('tenants').doc(companyId).get().catch(() => null);
    const hasTenantKey = Boolean(tenantDoc?.exists && tenantDoc.data()?.['byoe']?.['geminiApiKeyEncrypted']);
    res.json({
        success: true,
        data: {
            hasTenantKey,
            isSuperAdmin,
            available: hasTenantKey || isSuperAdmin,
        },
    });
}));
// GET /api/ai/live-key — fetch the Gemini API key for direct browser use (Gemini Live)
// Access rules:
//   1. Super admin → platform key (testing bypass)
//   2. Tenant has BYOE key AND user has 'useVoiceLive' permission → tenant key
//   3. Otherwise → 403 with explanation
router.get('/live-key', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const uid = req.user?.uid;
    if (!companyId || !uid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(uid).get().catch(() => null);
    const isSuperAdmin = userDoc?.data()?.['superAdmin'] === true;
    // Super admin bypass first (testing)
    if (isSuperAdmin) {
        const tenantDoc = await db.collection('tenants').doc(companyId).get().catch(() => null);
        const enc = tenantDoc?.data()?.['byoe']?.['geminiApiKeyEncrypted'];
        if (enc) {
            try {
                return res.json({ success: true, data: { apiKey: (0, encryption_1.decrypt)(enc), source: 'tenant' } });
            }
            catch { /* fall through */ }
        }
        const platformKey = process.env['GOOGLE_AI_API_KEY'] ?? '';
        if (platformKey) {
            logger_1.logger.warn('[AI] Super admin using platform Gemini key for Live', { companyId });
            return res.json({ success: true, data: { apiKey: platformKey, source: 'platform' } });
        }
    }
    // Non-super: must be member of the team with useVoiceLive permission
    const memberDoc = await db.collection(`companies/${companyId}/members`).doc(uid).get().catch(() => null);
    let memberData = memberDoc?.exists ? memberDoc.data() : null;
    // Fallback: check user doc itself
    if (!memberData && userDoc?.exists)
        memberData = userDoc.data();
    const role = memberData?.['role'] ?? userDoc?.data()?.['role'] ?? 'member';
    const permissions = memberData?.['permissions'] ?? [];
    const canUseVoice = permissions.includes('useVoiceLive') || role === 'owner' || role === 'admin' || role === 'manager';
    if (!canUseVoice) {
        throw new error_middleware_1.AppError("Vous n'avez pas la permission 'useVoiceLive'. Demandez à votre administrateur d'activer l'accès Gemini Live.", 403);
    }
    // Fetch tenant BYOE key
    const tenantDoc = await db.collection('tenants').doc(companyId).get().catch(() => null);
    const encryptedKey = tenantDoc?.data()?.['byoe']?.['geminiApiKeyEncrypted'];
    if (encryptedKey) {
        try {
            const apiKey = (0, encryption_1.decrypt)(encryptedKey);
            return res.json({ success: true, data: { apiKey, source: 'tenant' } });
        }
        catch (err) {
            logger_1.logger.error('[AI] Failed to decrypt tenant Gemini key', { companyId, err: String(err) });
        }
    }
    throw new error_middleware_1.AppError("Clé Gemini Live de l'entreprise non configurée. L'administrateur doit la définir dans /admin/byoe.", 403);
}));
exports.default = router;
//# sourceMappingURL=ai.routes.js.map