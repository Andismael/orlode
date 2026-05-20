/**
 * Per-agent RBAC — each user has a `agentRoles` map: { hr: 'admin', sales: 'user', finance: null }
 *
 * Rules:
 *   - Company owner (user.isCompanyOwner === true)   → full admin on everything
 *   - Legacy role === 'admin'                         → full admin on everything
 *   - Legacy role === 'manager'                       → admin on the agents listed in agentRoles
 *   - agentRoles[agentId] === 'admin'                 → admin on that agent
 *   - agentRoles[agentId] === 'user'                  → user on that agent (self data only)
 *   - agentRoles[agentId] is missing/undefined        → NO access
 */
import type { Response, NextFunction } from 'express';
import { getFirestore } from '../config/firebase.config';
import type { AuthenticatedRequest } from './auth.middleware';
import { AppError } from './error.middleware';

export type AgentRole = 'admin' | 'user';
export type AgentRoles = Record<string, AgentRole | null | undefined>;

/** Cache of user → agentRoles (30s TTL) to avoid hitting Firestore on every request. */
interface UserRbacCache {
  agentRoles: AgentRoles;
  isOwner: boolean;
  legacyRole: string | undefined;
  cachedAt: number;
}
const cache = new Map<string, UserRbacCache>();
const TTL = 30_000;

async function loadRbac(uid: string): Promise<UserRbacCache> {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.cachedAt < TTL) return hit;
  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(uid).get();
    const data = userDoc.data() ?? {};
    const companyId = data['companyId'] as string | undefined;
    // Also check company.ownerId for legacy owners (not every doc has isCompanyOwner)
    let isOwnerByCompany = false;
    if (companyId) {
      try {
        const companyDoc = await db.collection('companies').doc(companyId).get();
        if (companyDoc.data()?.['ownerId'] === uid) isOwnerByCompany = true;
      } catch { /* ignore */ }
    }
    const entry: UserRbacCache = {
      agentRoles: (data['agentRoles'] as AgentRoles) ?? {},
      isOwner: (data['isCompanyOwner'] as boolean) === true || isOwnerByCompany,
      legacyRole: data['role'] as string | undefined,
      cachedAt: Date.now(),
    };
    cache.set(uid, entry);
    return entry;
  } catch {
    return { agentRoles: {}, isOwner: false, legacyRole: undefined, cachedAt: Date.now() };
  }
}

/** Invalidate cache for a user after role change. Call this from the PUT endpoint. */
export function invalidateRbacCache(uid: string): void {
  cache.delete(uid);
}

/** Programmatic check — use inside route handlers when needed. */
export async function getAgentRole(uid: string, agentId: string): Promise<AgentRole | null> {
  const rbac = await loadRbac(uid);
  if (rbac.isOwner || rbac.legacyRole === 'admin') return 'admin';
  return (rbac.agentRoles[agentId] as AgentRole | null | undefined) ?? null;
}

/** Express middleware — block requests that don't have the required role on this agent. */
export function requireAgentRole(agentId: string, required: AgentRole = 'user') {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const uid = req.user?.uid;
    if (!uid) { next(new AppError('Auth required', 401)); return; }
    // Super-admins bypass per-agent RBAC — they manage every tenant and need full surface.
    try {
      const userDoc = await getFirestore().collection('users').doc(uid).get();
      if (userDoc.data()?.['superAdmin'] === true) { next(); return; }
    } catch { /* fall through to the role check below */ }
    const role = await getAgentRole(uid, agentId);
    if (!role) { next(new AppError(`Access refused to agent "${agentId}"`, 403)); return; }
    if (required === 'admin' && role !== 'admin') {
      next(new AppError(`Admin role required for "${agentId}"`, 403));
      return;
    }
    next();
  };
}
