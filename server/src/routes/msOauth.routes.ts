/**
 * Microsoft 365 OAuth — one app registration, multiple services.
 *
 * Flow:
 *   1. User clicks "Connect" → GET /api/ms-oauth/start?service=onedrive
 *   2. Backend returns Microsoft auth URL with state = base64({ companyId, service })
 *   3. User consents on Microsoft page → redirects to /api/ms-oauth/callback?code=...&state=...
 *   4. Backend exchanges code for tokens, stores encrypted in companies/{id}/msConnections/{service}
 *
 * Token doc:
 *   { service, accessTokenEncrypted, refreshTokenEncrypted, expiresAt, scope, connectedAt }
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { encrypt } from '../config/encryption';
import { logger } from '../utils/logger';

const router = Router();

// Scopes per service. 'offline_access' required to get refresh_token. 'User.Read' is baseline.
const SERVICE_SCOPES: Record<string, string> = {
  onedrive:   'offline_access User.Read Files.ReadWrite.All',
  outlook:    'offline_access User.Read Mail.ReadWrite Mail.Send',
  mscalendar: 'offline_access User.Read Calendars.ReadWrite',
  teams:      'offline_access User.Read ChannelMessage.Read.All Channel.ReadBasic.All Team.ReadBasic.All',
  sharepoint: 'offline_access User.Read Sites.Read.All',
};

// Scope: which services are per-user (personal) vs per-company (shared)
const PERSONAL_SERVICES = new Set(['onedrive', 'outlook', 'mscalendar']);
const COMPANY_SERVICES  = new Set(['sharepoint', 'teams']);
function isPersonal(service: string): boolean { return PERSONAL_SERVICES.has(service); }
function storagePath(service: string, companyId: string, uid: string): string {
  return isPersonal(service)
    ? `users/${uid}/msConnections`
    : `companies/${companyId}/msConnections`;
}

function tenantAuthority(): string {
  // Use 'common' for multi-tenant apps (any MS account). Use specific tenant ID for single-tenant.
  return process.env['MS_TENANT_ID'] || 'common';
}

function appCreds(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env['MS_CLIENT_ID'];
  const clientSecret = process.env['MS_CLIENT_SECRET'];
  const redirectUri = process.env['MS_REDIRECT_URI'];
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

// GET /api/ms-oauth/start?service=onedrive — requires auth, returns auth URL
router.get('/start', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Auth required', 401);
  const service = (req.query['service'] as string) || '';
  if (!SERVICE_SCOPES[service]) throw new AppError(`Unknown service: ${service}`, 400);
  const creds = appCreds();
  if (!creds) throw new AppError('Microsoft OAuth non configuré (MS_CLIENT_ID manquant).', 503);

  const state = Buffer.from(JSON.stringify({ companyId, uid, service, t: Date.now() })).toString('base64url');
  const scope = encodeURIComponent(SERVICE_SCOPES[service]);
  const authUrl =
    `https://login.microsoftonline.com/${tenantAuthority()}/oauth2/v2.0/authorize` +
    `?client_id=${creds.clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(creds.redirectUri)}` +
    `&response_mode=query` +
    `&scope=${scope}` +
    `&state=${state}` +
    `&prompt=select_account`;

  res.json({ success: true, data: { url: authUrl, service } });
}));

// GET /api/ms-oauth/callback — PUBLIC — Microsoft redirects here
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query['code'] as string;
  const stateEnc = req.query['state'] as string;
  const errorParam = req.query['error'] as string;
  const errorDesc = req.query['error_description'] as string;

  const base = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';

  if (errorParam) {
    logger.warn('[MS OAuth] User denied or error', { errorParam, errorDesc });
    return res.redirect(`${base}/connectors?ms=error&reason=${encodeURIComponent(errorDesc ?? errorParam)}`);
  }
  if (!code || !stateEnc) return res.redirect(`${base}/connectors?ms=error&reason=missing_code`);

  let state: { companyId: string; uid: string; service: string };
  try {
    state = JSON.parse(Buffer.from(stateEnc, 'base64url').toString('utf-8'));
  } catch { return res.redirect(`${base}/connectors?ms=error&reason=invalid_state`); }

  const creds = appCreds();
  if (!creds) return res.redirect(`${base}/connectors?ms=error&reason=app_not_configured`);

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantAuthority()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: creds.redirectUri,
        grant_type: 'authorization_code',
        scope: SERVICE_SCOPES[state.service] ?? 'offline_access User.Read',
      }).toString(),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      logger.error('[MS OAuth] Token exchange failed', { status: tokenRes.status, errText: errText.slice(0, 300) });
      return res.redirect(`${base}/connectors?ms=error&reason=token_exchange_failed`);
    }
    const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number; scope: string };

    // Fetch profile to record who connected
    interface GraphProfile { displayName?: string; mail?: string; userPrincipalName?: string }
    let profile: GraphProfile | null = null;
    try {
      const prof = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (prof.ok) profile = await prof.json() as GraphProfile;
    } catch { /* non-critical */ }

    // Store encrypted — path differs based on service scope (personal vs company)
    const db = getFirestore();
    const path = storagePath(state.service, state.companyId, state.uid);
    await db.collection(path).doc(state.service).set({
      service: state.service,
      ownerUid: state.uid,
      companyId: state.companyId,
      scope: isPersonal(state.service) ? 'personal' : 'company',
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      scopes: tokens.scope,
      connectedAt: new Date(),
      profile: {
        displayName: profile?.displayName ?? null,
        email: profile?.mail ?? profile?.userPrincipalName ?? null,
      },
    }, { merge: true });

    // Also mirror to company connectors collection for the UI list (company-wide visibility)
    try {
      await db.collection(`companies/${state.companyId}/connectors`).doc(`${state.service}${isPersonal(state.service) ? `:${state.uid}` : ''}`).set({
        type: state.service,
        name: state.service,
        scope: isPersonal(state.service) ? 'personal' : 'company',
        ownerUid: isPersonal(state.service) ? state.uid : null,
        status: 'active',
        connectedAt: new Date(),
        provider: 'microsoft',
      }, { merge: true });
    } catch { /* non-critical */ }

    logger.info('[MS OAuth] Connected', { companyId: state.companyId, service: state.service, user: profile?.userPrincipalName });

    res.redirect(`${base}/connectors?ms=success&service=${state.service}`);
  } catch (err) {
    logger.error('[MS OAuth] Callback failed', { err: String(err) });
    res.redirect(`${base}/connectors?ms=error&reason=unexpected`);
  }
}));

// GET /api/ms-oauth/status — list connections: personal for current user + company for all
router.get('/status', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Auth required', 401);
  const db = getFirestore();

  // Personal (the current user's own OneDrive, Outlook, Calendar)
  const personalSnap = await db.collection(`users/${uid}/msConnections`).get().catch(() => null);
  const personal = personalSnap ? personalSnap.docs.map(d => ({
    service: d.id,
    scope: 'personal' as const,
    connectedAt: d.data()['connectedAt'],
    profile: d.data()['profile'] ?? null,
    expiresAt: d.data()['expiresAt'] ?? null,
  })) : [];

  // Company-wide (SharePoint, Teams)
  const companySnap = await db.collection(`companies/${companyId}/msConnections`).get().catch(() => null);
  const company = companySnap ? companySnap.docs.map(d => ({
    service: d.id,
    scope: 'company' as const,
    connectedAt: d.data()['connectedAt'],
    profile: d.data()['profile'] ?? null,
    expiresAt: d.data()['expiresAt'] ?? null,
  })) : [];

  res.json({ success: true, data: [...personal, ...company] });
}));

// DELETE /api/ms-oauth/:service — disconnect (personal or company depending on service)
router.delete('/:service', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Auth required', 401);
  const { service } = req.params;
  const path = storagePath(service, companyId, uid);
  const db = getFirestore();
  await db.collection(path).doc(service).delete().catch(() => {});
  const connectorId = isPersonal(service) ? `${service}:${uid}` : service;
  await db.collection(`companies/${companyId}/connectors`).doc(connectorId).delete().catch(() => {});
  res.json({ success: true });
}));

export default router;
