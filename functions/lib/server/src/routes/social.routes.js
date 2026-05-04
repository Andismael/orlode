"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminOnly_middleware_1 = require("../middleware/adminOnly.middleware");
const socialPublishService_1 = require("../services/social/socialPublishService");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
// ── Routes publiques GDPR Meta (pas d'auth) ──────────────────────────────────
// POST /api/social/deauth/facebook — Meta appelle cette URL quand un user révoque l'accès
router.post('/deauth/facebook', (_req, res) => {
    // Meta envoie un signed_request — on accuse réception
    res.status(200).json({ success: true });
});
// POST /api/social/deletion/facebook — Meta appelle pour demander suppression des données
router.post('/deletion/facebook', (_req, res) => {
    // Retourne une confirmation avec URL de statut (obligatoire par Meta)
    const confirmationCode = `del_${Date.now()}`;
    res.status(200).json({
        url: `https://api-15262322885.us-central1.run.app/api/social/deletion/status/${confirmationCode}`,
        confirmation_code: confirmationCode,
    });
});
// GET /api/social/deletion/status/:code — page de statut de suppression
router.get('/deletion/status/:code', (req, res) => {
    res.status(200).json({ status: 'deleted', code: req.params['code'] });
});
router.use(auth_middleware_1.authMiddleware);
router.use(adminOnly_middleware_1.adminOnlyMiddleware);
// GET /api/social/connections — liste des connexions actives
router.get('/connections', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const connections = await socialPublishService_1.socialPublishService.getConnections(companyId);
    res.json({ success: true, data: connections });
}));
// POST /api/social/connect — connecter une plateforme (OAuth callback)
router.post('/connect', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { platform, accessToken, refreshToken, expiresAt, accountName, accountId, pageId, orgId } = req.body;
    if (!platform || !accessToken)
        throw new error_middleware_1.AppError('platform and accessToken required', 400);
    await socialPublishService_1.socialPublishService.saveConnection(companyId, {
        platform, accessToken, refreshToken, expiresAt, accountName, accountId, pageId, orgId,
    });
    res.json({ success: true, message: `${platform} connecté` });
}));
// DELETE /api/social/disconnect/:platform
router.delete('/disconnect/:platform', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { platform } = req.params;
    await socialPublishService_1.socialPublishService.disconnect(companyId, platform);
    res.json({ success: true, message: `${platform} déconnecté` });
}));
// POST /api/social/publish — publier du contenu
router.post('/publish', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { platforms, text, videoUrl, imageUrl, hashtags } = req.body;
    if (!platforms?.length || !text)
        throw new error_middleware_1.AppError('platforms and text required', 400);
    const results = await socialPublishService_1.socialPublishService.publishToAll(companyId, platforms, { text, videoUrl, imageUrl, hashtags });
    res.json({ success: true, data: results });
}));
// POST /api/social/publish-post/:postId — publish a marketing post to connected platforms
router.post('/publish-post/:postId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { getFirestore: getDb } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const db = getDb();
    // Get the post
    const postDoc = await db.collection('marketingPosts').doc(req.params['postId']).get();
    if (!postDoc.exists)
        throw new error_middleware_1.AppError('Post not found', 404);
    const post = postDoc.data();
    const platform = (post['platform'] ?? '').toLowerCase();
    const text = post['text'] ?? '';
    if (!text)
        throw new error_middleware_1.AppError('Post has no text', 400);
    // Check if platform is connected
    const connections = await socialPublishService_1.socialPublishService.getConnections(companyId);
    const isConnected = connections.some(c => c.platform === platform);
    if (!isConnected) {
        return res.json({
            success: false,
            data: { platform, connected: false, message: `${platform} n'est pas connecte. Connectez-le dans Admin > Reseaux sociaux.` },
        });
    }
    // Publish
    const results = await socialPublishService_1.socialPublishService.publishToAll(companyId, [platform], { text });
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
router.get('/platforms', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const connections = await socialPublishService_1.socialPublishService.getConnections(companyId);
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
exports.default = router;
//# sourceMappingURL=social.routes.js.map