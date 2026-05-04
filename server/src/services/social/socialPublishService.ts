/**
 * Social Publishing Service
 * Publie du contenu sur LinkedIn, Instagram, Facebook, TikTok, YouTube.
 * Chaque client stocke ses tokens OAuth dans SON Firebase (chiffré).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';

export type SocialPlatform = 'linkedin' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'twitter';

export interface SocialConnection {
  platform: SocialPlatform;
  accessToken: string;        // Chiffré
  refreshToken?: string;      // Chiffré
  expiresAt?: number;         // Timestamp
  accountName?: string;       // Nom du compte/page
  accountId?: string;         // ID du compte/page
  pageId?: string;            // Facebook Page ID
  orgId?: string;             // LinkedIn Organization ID
  connectedAt: Date;
}

export interface PublishResult {
  platform: SocialPlatform;
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

const ENCRYPTION_KEY = process.env['SOCIAL_ENCRYPTION_KEY'] ?? 'corpmind-social-key-32byteslong!!';

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

function decrypt(encrypted: string): string {
  try {
    const [ivHex, data] = encrypted.split(':');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const iv = Buffer.from(ivHex, 'hex');
    // createDecipheriv signature: (algorithm, key, iv) — was inverted previously,
    // which caused tokens to "round-trip" as ciphertext and Meta replied
    // "Cannot parse access token" because the encrypted hex was sent as the token.
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  } catch (err) {
    logger.error('[Social] decrypt failed — returning ciphertext as fallback', { err: String(err) });
    return encrypted;
  }
}

export class SocialPublishService {

  /** Sauvegarde une connexion OAuth */
  async saveConnection(companyId: string, conn: Omit<SocialConnection, 'connectedAt'>): Promise<void> {
    await getFirestore()
      .collection('companies').doc(companyId)
      .collection('socialConnections').doc(conn.platform)
      .set({
        ...conn,
        accessToken: encrypt(conn.accessToken),
        refreshToken: conn.refreshToken ? encrypt(conn.refreshToken) : null,
        connectedAt: new Date(),
      });
  }

  /** Liste les connexions actives */
  async getConnections(companyId: string): Promise<Array<Omit<SocialConnection, 'accessToken' | 'refreshToken'>>> {
    try {
      const snap = await getFirestore()
        .collection('companies').doc(companyId)
        .collection('socialConnections')
        .get();
      return snap.docs.map(d => {
        const data = d.data() as SocialConnection;
        const { accessToken: _a, refreshToken: _r, ...safe } = data;
        return safe;
      });
    } catch { return []; }
  }

  /** Déconnecte une plateforme */
  async disconnect(companyId: string, platform: SocialPlatform): Promise<void> {
    await getFirestore()
      .collection('companies').doc(companyId)
      .collection('socialConnections').doc(platform)
      .delete();
  }

  /** Récupère le token déchiffré */
  private async getToken(companyId: string, platform: SocialPlatform): Promise<string | null> {
    try {
      const doc = await getFirestore()
        .collection('companies').doc(companyId)
        .collection('socialConnections').doc(platform)
        .get();
      if (!doc.exists) return null;
      const data = doc.data() as SocialConnection;
      return decrypt(data.accessToken);
    } catch { return null; }
  }

  private async getConnection(companyId: string, platform: SocialPlatform): Promise<SocialConnection | null> {
    try {
      const doc = await getFirestore()
        .collection('companies').doc(companyId)
        .collection('socialConnections').doc(platform)
        .get();
      if (!doc.exists) return null;
      const data = doc.data() as SocialConnection;
      return { ...data, accessToken: decrypt(data.accessToken) };
    } catch { return null; }
  }

  /**
   * Publie sur LinkedIn — supporte personal (urn:li:person) et organization
   * (urn:li:organization). Utilise orgId si présent, sinon accountId comme
   * personal id (sub returned by /userinfo). orgId nécessite Marketing
   * Developer Platform approval; personal marche sans review.
   */
  async publishLinkedIn(companyId: string, content: { text: string; videoUrl?: string; imageUrl?: string }): Promise<PublishResult> {
    try {
      const conn = await this.getConnection(companyId, 'linkedin');
      if (!conn) return { platform: 'linkedin', success: false, error: 'Non connecté' };
      const token = conn.accessToken;

      // Prefer organization URN if present (legacy manual paste path);
      // fall back to person URN (OAuth flow saves accountId = sub from /userinfo).
      let author: string;
      if (conn.orgId) {
        author = `urn:li:organization:${conn.orgId}`;
      } else if (conn.accountId) {
        author = `urn:li:person:${conn.accountId}`;
      } else {
        return { platform: 'linkedin', success: false, error: 'Aucun person/org id stocké' };
      }

      const body: Record<string, unknown> = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content.text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      };

      const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { id?: string; message?: string };
      if (!res.ok || !data.id) {
        return { platform: 'linkedin', success: false, error: data.message ?? `HTTP ${res.status}` };
      }
      return {
        platform: 'linkedin',
        success: true,
        postId: data.id,
        url: `https://www.linkedin.com/feed/update/${data.id}`,
      };
    } catch (err) {
      logger.error('[Social] LinkedIn publish failed', { error: err });
      return { platform: 'linkedin', success: false, error: String(err) };
    }
  }

  /** Publie sur Instagram (via Meta Graph API) */
  async publishInstagram(companyId: string, content: { text: string; videoUrl?: string; imageUrl?: string; hashtags?: string[] }): Promise<PublishResult> {
    try {
      const conn = await this.getConnection(companyId, 'instagram');
      if (!conn) return { platform: 'instagram', success: false, error: 'Non connecté' };
      const token = conn.accessToken;
      const igUserId = conn.accountId;
      if (!igUserId) return { platform: 'instagram', success: false, error: 'Instagram Account ID manquant' };

      const caption = `${content.text}\n\n${(content.hashtags ?? []).map(h => `#${h}`).join(' ')}`.trim();
      let containerId: string;

      if (content.videoUrl) {
        const r = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token, media_type: 'REELS', video_url: content.videoUrl, caption }),
        });
        const d = await r.json() as { id?: string; error?: { message?: string } };
        if (!d.id) return { platform: 'instagram', success: false, error: d.error?.message ?? 'Container création échouée' };
        containerId = d.id;
      } else if (content.imageUrl) {
        const r = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token, image_url: content.imageUrl, caption }),
        });
        const d = await r.json() as { id?: string; error?: { message?: string } };
        if (!d.id) return { platform: 'instagram', success: false, error: d.error?.message ?? 'Container création échouée' };
        containerId = d.id;
      } else {
        return { platform: 'instagram', success: false, error: 'Image ou vidéo requise pour Instagram' };
      }

      const pub = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, creation_id: containerId }),
      });
      const pubData = await pub.json() as { id?: string; error?: { message?: string } };
      if (!pubData.id) return { platform: 'instagram', success: false, error: pubData.error?.message ?? 'Publish failed' };
      return {
        platform: 'instagram',
        success: true,
        postId: pubData.id,
        url: `https://www.instagram.com/p/${pubData.id}`,
      };
    } catch (err) {
      return { platform: 'instagram', success: false, error: String(err) };
    }
  }

  /** Publie sur Facebook */
  async publishFacebook(companyId: string, content: { text: string; videoUrl?: string; imageUrl?: string }): Promise<PublishResult> {
    try {
      const conn = await this.getConnection(companyId, 'facebook');
      if (!conn) return { platform: 'facebook', success: false, error: 'Non connecté' };
      const token = conn.accessToken;
      const pageId = conn.pageId ?? conn.accountId;
      if (!pageId) return { platform: 'facebook', success: false, error: 'Page ID manquant' };

      let endpoint = `https://graph.facebook.com/v22.0/${pageId}/feed`;
      const bodyObj: Record<string, string> = { access_token: token, message: content.text };

      if (content.videoUrl) {
        endpoint = `https://graph.facebook.com/v22.0/${pageId}/videos`;
        bodyObj['file_url'] = content.videoUrl;
        bodyObj['description'] = content.text;
        delete bodyObj['message'];
      } else if (content.imageUrl) {
        endpoint = `https://graph.facebook.com/v22.0/${pageId}/photos`;
        bodyObj['url'] = content.imageUrl;
        bodyObj['caption'] = content.text;
        delete bodyObj['message'];
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyObj).toString(),
      });
      const data = await res.json() as { id?: string; post_id?: string; error?: { message?: string; code?: number } };
      if (!res.ok || data.error) {
        return { platform: 'facebook', success: false, error: data.error?.message ?? `HTTP ${res.status}` };
      }
      const postId = data.post_id ?? data.id;
      if (!postId) return { platform: 'facebook', success: false, error: 'Aucun postId retourné par Meta' };
      return {
        platform: 'facebook',
        success: true,
        postId,
        url: `https://www.facebook.com/${pageId}/posts/${postId.includes('_') ? postId.split('_')[1] : postId}`,
      };
    } catch (err) {
      return { platform: 'facebook', success: false, error: String(err) };
    }
  }

  /**
   * Publie sur TikTok via Content Posting API.
   * Refresh le token automatiquement si expiré. Sandbox = inbox (drafts);
   * pour publier directement, l'app TikTok doit avoir "Direct Post" activé.
   */
  async publishTikTok(companyId: string, content: { text: string; videoUrl?: string; hashtags?: string[] }): Promise<PublishResult> {
    try {
      if (!content.videoUrl) return { platform: 'tiktok', success: false, error: 'Vidéo requise pour TikTok' };

      const conn = await this.getConnection(companyId, 'tiktok');
      if (!conn) return { platform: 'tiktok', success: false, error: 'Non connecté' };

      // Refresh if expired
      let accessToken = conn.accessToken;
      const expiresAt = conn.expiresAt ?? 0;
      const refreshTokenEncrypted = (conn as any).refreshToken as string | undefined;
      if (refreshTokenEncrypted && Date.now() > expiresAt) {
        try {
          const { refreshTiktokToken } = await import('./tiktokPublisher');
          const decryptedRefresh = decrypt(refreshTokenEncrypted);
          const refreshed = await refreshTiktokToken(decryptedRefresh);
          accessToken = refreshed.accessToken;
          await getFirestore().collection('companies').doc(companyId)
            .collection('socialConnections').doc('tiktok')
            .update({
              accessToken: encrypt(refreshed.accessToken),
              refreshToken: encrypt(refreshed.refreshToken),
              expiresAt: refreshed.expiresAt,
            });
        } catch (err) {
          return { platform: 'tiktok', success: false, error: `Token refresh failed: ${String(err)}` };
        }
      }

      const tagsList = (content.hashtags ?? []).filter(Boolean);
      const caption = tagsList.length > 0
        ? `${content.text}\n\n${tagsList.map(h => `#${h}`).join(' ')}`
        : content.text;

      const { uploadVideoToTiktok } = await import('./tiktokPublisher');
      // Try direct publish; if Direct Post permission not approved, the app
      // can fall back by setting `directPublish: false`. We default to direct.
      const directPublish = (process.env['TIKTOK_DIRECT_POST'] ?? 'true').toLowerCase() === 'true';
      const result = await uploadVideoToTiktok({
        accessToken,
        videoUrl: content.videoUrl,
        caption,
        directPublish,
      });

      // SEND_TO_USER_INBOX = inbox/draft mode (user finalizes from TikTok app)
      // PUBLISH_COMPLETE = direct publish succeeded
      const isDraftOnly = result.status === 'SEND_TO_USER_INBOX';
      return {
        platform: 'tiktok',
        success: true,
        postId: result.publishId,
        // No direct URL until TikTok finalizes — we don't have video_id here
        ...(isDraftOnly ? { error: '⚠️ Sauvegardé dans tes brouillons TikTok — finalise depuis l\'app TikTok pour publier.' } : {}),
      };
    } catch (err) {
      return { platform: 'tiktok', success: false, error: String(err) };
    }
  }

  /**
   * Publie une vidéo sur YouTube via resumable upload (Google Data API v3).
   * Refresh le token automatiquement si expiré.
   */
  async publishYouTube(companyId: string, content: { text: string; videoUrl?: string; hashtags?: string[] }): Promise<PublishResult> {
    try {
      if (!content.videoUrl) return { platform: 'youtube', success: false, error: 'Vidéo requise pour YouTube' };

      const conn = await this.getConnection(companyId, 'youtube');
      if (!conn) return { platform: 'youtube', success: false, error: 'Non connecté' };

      // Refresh token if expired
      let accessToken = conn.accessToken;
      const expiresAt = conn.expiresAt ?? 0;
      const refreshToken = (conn as any).refreshToken as string | undefined;
      if (refreshToken && Date.now() > expiresAt) {
        try {
          const { refreshGoogleToken } = await import('./googlePublisher');
          // Decrypt the stored refresh token (saveConnection encrypted it)
          // Note: getConnection already decrypts accessToken. Apply same logic for refresh.
          const decryptedRefresh = decrypt(refreshToken);
          const refreshed = await refreshGoogleToken(decryptedRefresh);
          accessToken = refreshed.accessToken;
          // Persist the new accessToken + expiry
          await getFirestore().collection('companies').doc(companyId)
            .collection('socialConnections').doc('youtube')
            .update({
              accessToken: encrypt(refreshed.accessToken),
              expiresAt: refreshed.expiresAt,
            });
        } catch (err) {
          return { platform: 'youtube', success: false, error: `Token refresh failed: ${String(err)}` };
        }
      }

      const { uploadVideoToYouTube } = await import('./googlePublisher');
      const tagsList = (content.hashtags ?? []).filter(Boolean);
      const description = tagsList.length > 0
        ? `${content.text}\n\n${tagsList.map(h => `#${h}`).join(' ')}`
        : content.text;

      const { videoId } = await uploadVideoToYouTube({
        accessToken,
        videoUrl: content.videoUrl,
        title: content.text,
        description,
        tags: tagsList,
        categoryId: '22',
        privacyStatus: 'public',
      });

      return {
        platform: 'youtube',
        success: true,
        postId: videoId,
        url: `https://youtube.com/watch?v=${videoId}`,
      };
    } catch (err) {
      return { platform: 'youtube', success: false, error: String(err) };
    }
  }

  /** Publie sur Twitter/X */
  async publishTwitter(companyId: string, content: { text: string; imageUrl?: string }): Promise<PublishResult> {
    try {
      const token = await this.getToken(companyId, 'twitter');
      if (!token) return { platform: 'twitter', success: false, error: 'Non connecte' };

      const tweetText = content.text.slice(0, 280);
      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tweetText }),
      });
      const data = await res.json() as { data?: { id?: string } };
      const tweetId = data.data?.id;
      return { platform: 'twitter', success: !!tweetId, postId: tweetId, url: `https://x.com/i/status/${tweetId}` };
    } catch (err) {
      return { platform: 'twitter', success: false, error: String(err) };
    }
  }

  /** Publie sur toutes les plateformes spécifiées */
  async publishToAll(
    companyId: string,
    platforms: SocialPlatform[],
    content: { text: string; videoUrl?: string; imageUrl?: string; hashtags?: string[] },
  ): Promise<PublishResult[]> {
    const results = await Promise.allSettled(
      platforms.map(p => {
        switch (p) {
          case 'linkedin':  return this.publishLinkedIn(companyId, content);
          case 'instagram': return this.publishInstagram(companyId, content);
          case 'facebook':  return this.publishFacebook(companyId, content);
          case 'tiktok':    return this.publishTikTok(companyId, content);
          case 'youtube':   return this.publishYouTube(companyId, content);
          case 'twitter':   return this.publishTwitter(companyId, content);
          default:          return Promise.resolve({ platform: p, success: false, error: 'Plateforme non supportée' } as PublishResult);
        }
      })
    );
    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { platform: platforms[i], success: false, error: 'Erreur interne' }
    );
  }
}

export const socialPublishService = new SocialPublishService();

// ─────────────────────────────────────────────────────────────────────────────
// Meta OAuth helper — exchange a Facebook OAuth code for long-lived per-Page
// tokens. Used by the GET /api/social/meta/callback handler so users can
// 1-click connect their Facebook Page + Instagram Business via Embedded Login
// instead of pasting access tokens manually.
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH = 'https://graph.facebook.com/v22.0';

export async function exchangeMetaCodeForPageTokens(
  code: string,
  redirectUri: string,
): Promise<Array<{
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igBusinessId?: string;
  igUsername?: string;
}>> {
  const META_APP_ID = process.env['META_APP_ID']
    ?? process.env['WHATSAPP_APP_ID']
    ?? process.env['VITE_META_APP_ID']
    ?? '';
  const META_APP_SECRET = process.env['META_APP_SECRET']
    ?? process.env['WHATSAPP_APP_SECRET']
    ?? '';
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID / META_APP_SECRET not configured');
  }

  const tokenUrl = `${GRAPH}/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
  const tokenRes = await fetch(tokenUrl);
  const tokenJson = await tokenRes.json() as { access_token?: string; error?: { message: string } };
  if (!tokenRes.ok || tokenJson.error || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message ?? 'Token exchange failed');
  }

  // Long-lived token (60 days) — preferred for server-side use.
  const longUrl = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenJson.access_token}`;
  const longRes = await fetch(longUrl);
  const longJson = await longRes.json() as { access_token?: string };
  const userToken = longJson.access_token ?? tokenJson.access_token;

  // Per-Page tokens — these never expire when issued from a long-lived user token.
  const pagesUrl = `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`;
  const pagesRes = await fetch(pagesUrl);
  const pagesJson = await pagesRes.json() as {
    data?: Array<{
      id: string; name: string; access_token: string;
      instagram_business_account?: { id: string; username: string };
    }>;
    error?: { message: string };
  };
  if (!pagesRes.ok || pagesJson.error || !pagesJson.data) {
    throw new Error(pagesJson.error?.message ?? 'Could not fetch pages');
  }

  return pagesJson.data.map(p => ({
    pageId: p.id,
    pageName: p.name,
    pageAccessToken: p.access_token,
    igBusinessId: p.instagram_business_account?.id,
    igUsername: p.instagram_business_account?.username,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling — drafts/scheduled posts live at companies/{cid}/socialPosts/{id}.
// processScheduledPostsCron() runs every minute via the existing cron-tick.
// ─────────────────────────────────────────────────────────────────────────────

export async function processScheduledPostsCron(): Promise<{ processed: number; published: number; errors: number }> {
  const stats = { processed: 0, published: 0, errors: 0 };
  const db = getFirestore();
  try {
    const companiesSnap = await db.collection('companies').limit(500).get();
    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      const dueSnap = await db.collection(`companies/${companyId}/socialPosts`)
        .where('status', '==', 'scheduled')
        .where('scheduledAt', '<=', new Date())
        .limit(50).get().catch(() => null);
      if (!dueSnap || dueSnap.empty) continue;

      for (const postDoc of dueSnap.docs) {
        stats.processed++;
        const data = postDoc.data() as { text: string; mediaUrl?: string; mediaType?: 'image' | 'video'; hashtags?: string[]; platforms: SocialPlatform[] };
        try {
          await postDoc.ref.update({ status: 'publishing', updatedAt: new Date() });
          const results = await socialPublishService.publishToAll(companyId, data.platforms, {
            text: data.text,
            imageUrl: data.mediaType === 'image' ? data.mediaUrl : undefined,
            videoUrl: data.mediaType === 'video' ? data.mediaUrl : undefined,
            hashtags: data.hashtags,
          });
          const allFailed = results.every(r => !r.success);
          // Strip undefined fields so Firestore accepts the write.
          const cleanResults = results.map(r => {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(r)) {
              if (v !== undefined) out[k] = v;
            }
            return out;
          });
          await postDoc.ref.update({
            status: allFailed ? 'failed' : 'published',
            results: cleanResults,
            publishedAt: new Date(),
            updatedAt: new Date(),
          });
          if (!allFailed) stats.published++; else stats.errors++;
        } catch (err) {
          stats.errors++;
          logger.error('[Social/Cron] publish failed', { companyId, postId: postDoc.id, error: String(err) });
          await postDoc.ref.update({ status: 'failed', error: String(err), updatedAt: new Date() }).catch(() => null);
        }
      }
    }
  } catch (err) {
    logger.error('[Social/Cron] sweep failed', { error: String(err) });
  }
  return stats;
}
