/**
 * API Keys Service
 * Manages persistent API keys for external integrations.
 * Keys are stored hashed in Firestore.
 */
import { randomBytes, createHash } from 'crypto';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

export interface ApiKey {
  id:          string;
  companyId:   string;
  name:        string;               // e.g. "CRM Integration"
  keyHash:     string;               // SHA-256 of the actual key
  keyPrefix:   string;               // First 8 chars for display (cm_xxxxxxxx...)
  scopes:      string[];             // ['read', 'write', 'agent']
  createdBy:   string;               // userId
  createdAt:   FirebaseFirestore.Timestamp;
  lastUsedAt?: FirebaseFirestore.Timestamp;
  expiresAt?:  FirebaseFirestore.Timestamp;
  enabled:     boolean;
  usageCount:  number;
}

export interface ApiKeyCreateResult {
  id:        string;
  key:       string;   // Full key — ONLY returned at creation time
  keyPrefix: string;
  name:      string;
}

export class ApiKeysService {
  private readonly PREFIX = 'cm_';

  /**
   * Generate a new API key for a company.
   * The full key is returned ONCE — it is never stored in plaintext.
   */
  async createKey(
    companyId: string,
    userId:    string,
    name:      string,
    scopes:    string[] = ['read', 'agent'],
    expiresInDays?: number,
  ): Promise<ApiKeyCreateResult> {
    const rawKey    = this.PREFIX + randomBytes(32).toString('hex');
    const keyHash   = this.hash(rawKey);
    const keyPrefix = rawKey.slice(0, 12) + '...';

    const db = getFirestore();
    const docRef = db.collection(`companies/${companyId}/apiKeys`).doc();

    const data: Omit<ApiKey, 'id'> = {
      companyId,
      name,
      keyHash,
      keyPrefix,
      scopes,
      createdBy:  userId,
      createdAt:  FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      expiresAt:  expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) as never
        : undefined,
      enabled:    true,
      usageCount: 0,
    };

    await docRef.set(data);
    logger.info(`[ApiKeys] Created key "${name}" for company ${companyId}`);

    return { id: docRef.id, key: rawKey, keyPrefix, name };
  }

  /**
   * Validate an API key and return company/user context.
   * Returns null if invalid, expired, or disabled.
   */
  async validateKey(rawKey: string): Promise<{
    companyId:   string;
    scopes:      string[];
    keyId:       string;
    companyName: string;
  } | null> {
    if (!rawKey.startsWith(this.PREFIX)) return null;

    const keyHash = this.hash(rawKey);
    const db = getFirestore();

    // Search across all companies (collectionGroup query)
    const snap = await db.collectionGroup('apiKeys')
      .where('keyHash', '==', keyHash)
      .where('enabled', '==', true)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc  = snap.docs[0];
    const data = doc.data() as ApiKey;

    // Check expiry
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      logger.warn(`[ApiKeys] Expired key used: ${data.keyPrefix}`);
      return null;
    }

    // Update usage stats (non-blocking)
    setImmediate(() => {
      doc.ref.update({
        lastUsedAt: FieldValue.serverTimestamp(),
        usageCount: FieldValue.increment(1),
      }).catch(() => {});
    });

    // Get company name
    const companyDoc  = await db.collection('companies').doc(data.companyId).get();
    const companyName = (companyDoc.data()?.['name'] as string) ?? 'Unknown';

    return {
      companyId:   data.companyId,
      scopes:      data.scopes,
      keyId:       doc.id,
      companyName,
    };
  }

  /**
   * List all API keys for a company (no plaintext keys).
   */
  async listKeys(companyId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/apiKeys`).get();

    return snap.docs.map((doc) => {
      const data = doc.data() as ApiKey;
      const { keyHash: _kh, ...safe } = data;
      return { ...safe, id: doc.id };
    });
  }

  /**
   * Revoke (disable) an API key.
   */
  async revokeKey(companyId: string, keyId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(`companies/${companyId}/apiKeys`).doc(keyId).update({
      enabled:   false,
      revokedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[ApiKeys] Revoked key ${keyId} for company ${companyId}`);
  }

  private hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}

export const apiKeysService = new ApiKeysService();
