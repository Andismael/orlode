"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = tenantMiddleware;
exports.getTenantFirestore = getTenantFirestore;
const tenantManager_1 = require("../config/tenantManager");
const logger_1 = require("../utils/logger");
async function tenantMiddleware(req, _res, next) {
    const companyId = req.user?.companyId;
    if (!companyId) {
        // No company context — let downstream handlers decide
        next();
        return;
    }
    try {
        const config = await tenantManager_1.tenantManager.getTenantConfig(companyId);
        req.tenantConfig = config;
        // Lazy-load heavy clients (Firebase app + AI) only for BYOE tenants
        // Starter tenants share the host Firebase already initialized at startup
        if (config.byoeEnabled && config.firebase) {
            req.tenantClients = await tenantManager_1.tenantManager.getTenantClients(companyId);
        }
        next();
    }
    catch (err) {
        logger_1.logger.error(`[TenantMiddleware] Failed to load config for ${companyId}`, { error: err });
        // Don't block the request — degraded mode with host Firebase
        next();
    }
}
/**
 * Helper: get Firestore for the current request.
 * Falls back to host Firestore if tenant clients not loaded.
 */
function getTenantFirestore(req) {
    if (req.tenantClients)
        return req.tenantClients.firestore;
    const { getFirestore } = require('../config/firebase.config');
    return getFirestore();
}
//# sourceMappingURL=tenant.middleware.js.map