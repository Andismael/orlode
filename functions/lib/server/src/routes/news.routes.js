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
/**
 * News Routes PRO — Articles, Briefings, Competitors, Alerts, Bookmarks, Trending, Digest
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const safe = async (fn, fallback) => { try {
    return await fn();
}
catch {
    return fallback;
} };
// ═══════════════════════════════════════════════════════════════════════════════
// ARTICLES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/articles', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsArticles`);
    if (req.query['category'])
        q = q.where('category', '==', req.query['category']);
    if (req.query['importance'])
        q = q.where('importance', '==', req.query['importance']);
    const snap = await q.orderBy('savedAt', 'desc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// BRIEFINGS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/briefings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsBriefings`).orderBy('createdAt', 'desc').limit(20).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.get('/briefings/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsBriefings`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Briefing not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));
// Trigger new briefing via agent
router.post('/briefings/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { newsAgentFlow } = await Promise.resolve().then(() => __importStar(require('../agents/news.agent')));
        const topics = req.body['topics'] ?? ['breaking news', 'business', 'technology'];
        const result = await newsAgentFlow({ request: `Generate a news briefing. Topics: ${topics.join(', ')}`, companyId: cid, language: 'fr' });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Generation echouee' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITORS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/competitors', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/competitors`).limit(20).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/competitors', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const comp = { id, name: body['name'] ?? '', website: body['website'] ?? '', sector: body['sector'] ?? '', notes: body['notes'] ?? '', addedAt: new Date(), addedBy: req.user.uid };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/competitors`).doc(id).set(comp);
    res.status(201).json({ success: true, data: comp });
}));
router.delete('/competitors/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/competitors`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// Analyze competitor via agent
router.post('/competitors/:id/analyze', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/competitors`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Competitor not found', 404);
    const name = doc.data()['name'] ?? '';
    try {
        const { trackCompetitorTool } = await Promise.resolve().then(() => __importStar(require('../agents/news.agent')));
        const result = await trackCompetitorTool({ companyId: cid, action: 'analyze', competitorName: name, sector: doc.data()['sector'] });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Analyse echouee' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/alerts/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/settings`).doc('newsConfig').get();
    res.json({ success: true, data: doc.exists ? doc.data() : { keywords: [], schedule: ['07:00', '12:00', '18:00'], categories: ['business', 'technology'], notifyChannels: ['in_app'], enabled: false } });
}));
router.post('/alerts/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/settings`).doc('newsConfig').set({ ...req.body, updatedAt: new Date() }, { merge: true });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/bookmarks', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsBookmarks`).orderBy('savedAt', 'desc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/bookmarks', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsBookmarks`).doc(id).set({
        id, title: body['title'] ?? '', summary: body['summary'] ?? '', source: body['source'] ?? '',
        url: body['url'] ?? null, notes: body['notes'] ?? '', userId: req.user.uid, savedAt: new Date(),
    });
    res.status(201).json({ success: true, data: { id } });
}));
router.delete('/bookmarks/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsBookmarks`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// TRENDING
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/trending', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { getTrendingTool } = await Promise.resolve().then(() => __importStar(require('../agents/news.agent')));
        const result = await getTrendingTool({ companyId: cid, sector: req.query['sector'], language: 'fr' });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { trending: [] } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// SENTIMENT
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/sentiment', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const topic = req.query['topic'] ?? 'business';
    try {
        const { analyzeSentimentTool } = await Promise.resolve().then(() => __importStar(require('../agents/news.agent')));
        const result = await analyzeSentimentTool({ companyId: cid, topic, language: 'fr' });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { topic, overallSentiment: 'neutral', score: 0.5 } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// DIGEST
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/digest/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { generateDigestTool } = await Promise.resolve().then(() => __importStar(require('../agents/news.agent')));
        const result = await generateDigestTool({
            companyId: cid, period: req.body['period'] ?? 'daily', language: 'fr',
        });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Generation echouee' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const [artSnap, briefSnap, compSnap, bookSnap, configDoc] = await Promise.all([
        db.collection(`companies/${cid}/newsArticles`).limit(500).get(),
        db.collection(`companies/${cid}/newsBriefings`).limit(50).get(),
        db.collection(`companies/${cid}/competitors`).limit(20).get(),
        db.collection(`companies/${cid}/newsBookmarks`).limit(100).get(),
        db.collection(`companies/${cid}/settings`).doc('newsConfig').get(),
    ]);
    const articles = artSnap.docs.map(d => d.data());
    const categories = {};
    const sentiments = {};
    articles.forEach(a => {
        const c = a['category'] ?? 'other';
        categories[c] = (categories[c] ?? 0) + 1;
        const s = a['sentiment'] ?? 'neutral';
        sentiments[s] = (sentiments[s] ?? 0) + 1;
    });
    res.json({ success: true, data: {
            totalArticles: artSnap.size, totalBriefings: briefSnap.size,
            competitors: compSnap.size, bookmarks: bookSnap.size,
            alertsEnabled: configDoc.data()?.['enabled'] ?? false,
            alertKeywords: configDoc.data()?.['keywords'] ?? [],
            byCategory: Object.entries(categories).map(([k, v]) => ({ category: k, count: v })).sort((a, b) => b.count - a.count),
            bySentiment: sentiments,
        } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE (correlation + smart alerts + auto-actions)
// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/news/intelligence/run — run full pipeline
router.post('/intelligence/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { runFullIntelligencePipeline } = await Promise.resolve().then(() => __importStar(require('../services/newsIntelligence')));
        const result = await runFullIntelligencePipeline(cid);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.json({ success: true, data: { insights: [], alerts: [], actions: [], error: String(err) } });
    }
}));
// GET /api/news/insights — correlation insights
router.get('/insights', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsInsights`).orderBy('createdAt', 'desc').limit(20).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// GET /api/news/alerts — smart alerts
router.get('/alerts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsAlerts`).orderBy('createdAt', 'desc').limit(20).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// GET /api/news/auto-actions — history of automatic actions
router.get('/auto-actions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/newsAutoActions`).orderBy('executedAt', 'desc').limit(20).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
exports.default = router;
//# sourceMappingURL=news.routes.js.map