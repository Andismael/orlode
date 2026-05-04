/**
 * Gmail OAuth routes — per-company Gmail connection.
 * Flow:
 *   1. GET /api/gmail/oauth/start?state=<companyId> — redirects to Google consent
 *   2. Google redirects back to GET /api/gmail/oauth/callback?code=...&state=<companyId>
 *   3. We exchange code → refresh_token, fetch user email, store in companies/{companyId}.gmail
 *   4. GET /api/gmail/status — returns { connected, email }
 *   5. POST /api/gmail/disconnect — removes the connection
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { clearTokenCache } from '../services/email/gmailSendService';
import { logger } from '../utils/logger';

const router = Router();

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

function getRedirectUri(): string {
  return process.env['GOOGLE_OAUTH_REDIRECT_URI']
    ?? `${process.env['API_BASE_URL'] ?? 'https://api-15262322885.us-central1.run.app'}/api/gmail/oauth/callback`;
}

function getAppReturnUrl(): string {
  return process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
}

// ─── AUTH-REQUIRED ENDPOINTS ─────────────────────────────────────────────────

// GET /api/gmail/status — is Gmail connected for my company?
router.get('/status', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const doc = await db.collection('companies').doc(companyId).get();
  const gmail = doc.data()?.['gmail'] as { email?: string; refreshToken?: string; connectedAt?: Date } | undefined;

  res.json({
    success: true,
    data: {
      connected: Boolean(gmail?.refreshToken),
      email: gmail?.email ?? null,
      connectedAt: gmail?.connectedAt ?? null,
    },
  });
}));

// POST /api/gmail/disconnect — remove stored tokens
router.post('/disconnect', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  await db.collection('companies').doc(companyId).update({
    gmail: null,
    updatedAt: new Date(),
  });
  clearTokenCache(companyId);
  logger.info('[Gmail] Disconnected', { companyId });

  res.json({ success: true });
}));

// GET /api/gmail/oauth/start — returns the Google consent URL for the client to navigate to
router.get('/oauth/start', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const clientId = process.env['GOOGLE_CLIENT_ID'];
  if (!clientId) throw new AppError('GOOGLE_CLIENT_ID not configured', 500);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', companyId);
  url.searchParams.set('include_granted_scopes', 'true');

  res.json({ success: true, data: { url: url.toString() } });
}));

// ─── PUBLIC CALLBACK (Google redirects here) ─────────────────────────────────

// GET /api/gmail/oauth/callback — exchange code for tokens, store them
router.get('/oauth/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query['code'] as string | undefined;
  const companyId = req.query['state'] as string | undefined;
  const error = req.query['error'] as string | undefined;
  const appUrl = getAppReturnUrl();

  if (error) { res.redirect(`${appUrl}/connectors?gmail=error&reason=${encodeURIComponent(error)}`); return; }
  if (!code || !companyId) { res.redirect(`${appUrl}/connectors?gmail=error&reason=missing_params`); return; }

  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    res.status(500).send('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
    return;
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    logger.error('[Gmail] Token exchange failed', { companyId, status: tokenRes.status, body: errBody });
    res.redirect(`${appUrl}/connectors?gmail=error&reason=token_exchange_failed`);
    return;
  }
  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; id_token?: string; expires_in?: number };

  if (!tokens.refresh_token) {
    logger.warn('[Gmail] No refresh_token returned — user may have previously granted access', { companyId });
    res.redirect(`${appUrl}/connectors?gmail=error&reason=no_refresh_token`);
    return;
  }

  // Fetch the user's email via userinfo endpoint
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json() as { email?: string };
  const email = userInfo.email ?? '';

  // Store in Firestore
  const db = getFirestore();
  await db.collection('companies').doc(companyId).update({
    gmail: {
      refreshToken: tokens.refresh_token,
      email,
      connectedAt: new Date(),
    },
    updatedAt: new Date(),
  });
  clearTokenCache(companyId);
  logger.info('[Gmail] Connected', { companyId, email });

  res.redirect(`${appUrl}/connectors?gmail=connected&email=${encodeURIComponent(email)}`);
}));

export default router;
