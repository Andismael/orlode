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
 * Marketing Routes PRO — Posts · Campaigns · Calendar · Content · Stats
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const agentRbac_middleware_1 = require("../middleware/agentRbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.use((0, agentRbac_middleware_1.requireAgentRole)('marketing'));
const safe = async (fn, fallback) => {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
};
function serializeDoc(data) {
    const out = {};
    for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object' && '_seconds' in val) {
            out[key] = new Date(val._seconds * 1000).toISOString();
        }
        else if (val && typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
            out[key] = (val.toDate()).toISOString();
        }
        else if (Array.isArray(val)) {
            out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item) : item);
        }
        else {
            out[key] = val;
        }
    }
    return out;
}
function serializeSnap(doc) { return { id: doc.id, ...serializeDoc(doc.data()) }; }
// ═══════════════════════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/posts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`);
        if (req.query['status'] && req.query['status'] !== 'all')
            q = q.where('status', '==', req.query['status']);
        if (req.query['platform'])
            q = q.where('platform', '==', req.query['platform']);
        return (await q.limit(100).get()).docs.map(serializeSnap);
    }, []);
    res.json({ success: true, data });
}));
router.post('/posts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const post = {
        id, companyId: cid, platform: body['platform'] ?? 'linkedin',
        text: body['text'] ?? '', topic: body['topic'] ?? '', tone: body['tone'] ?? 'professional',
        hashtags: Array.isArray(body['hashtags']) ? body['hashtags'] : [],
        status: body['status'] ?? 'draft', scheduledAt: body['scheduledAt'] ?? null,
        campaignId: body['campaignId'] ?? null, type: 'social_post',
        createdBy: req.user.uid, createdAt: new Date(), updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).doc(id).set(post);
    res.status(201).json({ success: true, data: post });
}));
router.patch('/posts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).doc(req.params.id)
        .update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
}));
router.delete('/posts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// AI generate
router.post('/posts/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { topic, platform, tone, includeVariant } = req.body;
    if (!topic)
        throw new error_middleware_1.AppError('topic required', 400);
    try {
        const { marketingAgentFlow } = await Promise.resolve().then(() => __importStar(require('../agents/marketing.agent')));
        const prompt = `Generate a ${tone ?? 'professional'} post for ${platform ?? 'LinkedIn'} about "${topic}".${includeVariant ? ' Include an A/B variant.' : ''}`;
        const result = await marketingAgentFlow({ request: prompt, companyId: cid, language: 'fr' });
        res.json({ success: true, data: { text: result.response } });
    }
    catch {
        res.json({ success: true, data: { text: `Post sur "${topic}" — generez manuellement.` } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/campaigns', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/campaigns`);
        if (req.query['status'])
            q = q.where('status', '==', req.query['status']);
        return (await q.limit(50).get()).docs.map(serializeSnap);
    }, []);
    res.json({ success: true, data });
}));
router.post('/campaigns', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const campaign = {
        id, companyId: cid, name: body['name'] ?? '', objective: body['objective'] ?? '',
        platforms: Array.isArray(body['platforms']) ? body['platforms'] : [],
        budget: body['budget'] ?? 0, startDate: body['startDate'] ?? '', endDate: body['endDate'] ?? '',
        status: 'planning', postsCount: 0,
        metrics: { impressions: 0, clicks: 0, conversions: 0, engagement: 0 },
        createdBy: req.user.uid, createdAt: new Date(), updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/campaigns`).doc(id).set(campaign);
    res.status(201).json({ success: true, data: campaign });
}));
router.patch('/campaigns/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/campaigns`).doc(req.params.id)
        .update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
}));
router.delete('/campaigns/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/campaigns`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// INFLUENCERS — minimal CRM (V1). DM tracking + status pipeline.
// Persisted at companies/{cid}/influencers/{id}.
// ═══════════════════════════════════════════════════════════════════════════════
const INFLUENCER_STATUSES = ['prospect', 'contacted', 'replied', 'active', 'lost'];
router.get('/influencers', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/influencers`);
        if (req.query['status'])
            q = q.where('status', '==', req.query['status']);
        return (await q.limit(500).get()).docs.map(serializeSnap);
    }, []);
    res.json({ success: true, data });
}));
router.post('/influencers', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const b = req.body;
    const name = String(b['name'] ?? '').trim();
    if (!name)
        throw new error_middleware_1.AppError('name required', 400);
    const id = (0, helpers_1.generateId)();
    const doc = {
        id, companyId: cid,
        name,
        handle: String(b['handle'] ?? '').trim(),
        platform: String(b['platform'] ?? 'instagram').trim().toLowerCase(),
        followers: Number(b['followers'] ?? 0) || 0,
        engagement: Number(b['engagement'] ?? 0) || 0,
        niche: String(b['niche'] ?? '').trim(),
        email: String(b['email'] ?? '').trim(),
        phone: String(b['phone'] ?? '').trim(),
        status: INFLUENCER_STATUSES.includes(String(b['status'])) ? String(b['status']) : 'prospect',
        notes: String(b['notes'] ?? '').trim(),
        dmSentAt: null,
        dmRepliedAt: null,
        createdBy: req.user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/influencers`).doc(id).set(doc);
    res.status(201).json({ success: true, data: doc });
}));
router.post('/influencers/import', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0)
        throw new error_middleware_1.AppError('rows[] required', 400);
    if (rows.length > 500)
        throw new error_middleware_1.AppError('Max 500 influencers per import', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const batch = db.batch();
    const col = db.collection(`companies/${cid}/influencers`);
    let imported = 0;
    for (const r of rows) {
        const name = String(r?.name ?? '').trim();
        if (!name)
            continue;
        const id = (0, helpers_1.generateId)();
        batch.set(col.doc(id), {
            id, companyId: cid,
            name,
            handle: String(r?.handle ?? '').trim(),
            platform: String(r?.platform ?? 'instagram').trim().toLowerCase(),
            followers: Number(r?.followers ?? 0) || 0,
            engagement: Number(r?.engagement ?? 0) || 0,
            niche: String(r?.niche ?? '').trim(),
            email: String(r?.email ?? '').trim(),
            phone: String(r?.phone ?? '').trim(),
            status: 'prospect',
            notes: String(r?.notes ?? '').trim(),
            dmSentAt: null,
            dmRepliedAt: null,
            createdBy: req.user.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        imported++;
    }
    await batch.commit();
    res.json({ success: true, data: { imported } });
}));
router.patch('/influencers/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const patch = { ...req.body, updatedAt: new Date() };
    // Stamp dmSentAt / dmRepliedAt when status transitions through the pipeline.
    if (patch['status'] === 'contacted' && !patch['dmSentAt'])
        patch['dmSentAt'] = new Date();
    if (patch['status'] === 'replied' && !patch['dmRepliedAt'])
        patch['dmRepliedAt'] = new Date();
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/influencers`).doc(req.params.id).update(patch);
    res.json({ success: true });
}));
router.delete('/influencers/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/influencers`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/calendar', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { month, year } = req.query;
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).limit(200).get();
        const all = snap.docs.map(serializeSnap);
        let posts = all.filter(p => p.scheduledAt);
        if (month && year) {
            const m = parseInt(month), y = parseInt(year);
            posts = posts.filter(p => { const d = new Date(p.scheduledAt); return d.getMonth() + 1 === m && d.getFullYear() === y; });
        }
        posts.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
        return posts;
    }, []);
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT (articles, newsletters)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/content', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingContent`);
        if (req.query['type'])
            q = q.where('type', '==', req.query['type']);
        return (await q.limit(100).get()).docs.map(serializeSnap);
    }, []);
    res.json({ success: true, data });
}));
router.post('/content', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const content = {
        id, companyId: cid, type: body['type'] ?? 'blog', title: body['title'] ?? '', content: body['content'] ?? '',
        tone: body['tone'] ?? 'professional', status: 'draft',
        createdBy: req.user.uid, createdAt: new Date(), updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingContent`).doc(id).set(content);
    res.status(201).json({ success: true, data: content });
}));
router.delete('/content/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingContent`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// SEO (AI-powered)
// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/marketing/images/generate — Gemini/Imagen image generation for posts & flyers.
// Body: { prompt: string, style?: string, format?: '1:1'|'16:9'|'9:16'|'4:5' }
// Returns: { url: string } where url is a public Storage URL (or a data URL fallback).
router.post('/images/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { prompt, style, format } = req.body;
    if (!prompt || !prompt.trim())
        throw new error_middleware_1.AppError('prompt required', 400);
    const aspect = format === '16:9' ? '16:9' : format === '9:16' ? '9:16' : format === '4:5' ? '4:5' : '1:1';
    const styleHint = style === 'illustration' ? 'flat illustration, vibrant'
        : style === 'minimalist' ? 'minimalist, lots of whitespace'
            : style === 'cinematic' ? 'cinematic photography, dramatic lighting'
                : 'professional photography, natural lighting, premium look';
    const finalPrompt = `${prompt}. Style: ${styleHint}. Format: ${aspect}. No text overlay.`;
    function extractImage(response) {
        const r = response;
        const candidates = [];
        if (r.media)
            Array.isArray(r.media) ? candidates.push(...r.media) : candidates.push(r.media);
        for (const part of r.message?.content ?? [])
            if (part?.media)
                candidates.push(part.media);
        for (const c of candidates) {
            if (!c.url)
                continue;
            const match = /^data:([^;]+);base64,(.+)$/.exec(c.url);
            if (match)
                return { buffer: Buffer.from(match[2] ?? '', 'base64'), contentType: match[1] ?? 'image/png' };
        }
        return null;
    }
    const { ai } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
    const candidates = [
        { model: 'googleai/gemini-2.5-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
        { model: 'googleai/gemini-2.5-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
        { model: 'googleai/gemini-2.0-flash-preview-image-generation', config: { responseModalities: ['IMAGE', 'TEXT'] } },
        { model: 'googleai/imagen-3.0-generate-001', config: { numberOfImages: 1, aspectRatio: aspect } },
    ];
    let imageBuffer = null;
    let contentType = 'image/png';
    const errors = [];
    for (const c of candidates) {
        try {
            const response = await ai.generate({ model: c.model, prompt: finalPrompt, config: c.config });
            const extracted = extractImage(response);
            if (extracted) {
                imageBuffer = extracted.buffer;
                contentType = extracted.contentType;
                break;
            }
            errors.push(`${c.model}: no image data`);
        }
        catch (err) {
            errors.push(`${c.model}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    if (!imageBuffer) {
        throw new error_middleware_1.AppError(`Image generation unavailable. Last error: ${errors[errors.length - 1] ?? 'unknown'}`, 503);
    }
    try {
        const { getStorage } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
        const bucket = getStorage().bucket();
        const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
        const storagePath = `companies/${cid}/marketing/generated/${Date.now()}.${ext}`;
        const fileRef = bucket.file(storagePath);
        await fileRef.save(imageBuffer, { metadata: { contentType } });
        await fileRef.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        res.json({ success: true, data: { url } });
    }
    catch {
        // Fallback to data URL if Storage upload fails — image is still usable in the modal.
        const url = `data:${contentType};base64,${imageBuffer.toString('base64')}`;
        res.json({ success: true, data: { url } });
    }
}));
router.post('/seo/analyze', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { topic } = req.body;
    if (!topic)
        throw new error_middleware_1.AppError('topic required', 400);
    try {
        const { ai, GEMINI_FLASH } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
        const { text } = await ai.generate({
            model: GEMINI_FLASH,
            prompt: `SEO analysis for "${topic}" in French. Return JSON: {"keywords":["..."],"titleSuggestions":["..."],"metaDescription":"...","tips":["..."]} ONLY.`,
            config: { temperature: 0.4 },
        });
        const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        res.json({ success: true, data: parsed });
    }
    catch {
        res.json({ success: true, data: { keywords: [topic], titleSuggestions: [topic], metaDescription: '', tips: [] } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        const [postsSnap, campsSnap, contentSnap] = await Promise.all([
            db.collection(`companies/${cid}/marketingPosts`).limit(500).get(),
            db.collection(`companies/${cid}/campaigns`).limit(50).get(),
            db.collection(`companies/${cid}/marketingContent`).limit(100).get(),
        ]);
        const posts = postsSnap.docs.map(d => d.data());
        const camps = campsSnap.docs.map(d => d.data());
        const byPlatform = {};
        let drafts = 0, scheduled = 0, published = 0;
        for (const p of posts) {
            const s = p['status'] ?? 'draft';
            if (s === 'draft')
                drafts++;
            else if (s === 'scheduled')
                scheduled++;
            else if (s === 'published')
                published++;
            const pl = p['platform'] ?? 'other';
            byPlatform[pl] = (byPlatform[pl] ?? 0) + 1;
        }
        return {
            totalPosts: posts.length, drafts, scheduled, published,
            totalCampaigns: camps.length, activeCampaigns: camps.filter(c => c['status'] === 'active').length,
            totalBudget: camps.reduce((s, c) => s + (c['budget'] ?? 0), 0),
            totalContent: contentSnap.size,
            byPlatform: Object.entries(byPlatform).map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count),
        };
    }, { totalPosts: 0, drafts: 0, scheduled: 0, published: 0, totalCampaigns: 0, activeCampaigns: 0, totalBudget: 0, totalContent: 0, byPlatform: [] });
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// POST WORKFLOW (review / approve / publish)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/posts/:id/submit-review', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).update({ status: 'review', submittedAt: new Date(), updatedAt: new Date() });
    res.json({ success: true });
}));
router.post('/posts/:id/approve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { approved, feedback } = req.body;
    const updates = { updatedAt: new Date() };
    if (approved) {
        updates['status'] = 'scheduled';
        updates['approvedAt'] = new Date();
    }
    else {
        updates['status'] = 'draft';
        updates['reviewFeedback'] = feedback ?? '';
    }
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).update(updates);
    res.json({ success: true });
}));
router.post('/posts/:id/publish', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).update({ status: 'published', publishedAt: new Date(), updatedAt: new Date() });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// BRAND PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/brand', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        const [companyDoc, brandDoc] = await Promise.all([
            db.collection('companies').doc(cid).get(),
            db.collection(`companies/${cid}/settings`).doc('brand').get(),
        ]);
        const c = companyDoc.data() ?? {};
        const b = brandDoc.data() ?? {};
        return { name: c['name'] ?? '', slogan: c['slogan'] ?? b['slogan'] ?? '', tone: b['tone'] ?? 'professional', targetAudience: b['targetAudience'] ?? '', guidelines: b['guidelines'] ?? [] };
    }, { name: '', slogan: '', tone: 'professional', targetAudience: '', guidelines: [] });
    res.json({ success: true, data });
}));
router.patch('/brand', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/settings`).doc('brand').set(req.body, { merge: true });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// LEAD ATTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/attribution', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/leads`).limit(500).get();
        const bySource = {};
        for (const d of snap.docs) {
            const s = d.data()['source'] ?? 'other';
            bySource[s] = (bySource[s] ?? 0) + 1;
        }
        return { bySource: Object.entries(bySource).map(([source, leads]) => ({ source, leads })).sort((a, b) => b.leads - a.leads), totalLeads: snap.size };
    }, { bySource: [], totalLeads: 0 });
    res.json({ success: true, data });
}));
// PRO routes
router.get('/roi', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { roiAnalyticsTool } = await Promise.resolve().then(() => __importStar(require('../agents/marketing.agent')));
    res.json({ success: true, data: await roiAnalyticsTool({ companyId: cid }) });
}));
router.get('/content-strategy', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { contentStrategyTool } = await Promise.resolve().then(() => __importStar(require('../agents/marketing.agent')));
    res.json({ success: true, data: await contentStrategyTool({ companyId: cid, period: req.query['period'] ?? 'week' }) });
}));
router.post('/competitor-analysis', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { competitorContentTool } = await Promise.resolve().then(() => __importStar(require('../agents/marketing.agent')));
    res.json({ success: true, data: await competitorContentTool({ companyId: cid, competitorName: req.body['competitorName'] ?? '' }) });
}));
router.post('/automation/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { marketingAutomationTool } = await Promise.resolve().then(() => __importStar(require('../agents/marketing.agent')));
    res.json({ success: true, data: await marketingAutomationTool({ companyId: cid, type: req.body['type'] ?? 'content_calendar_fill' }) });
}));
exports.default = router;
//# sourceMappingURL=marketing.routes.js.map