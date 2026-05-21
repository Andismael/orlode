/**
 * BYOE Gate Middleware
 * Blocks agent API calls unless one of these is true:
 *   - Company has BYOE configured (`byoeEnabled === true` + has `geminiApiKeyEncrypted`)
 *   - Company is permanently hosted by Orlode (`hostedByOrlode === true`) —
 *     granted by SuperAdmin for free-tier customers, NGOs, demos
 *   - Company has an active hosted exception (`hostedException.expiresAt` in future)
 *   - The caller is a super admin
 *
 * Returns 402 "Payment Required" with a clear message the client can display.
 */
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { logger } from '../utils/logger';

async function isSuperAdmin(uid?: string): Promise<boolean> {
  if (!uid) return false;
  const doc = await getFirestore().collection('users').doc(uid).get();
  return doc.data()?.['superAdmin'] === true;
}

export async function byoeGate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) { next(); return; }

  // Super admin bypass
  if (await isSuperAdmin(req.user?.uid)) { next(); return; }

  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const data = companyDoc.data() ?? {};

  // Path 1: BYOE is configured — check tenant has encrypted key
  if (data['byoeEnabled'] === true) {
    const tenantDoc = await db.collection('tenants').doc(companyId).get();
    const hasKey = tenantDoc.exists && Boolean(tenantDoc.data()?.['byoe']?.['geminiApiKeyEncrypted']);
    if (hasKey) { next(); return; }
    // byoeEnabled but no key stored — fall through to exception check
  }

  // Path 2: permanently hosted by Orlode (no expiration). Granted by
  // SuperAdmin via the "Hébergement Orlode" toggle. Orlode pays the AI bill.
  if (data['hostedByOrlode'] === true) { next(); return; }

  // Path 3: active hosted exception (super admin granted, time-limited)
  const ex = data['hostedException'] as { expiresAt?: string; grantedBy?: string; reason?: string } | undefined;
  if (ex?.expiresAt) {
    const exp = new Date(ex.expiresAt).getTime();
    if (exp > Date.now()) { next(); return; }
    // Exception expired
  }

  // Otherwise: block
  logger.info('[BYOE Gate] Blocked agent call — no BYOE, no exception', { companyId });
  res.status(402).json({
    success: false,
    error: 'BYOE_REQUIRED',
    message: 'Configurez votre hébergement BYOE pour activer les agents IA, ou demandez une exception à l\'administrateur.',
    cta: { label: 'Configurer BYOE', url: '/admin/byoe' },
  });
}
