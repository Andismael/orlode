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
const videoGenerationService_1 = require("../services/video/videoGenerationService");
const error_middleware_1 = require("../middleware/error.middleware");
const firebase_config_1 = require("../config/firebase.config");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// POST /api/video/estimate — estimer le coût avant génération
router.post('/estimate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { quality, duration, platforms } = req.body;
    if (!quality || !duration || !platforms?.length)
        throw new error_middleware_1.AppError('quality, duration, platforms required', 400);
    const cost = videoGenerationService_1.videoGenerationService.estimateCost(quality, duration, platforms);
    res.json({ success: true, data: { estimatedCost: parseFloat(cost.toFixed(2)), currency: 'USD' } });
}));
// POST /api/video/generate — générer des vidéos (nécessite approbation avant publication)
router.post('/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { script, quality = 'standard', platforms, duration = 15, language = 'fr', inputImageUrl } = req.body;
    if (!script || !platforms?.length)
        throw new error_middleware_1.AppError('script and platforms required', 400);
    const videos = await videoGenerationService_1.videoGenerationService.generateForPlatforms({ script, quality, platforms, duration, language, inputImageUrl, companyId });
    // Sauvegarder comme brouillons en attente d'approbation
    const db = (0, firebase_config_1.getFirestore)();
    const saved = await Promise.all(videos.map(async (v) => {
        const ref = db.collection(`companies/${companyId}/marketingContent`).doc();
        await ref.set({ ...v, createdBy: req.user?.uid, createdAt: new Date(), updatedAt: new Date() }).catch(() => { });
        return { id: ref.id, ...v };
    }));
    const totalCost = videos.reduce((s, v) => s + v.cost, 0);
    res.json({
        success: true,
        data: { videos: saved, totalCost: parseFloat(totalCost.toFixed(2)), status: 'pending_approval' },
    });
}));
// GET /api/video/drafts — vidéos en attente d'approbation
router.get('/drafts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/marketingContent`)
            .where('status', '==', 'pending_approval')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// PATCH /api/video/drafts/:id/approve — approuver une vidéo
router.patch('/drafts/:id/approve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/marketingContent`).doc(req.params['id'])
        .update({ status: 'approved', approvedBy: req.user?.uid, approvedAt: new Date() })
        .catch(() => { });
    res.json({ success: true });
}));
// PATCH /api/video/drafts/:id/reject — rejeter une vidéo
router.patch('/drafts/:id/reject', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/marketingContent`).doc(req.params['id'])
        .update({ status: 'rejected', rejectedBy: req.user?.uid, rejectedAt: new Date() })
        .catch(() => { });
    res.json({ success: true });
}));
// GET /api/video/history — all videos (any status)
router.get('/history', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let q = db.collection(`companies/${companyId}/marketingContent`);
        if (req.query['status'])
            q = q.where('status', '==', req.query['status']);
        const snap = await q.limit(100).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// DELETE /api/video/drafts/:id
router.delete('/drafts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/marketingContent`).doc(req.params['id']).delete().catch(() => { });
    res.json({ success: true });
}));
// GET /api/video/stats
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/marketingContent`).limit(500).get();
        const all = snap.docs.map(d => d.data());
        const totalCost = all.reduce((s, v) => s + (v['cost'] ?? 0), 0);
        res.json({
            success: true,
            data: {
                total: all.length,
                pending: all.filter(v => v['status'] === 'pending_approval').length,
                approved: all.filter(v => v['status'] === 'approved').length,
                rejected: all.filter(v => v['status'] === 'rejected').length,
                totalCost: parseFloat(totalCost.toFixed(2)),
                platforms: [...new Set(all.map(v => v['platform']).filter(Boolean))],
            },
        });
    }
    catch {
        res.json({ success: true, data: { total: 0, pending: 0, approved: 0, rejected: 0, totalCost: 0, platforms: [] } });
    }
}));
// POST /api/video/drafts/:id/publish — publish approved video to social platforms
router.post('/drafts/:id/publish', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/marketingContent`).doc(req.params['id']).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Video not found', 404);
    const video = doc.data();
    if (video['status'] !== 'approved')
        throw new error_middleware_1.AppError('Video must be approved before publishing', 400);
    const { platforms, caption, hashtags } = req.body;
    const targetPlatforms = platforms ?? [video['platform']];
    const videoUrl = video['videoUrl'];
    if (!videoUrl)
        throw new error_middleware_1.AppError('No video URL available', 400);
    // Mark as publishing
    await doc.ref.update({ status: 'publishing', publishStartedAt: new Date() });
    // Publish to each platform via social service
    const results = {};
    try {
        const { socialPublishService } = await Promise.resolve().then(() => __importStar(require('../services/social/socialPublishService')));
        for (const platform of targetPlatforms) {
            try {
                // Get connector config for this platform
                const connectorDoc = await db.collection(`companies/${companyId}/connectors`).doc(platform).get();
                const connectorData = connectorDoc.data();
                if (!connectorData?.['accessToken']) {
                    results[platform] = 'not_connected';
                    continue;
                }
                // Prepare post content
                const postCaption = caption ?? video['script'] ?? '';
                const postHashtags = hashtags ?? '';
                const fullCaption = `${postCaption}\n\n${postHashtags}`.trim();
                // Use social publish service
                await socialPublishService.publishToAll(companyId, [platform], { text: fullCaption, videoUrl });
                results[platform] = 'published';
            }
            catch (err) {
                results[platform] = `error: ${err.message}`;
            }
        }
    }
    catch (err) {
        await doc.ref.update({ status: 'approved', publishError: err.message });
        throw new error_middleware_1.AppError('Publishing failed', 500);
    }
    // Update status
    const allPublished = Object.values(results).every(r => r === 'published');
    await doc.ref.update({
        status: allPublished ? 'published' : 'partially_published',
        publishedAt: new Date(),
        publishedBy: req.user?.uid,
        publishResults: results,
        publishCaption: caption,
        publishHashtags: hashtags,
    });
    res.json({ success: true, data: { results } });
}));
exports.default = router;
//# sourceMappingURL=video.routes.js.map