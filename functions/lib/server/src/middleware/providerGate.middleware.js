"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedProviders = getAllowedProviders;
exports.invalidateProviderCache = invalidateProviderCache;
exports.isProviderAllowed = isProviderAllowed;
exports.requireProvider = requireProvider;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("./error.middleware");
const cache = new Map();
const TTL = 60 * 1000; // 1 minute
async function getAllowedProviders(companyId) {
    const cached = cache.get(companyId);
    if (cached && Date.now() - cached.fetchedAt < TTL)
        return cached.providers;
    const doc = await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).get();
    const providers = doc.data()?.['allowedProviders'] ?? [];
    cache.set(companyId, { providers, fetchedAt: Date.now() });
    return providers;
}
function invalidateProviderCache(companyId) {
    cache.delete(companyId);
}
async function isProviderAllowed(companyId, provider) {
    const allowed = await getAllowedProviders(companyId);
    // Empty or includes 'all' → no restriction
    if (allowed.length === 0 || allowed.includes('all'))
        return true;
    return allowed.includes(provider);
}
/**
 * Express middleware that blocks the request if the company is not authorized
 * to use the required provider.
 */
function requireProvider(provider) {
    return async (req, _res, next) => {
        const companyId = req.user?.companyId;
        if (!companyId)
            return next();
        const ok = await isProviderAllowed(companyId, provider);
        if (!ok) {
            next(new error_middleware_1.AppError(`Le provider ${provider} n'est pas autorisé pour votre entreprise. Contactez le support.`, 403));
            return;
        }
        next();
    };
}
//# sourceMappingURL=providerGate.middleware.js.map