/**
 * Tenant middleware — injects per-tenant clients into the request.
 * For Starter plan: uses host Firebase + env API keys (fast path).
 * For Business/Enterprise BYOE: loads tenant Firebase + encrypted API keys.
 *
 * Must run AFTER authMiddleware (needs req.user.companyId).
 */
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';
import { tenantManager, type TenantClients } from '../config/tenantManager';
import type { TenantConfig } from '../config/tenantConfig';
import { logger } from '../utils/logger';

// Extend the request type with tenant context
declare module 'express' {
  interface Request {
    tenantConfig?: TenantConfig;
    tenantClients?: TenantClients;
  }
}

export async function tenantMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.user?.companyId;

  if (!companyId) {
    // No company context — let downstream handlers decide
    next();
    return;
  }

  try {
    const config = await tenantManager.getTenantConfig(companyId);
    req.tenantConfig = config;

    // Lazy-load heavy clients (Firebase app + AI) only for BYOE tenants
    // Starter tenants share the host Firebase already initialized at startup
    if (config.byoeEnabled && config.firebase) {
      req.tenantClients = await tenantManager.getTenantClients(companyId);
    }

    next();
  } catch (err) {
    logger.error(`[TenantMiddleware] Failed to load config for ${companyId}`, { error: err });
    // Don't block the request — degraded mode with host Firebase
    next();
  }
}

/**
 * Helper: get Firestore for the current request.
 * Falls back to host Firestore if tenant clients not loaded.
 */
export function getTenantFirestore(req: AuthenticatedRequest) {
  if (req.tenantClients) return req.tenantClients.firestore;
  const { getFirestore } = require('../config/firebase.config') as typeof import('../config/firebase.config');
  return getFirestore();
}
