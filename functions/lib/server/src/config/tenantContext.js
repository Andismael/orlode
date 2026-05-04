"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContext = void 0;
exports.getTenantContext = getTenantContext;
/**
 * Tenant async context — threads { companyId, userId } through the entire request
 * call stack using Node.js AsyncLocalStorage. Any code running under a request
 * can access the tenant info without passing it explicitly.
 *
 * Used by the dynamic `ai` proxy (genkit.config.ts) to route ai.generate() calls
 * to the tenant's Gemini key instead of the platform key.
 */
const async_hooks_1 = require("async_hooks");
exports.tenantContext = new async_hooks_1.AsyncLocalStorage();
function getTenantContext() {
    return exports.tenantContext.getStore();
}
//# sourceMappingURL=tenantContext.js.map