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
import admin from 'firebase-admin';
import { getFirestore as getHostFirestore } from './firebase.config';
import { decrypt } from './encryption';
import type { TenantConfig, TenantPlan } from './tenantConfig';
import { PLAN_DEFAULTS } from './tenantConfig';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedConfig {
  config: TenantConfig;
  loadedAt: number;
}

/** Tenant Firebase clients only — AI calls go through host Genkit instance */
export interface TenantClients {
  firestore: admin.firestore.Firestore;
  storage: admin.storage.Storage;
  auth: admin.auth.Auth;
}

class TenantManagerClass {
  private static instance: TenantManagerClass;
  private configCache = new Map<string, CachedConfig>();

  static getInstance(): TenantManagerClass {
    if (!TenantManagerClass.instance) {
      TenantManagerClass.instance = new TenantManagerClass();
    }
    return TenantManagerClass.instance;
  }

  /** Load and cache TenantConfig from Firestore */
  async getTenantConfig(companyId: string): Promise<TenantConfig> {
    const cached = this.configCache.get(companyId);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.config;
    }

    const db = getHostFirestore();
    const companyDoc = await db.collection('companies').doc(companyId).get();

    if (!companyDoc.exists) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const data = companyDoc.data()!;
    const plan = (data['plan'] as TenantPlan | undefined) ?? 'starter';
    const planDefaults = PLAN_DEFAULTS[plan];

    // Merge Firestore data over plan defaults
    const config: TenantConfig = {
      ...planDefaults,
      companyId,
      plan,
      byoeEnabled: (data['byoeEnabled'] as boolean | undefined) ?? planDefaults.byoeEnabled,
      setupCompleted: (data['setupCompleted'] as boolean | undefined) ?? planDefaults.setupCompleted,
      setupStep: (data['setupStep'] as number | undefined) ?? planDefaults.setupStep,
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
        const byoe = byoeDoc.data()!;
        config.firebase = {
          projectId: byoe['firebaseProjectId'] as string,
          serviceAccountKey: byoe['serviceAccountKeyEncrypted'] as string,
          storageBucket: byoe['storageBucket'] as string,
          region: byoe['region'] as string ?? 'europe-west1',
        };
        config.ai = {
          gemini: {
            apiKey: byoe['geminiApiKeyEncrypted'] as string,
            preferredModel: (byoe['geminiModel'] as string | undefined) ?? 'gemini-2.0-flash',
          },
        };
        if (byoe['claudeApiKeyEncrypted']) {
          config.ai.claude = {
            apiKey: byoe['claudeApiKeyEncrypted'] as string,
            preferredModel: (byoe['claudeModel'] as string | undefined) ?? 'claude-sonnet-4-20250514',
          };
        }
        if (byoe['openaiApiKeyEncrypted']) {
          config.ai.openai = {
            apiKey: byoe['openaiApiKeyEncrypted'] as string,
            preferredModel: (byoe['openaiModel'] as string | undefined) ?? 'gpt-4o',
          };
        }
      }
    }

    this.configCache.set(companyId, { config, loadedAt: Date.now() });
    return config;
  }

  /** Get or initialize a Firebase Admin app for this tenant */
  async getTenantFirebaseApp(companyId: string): Promise<admin.app.App> {
    const config = await this.getTenantConfig(companyId);

    // Starter plan → use host Firebase
    if (!config.byoeEnabled || !config.firebase) {
      const hostApp = admin.apps.find((a) => a?.name === '[DEFAULT]');
      return hostApp ?? admin.app();
    }

    const appName = `tenant_${companyId}`;
    const existing = admin.apps.find((a) => a?.name === appName);
    if (existing) return existing;

    try {
      const serviceAccountJson = decrypt(config.firebase.serviceAccountKey);
      const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

      const app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId: config.firebase.projectId,
          storageBucket: config.firebase.storageBucket,
        },
        appName
      );

      logger.info(`[TenantManager] Initialized Firebase app for tenant ${companyId}`);
      return app;
    } catch (err) {
      logger.error(`[TenantManager] Failed to init Firebase for tenant ${companyId}`, { error: err });
      throw new Error(`BYOE Firebase init failed for ${companyId}: ${String(err)}`);
    }
  }

  /** Get tenant Firebase clients (Firestore / Storage / Auth) */
  async getTenantClients(companyId: string): Promise<TenantClients> {
    const app = await this.getTenantFirebaseApp(companyId);
    return {
      firestore: app.firestore(),
      storage: app.storage(),
      auth: app.auth(),
    };
  }

  /** Invalidate cache for a company (call after BYOE config update) */
  invalidate(companyId: string): void {
    this.configCache.delete(companyId);
    // Also clean up Firebase app so it gets re-initialized with new credentials
    const appName = `tenant_${companyId}`;
    const existing = admin.apps.find((a) => a?.name === appName);
    if (existing) {
      existing.delete().catch(() => {});
    }
    logger.info(`[TenantManager] Cache invalidated for tenant ${companyId}`);
  }

  /** Save BYOE config to Firestore (encrypted) — called by Setup Agent */
  async saveBYOEConfig(
    companyId: string,
    params: {
      firebaseProjectId: string;
      serviceAccountKey: string;     // Plaintext JSON — will be encrypted
      storageBucket: string;
      region: string;
      geminiApiKey: string;          // Plaintext — will be encrypted
      claudeApiKey?: string;
      openaiApiKey?: string;
      geminiModel?: string;
      claudeModel?: string;
    }
  ): Promise<void> {
    const db = getHostFirestore();
    const { encrypt } = await import('./encryption');

    const byoeData: Record<string, unknown> = {
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
    logger.info(`[TenantManager] BYOE config saved for tenant ${companyId}`);
  }
}

export const tenantManager = TenantManagerClass.getInstance();
