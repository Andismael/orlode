"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateRbacCache = invalidateRbacCache;
exports.getAgentRole = getAgentRole;
exports.requireAgentRole = requireAgentRole;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("./error.middleware");
const cache = new Map();
const TTL = 30000;
async function loadRbac(uid) {
    const hit = cache.get(uid);
    if (hit && Date.now() - hit.cachedAt < TTL)
        return hit;
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const userDoc = await db.collection('users').doc(uid).get();
        const data = userDoc.data() ?? {};
        const companyId = data['companyId'];
        // Also check company.ownerId for legacy owners (not every doc has isCompanyOwner)
        let isOwnerByCompany = false;
        if (companyId) {
            try {
                const companyDoc = await db.collection('companies').doc(companyId).get();
                if (companyDoc.data()?.['ownerId'] === uid)
                    isOwnerByCompany = true;
            }
            catch { /* ignore */ }
        }
        const entry = {
            agentRoles: data['agentRoles'] ?? {},
            isOwner: data['isCompanyOwner'] === true || isOwnerByCompany,
            legacyRole: data['role'],
            cachedAt: Date.now(),
        };
        cache.set(uid, entry);
        return entry;
    }
    catch {
        return { agentRoles: {}, isOwner: false, legacyRole: undefined, cachedAt: Date.now() };
    }
}
/** Invalidate cache for a user after role change. Call this from the PUT endpoint. */
function invalidateRbacCache(uid) {
    cache.delete(uid);
}
/** Programmatic check — use inside route handlers when needed. */
async function getAgentRole(uid, agentId) {
    const rbac = await loadRbac(uid);
    if (rbac.isOwner || rbac.legacyRole === 'admin')
        return 'admin';
    return rbac.agentRoles[agentId] ?? null;
}
/** Express middleware — block requests that don't have the required role on this agent. */
function requireAgentRole(agentId, required = 'user') {
    return async (req, _res, next) => {
        const uid = req.user?.uid;
        if (!uid) {
            next(new error_middleware_1.AppError('Auth required', 401));
            return;
        }
        const role = await getAgentRole(uid, agentId);
        if (!role) {
            next(new error_middleware_1.AppError(`Access refused to agent "${agentId}"`, 403));
            return;
        }
        if (required === 'admin' && role !== 'admin') {
            next(new error_middleware_1.AppError(`Admin role required for "${agentId}"`, 403));
            return;
        }
        next();
    };
}
//# sourceMappingURL=agentRbac.middleware.js.map