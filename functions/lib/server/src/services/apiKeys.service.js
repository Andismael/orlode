"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeysService = exports.ApiKeysService = void 0;
/**
 * API Keys Service
 * Manages persistent API keys for external integrations.
 * Keys are stored hashed in Firestore.
 */
const crypto_1 = require("crypto");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
class ApiKeysService {
    constructor() {
        this.PREFIX = 'cm_';
    }
    /**
     * Generate a new API key for a company.
     * The full key is returned ONCE — it is never stored in plaintext.
     */
    async createKey(companyId, userId, name, scopes = ['read', 'agent'], expiresInDays) {
        const rawKey = this.PREFIX + (0, crypto_1.randomBytes)(32).toString('hex');
        const keyHash = this.hash(rawKey);
        const keyPrefix = rawKey.slice(0, 12) + '...';
        const db = (0, firebase_config_1.getFirestore)();
        const docRef = db.collection(`companies/${companyId}/apiKeys`).doc();
        const data = {
            companyId,
            name,
            keyHash,
            keyPrefix,
            scopes,
            createdBy: userId,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            expiresAt: expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
                : undefined,
            enabled: true,
            usageCount: 0,
        };
        await docRef.set(data);
        logger_1.logger.info(`[ApiKeys] Created key "${name}" for company ${companyId}`);
        return { id: docRef.id, key: rawKey, keyPrefix, name };
    }
    /**
     * Validate an API key and return company/user context.
     * Returns null if invalid, expired, or disabled.
     */
    async validateKey(rawKey) {
        if (!rawKey.startsWith(this.PREFIX))
            return null;
        const keyHash = this.hash(rawKey);
        const db = (0, firebase_config_1.getFirestore)();
        // Search across all companies (collectionGroup query)
        const snap = await db.collectionGroup('apiKeys')
            .where('keyHash', '==', keyHash)
            .where('enabled', '==', true)
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        const doc = snap.docs[0];
        const data = doc.data();
        // Check expiry
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
            logger_1.logger.warn(`[ApiKeys] Expired key used: ${data.keyPrefix}`);
            return null;
        }
        // Update usage stats (non-blocking)
        setImmediate(() => {
            doc.ref.update({
                lastUsedAt: firestore_1.FieldValue.serverTimestamp(),
                usageCount: firestore_1.FieldValue.increment(1),
            }).catch(() => { });
        });
        // Get company name
        const companyDoc = await db.collection('companies').doc(data.companyId).get();
        const companyName = companyDoc.data()?.['name'] ?? 'Unknown';
        return {
            companyId: data.companyId,
            scopes: data.scopes,
            keyId: doc.id,
            companyName,
        };
    }
    /**
     * List all API keys for a company (no plaintext keys).
     */
    async listKeys(companyId) {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${companyId}/apiKeys`).get();
        return snap.docs.map((doc) => {
            const data = doc.data();
            const { keyHash: _kh, ...safe } = data;
            return { ...safe, id: doc.id };
        });
    }
    /**
     * Revoke (disable) an API key.
     */
    async revokeKey(companyId, keyId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${companyId}/apiKeys`).doc(keyId).update({
            enabled: false,
            revokedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        logger_1.logger.info(`[ApiKeys] Revoked key ${keyId} for company ${companyId}`);
    }
    hash(rawKey) {
        return (0, crypto_1.createHash)('sha256').update(rawKey).digest('hex');
    }
}
exports.ApiKeysService = ApiKeysService;
exports.apiKeysService = new ApiKeysService();
//# sourceMappingURL=apiKeys.service.js.map