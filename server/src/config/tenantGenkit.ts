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
import { genkit, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getFirestore } from './firebase.config';
import { decrypt } from './encryption';
import { logger } from '../utils/logger';

interface CachedInstance {
  ai: Genkit;
  source: 'tenant' | 'platform';
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CachedInstance>();

export class TenantKeyMissingError extends Error {
  constructor(public companyId: string) {
    super(`No Gemini key configured for company ${companyId}. Setup BYOE or contact support.`);
    this.name = 'TenantKeyMissingError';
  }
}

/** Decrypted tenant Gemini API key, or null if not configured. */
async function fetchTenantGeminiKey(companyId: string): Promise<string | null> {
  try {
    const db = getFirestore();
    const tenantDoc = await db.collection('tenants').doc(companyId).get();
    const encrypted = tenantDoc.data()?.['byoe']?.['geminiApiKeyEncrypted'] as string | undefined;
    if (!encrypted) return null;
    return decrypt(encrypted);
  } catch (err) {
    logger.error('[TenantGenkit] Failed to fetch tenant key', { companyId, err: String(err) });
    return null;
  }
}

/** Is this user a super admin? (used for platform-key fallback) */
async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const db = getFirestore();
    const doc = await db.collection('users').doc(userId).get();
    return doc.data()?.['superAdmin'] === true;
  } catch {
    return false;
  }
}

/**
 * Get a Genkit instance scoped to this company's API key.
 * Throws TenantKeyMissingError if the company has no key and the user isn't a super admin.
 */
export async function getTenantAi(
  companyId: string,
  userId: string,
): Promise<{ ai: Genkit; source: 'tenant' | 'platform' }> {
  // Check cache
  const cached = cache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ai: cached.ai, source: cached.source };
  }

  // Prefer tenant key
  const tenantKey = await fetchTenantGeminiKey(companyId);
  let apiKey: string;
  let source: 'tenant' | 'platform';

  if (tenantKey) {
    apiKey = tenantKey;
    source = 'tenant';
  } else {
    // Super admin fallback — platform key, logged
    if (await isSuperAdmin(userId)) {
      const platform = process.env['GOOGLE_AI_API_KEY'] ?? '';
      if (!platform) throw new TenantKeyMissingError(companyId);
      apiKey = platform;
      source = 'platform';
      logger.warn('[TenantGenkit] Super admin using platform key', { companyId, userId });
    } else {
      throw new TenantKeyMissingError(companyId);
    }
  }

  // Build isolated Genkit instance with this key
  const ai = genkit({
    plugins: [googleAI({ apiKey })],
    model: 'googleai/gemini-2.5-flash',
  });

  cache.set(companyId, { ai, source, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ai, source };
}

/** Invalidate cache (call when tenant rotates their key) */
export function invalidateTenantAi(companyId: string): void {
  cache.delete(companyId);
}
