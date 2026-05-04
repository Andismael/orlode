/**
 * AI key routes — per-tenant API keys for direct browser calls (e.g. Gemini Live).
 *
 * SECURITY: returns the tenant's own Gemini API key (decrypted) so the browser
 * can open a WebSocket to Google directly. Never returns the platform's key.
 * Rejects if the caller has no BYOE config with a Gemini key.
 */
import { Router } from 'express';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { decrypt } from '../config/encryption';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// GET /api/ai/live-key-status — does this company have a Gemini key configured?
router.get('/live-key-status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();

  // Super admin bypass — can use the platform key for testing
  const userDoc = await db.collection('users').doc(req.user!.uid).get().catch(() => null);
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
router.get('/live-key', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const userDoc = await db.collection('users').doc(uid).get().catch(() => null);
  const isSuperAdmin = userDoc?.data()?.['superAdmin'] === true;

  // Super admin bypass first (testing)
  if (isSuperAdmin) {
    const tenantDoc = await db.collection('tenants').doc(companyId).get().catch(() => null);
    const enc = tenantDoc?.data()?.['byoe']?.['geminiApiKeyEncrypted'] as string | undefined;
    if (enc) {
      try { return res.json({ success: true, data: { apiKey: decrypt(enc), source: 'tenant' } }); }
      catch { /* fall through */ }
    }
    const platformKey = process.env['GOOGLE_AI_API_KEY'] ?? '';
    if (platformKey) {
      logger.warn('[AI] Super admin using platform Gemini key for Live', { companyId });
      return res.json({ success: true, data: { apiKey: platformKey, source: 'platform' } });
    }
  }

  // Non-super: must be member of the team with useVoiceLive permission
  const memberDoc = await db.collection(`companies/${companyId}/members`).doc(uid).get().catch(() => null);
  let memberData: Record<string, unknown> | null = memberDoc?.exists ? (memberDoc.data() as Record<string, unknown>) : null;
  // Fallback: check user doc itself
  if (!memberData && userDoc?.exists) memberData = userDoc.data() as Record<string, unknown>;

  const role = (memberData?.['role'] as string) ?? (userDoc?.data()?.['role'] as string) ?? 'member';
  const permissions = (memberData?.['permissions'] as string[]) ?? [];
  const canUseVoice = permissions.includes('useVoiceLive') || role === 'owner' || role === 'admin' || role === 'manager';

  if (!canUseVoice) {
    throw new AppError(
      "Vous n'avez pas la permission 'useVoiceLive'. Demandez à votre administrateur d'activer l'accès Gemini Live.",
      403,
    );
  }

  // Fetch tenant BYOE key
  const tenantDoc = await db.collection('tenants').doc(companyId).get().catch(() => null);
  const encryptedKey = tenantDoc?.data()?.['byoe']?.['geminiApiKeyEncrypted'] as string | undefined;
  if (encryptedKey) {
    try {
      const apiKey = decrypt(encryptedKey);
      return res.json({ success: true, data: { apiKey, source: 'tenant' } });
    } catch (err) {
      logger.error('[AI] Failed to decrypt tenant Gemini key', { companyId, err: String(err) });
    }
  }

  throw new AppError(
    "Clé Gemini Live de l'entreprise non configurée. L'administrateur doit la définir dans /admin/byoe.",
    403,
  );
}));

export default router;
