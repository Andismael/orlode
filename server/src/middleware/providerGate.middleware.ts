/**
 * Provider Gate — reads the company's allowedProviders list (set by SuperAdmin)
 * and exposes a helper to check whether a given AI provider is authorized.
 *
 * Providers: 'claude' | 'gemini' | 'openai' | 'elevenlabs'
 * If the company has no allowedProviders set (or includes 'all'), everything is allowed.
 */
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from './error.middleware';

export type Provider = 'claude' | 'gemini' | 'openai' | 'elevenlabs';

const cache = new Map<string, { providers: string[]; fetchedAt: number }>();
const TTL = 60 * 1000; // 1 minute

export async function getAllowedProviders(companyId: string): Promise<string[]> {
  const cached = cache.get(companyId);
  if (cached && Date.now() - cached.fetchedAt < TTL) return cached.providers;
  const doc = await getFirestore().collection('companies').doc(companyId).get();
  const providers = (doc.data()?.['allowedProviders'] as string[] | undefined) ?? [];
  cache.set(companyId, { providers, fetchedAt: Date.now() });
  return providers;
}

export function invalidateProviderCache(companyId: string) {
  cache.delete(companyId);
}

export async function isProviderAllowed(companyId: string, provider: Provider): Promise<boolean> {
  const allowed = await getAllowedProviders(companyId);
  // Empty or includes 'all' → no restriction
  if (allowed.length === 0 || allowed.includes('all')) return true;
  return allowed.includes(provider);
}

/**
 * Express middleware that blocks the request if the company is not authorized
 * to use the required provider.
 */
export function requireProvider(provider: Provider) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const companyId = req.user?.companyId;
    if (!companyId) return next();
    const ok = await isProviderAllowed(companyId, provider);
    if (!ok) {
      next(new AppError(
        `Le provider ${provider} n'est pas autorisé pour votre entreprise. Contactez le support.`,
        403,
      ));
      return;
    }
    next();
  };
}
