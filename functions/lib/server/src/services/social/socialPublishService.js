"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialPublishService = exports.SocialPublishService = void 0;
/**
 * Social Publishing Service
 * Publie du contenu sur LinkedIn, Instagram, Facebook, TikTok, YouTube.
 * Chaque client stocke ses tokens OAuth dans SON Firebase (chiffré).
 */
const crypto_1 = require("crypto");
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
const ENCRYPTION_KEY = process.env['SOCIAL_ENCRYPTION_KEY'] ?? 'corpmind-social-key-32byteslong!!';
function encrypt(text) {
    const iv = (0, crypto_1.randomBytes)(16);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
    return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
function decrypt(encrypted) {
    try {
        const [ivHex, data] = encrypted.split(':');
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', Buffer.from(ivHex, 'hex'), key);
        return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
    }
    catch {
        return encrypted;
    }
}
class SocialPublishService {
    /** Sauvegarde une connexion OAuth */
    async saveConnection(companyId, conn) {
        await (0, firebase_config_1.getFirestore)()
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
    async getConnections(companyId) {
        try {
            const snap = await (0, firebase_config_1.getFirestore)()
                .collection('companies').doc(companyId)
                .collection('socialConnections')
                .get();
            return snap.docs.map(d => {
                const data = d.data();
                const { accessToken: _a, refreshToken: _r, ...safe } = data;
                return safe;
            });
        }
        catch {
            return [];
        }
    }
    /** Déconnecte une plateforme */
    async disconnect(companyId, platform) {
        await (0, firebase_config_1.getFirestore)()
            .collection('companies').doc(companyId)
            .collection('socialConnections').doc(platform)
            .delete();
    }
    /** Récupère le token déchiffré */
    async getToken(companyId, platform) {
        try {
            const doc = await (0, firebase_config_1.getFirestore)()
                .collection('companies').doc(companyId)
                .collection('socialConnections').doc(platform)
                .get();
            if (!doc.exists)
                return null;
            const data = doc.data();
            return decrypt(data.accessToken);
        }
        catch {
            return null;
        }
    }
    async getConnection(companyId, platform) {
        try {
            const doc = await (0, firebase_config_1.getFirestore)()
                .collection('companies').doc(companyId)
                .collection('socialConnections').doc(platform)
                .get();
            if (!doc.exists)
                return null;
            const data = doc.data();
            return { ...data, accessToken: decrypt(data.accessToken) };
        }
        catch {
            return null;
        }
    }
    /** Publie sur LinkedIn */
    async publishLinkedIn(companyId, content) {
        try {
            const conn = await this.getConnection(companyId, 'linkedin');
            if (!conn)
                return { platform: 'linkedin', success: false, error: 'Non connecté' };
            const token = conn.accessToken;
            const orgId = conn.orgId ?? conn.accountId;
            if (!orgId)
                return { platform: 'linkedin', success: false, error: 'Organization ID manquant' };
            const body = {
                author: `urn:li:organization:${orgId}`,
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
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            return { platform: 'linkedin', success: !!data.id, postId: data.id, url: `https://linkedin.com/feed/update/${data.id}` };
        }
        catch (err) {
            logger_1.logger.error('[Social] LinkedIn publish failed', { error: err });
            return { platform: 'linkedin', success: false, error: String(err) };
        }
    }
    /** Publie sur Instagram (via Meta Graph API) */
    async publishInstagram(companyId, content) {
        try {
            const conn = await this.getConnection(companyId, 'instagram');
            if (!conn)
                return { platform: 'instagram', success: false, error: 'Non connecté' };
            const token = conn.accessToken;
            const igUserId = conn.accountId;
            if (!igUserId)
                return { platform: 'instagram', success: false, error: 'Instagram Account ID manquant' };
            const caption = `${content.text}\n\n${(content.hashtags ?? []).map(h => `#${h}`).join(' ')}`.trim();
            let containerId;
            if (content.videoUrl) {
                const r = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: token, media_type: 'REELS', video_url: content.videoUrl, caption }),
                });
                const d = await r.json();
                if (!d.id)
                    return { platform: 'instagram', success: false, error: 'Container création échouée' };
                containerId = d.id;
            }
            else if (content.imageUrl) {
                const r = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: token, image_url: content.imageUrl, caption }),
                });
                const d = await r.json();
                if (!d.id)
                    return { platform: 'instagram', success: false, error: 'Container création échouée' };
                containerId = d.id;
            }
            else {
                return { platform: 'instagram', success: false, error: 'Image ou vidéo requise pour Instagram' };
            }
            const pub = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: token, creation_id: containerId }),
            });
            const pubData = await pub.json();
            return { platform: 'instagram', success: !!pubData.id, postId: pubData.id };
        }
        catch (err) {
            return { platform: 'instagram', success: false, error: String(err) };
        }
    }
    /** Publie sur Facebook */
    async publishFacebook(companyId, content) {
        try {
            const conn = await this.getConnection(companyId, 'facebook');
            if (!conn)
                return { platform: 'facebook', success: false, error: 'Non connecté' };
            const token = conn.accessToken;
            const pageId = conn.pageId ?? conn.accountId;
            if (!pageId)
                return { platform: 'facebook', success: false, error: 'Page ID manquant' };
            let endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
            const bodyObj = { access_token: token, message: content.text };
            if (content.videoUrl) {
                endpoint = `https://graph.facebook.com/v21.0/${pageId}/videos`;
                bodyObj['file_url'] = content.videoUrl;
                bodyObj['description'] = content.text;
                delete bodyObj['message'];
            }
            else if (content.imageUrl) {
                endpoint = `https://graph.facebook.com/v21.0/${pageId}/photos`;
                bodyObj['url'] = content.imageUrl;
                bodyObj['caption'] = content.text;
                delete bodyObj['message'];
            }
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj),
            });
            const data = await res.json();
            return { platform: 'facebook', success: !!data.id, postId: data.id };
        }
        catch (err) {
            return { platform: 'facebook', success: false, error: String(err) };
        }
    }
    /** Publie sur TikTok */
    async publishTikTok(companyId, content) {
        try {
            const token = await this.getToken(companyId, 'tiktok');
            if (!token)
                return { platform: 'tiktok', success: false, error: 'Non connecté' };
            if (!content.videoUrl)
                return { platform: 'tiktok', success: false, error: 'Vidéo requise pour TikTok' };
            const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_info: { title: content.text.slice(0, 150), privacy_level: 'PUBLIC_TO_EVERYONE' },
                    source_info: { source: 'PULL_FROM_URL', video_url: content.videoUrl },
                }),
            });
            const data = await res.json();
            const publishId = data.data?.publish_id;
            return { platform: 'tiktok', success: !!publishId, postId: publishId };
        }
        catch (err) {
            return { platform: 'tiktok', success: false, error: String(err) };
        }
    }
    /** Publie sur YouTube */
    async publishYouTube(companyId, content) {
        try {
            const token = await this.getToken(companyId, 'youtube');
            if (!token)
                return { platform: 'youtube', success: false, error: 'Non connecté' };
            if (!content.videoUrl)
                return { platform: 'youtube', success: false, error: 'Vidéo requise pour YouTube' };
            const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    snippet: {
                        title: content.text.slice(0, 100),
                        description: `${content.text}\n\n${(content.hashtags ?? []).map(h => `#${h}`).join(' ')}`,
                        categoryId: '22',
                    },
                    status: { privacyStatus: 'public' },
                }),
            });
            const data = await res.json();
            return { platform: 'youtube', success: !!data.id, postId: data.id, url: `https://youtube.com/watch?v=${data.id}` };
        }
        catch (err) {
            return { platform: 'youtube', success: false, error: String(err) };
        }
    }
    /** Publie sur Twitter/X */
    async publishTwitter(companyId, content) {
        try {
            const token = await this.getToken(companyId, 'twitter');
            if (!token)
                return { platform: 'twitter', success: false, error: 'Non connecte' };
            const tweetText = content.text.slice(0, 280);
            const res = await fetch('https://api.twitter.com/2/tweets', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: tweetText }),
            });
            const data = await res.json();
            const tweetId = data.data?.id;
            return { platform: 'twitter', success: !!tweetId, postId: tweetId, url: `https://x.com/i/status/${tweetId}` };
        }
        catch (err) {
            return { platform: 'twitter', success: false, error: String(err) };
        }
    }
    /** Publie sur toutes les plateformes spécifiées */
    async publishToAll(companyId, platforms, content) {
        const results = await Promise.allSettled(platforms.map(p => {
            switch (p) {
                case 'linkedin': return this.publishLinkedIn(companyId, content);
                case 'instagram': return this.publishInstagram(companyId, content);
                case 'facebook': return this.publishFacebook(companyId, content);
                case 'tiktok': return this.publishTikTok(companyId, content);
                case 'youtube': return this.publishYouTube(companyId, content);
                case 'twitter': return this.publishTwitter(companyId, content);
                default: return Promise.resolve({ platform: p, success: false, error: 'Plateforme non supportée' });
            }
        }));
        return results.map((r, i) => r.status === 'fulfilled' ? r.value : { platform: platforms[i], success: false, error: 'Erreur interne' });
    }
}
exports.SocialPublishService = SocialPublishService;
exports.socialPublishService = new SocialPublishService();
//# sourceMappingURL=socialPublishService.js.map