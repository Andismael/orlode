"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantKeyMissingError = void 0;
exports.getTenantAi = getTenantAi;
exports.invalidateTenantAi = invalidateTenantAi;
/**
 * Per-tenant Genkit instances — BYOK isolation.
 *
 * Each company uses their own Gemini API key for LLM calls. The platform
 * does not subsidize compute. Super admin can fall back to the platform key
 * for testing/demos (logged as warning).
 *
 * Cache: Genkit instances are kept in memory for 15 minutes per company to
 * avoid re-initializing on every request.
 */
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
const firebase_config_1 = require("./firebase.config");
const encryption_1 = require("./encryption");
const logger_1 = require("../utils/logger");
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();
class TenantKeyMissingError extends Error {
    constructor(companyId) {
        super(`No Gemini key configured for company ${companyId}. Setup BYOE or contact support.`);
        this.companyId = companyId;
        this.name = 'TenantKeyMissingError';
    }
}
exports.TenantKeyMissingError = TenantKeyMissingError;
/** Decrypted tenant Gemini API key, or null if not configured. */
async function fetchTenantGeminiKey(companyId) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const tenantDoc = await db.collection('tenants').doc(companyId).get();
        const encrypted = tenantDoc.data()?.['byoe']?.['geminiApiKeyEncrypted'];
        if (!encrypted)
            return null;
        return (0, encryption_1.decrypt)(encrypted);
    }
    catch (err) {
        logger_1.logger.error('[TenantGenkit] Failed to fetch tenant key', { companyId, err: String(err) });
        return null;
    }
}
/** Is this user a super admin? (used for platform-key fallback) */
async function isSuperAdmin(userId) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection('users').doc(userId).get();
        return doc.data()?.['superAdmin'] === true;
    }
    catch {
        return false;
    }
}
/**
 * Get a Genkit instance scoped to this company's API key.
 * Throws TenantKeyMissingError if the company has no key and the user isn't a super admin.
 */
async function getTenantAi(companyId, userId) {
    // Check cache
    const cached = cache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) {
        return { ai: cached.ai, source: cached.source };
    }
    // Prefer tenant key
    const tenantKey = await fetchTenantGeminiKey(companyId);
    let apiKey;
    let source;
    if (tenantKey) {
        apiKey = tenantKey;
        source = 'tenant';
    }
    else {
        // Super admin fallback — platform key, logged
        if (await isSuperAdmin(userId)) {
            const platform = process.env['GOOGLE_AI_API_KEY'] ?? '';
            if (!platform)
                throw new TenantKeyMissingError(companyId);
            apiKey = platform;
            source = 'platform';
            logger_1.logger.warn('[TenantGenkit] Super admin using platform key', { companyId, userId });
        }
        else {
            throw new TenantKeyMissingError(companyId);
        }
    }
    // Build isolated Genkit instance with this key
    const ai = (0, genkit_1.genkit)({
        plugins: [(0, google_genai_1.googleAI)({ apiKey })],
        model: 'googleai/gemini-2.5-flash',
    });
    cache.set(companyId, { ai, source, expiresAt: Date.now() + CACHE_TTL_MS });
    return { ai, source };
}
/** Invalidate cache (call when tenant rotates their key) */
function invalidateTenantAi(companyId) {
    cache.delete(companyId);
}
//# sourceMappingURL=tenantGenkit.js.map