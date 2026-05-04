"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceDocumentLimit = enforceDocumentLimit;
exports.enforceMessageQuota = enforceMessageQuota;
exports.requirePlan = requirePlan;
const firebase_config_1 = require("../config/firebase.config");
const stripeService_1 = require("../services/billing/stripeService");
const error_middleware_1 = require("./error.middleware");
async function getCompanyPlan(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('companies').doc(companyId).get();
    return doc.data()?.['plan'] ?? 'trial';
}
async function isSuperAdmin(uid) {
    if (!uid)
        return false;
    const doc = await (0, firebase_config_1.getFirestore)().collection('users').doc(uid).get();
    return doc.data()?.['superAdmin'] === true;
}
/**
 * Enforce document upload limit.
 */
async function enforceDocumentLimit(req, res, next) {
    const companyId = req.user?.companyId;
    if (!companyId) {
        next();
        return;
    }
    // SuperAdmin bypass — no limits
    if (await isSuperAdmin(req.user?.uid)) {
        next();
        return;
    }
    const plan = await getCompanyPlan(companyId);
    const limit = stripeService_1.PLANS[plan].documentsLimit;
    if (limit === -1) {
        next();
        return;
    } // Unlimited
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/documents`).count().get();
    const current = snap.data().count;
    if (current >= limit) {
        next(new error_middleware_1.AppError(`Document limit reached (${current}/${limit} on ${stripeService_1.PLANS[plan].name} plan). Upgrade to upload more.`, 403));
        return;
    }
    next();
}
/**
 * Enforce monthly message quota.
 * Counts messages via the usageMetrics collection: companies/{id}/usageMetrics/{YYYY-MM}
 * which is already incremented by the agent runtime on each turn.
 */
async function enforceMessageQuota(req, res, next) {
    const companyId = req.user?.companyId;
    if (!companyId) {
        next();
        return;
    }
    // SuperAdmin bypass
    if (await isSuperAdmin(req.user?.uid)) {
        next();
        return;
    }
    const plan = await getCompanyPlan(companyId);
    const limit = stripeService_1.PLANS[plan].messagesLimit ?? -1;
    if (limit === -1) {
        next();
        return;
    }
    const month = new Date().toISOString().slice(0, 7);
    const db = (0, firebase_config_1.getFirestore)();
    const usageDoc = await db.collection(`companies/${companyId}/usageMetrics`).doc(month).get();
    const used = usageDoc.data()?.['total'] ?? 0;
    if (used >= limit) {
        next(new error_middleware_1.AppError(`Quota mensuel atteint (${used}/${limit} messages sur le plan ${stripeService_1.PLANS[plan].name}). Passez à un plan supérieur pour continuer.`, 429));
        return;
    }
    next();
}
/**
 * Require a minimum plan level.
 */
function requirePlan(...allowedPlans) {
    return async (req, res, next) => {
        const companyId = req.user?.companyId;
        if (!companyId) {
            next(new error_middleware_1.AppError('Company ID required', 400));
            return;
        }
        // SuperAdmin bypass — access to everything
        if (await isSuperAdmin(req.user?.uid)) {
            next();
            return;
        }
        const plan = await getCompanyPlan(companyId);
        if (!allowedPlans.includes(plan)) {
            next(new error_middleware_1.AppError(`This feature requires ${allowedPlans.join(' or ')} plan. You are on the ${stripeService_1.PLANS[plan].name} plan.`, 403));
            return;
        }
        next();
    };
}
//# sourceMappingURL=planEnforcement.middleware.js.map