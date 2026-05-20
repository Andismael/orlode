"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleAuthUrl = getGoogleAuthUrl;
exports.exchangeGoogleCode = exchangeGoogleCode;
exports.refreshGoogleToken = refreshGoogleToken;
exports.uploadVideoToYouTube = uploadVideoToYouTube;
/**
 * Google / YouTube Publisher
 *
 * Auth: OAuth 2.0 with offline access (we get a refresh_token to keep posting
 * after the 1-hour access_token expires).
 *
 * Publishing: YouTube Data API v3 with `uploadType=resumable`. We fetch the
 * video bytes from the user-provided URL (typically Firebase Storage from our
 * /social/upload endpoint), then pipe them into the resumable session.
 *
 * Setup required (one-time, in GCP Console):
 *   1. Enable YouTube Data API v3 for the project
 *   2. OAuth consent screen → add scopes:
 *        https://www.googleapis.com/auth/youtube.upload
 *        https://www.googleapis.com/auth/youtube.readonly
 *   3. Credentials → Create OAuth 2.0 Client ID (Web application)
 *      Authorized redirect URI: https://orlode.com/api/social/google/callback
 *   4. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in env.cloud.yaml
 */
const logger_1 = require("../../utils/logger");
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const RESUMABLE_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const CHANNEL_INFO_URL = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'openid',
    'email',
    'profile',
];
function getGoogleAuthUrl(state, redirectUri) {
    const clientId = process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? '';
    if (!clientId)
        throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline', // required to get a refresh_token
        prompt: 'consent', // force the consent screen so refresh_token is always issued
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeGoogleCode(code, redirectUri) {
    const clientId = process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? '';
    const clientSecret = process.env['GOOGLE_OAUTH_CLIENT_SECRET'] ?? '';
    if (!clientId || !clientSecret)
        throw new Error('GOOGLE_OAUTH_CLIENT_ID/SECRET not configured');
    const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });
    const r = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const json = await r.json();
    if (!r.ok || !json.access_token) {
        throw new Error(json.error_description ?? json.error ?? `Token exchange failed (HTTP ${r.status})`);
    }
    // Fetch the connected YouTube channel so we can store a friendly name
    let channelId;
    let channelTitle;
    try {
        const chRes = await fetch(CHANNEL_INFO_URL, {
            headers: { Authorization: `Bearer ${json.access_token}` },
        });
        const chJson = await chRes.json();
        if (chJson.items?.[0]) {
            channelId = chJson.items[0].id;
            channelTitle = chJson.items[0].snippet?.title;
        }
    }
    catch { /* best-effort */ }
    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000, // 60s safety margin
        channelId,
        channelTitle,
    };
}
/**
 * Refresh an expired Google access token using the stored refresh_token.
 * Returns a new accessToken + expiresAt; the refreshToken stays the same.
 */
async function refreshGoogleToken(refreshToken) {
    const clientId = process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? '';
    const clientSecret = process.env['GOOGLE_OAUTH_CLIENT_SECRET'] ?? '';
    if (!clientId || !clientSecret)
        throw new Error('GOOGLE_OAUTH_CLIENT_ID/SECRET not configured');
    const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
    });
    const r = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const json = await r.json();
    if (!r.ok || !json.access_token) {
        throw new Error(json.error ?? `Refresh failed (HTTP ${r.status})`);
    }
    return {
        accessToken: json.access_token,
        expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
    };
}
/**
 * Upload a video to YouTube via resumable upload.
 *   1. Create the upload session (POST to videos with metadata)
 *   2. PUT the video bytes to the returned Location URL
 * Returns the YouTube videoId on success.
 */
async function uploadVideoToYouTube(args) {
    const { accessToken, videoUrl, title, description, tags, categoryId, privacyStatus } = args;
    // 1. Fetch the video bytes from the public URL
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok)
        throw new Error(`Cannot fetch video (HTTP ${videoRes.status})`);
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    // 2. Start the resumable session — POST with metadata in JSON body
    const metadata = {
        snippet: {
            title: title.slice(0, 100),
            description: description.slice(0, 5000),
            tags: (tags ?? []).slice(0, 30),
            categoryId: categoryId ?? '22',
        },
        status: { privacyStatus: privacyStatus ?? 'public' },
    };
    const startRes = await fetch(RESUMABLE_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': contentType,
            'X-Upload-Content-Length': String(videoBuffer.length),
        },
        body: JSON.stringify(metadata),
    });
    if (!startRes.ok) {
        const errText = await startRes.text().catch(() => '');
        throw new Error(`Upload session failed: HTTP ${startRes.status} ${errText.slice(0, 200)}`);
    }
    const uploadUrl = startRes.headers.get('location');
    if (!uploadUrl)
        throw new Error('No Location header returned from YouTube upload init');
    // 3. PUT the actual bytes
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType, 'Content-Length': String(videoBuffer.length) },
        body: videoBuffer,
    });
    const putJson = await putRes.json();
    if (!putRes.ok || !putJson.id) {
        throw new Error(putJson.error?.message ?? `Upload failed (HTTP ${putRes.status})`);
    }
    logger_1.logger.info('[YouTube] video uploaded', { videoId: putJson.id, title });
    return { videoId: putJson.id };
}
//# sourceMappingURL=googlePublisher.js.map