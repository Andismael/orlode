/**
 * Plan Enforcement Middleware
 * Checks company plan limits before allowing access to premium features.
 */
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { PLANS, type PlanId } from '../services/billing/stripeService';
import { AppError } from './error.middleware';

async function getCompanyPlan(companyId: string): Promise<PlanId> {
  const db = getFirestore();
  const doc = await db.collection('companies').doc(companyId).get();
  return (doc.data()?.['plan'] as PlanId) ?? 'trial';
}

async function isSuperAdmin(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await getFirestore().collection('users').doc(uid).get();
  return doc.data()?.['superAdmin'] === true;
}

/**
 * Enforce document upload limit.
 */
export async function enforceDocumentLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) { next(); return; }

  // SuperAdmin bypass — no limits
  if (await isSuperAdmin(req.user?.uid)) { next(); return; }

  const plan = await getCompanyPlan(companyId);
  const limit = PLANS[plan].documentsLimit;
  if (limit === -1) { next(); return; } // Unlimited

  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/documents`).count().get();
  const current = snap.data().count;

  if (current >= limit) {
    next(new AppError(
      `Document limit reached (${current}/${limit} on ${PLANS[plan].name} plan). Upgrade to upload more.`,
      403
    ));
    return;
  }

  next();
}

/**
 * Enforce monthly message quota.
 * Counts messages via the usageMetrics collection: companies/{id}/usageMetrics/{YYYY-MM}
 * which is already incremented by the agent runtime on each turn.
 */
export async function enforceMessageQuota(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) { next(); return; }

  // SuperAdmin bypass
  if (await isSuperAdmin(req.user?.uid)) { next(); return; }

  const plan = await getCompanyPlan(companyId);
  const limit = (PLANS[plan] as { messagesLimit?: number }).messagesLimit ?? -1;
  if (limit === -1) { next(); return; }

  const month = new Date().toISOString().slice(0, 7);
  const db = getFirestore();
  const usageDoc = await db.collection(`companies/${companyId}/usageMetrics`).doc(month).get();
  const used = (usageDoc.data()?.['total'] as number) ?? 0;

  if (used >= limit) {
    next(new AppError(
      `Quota mensuel atteint (${used}/${limit} messages sur le plan ${PLANS[plan].name}). Passez à un plan supérieur pour continuer.`,
      429
    ));
    return;
  }

  next();
}

/**
 * Require a minimum plan level.
 */
export function requirePlan(...allowedPlans: PlanId[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const companyId = req.user?.companyId;
    if (!companyId) { next(new AppError('Company ID required', 400)); return; }

    // SuperAdmin bypass — access to everything
    if (await isSuperAdmin(req.user?.uid)) { next(); return; }

    const plan = await getCompanyPlan(companyId);

    if (!allowedPlans.includes(plan)) {
      next(new AppError(
        `This feature requires ${allowedPlans.join(' or ')} plan. You are on the ${PLANS[plan].name} plan.`,
        403
      ));
      return;
    }

    next();
  };
}
