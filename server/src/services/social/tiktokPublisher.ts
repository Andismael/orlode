/**
 * TikTok Publisher — OAuth + Content Posting API.
 *
 * Auth: OAuth 2.0 with code → access_token + refresh_token (365 days).
 * Refresh tokens are long-lived; access tokens expire in 24h.
 *
 * Publishing: 2-step flow per TikTok Content Posting API v2:
 *   1. INIT — POST /v2/post/publish/video/init/ (or /inbox/video/init/ for drafts)
 *      Returns: { upload_url, publish_id }
 *   2. UPLOAD — PUT bytes to the upload_url (multi-chunk supported)
 *   3. STATUS — poll /v2/post/publish/status/fetch/ to know when published
 *
 * Setup required (one-time):
 *   1. https://developers.tiktok.com → My apps → Create app
 *   2. Add product "Login Kit" + "Content Posting API"
 *   3. URL Properties → add: https://orlode.com (and verified domain)
 *   4. Redirect URI: https://orlode.com/api/social/tiktok/callback
 *   5. Scopes: user.info.basic, video.upload, video.publish
 *   6. Set TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET in env
 *
 * IMPORTANT — Sandbox vs Production:
 *   - Out of the box, the app is in "sandbox" mode = videos go to user's drafts
 *     (Inbox) and the user must publish manually from TikTok app.
 *   - To enable direct publish to public feed, request "Direct Post" review
 *     from TikTok (3-7 days).
 */
import { logger } from '../../utils/logger';

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name';

const SCOPES = ['user.info.basic', 'video.upload', 'video.publish'];

export function getTiktokAuthUrl(state: string, redirectUri: string): string {
  const clientKey = process.env['TIKTOK_CLIENT_KEY'] ?? '';
  if (!clientKey) throw new Error('TIKTOK_CLIENT_KEY not configured');
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export interface TiktokTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;     // ms
  openId: string;        // TikTok user identifier
  displayName?: string;
  avatarUrl?: string;
}

export async function exchangeTiktokCode(code: string, redirectUri: string): Promise<TiktokTokens> {
  const clientKey = process.env['TIKTOK_CLIENT_KEY'] ?? '';
  const clientSecret = process.env['TIKTOK_CLIENT_SECRET'] ?? '';
  if (!clientKey || !clientSecret) throw new Error('TIKTOK_CLIENT_KEY / SECRET not configured');

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await r.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description ?? json.error ?? `Token exchange failed (HTTP ${r.status})`);
  }

  // Fetch display name + avatar to label the connection nicely
  let displayName: string | undefined;
  let avatarUrl: string | undefined;
  try {
    const u = await fetch(USER_INFO_URL, { headers: { Authorization: `Bearer ${json.access_token}` } });
    const uJson = await u.json() as { data?: { user?: { display_name?: string; avatar_url?: string } } };
    displayName = uJson.data?.user?.display_name;
    avatarUrl = uJson.data?.user?.avatar_url;
  } catch { /* best-effort */ }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + ((json.expires_in ?? 86400) - 60) * 1000,
    openId: json.open_id ?? '',
    displayName,
    avatarUrl,
  };
}

export async function refreshTiktokToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientKey = process.env['TIKTOK_CLIENT_KEY'] ?? '';
  const clientSecret = process.env['TIKTOK_CLIENT_SECRET'] ?? '';
  if (!clientKey || !clientSecret) throw new Error('TIKTOK creds not configured');

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j = await r.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!r.ok || !j.access_token) throw new Error(j.error ?? `Refresh failed (HTTP ${r.status})`);
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? refreshToken,
    expiresAt: Date.now() + ((j.expires_in ?? 86400) - 60) * 1000,
  };
}

/**
 * Publish a video to TikTok. By default, posts to user's "Inbox" (drafts);
 * the user finalizes from the TikTok app. If your app has Direct Post
 * permission, set `directPublish: true` for instant feed publication.
 *
 * 3-step flow:
 *   1. INIT — get upload_url + publish_id
 *   2. UPLOAD — PUT video bytes
 *   3. STATUS — poll until 'PUBLISHED' or 'FAILED'
 */
export async function uploadVideoToTiktok(args: {
  accessToken: string;
  videoUrl: string;
  caption: string;
  directPublish?: boolean;
}): Promise<{ publishId: string; status: string }> {
  const { accessToken, videoUrl, caption, directPublish } = args;

  // 1. Fetch the video bytes
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Cannot fetch video (HTTP ${videoRes.status})`);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  const videoSize = videoBuffer.length;

  // TikTok needs chunk size between 5 MB and 10 MB; for simplicity we use 1 chunk
  // if file fits, or split into 5 MB chunks otherwise. Max video = 4 GB.
  const CHUNK_SIZE = 10 * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(videoSize / CHUNK_SIZE));

  // 2. INIT — different endpoint for direct vs draft
  const initEndpoint = directPublish
    ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

  const initBody = directPublish ? {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: Math.min(CHUNK_SIZE, videoSize),
      total_chunk_count: totalChunks,
    },
  } : {
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: Math.min(CHUNK_SIZE, videoSize),
      total_chunk_count: totalChunks,
    },
  };

  const initRes = await fetch(initEndpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(initBody),
  });
  const initJson = await initRes.json() as {
    data?: { upload_url: string; publish_id: string };
    error?: { code: string; message: string };
  };
  if (!initRes.ok || !initJson.data?.upload_url) {
    throw new Error(initJson.error?.message ?? `Init failed (HTTP ${initRes.status})`);
  }
  const uploadUrl = initJson.data.upload_url;
  const publishId = initJson.data.publish_id;

  // 3. UPLOAD — PUT bytes (single chunk if fits)
  if (totalChunks === 1) {
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoSize),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuffer,
    });
    if (!uploadRes.ok) {
      const t = await uploadRes.text().catch(() => '');
      throw new Error(`Upload failed: HTTP ${uploadRes.status} ${t.slice(0, 200)}`);
    }
  } else {
    // Multi-chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoSize) - 1;
      const chunk = videoBuffer.subarray(start, end + 1);
      const r = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        },
        body: chunk,
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`Chunk ${i + 1}/${totalChunks} failed: HTTP ${r.status} ${t.slice(0, 200)}`);
      }
    }
  }

  // 4. POLL status (up to ~30s) so we can return a final state
  let status = 'PROCESSING_UPLOAD';
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const sJson = await statusRes.json() as { data?: { status: string } };
    status = sJson.data?.status ?? status;
    if (status === 'PUBLISH_COMPLETE' || status === 'FAILED' || status === 'SEND_TO_USER_INBOX') break;
  }

  logger.info('[TikTok] upload complete', { publishId, status, directPublish: !!directPublish });
  return { publishId, status };
}
