/**
 * LinkedIn Publisher — OAuth 2.0 + UGC posting.
 *
 * Auth: standard OAuth code flow. Access tokens last 60 days.
 * Refresh tokens require `offline_access` scope which is gated by LinkedIn
 * approval — for now we just re-prompt every 60 days.
 *
 * Personal vs Organization posting:
 *   - Personal: scope `w_member_social` — works without review.
 *     Author URN = `urn:li:person:{sub}` from /v2/userinfo.
 *   - Organization: scope `w_organization_social` — requires Marketing
 *     Developer Platform approval (~weeks). Author = `urn:li:organization:{id}`.
 *
 * We implement personal here. The existing publishLinkedIn in
 * socialPublishService.ts already handles organization URN if orgId is
 * stored in the connection.
 *
 * Setup (one-time):
 *   1. https://www.linkedin.com/developers/apps → Create app
 *   2. Products → request "Sign In with LinkedIn using OpenID Connect"
 *      + "Share on LinkedIn" (auto-approved for personal scope)
 *   3. Auth → Redirect URLs → add: https://orlode.com/api/social/linkedin/callback
 *   4. Set LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET in env
 */
import { logger } from '../../utils/logger';

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

export function getLinkedInAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env['LINKEDIN_CLIENT_ID'] ?? '';
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not configured');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface LinkedInTokens {
  accessToken: string;
  expiresAt: number;
  personId: string;     // sub from /userinfo (URN: urn:li:person:{personId})
  displayName?: string;
  email?: string;
}

export async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<LinkedInTokens> {
  const clientId = process.env['LINKEDIN_CLIENT_ID'] ?? '';
  const clientSecret = process.env['LINKEDIN_CLIENT_SECRET'] ?? '';
  if (!clientId || !clientSecret) throw new Error('LINKEDIN_CLIENT_ID / SECRET not configured');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await r.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Token exchange failed (HTTP ${r.status})`);
  }

  // Fetch user profile (sub = LinkedIn person id)
  let personId = '';
  let displayName: string | undefined;
  let email: string | undefined;
  try {
    const u = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${json.access_token}` } });
    const uJson = await u.json() as { sub?: string; name?: string; email?: string };
    personId = uJson.sub ?? '';
    displayName = uJson.name;
    email = uJson.email;
  } catch (err) {
    logger.warn('[LinkedIn] userinfo fetch failed', { err: String(err) });
  }
  if (!personId) throw new Error('Could not fetch LinkedIn person id');

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 60 * 24 * 3600) - 60) * 1000,
    personId,
    displayName,
    email,
  };
}

/**
 * Create a UGC post on a personal LinkedIn profile.
 * The existing socialPublishService.publishLinkedIn already handles
 * organization URN if orgId is set. This is the personal version.
 */
export async function publishLinkedInPost(args: {
  accessToken: string;
  personId: string;
  text: string;
  imageUrl?: string;       // optional — image post
  videoUrl?: string;       // optional — video post (requires registerUpload + asset)
}): Promise<{ postId: string; url?: string }> {
  const { accessToken, personId, text } = args;
  const author = `urn:li:person:${personId}`;

  // For images/videos, LinkedIn requires a 2-step flow: register the asset
  // with /v2/assets then post with the asset URN. For MVP, we publish text-only.
  // Adding asset upload is straightforward but adds ~50 lines.
  const body = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  const json = await r.json() as { id?: string; message?: string };
  if (!r.ok || !json.id) {
    throw new Error(json.message ?? `Post failed (HTTP ${r.status})`);
  }
  // The post URN is like urn:li:share:7100... — extract the numeric id for the URL
  const numericId = json.id.split(':').pop() ?? json.id;
  return {
    postId: json.id,
    url: `https://www.linkedin.com/feed/update/${json.id}`,
  };
}
