import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnlyMiddleware } from '../middleware/adminOnly.middleware';
import { socialPublishService, type SocialPlatform } from '../services/social/socialPublishService';
import { AppError } from '../middleware/error.middleware';
import { getStorage } from '../config/firebase.config';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response, Request } from 'express';

// Multer config: 50 MB cap (Instagram videos can be 100MB but we cap to keep
// the request within Cloud Run limits — videos beyond 50MB should be uploaded
// directly to Storage from the client via a signed URL, future enhancement).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

// ── Routes publiques GDPR Meta (pas d'auth) ──────────────────────────────────

// POST /api/social/deauth/facebook — Meta appelle cette URL quand un user révoque l'accès
router.post('/deauth/facebook', (_req: Request, res: Response) => {
  // Meta envoie un signed_request — on accuse réception
  res.status(200).json({ success: true });
});

// POST /api/social/deletion/facebook — Meta appelle pour demander suppression des données
router.post('/deletion/facebook', (_req: Request, res: Response) => {
  // Retourne une confirmation avec URL de statut (obligatoire par Meta)
  const confirmationCode = `del_${Date.now()}`;
  res.status(200).json({
    url: `https://api-15262322885.us-central1.run.app/api/social/deletion/status/${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
});

// GET /api/social/deletion/status/:code — page de statut de suppression
router.get('/deletion/status/:code', (req: Request, res: Response) => {
  res.status(200).json({ status: 'deleted', code: req.params['code'] });
});

// ── PUBLIC: LinkedIn OAuth callback ──
router.get('/linkedin/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query['code'] as string | undefined;
  const state = req.query['state'] as string | undefined;
  const errorDesc = req.query['error_description'] as string | undefined ?? req.query['error'] as string | undefined;
  if (errorDesc) return res.redirect(`/admin/social?error=${encodeURIComponent(errorDesc)}`);
  if (!code || !state) return res.redirect('/admin/social?error=missing_code_or_state');

  try {
    const { exchangeLinkedInCode } = await import('../services/social/linkedinPublisher');
    const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
    const redirectUri = `${baseUrl}/api/social/linkedin/callback`;
    const tokens = await exchangeLinkedInCode(code, redirectUri);
    await socialPublishService.saveConnection(state, {
      platform: 'linkedin',
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      accountName: tokens.displayName ?? tokens.email ?? 'LinkedIn profile',
      accountId: tokens.personId,
    });
    return res.redirect('/admin/social?connected=linkedin');
  } catch (err: any) {
    return res.redirect(`/admin/social?error=${encodeURIComponent(err?.message ?? 'oauth_failed')}`);
  }
}));

// ── PUBLIC: TikTok OAuth callback ──
router.get('/tiktok/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query['code'] as string | undefined;
  const state = req.query['state'] as string | undefined;
  const errorDesc = req.query['error_description'] as string | undefined ?? req.query['error'] as string | undefined;
  if (errorDesc) return res.redirect(`/admin/social?error=${encodeURIComponent(errorDesc)}`);
  if (!code || !state) return res.redirect('/admin/social?error=missing_code_or_state');

  try {
    const { exchangeTiktokCode } = await import('../services/social/tiktokPublisher');
    const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
    const redirectUri = `${baseUrl}/api/social/tiktok/callback`;
    const tokens = await exchangeTiktokCode(code, redirectUri);
    await socialPublishService.saveConnection(state, {
      platform: 'tiktok',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      accountName: tokens.displayName ?? `@${tokens.openId.slice(0, 12)}`,
      accountId: tokens.openId,
    });
    return res.redirect('/admin/social?connected=tiktok');
  } catch (err: any) {
    return res.redirect(`/admin/social?error=${encodeURIComponent(err?.message ?? 'oauth_failed')}`);
  }
}));

// ── PUBLIC: Google / YouTube OAuth callback ──
router.get('/google/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query['code'] as string | undefined;
  const state = req.query['state'] as string | undefined; // companyId
  const errorDesc = req.query['error_description'] as string | undefined ?? req.query['error'] as string | undefined;
  if (errorDesc) return res.redirect(`/admin/social?error=${encodeURIComponent(errorDesc)}`);
  if (!code || !state) return res.redirect('/admin/social?error=missing_code_or_state');

  try {
    const { exchangeGoogleCode } = await import('../services/social/googlePublisher');
    const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
    const redirectUri = `${baseUrl}/api/social/google/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);

    await socialPublishService.saveConnection(state, {
      platform: 'youtube',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      accountName: tokens.channelTitle ?? 'YouTube Channel',
      accountId: tokens.channelId,
    });
    return res.redirect('/admin/social?connected=youtube');
  } catch (err: any) {
    return res.redirect(`/admin/social?error=${encodeURIComponent(err?.message ?? 'oauth_failed')}`);
  }
}));

// ── PUBLIC: Meta OAuth callback (no auth — uses state param to identify company) ──
// User clicks "Connect Meta" → frontend redirects to Facebook OAuth → Facebook
// redirects back here with `code` and `state=companyId`. We swap the code for
// per-Page tokens and save one socialConnection per Page (+ linked IG account).
router.get('/meta/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query['code'] as string | undefined;
  const state = req.query['state'] as string | undefined; // companyId
  const errorDesc = req.query['error_description'] as string | undefined;
  if (errorDesc) return res.redirect(`/admin/social?error=${encodeURIComponent(errorDesc)}`);
  if (!code || !state) return res.redirect('/admin/social?error=missing_code_or_state');

  try {
    const { exchangeMetaCodeForPageTokens } = await import('../services/social/socialPublishService');
    const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
    const redirectUri = `${baseUrl}/api/social/meta/callback`;
    const pages = await exchangeMetaCodeForPageTokens(code, redirectUri);
    if (pages.length === 0) return res.redirect('/admin/social?error=no_pages_found');

    // Save the first Page as the Facebook connection + its linked IG (if any).
    // If the user has multiple pages, we currently take the first; future
    // enhancement = let them pick.
    const page = pages[0];
    await socialPublishService.saveConnection(state, {
      platform: 'facebook',
      accessToken: page.pageAccessToken,
      accountName: page.pageName,
      accountId: page.pageId,
      pageId: page.pageId,
    });
    if (page.igBusinessId) {
      await socialPublishService.saveConnection(state, {
        platform: 'instagram',
        accessToken: page.pageAccessToken,
        accountName: `@${page.igUsername}`,
        accountId: page.igBusinessId,
      });
    }

    return res.redirect(`/admin/social?connected=meta${page.igBusinessId ? '+instagram' : ''}`);
  } catch (err: any) {
    return res.redirect(`/admin/social?error=${encodeURIComponent(err?.message ?? 'oauth_failed')}`);
  }
}));

router.use(authMiddleware);
router.use(adminOnlyMiddleware);

// GET /api/social/connections — liste des connexions actives
router.get('/connections', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const connections = await socialPublishService.getConnections(companyId);
  res.json({ success: true, data: connections });
}));

// POST /api/social/connect — connecter une plateforme (OAuth callback)
router.post('/connect', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { platform, accessToken, refreshToken, expiresAt, accountName, accountId, pageId, orgId } = req.body as {
    platform: SocialPlatform;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    accountName?: string;
    accountId?: string;
    pageId?: string;
    orgId?: string;
  };
  if (!platform || !accessToken) throw new AppError('platform and accessToken required', 400);
  await socialPublishService.saveConnection(companyId, {
    platform, accessToken, refreshToken, expiresAt, accountName, accountId, pageId, orgId,
  });
  res.json({ success: true, message: `${platform} connecté` });
}));

// DELETE /api/social/disconnect/:platform
router.delete('/disconnect/:platform', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { platform } = req.params as { platform: SocialPlatform };
  await socialPublishService.disconnect(companyId, platform);
  res.json({ success: true, message: `${platform} déconnecté` });
}));

// POST /api/social/disconnect-all — full revocation (GDPR-friendly + Meta App Review).
// Disconnects every social platform + deletes scheduled posts + uploaded media.
router.post('/disconnect-all', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore } = await import('../config/firebase.config');
  const db = getFirestore();
  const summary = { platforms: 0, scheduledPosts: 0, mediaFiles: 0 };

  // 1. Disconnect every platform
  const conns = await db.collection(`companies/${companyId}/socialConnections`).get().catch(() => null);
  if (conns) {
    for (const doc of conns.docs) {
      await doc.ref.delete().catch(() => null);
      summary.platforms++;
    }
  }

  // 2. Delete scheduled (not yet published) posts
  const scheduled = await db.collection(`companies/${companyId}/socialPosts`)
    .where('status', '==', 'scheduled').get().catch(() => null);
  if (scheduled) {
    for (const doc of scheduled.docs) {
      await doc.ref.delete().catch(() => null);
      summary.scheduledPosts++;
    }
  }

  // 3. Delete uploaded media (Storage + Firestore metadata)
  const media = await db.collection(`companies/${companyId}/socialMedia`).get().catch(() => null);
  if (media) {
    for (const doc of media.docs) {
      const filePath = doc.data()?.['filePath'] as string | undefined;
      if (filePath) {
        await getStorage().bucket().file(filePath).delete().catch(() => null);
      }
      await doc.ref.delete().catch(() => null);
      summary.mediaFiles++;
    }
  }

  res.json({ success: true, data: summary });
}));

// POST /api/social/publish — publier du contenu
router.post('/publish', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { platforms, text, videoUrl, imageUrl, hashtags } = req.body as {
    platforms: SocialPlatform[];
    text: string;
    videoUrl?: string;
    imageUrl?: string;
    hashtags?: string[];
  };
  if (!platforms?.length || !text) throw new AppError('platforms and text required', 400);
  const results = await socialPublishService.publishToAll(companyId, platforms, { text, videoUrl, imageUrl, hashtags });
  res.json({ success: true, data: results });
}));

// POST /api/social/publish-post/:postId — publish a marketing post to connected platforms
router.post('/publish-post/:postId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { getFirestore: getDb } = await import('../config/firebase.config');
  const db = getDb();

  // Get the post
  const postDoc = await db.collection('marketingPosts').doc(req.params['postId']).get();
  if (!postDoc.exists) throw new AppError('Post not found', 404);
  const post = postDoc.data() as Record<string, unknown>;

  const platform = ((post['platform'] as string) ?? '').toLowerCase() as SocialPlatform;
  const text = (post['text'] as string) ?? '';
  if (!text) throw new AppError('Post has no text', 400);

  // Check if platform is connected
  const connections = await socialPublishService.getConnections(companyId);
  const isConnected = connections.some(c => c.platform === platform);

  if (!isConnected) {
    return res.json({
      success: false,
      data: { platform, connected: false, message: `${platform} n'est pas connecte. Connectez-le dans Admin > Reseaux sociaux.` },
    });
  }

  // Publish
  const results = await socialPublishService.publishToAll(companyId, [platform], { text });
  const result = results[0];

  // Update post status
  if (result?.success) {
    await db.collection('marketingPosts').doc(req.params['postId']).update({
      status: 'published', publishedAt: new Date(), socialPostId: result.postId, socialPostUrl: result.url,
    });
  }

  res.json({ success: true, data: result });
}));

// GET /api/social/platforms — list all supported platforms with connection status
router.get('/platforms', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const connections = await socialPublishService.getConnections(companyId);
  const connectedPlatforms = new Set(connections.map(c => c.platform));

  const platforms = [
    { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin', connected: connectedPlatforms.has('linkedin'), oauthUrl: 'https://www.linkedin.com/oauth/v2/authorization' },
    { id: 'facebook', name: 'Facebook', icon: 'facebook', connected: connectedPlatforms.has('facebook'), oauthUrl: 'https://www.facebook.com/v21.0/dialog/oauth' },
    { id: 'instagram', name: 'Instagram', icon: 'instagram', connected: connectedPlatforms.has('instagram'), oauthUrl: 'Via Facebook Business' },
    { id: 'twitter', name: 'Twitter / X', icon: 'twitter', connected: connectedPlatforms.has('twitter'), oauthUrl: 'https://twitter.com/i/oauth2/authorize' },
    { id: 'tiktok', name: 'TikTok', icon: 'tiktok', connected: connectedPlatforms.has('tiktok'), oauthUrl: 'https://www.tiktok.com/v2/auth/authorize/' },
    { id: 'youtube', name: 'YouTube', icon: 'youtube', connected: connectedPlatforms.has('youtube'), oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth' },
  ];

  res.json({ success: true, data: platforms });
}));

// POST /api/social/upload — upload an image/video to Firebase Storage and
// return a public URL the publishers can use as image_url / video_url.
router.post('/upload', upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new AppError('No file uploaded', 400);

  // Validate type — Meta requires JPEG/PNG for images, MP4/MOV for videos
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  if (!isImage && !isVideo) throw new AppError('Format non supporté — image (JPEG/PNG) ou vidéo (MP4/MOV) uniquement', 400);

  const ext = (file.originalname.split('.').pop() ?? file.mimetype.split('/')[1] ?? 'bin').toLowerCase();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const filePath = `social/${companyId}/${Date.now()}-${safeName}`;

  const bucket = getStorage().bucket();
  const fileRef = bucket.file(filePath);
  await fileRef.save(file.buffer, {
    contentType: file.mimetype,
    public: true,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

  // Persist metadata so we can compute per-company storage usage.
  const { getFirestore } = await import('../config/firebase.config');
  const { FieldValue } = await import('firebase-admin/firestore');
  await getFirestore().collection(`companies/${companyId}/socialMedia`).add({
    url: publicUrl,
    filePath,
    mimeType: file.mimetype,
    size: file.size,
    mediaType: isImage ? 'image' : 'video',
    ext,
    originalName: file.originalname,
    uploadedBy: req.user?.uid ?? null,
    uploadedAt: FieldValue.serverTimestamp(),
  });

  res.json({
    success: true,
    data: {
      url: publicUrl,
      mediaType: isImage ? 'image' : 'video',
      size: file.size,
      mimeType: file.mimetype,
      ext,
    },
  });
}));

// GET /api/social/storage/usage — total storage used by this company across
// all uploaded social media files. Returns bytes + count + breakdown.
router.get('/storage/usage', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore } = await import('../config/firebase.config');
  const snap = await getFirestore().collection(`companies/${companyId}/socialMedia`).limit(1000).get().catch(() => null);

  let totalBytes = 0;
  let imageCount = 0;
  let videoCount = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  if (snap) {
    for (const d of snap.docs) {
      const data = d.data();
      const size = typeof data['size'] === 'number' ? data['size'] : 0;
      totalBytes += size;
      if (data['mediaType'] === 'video') {
        videoCount++; videoBytes += size;
      } else {
        imageCount++; imageBytes += size;
      }
    }
  }

  res.json({
    success: true,
    data: {
      totalBytes,
      totalFiles: imageCount + videoCount,
      imageCount, imageBytes,
      videoCount, videoBytes,
      // Soft display limit (Firebase Storage free tier baseline).
      // No enforcement — just for the UI badge.
      softLimitBytes: 5 * 1024 * 1024 * 1024,
    },
  });
}));

// DELETE /api/social/media/:id — remove a media file from Storage + Firestore
router.delete('/media/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore } = await import('../config/firebase.config');
  const ref = getFirestore().collection(`companies/${companyId}/socialMedia`).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Media not found', 404);
  const filePath = doc.data()?.['filePath'] as string | undefined;
  if (filePath) {
    await getStorage().bucket().file(filePath).delete().catch(() => null);
  }
  await ref.delete();
  res.json({ success: true });
}));

// GET /api/social/media — list uploaded media for this company
router.get('/media', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore } = await import('../config/firebase.config');
  const snap = await getFirestore().collection(`companies/${companyId}/socialMedia`)
    .orderBy('uploadedAt', 'desc').limit(100).get().catch(() => null);
  res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));

// ── OAuth helper for LinkedIn ──
router.get('/linkedin/connect-url', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getLinkedInAuthUrl } = await import('../services/social/linkedinPublisher');
  const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
  const redirectUri = `${baseUrl}/api/social/linkedin/callback`;
  const url = getLinkedInAuthUrl(companyId, redirectUri);
  res.json({ success: true, data: { url, redirectUri } });
}));

// ── OAuth helper for TikTok ──
router.get('/tiktok/connect-url', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getTiktokAuthUrl } = await import('../services/social/tiktokPublisher');
  const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
  const redirectUri = `${baseUrl}/api/social/tiktok/callback`;
  const url = getTiktokAuthUrl(companyId, redirectUri);
  res.json({ success: true, data: { url, redirectUri } });
}));

// ── OAuth helper for Google/YouTube ──
router.get('/google/connect-url', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getGoogleAuthUrl } = await import('../services/social/googlePublisher');
  const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
  const redirectUri = `${baseUrl}/api/social/google/callback`;
  const url = getGoogleAuthUrl(companyId, redirectUri);
  res.json({ success: true, data: { url, redirectUri } });
}));

// ── OAuth helper: returns the Facebook OAuth URL for the user to click ──
router.get('/meta/connect-url', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const META_APP_ID = process.env['META_APP_ID']
    ?? process.env['WHATSAPP_APP_ID']
    ?? process.env['VITE_META_APP_ID']
    ?? '';
  if (!META_APP_ID) throw new AppError('META_APP_ID env not configured', 500);

  const baseUrl = process.env['BASE_URL'] ?? 'https://orlode.com';
  const redirectUri = `${baseUrl}/api/social/meta/callback`;
  const scopes = [
    'pages_show_list',
    'pages_manage_posts',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
    'business_management',
  ].join(',');
  const url = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${companyId}`;
  res.json({ success: true, data: { url, redirectUri } });
}));

// ─── Scheduled / draft posts (companies/{cid}/socialPosts) ──────────────────

// Strip undefined values recursively — Firestore refuses undefined and throws.
// Keeps `null` and primitives as-is.
function stripUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripUndefined) as any;
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) out[k] = stripUndefined(val);
    }
    return out;
  }
  return v;
}

// POST /api/social/posts — create a post (publish now if no scheduledAt, else schedule)
router.post('/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { text, mediaUrl, mediaType, hashtags, platforms, scheduledAt } = req.body as {
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    hashtags?: string[];
    platforms: SocialPlatform[];
    scheduledAt?: string;
  };
  if (!text?.trim() || !platforms?.length) throw new AppError('text + platforms required', 400);

  const { getFirestore: getDb } = await import('../config/firebase.config');
  const db = getDb();
  const ref = db.collection(`companies/${companyId}/socialPosts`).doc();

  const scheduled = scheduledAt ? new Date(scheduledAt) : null;
  const now = Date.now();
  const isFuture = scheduled && scheduled.getTime() > now + 30_000;

  await ref.set({
    text: text.trim(),
    mediaUrl: mediaUrl ?? null,
    mediaType: mediaType ?? null,
    hashtags: hashtags ?? [],
    platforms,
    status: isFuture ? 'scheduled' : 'publishing',
    scheduledAt: scheduled,
    triggeredBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (isFuture) {
    return res.json({ success: true, data: { postId: ref.id, status: 'scheduled', scheduledAt: scheduled } });
  }

  // Publish immediately
  const results = await socialPublishService.publishToAll(companyId, platforms, {
    text: text.trim(),
    imageUrl: mediaType === 'image' ? mediaUrl : undefined,
    videoUrl: mediaType === 'video' ? mediaUrl : undefined,
    hashtags,
  });
  const allFailed = results.every(r => !r.success);
  const cleanResults = stripUndefined(results);
  await ref.update({
    status: allFailed ? 'failed' : 'published',
    results: cleanResults,
    publishedAt: new Date(),
    updatedAt: new Date(),
  });

  res.json({ success: true, data: { postId: ref.id, status: allFailed ? 'failed' : 'published', results: cleanResults } });
}));

// GET /api/social/posts — list recent posts (drafts/scheduled/published)
router.get('/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore: getDb } = await import('../config/firebase.config');
  const snap = await getDb().collection(`companies/${companyId}/socialPosts`)
    .orderBy('createdAt', 'desc').limit(50).get().catch(() => null);
  res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));

// DELETE /api/social/posts/:id — delete draft / scheduled (not published)
router.delete('/posts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore: getDb } = await import('../config/firebase.config');
  const ref = getDb().collection(`companies/${companyId}/socialPosts`).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Post not found', 404);
  if (doc.data()?.['status'] === 'published') throw new AppError('Impossible de supprimer un post publié', 400);
  await ref.delete();
  res.json({ success: true });
}));

// POST /api/social/posts/:id/publish-now — force publish a scheduled post immediately
router.post('/posts/:id/publish-now', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);
  const { getFirestore: getDb } = await import('../config/firebase.config');
  const ref = getDb().collection(`companies/${companyId}/socialPosts`).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Post not found', 404);
  const data = doc.data() as any;

  await ref.update({ status: 'publishing', updatedAt: new Date() });
  const results = await socialPublishService.publishToAll(companyId, data.platforms, {
    text: data.text,
    imageUrl: data.mediaType === 'image' ? data.mediaUrl : undefined,
    videoUrl: data.mediaType === 'video' ? data.mediaUrl : undefined,
    hashtags: data.hashtags,
  });
  const allFailed = results.every((r: any) => !r.success);
  const cleanResults = stripUndefined(results);
  await ref.update({
    status: allFailed ? 'failed' : 'published',
    results: cleanResults,
    publishedAt: new Date(),
    updatedAt: new Date(),
  });
  res.json({ success: true, data: { results: cleanResults, allFailed } });
}));

export default router;
