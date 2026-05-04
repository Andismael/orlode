"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantManager = void 0;
/**
 * TenantManager — Manages per-company Firebase + AI client instances.
 *
 * BYOE model:
 * - Starter plan → uses the "host" Firebase (env vars), shared infrastructure
 * - Business/Enterprise → each company has their own Firebase project + API keys
 *
 * All tenant Firebase apps are keyed as `tenant_${companyId}` to avoid conflicts.
 * Configs are cached in-memory; cache invalidated after 30 minutes.
 */
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const firebase_config_1 = require("./firebase.config");
const encryption_1 = require("./encryption");
const tenantConfig_1 = require("./tenantConfig");
const logger_1 = require("../utils/logger");
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
class TenantManagerClass {
    constructor() {
        this.configCache = new Map();
    }
    static getInstance() {
        if (!TenantManagerClass.instance) {
            TenantManagerClass.instance = new TenantManagerClass();
        }
        return TenantManagerClass.instance;
    }
    /** Load and cache TenantConfig from Firestore */
    async getTenantConfig(companyId) {
        const cached = this.configCache.get(companyId);
        if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
            return cached.config;
        }
        const db = (0, firebase_config_1.getFirestore)();
        const companyDoc = await db.collection('companies').doc(companyId).get();
        if (!companyDoc.exists) {
            throw new Error(`Company not found: ${companyId}`);
        }
        const data = companyDoc.data();
        const plan = data['plan'] ?? 'starter';
        const planDefaults = tenantConfig_1.PLAN_DEFAULTS[plan];
        // Merge Firestore data over plan defaults
        const config = {
            ...planDefaults,
            companyId,
            plan,
            byoeEnabled: data['byoeEnabled'] ?? planDefaults.byoeEnabled,
            setupCompleted: data['setupCompleted'] ?? planDefaults.setupCompleted,
            setupStep: data['setupStep'] ?? planDefaults.setupStep,
        };
        // Load BYOE Firebase config if present
        if (config.byoeEnabled) {
            const byoeDoc = await db
                .collection('companies')
                .doc(companyId)
                .collection('settings')
                .doc('byoe')
                .get();
            if (byoeDoc.exists) {
                const byoe = byoeDoc.data();
                config.firebase = {
                    projectId: byoe['firebaseProjectId'],
                    serviceAccountKey: byoe['serviceAccountKeyEncrypted'],
                    storageBucket: byoe['storageBucket'],
                    region: byoe['region'] ?? 'europe-west1',
                };
                config.ai = {
                    gemini: {
                        apiKey: byoe['geminiApiKeyEncrypted'],
                        preferredModel: byoe['geminiModel'] ?? 'gemini-2.0-flash',
                    },
                };
                if (byoe['claudeApiKeyEncrypted']) {
                    config.ai.claude = {
                        apiKey: byoe['claudeApiKeyEncrypted'],
                        preferredModel: byoe['claudeModel'] ?? 'claude-sonnet-4-20250514',
                    };
                }
                if (byoe['openaiApiKeyEncrypted']) {
                    config.ai.openai = {
                        apiKey: byoe['openaiApiKeyEncrypted'],
                        preferredModel: byoe['openaiModel'] ?? 'gpt-4o',
                    };
                }
            }
        }
        this.configCache.set(companyId, { config, loadedAt: Date.now() });
        return config;
    }
    /** Get or initialize a Firebase Admin app for this tenant */
    async getTenantFirebaseApp(companyId) {
        const config = await this.getTenantConfig(companyId);
        // Starter plan → use host Firebase
        if (!config.byoeEnabled || !config.firebase) {
            const hostApp = firebase_admin_1.default.apps.find((a) => a?.name === '[DEFAULT]');
            return hostApp ?? firebase_admin_1.default.app();
        }
        const appName = `tenant_${companyId}`;
        const existing = firebase_admin_1.default.apps.find((a) => a?.name === appName);
        if (existing)
            return existing;
        try {
            const serviceAccountJson = (0, encryption_1.decrypt)(config.firebase.serviceAccountKey);
            const serviceAccount = JSON.parse(serviceAccountJson);
            const app = firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                projectId: config.firebase.projectId,
                storageBucket: config.firebase.storageBucket,
            }, appName);
            logger_1.logger.info(`[TenantManager] Initialized Firebase app for tenant ${companyId}`);
            return app;
        }
        catch (err) {
            logger_1.logger.error(`[TenantManager] Failed to init Firebase for tenant ${companyId}`, { error: err });
            throw new Error(`BYOE Firebase init failed for ${companyId}: ${String(err)}`);
        }
    }
    /** Get tenant Firebase clients (Firestore / Storage / Auth) */
    async getTenantClients(companyId) {
        const app = await this.getTenantFirebaseApp(companyId);
        return {
            firestore: app.firestore(),
            storage: app.storage(),
            auth: app.auth(),
        };
    }
    /** Invalidate cache for a company (call after BYOE config update) */
    invalidate(companyId) {
        this.configCache.delete(companyId);
        // Also clean up Firebase app so it gets re-initialized with new credentials
        const appName = `tenant_${companyId}`;
        const existing = firebase_admin_1.default.apps.find((a) => a?.name === appName);
        if (existing) {
            existing.delete().catch(() => { });
        }
        logger_1.logger.info(`[TenantManager] Cache invalidated for tenant ${companyId}`);
    }
    /** Save BYOE config to Firestore (encrypted) — called by Setup Agent */
    async saveBYOEConfig(companyId, params) {
        const db = (0, firebase_config_1.getFirestore)();
        const { encrypt } = await Promise.resolve().then(() => __importStar(require('./encryption')));
        const byoeData = {
            firebaseProjectId: params.firebaseProjectId,
            serviceAccountKeyEncrypted: encrypt(params.serviceAccountKey),
            storageBucket: params.storageBucket,
            region: params.region,
            geminiApiKeyEncrypted: encrypt(params.geminiApiKey),
            geminiModel: params.geminiModel ?? 'gemini-2.0-flash',
            updatedAt: new Date(),
        };
        if (params.claudeApiKey) {
            byoeData['claudeApiKeyEncrypted'] = encrypt(params.claudeApiKey);
            byoeData['claudeModel'] = params.claudeModel ?? 'claude-sonnet-4-20250514';
        }
        if (params.openaiApiKey) {
            byoeData['openaiApiKeyEncrypted'] = encrypt(params.openaiApiKey);
        }
        await db
            .collection('companies')
            .doc(companyId)
            .collection('settings')
            .doc('byoe')
            .set(byoeData, { merge: true });
        // Mark company as BYOE-enabled
        await db.collection('companies').doc(companyId).update({
            byoeEnabled: true,
            updatedAt: new Date(),
        });
        this.invalidate(companyId);
        logger_1.logger.info(`[TenantManager] BYOE config saved for tenant ${companyId}`);
    }
}
exports.tenantManager = TenantManagerClass.getInstance();
//# sourceMappingURL=tenantManager.js.map