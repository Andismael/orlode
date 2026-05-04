/**
 * Tenant async context — threads { companyId, userId } through the entire request
 * call stack using Node.js AsyncLocalStorage. Any code running under a request
 * can access the tenant info without passing it explicitly.
 *
 * Used by the dynamic `ai` proxy (genkit.config.ts) to route ai.generate() calls
 * to the tenant's Gemini key instead of the platform key.
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantRequestContext {
  companyId: string;
  userId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantRequestContext>();

export function getTenantContext(): TenantRequestContext | undefined {
  return tenantContext.getStore();
}
