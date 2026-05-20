import rateLimit from 'express-rate-limit';

// General API rate limiter — keyed per-user (auth UID) instead of per-IP so
// that multiple legit users behind the same NAT (corporate WiFi, mobile
// carrier) don't share a quota. 200/15min was way too low — a single pack
// admin page fires 8-12 parallel requests at boot, and the polling clients
// (notifications, insights) burn ~30/min. Bumped to a much higher ceiling
// and scoped per-uid so honest users never hit it; only true abuse trips.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,                // ~133 req/min — generous; per-user
  message: {
    success: false,
    message: 'Too many requests. Please try again in a minute.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't burn the global IP bucket when an authenticated user calls many
  // small endpoints in parallel — key each user separately. Fall back to IP
  // only for un-authenticated calls (login, public storefront, webhooks).
  keyGenerator: (req) => {
    const authReq = req as { user?: { uid?: string }; ip?: string };
    return authReq.user?.uid ?? (req.ip ?? 'anonymous');
  },
  // GET reads are cheap — don't count them against the bucket. Only POST /
  // PATCH / DELETE / PUT (state-changing operations) consume tokens. This
  // matches what every "abuse" actually looks like and lets dashboards
  // refresh freely.
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
});

// Strict limiter for AI endpoints (expensive operations)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    success: false,
    message: 'AI request limit reached. Max 20 requests per minute.',
    code: 'AI_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user if authenticated
    const authReq = req as { user?: { uid: string } };
    return authReq.user?.uid ?? req.ip ?? 'unknown';
  },
});

// Auth rate limiter
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message: 'Too many auth attempts. Try again in 1 hour.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  skipSuccessfulRequests: true,
});

// Upload rate limiter
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: {
    success: false,
    message: 'Upload limit reached. Max 50 uploads per hour.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
  },
});
