"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketingAgentTool = exports.marketingAgentFlow = exports.marketingAutomationTool = exports.competitorContentTool = exports.contentStrategyTool = exports.roiAnalyticsTool = exports.getLeadAttributionTool = exports.getBrandProfileTool = exports.getPostPerformanceTool = exports.approvePostTool = exports.submitForReviewTool = exports.publishPostTool = exports.getStatsTool = exports.seoAnalysisTool = exports.writeContentTool = exports.getCampaignsTool = exports.createCampaignTool = exports.schedulePostTool = exports.getCalendarTool = exports.getPostsTool = exports.generatePostTool = void 0;
/**
 * Marketing Agent PRO — Gemini Flash
 * Mission : Visibilite, engagement, conversion.
 *
 * Capabilities:
 *   1. Posts sociaux — generer, multi-plateforme, hashtags, emojis, A/B variantes
 *   2. Calendrier editorial — planification, scheduling, statuts
 *   3. Campagnes — creation, suivi, budget, ROI
 *   4. Articles — blog, newsletter, email campaign, press release
 *   5. SEO — mots-cles, analyse, suggestions
 *   6. Templates — modeles par plateforme et type
 *   7. Analytics — engagement, reach, top content, insights
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const PLATFORMS = ['linkedin', 'instagram', 'twitter', 'facebook', 'tiktok', 'youtube'];
const TONES = ['professional', 'casual', 'inspiring', 'humorous', 'bold', 'educational'];
const CONTENT_TYPES = ['social_post', 'blog', 'newsletter', 'email_campaign', 'press_release', 'ad_copy'];
const PLATFORM_GUIDES = {
    linkedin: 'Professional, 150-300 words, 3 hashtags max, insights',
    instagram: 'Visual-focused, 50-150 words, 10 hashtags, emojis',
    twitter: 'Max 280 chars, punchy, 2 hashtags',
    facebook: 'Conversational, 100-250 words, question at end',
    tiktok: 'Trendy, casual, 50-100 words, 8 hashtags',
    youtube: 'SEO title + description, 200 words, keywords',
};
// ══════════════════════════════════════════════════════════════════════════════
// 1. POSTS SOCIAUX
// ══════════════════════════════════════════════════════════════════════════════
exports.generatePostTool = genkit_config_1.ai.defineTool({
    name: 'mkt_generatePost',
    description: 'Generate a social media post with hashtags and emojis for a specific platform.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), topic: zod_1.z.string(),
        platform: zod_1.z.enum(PLATFORMS).default('linkedin'),
        tone: zod_1.z.enum(TONES).default('professional'),
        language: zod_1.z.string().optional().default('fr'),
        includeVariant: zod_1.z.boolean().optional().default(false).describe('Generate A/B variant'),
    }),
    outputSchema: zod_1.z.object({
        postId: zod_1.z.string(), post: zod_1.z.string(), hashtags: zod_1.z.array(zod_1.z.string()),
        platform: zod_1.z.string(), variant: zod_1.z.string().optional(),
    }),
}, async ({ companyId, topic, platform, tone, language, includeVariant }) => {
    const guide = PLATFORM_GUIDES[platform] ?? '150 words max';
    const variantInstr = includeVariant ? '\nAlso generate an A/B variant with a different angle. Return JSON: {"post":"...","hashtags":[...],"variant":"..."}' : '\nReturn JSON: {"post":"...","hashtags":[...]}';
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Write a ${tone} social media post in ${language} for ${platform} about: "${topic}".
Guidelines: ${guide}.${variantInstr}
Return ONLY JSON.`,
        config: { temperature: 0.7 },
    });
    let parsed = { post: text, hashtags: [], variant: undefined };
    try {
        const clean = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(clean);
    }
    catch { /* use raw */ }
    const db = (0, firebase_config_1.getFirestore)();
    const postId = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/marketingPosts`).doc(postId).set({
        id: postId, companyId, platform, text: parsed.post,
        hashtags: parsed.hashtags, topic, tone, variant: parsed.variant ?? null,
        status: 'draft', type: 'social_post',
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { postId, post: parsed.post, hashtags: parsed.hashtags ?? [], platform, variant: parsed.variant };
});
exports.getPostsTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getPosts',
    description: 'List marketing posts filtered by status or platform.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), status: zod_1.z.string().optional(), platform: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ posts: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), platform: zod_1.z.string(), text: zod_1.z.string(), status: zod_1.z.string(), topic: zod_1.z.string() })), total: zod_1.z.number() }),
}, async ({ companyId, status, platform }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/marketingPosts`);
    if (status)
        q = q.where('status', '==', status);
    if (platform)
        q = q.where('platform', '==', platform);
    const snap = await q.limit(50).get();
    const posts = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, platform: data['platform'] ?? '', text: data['text'] ?? '', status: data['status'] ?? 'draft', topic: data['topic'] ?? '' };
    });
    return { posts, total: posts.length };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. CALENDRIER EDITORIAL
// ══════════════════════════════════════════════════════════════════════════════
exports.getCalendarTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getCalendar',
    description: 'Get content calendar entries for a given month.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), month: zod_1.z.number().optional(), year: zod_1.z.number().optional() }),
    outputSchema: zod_1.z.object({ entries: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), date: zod_1.z.string(), platform: zod_1.z.string(), topic: zod_1.z.string(), status: zod_1.z.string() })) }),
}, async ({ companyId, month, year }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/marketingPosts`).where('scheduledAt', '!=', null).limit(100).get();
    let entries = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, date: data['scheduledAt'] ?? '', platform: data['platform'] ?? '', topic: data['topic'] ?? '', status: data['status'] ?? 'planned' };
    });
    if (month && year) {
        entries = entries.filter(e => { const d = new Date(e.date); return d.getMonth() + 1 === month && d.getFullYear() === year; });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return { entries };
});
exports.schedulePostTool = genkit_config_1.ai.defineTool({
    name: 'mkt_schedulePost',
    description: 'Generate and schedule a post for a specific date.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), topic: zod_1.z.string(), platform: zod_1.z.enum(PLATFORMS).default('linkedin'),
        scheduledDate: zod_1.z.string().describe('YYYY-MM-DD'), tone: zod_1.z.enum(TONES).default('professional'),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({ postId: zod_1.z.string(), text: zod_1.z.string(), scheduledAt: zod_1.z.string() }),
}, async ({ companyId, topic, platform, scheduledDate, tone, language }) => {
    const guide = PLATFORM_GUIDES[platform] ?? '150 words max';
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Write a ${tone} post in ${language} for ${platform} about "${topic}". ${guide}. Return only the post text ready to publish.`,
        config: { temperature: 0.6 },
    });
    const db = (0, firebase_config_1.getFirestore)();
    const postId = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/marketingPosts`).doc(postId).set({
        id: postId, companyId, platform, text: text.trim(), topic, tone,
        status: 'scheduled', scheduledAt: scheduledDate, type: 'social_post',
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { postId, text: text.trim(), scheduledAt: scheduledDate };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. CAMPAGNES
// ══════════════════════════════════════════════════════════════════════════════
exports.createCampaignTool = genkit_config_1.ai.defineTool({
    name: 'mkt_createCampaign',
    description: 'Create a marketing campaign with goals, budget, and timeline.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), name: zod_1.z.string(), objective: zod_1.z.string(),
        platforms: zod_1.z.array(zod_1.z.string()), budget: zod_1.z.number().optional(),
        startDate: zod_1.z.string(), endDate: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({ campaignId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, name, objective, platforms, budget, startDate, endDate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/campaigns`).doc(id).set({
        id, name, objective, platforms, budget: budget ?? 0,
        startDate, endDate, status: 'planning', postsCount: 0,
        metrics: { impressions: 0, clicks: 0, conversions: 0, engagement: 0 },
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { campaignId: id, message: `Campagne "${name}" creee.` };
});
exports.getCampaignsTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getCampaigns',
    description: 'List marketing campaigns.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), status: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ campaigns: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), status: zod_1.z.string(), budget: zod_1.z.number(), platforms: zod_1.z.array(zod_1.z.string()), startDate: zod_1.z.string(), endDate: zod_1.z.string() })) }),
}, async ({ companyId, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/campaigns`);
    if (status)
        q = q.where('status', '==', status);
    const snap = await q.limit(50).get();
    const campaigns = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, name: data['name'] ?? '', status: data['status'] ?? 'planning', budget: data['budget'] ?? 0, platforms: data['platforms'] ?? [], startDate: data['startDate'] ?? '', endDate: data['endDate'] ?? '' };
    });
    return { campaigns };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. ARTICLES + EMAIL
// ══════════════════════════════════════════════════════════════════════════════
exports.writeContentTool = genkit_config_1.ai.defineTool({
    name: 'mkt_writeContent',
    description: 'Write a blog article, newsletter, email campaign, or press release.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), type: zod_1.z.enum(CONTENT_TYPES).default('blog'),
        topic: zod_1.z.string(), tone: zod_1.z.enum(TONES).default('professional'),
        length: zod_1.z.enum(['short', 'medium', 'long']).default('medium'),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({ contentId: zod_1.z.string(), title: zod_1.z.string(), content: zod_1.z.string(), type: zod_1.z.string(), wordCount: zod_1.z.number() }),
}, async ({ companyId, type, topic, tone, length, language }) => {
    const targets = { short: 300, medium: 600, long: 1200 };
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Write a ${tone} ${type} in ${language} about "${topic}". ~${targets[length ?? 'medium']} words. Return JSON: {"title":"...","content":"..."} ONLY.`,
        config: { temperature: 0.6 },
    });
    let title = topic, content = text;
    try {
        const p = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        title = p.title;
        content = p.content;
    }
    catch { }
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/marketingContent`).doc(id).set({
        id, type, title, content, tone, topic, status: 'draft', wordCount: content.split(/\s+/).length,
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { contentId: id, title, content, type, wordCount: content.split(/\s+/).length };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. SEO
// ══════════════════════════════════════════════════════════════════════════════
exports.seoAnalysisTool = genkit_config_1.ai.defineTool({
    name: 'mkt_seoAnalysis',
    description: 'Analyze SEO potential and suggest keywords for a topic.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), topic: zod_1.z.string(), language: zod_1.z.string().optional().default('fr') }),
    outputSchema: zod_1.z.object({ keywords: zod_1.z.array(zod_1.z.string()), titleSuggestions: zod_1.z.array(zod_1.z.string()), metaDescription: zod_1.z.string(), tips: zod_1.z.array(zod_1.z.string()) }),
}, async ({ topic, language }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `SEO analysis in ${language} for "${topic}". Return JSON: {"keywords":["..."],"titleSuggestions":["...","..."],"metaDescription":"...","tips":["...","..."]} ONLY.`,
        config: { temperature: 0.4 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { keywords: [topic], titleSuggestions: [topic], metaDescription: topic, tips: ['Optimisez vos titres', 'Utilisez des mots-cles longue traine'] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.getStatsTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getStats',
    description: 'Get marketing statistics and KPIs.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalPosts: zod_1.z.number(), drafts: zod_1.z.number(), scheduled: zod_1.z.number(), published: zod_1.z.number(),
        totalCampaigns: zod_1.z.number(), activeCampaigns: zod_1.z.number(), totalBudget: zod_1.z.number(),
        byPlatform: zod_1.z.array(zod_1.z.object({ platform: zod_1.z.string(), count: zod_1.z.number() })),
        insights: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [postsSnap, campsSnap] = await Promise.all([
        db.collection(`companies/${companyId}/marketingPosts`).limit(500).get(),
        db.collection(`companies/${companyId}/campaigns`).limit(50).get(),
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
    const activeCamps = camps.filter(c => c['status'] === 'active').length;
    const totalBudget = camps.reduce((s, c) => s + (c['budget'] ?? 0), 0);
    return {
        totalPosts: posts.length, drafts, scheduled, published,
        totalCampaigns: camps.length, activeCampaigns: activeCamps, totalBudget,
        byPlatform: Object.entries(byPlatform).map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count),
        insights: [
            published === 0 ? 'Aucun post publie — commencez a creer du contenu !' : `${published} posts publies`,
            'LinkedIn: meilleur engagement mardi/jeudi 9h-11h',
            'Les videos courtes surpassent les images statiques 2-3x',
        ],
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 7. PUBLISH · REVIEW · APPROVE · PERFORMANCE · BRAND · ATTRIBUTION
// ══════════════════════════════════════════════════════════════════════════════
exports.publishPostTool = genkit_config_1.ai.defineTool({
    name: 'mkt_publishPost',
    description: 'Mark a post as published (after approval).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), postId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, postId }) => {
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/marketingPosts`).doc(postId).update({
        status: 'published', publishedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, message: 'Post publie.' };
});
exports.submitForReviewTool = genkit_config_1.ai.defineTool({
    name: 'mkt_submitForReview',
    description: 'Submit a draft post for review/approval.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), postId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, postId }) => {
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/marketingPosts`).doc(postId).update({
        status: 'review', submittedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, message: 'Post soumis pour validation.' };
});
exports.approvePostTool = genkit_config_1.ai.defineTool({
    name: 'mkt_approvePost',
    description: 'Approve a post that was submitted for review.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), postId: zod_1.z.string(), approved: zod_1.z.boolean(), feedback: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, postId, approved, feedback }) => {
    const updates = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (approved) {
        updates['status'] = 'scheduled';
        updates['approvedAt'] = firestore_1.FieldValue.serverTimestamp();
    }
    else {
        updates['status'] = 'draft';
        updates['reviewFeedback'] = feedback ?? 'Revisions necessaires.';
    }
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/marketingPosts`).doc(postId).update(updates);
    return { success: true, message: approved ? 'Post approuve et planifie.' : 'Post renvoye en brouillon avec feedback.' };
});
exports.getPostPerformanceTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getPostPerformance',
    description: 'Get performance metrics for a published post.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), postId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        impressions: zod_1.z.number(), clicks: zod_1.z.number(), likes: zod_1.z.number(),
        shares: zod_1.z.number(), comments: zod_1.z.number(), engagementRate: zod_1.z.number(),
    }),
}, async ({ companyId, postId }) => {
    const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/marketingPosts`).doc(postId).get();
    const perf = doc.data()?.['performance'] ?? {};
    const impressions = perf['impressions'] ?? 0;
    const clicks = perf['clicks'] ?? 0;
    const likes = perf['likes'] ?? 0;
    const shares = perf['shares'] ?? 0;
    const comments = perf['comments'] ?? 0;
    const engagementRate = impressions > 0 ? Math.round(((likes + shares + comments) / impressions) * 10000) / 100 : 0;
    return { impressions, clicks, likes, shares, comments, engagementRate };
});
exports.getBrandProfileTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getBrandProfile',
    description: 'Get the company brand profile (tone, colors, target audience, guidelines).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        name: zod_1.z.string(), slogan: zod_1.z.string(), tone: zod_1.z.string(),
        targetAudience: zod_1.z.string(), guidelines: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const brandDoc = await db.collection(`companies/${companyId}/settings`).doc('brand').get().catch(() => null);
    const c = companyDoc.data() ?? {};
    const b = brandDoc?.data() ?? {};
    return {
        name: c['name'] ?? 'Mon Entreprise',
        slogan: c['slogan'] ?? b['slogan'] ?? '',
        tone: b['tone'] ?? 'professional',
        targetAudience: b['targetAudience'] ?? '',
        guidelines: Array.isArray(b['guidelines']) ? b['guidelines'] : [],
    };
});
exports.getLeadAttributionTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getLeadAttribution',
    description: 'Get marketing lead attribution — which campaigns/posts generated leads.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        bySource: zod_1.z.array(zod_1.z.object({ source: zod_1.z.string(), leads: zod_1.z.number() })),
        byCampaign: zod_1.z.array(zod_1.z.object({ campaign: zod_1.z.string(), leads: zod_1.z.number() })),
        totalLeads: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const leadsSnap = await db.collection(`companies/${companyId}/leads`).limit(500).get();
    const bySource = {};
    for (const d of leadsSnap.docs) {
        const src = d.data()['source'] ?? 'other';
        bySource[src] = (bySource[src] ?? 0) + 1;
    }
    return {
        bySource: Object.entries(bySource).map(([source, leads]) => ({ source, leads })).sort((a, b) => b.leads - a.leads),
        byCampaign: [], // Would need campaign tracking on leads
        totalLeads: leadsSnap.size,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: ROI ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.roiAnalyticsTool = genkit_config_1.ai.defineTool({
    name: 'mkt_getROIAnalytics',
    description: 'Marketing ROI analytics — cost per lead, campaign ROI, channel performance, conversion funnel.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalSpend: zod_1.z.number(), totalLeads: zod_1.z.number(), costPerLead: zod_1.z.number(),
        byChannel: zod_1.z.array(zod_1.z.object({ channel: zod_1.z.string(), posts: zod_1.z.number(), engagement: zod_1.z.number(), leads: zod_1.z.number(), roi: zod_1.z.number() })),
        byCampaign: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), budget: zod_1.z.number(), spent: zod_1.z.number(), leads: zod_1.z.number(), roi: zod_1.z.number() })),
        recommendations: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [postsSnap, campaignsSnap, leadsSnap] = await Promise.all([
        db.collection(`companies/${companyId}/marketingPosts`).limit(300).get(),
        db.collection(`companies/${companyId}/marketingCampaigns`).limit(50).get(),
        db.collection(`companies/${companyId}/leads`).where('source', '>=', 'marketing').where('source', '<=', 'marketing\uf8ff').limit(200).get(),
    ]);
    const posts = postsSnap.docs.map(d => d.data());
    const campaigns = campaignsSnap.docs.map(d => d.data());
    const totalLeads = leadsSnap.size;
    const totalSpend = campaigns.reduce((s, c) => s + (c['spent'] ?? c['budget'] ?? 0), 0);
    // By channel
    const channelMap = new Map();
    posts.forEach(p => {
        const ch = p['platform'] ?? 'other';
        if (!channelMap.has(ch))
            channelMap.set(ch, { posts: 0, engagement: 0, leads: 0 });
        const c = channelMap.get(ch);
        c.posts++;
        c.engagement += (p['likes'] ?? 0) + (p['comments'] ?? 0) + (p['shares'] ?? 0);
    });
    const byChannel = Array.from(channelMap.entries()).map(([ch, d]) => ({ channel: ch, ...d, roi: d.leads > 0 ? Math.round(d.leads / Math.max(d.posts, 1) * 100) : 0 })).sort((a, b) => b.engagement - a.engagement);
    const byCampaign = campaigns.map(c => ({ name: c['name'] ?? '', budget: c['budget'] ?? 0, spent: c['spent'] ?? 0, leads: c['leadsGenerated'] ?? 0, roi: c['spent'] > 0 ? Math.round((c['leadsGenerated'] ?? 0) / (c['spent'] ?? 1) * 1000) : 0 })).sort((a, b) => b.roi - a.roi);
    const { text } = await genkit_config_1.ai.generate({ model: genkit_config_1.GEMINI_FLASH, prompt: `Analyze marketing ROI in French. Spend: ${totalSpend}€, Leads: ${totalLeads}, Top channel: ${byChannel[0]?.channel ?? 'none'}. Give 3 short recommendations. Return JSON: {"recommendations":["rec1","rec2","rec3"]}`, config: { temperature: 0.3 } });
    let recs = [];
    try {
        recs = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).recommendations;
    }
    catch { }
    return { totalSpend, totalLeads, costPerLead: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0, byChannel, byCampaign, recommendations: recs };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CONTENT AI (generate full content strategy)
// ══════════════════════════════════════════════════════════════════════════════
exports.contentStrategyTool = genkit_config_1.ai.defineTool({
    name: 'mkt_generateContentStrategy',
    description: 'AI-powered content strategy — topic ideas, content calendar suggestions, trending formats.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['week', 'month']).optional().default('week'), sector: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        ideas: zod_1.z.array(zod_1.z.object({ topic: zod_1.z.string(), platform: zod_1.z.string(), format: zod_1.z.string(), bestDay: zod_1.z.string(), reasoning: zod_1.z.string() })),
        trendingFormats: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId, period, sector }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyName = companyDoc.data()?.['name'] ?? '';
    const companySector = sector ?? companyDoc.data()?.['sector'] ?? 'business';
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Generate a ${period} content strategy for "${companyName}" (${companySector}) in French.
Include 5-7 content ideas with: topic, best platform (linkedin/instagram/twitter/facebook/tiktok), format (post/carousel/video/story/article), best day, and reasoning.
Also suggest 3 trending formats right now.
Return JSON: {"ideas":[{"topic":"...","platform":"...","format":"...","bestDay":"...","reasoning":"..."}],"trendingFormats":["format1","format2","format3"]}`,
        config: { temperature: 0.5 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { ideas: [], trendingFormats: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: COMPETITOR CONTENT ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
exports.competitorContentTool = genkit_config_1.ai.defineTool({
    name: 'mkt_analyzeCompetitorContent',
    description: 'Analyze competitor content strategy — what works, gaps, opportunities.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), competitorName: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ analysis: zod_1.z.string(), strengths: zod_1.z.array(zod_1.z.string()), weaknesses: zod_1.z.array(zod_1.z.string()), opportunities: zod_1.z.array(zod_1.z.string()) }),
}, async ({ companyId, competitorName }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze the content marketing strategy of "${competitorName}" in French. Identify strengths, weaknesses, and opportunities for us.
Return JSON: {"analysis":"2-3 paragraphs","strengths":["s1","s2"],"weaknesses":["w1","w2"],"opportunities":["o1","o2"]}`,
        config: { temperature: 0.4 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { analysis: '', strengths: [], weaknesses: [], opportunities: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: MARKETING AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════
exports.marketingAutomationTool = genkit_config_1.ai.defineTool({
    name: 'mkt_runAutomation',
    description: 'Marketing automation: deal won → success story, new product → campaign, competitor active → response post.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), type: zod_1.z.enum(['success_stories', 'product_launch', 'competitor_response', 'content_calendar_fill']) }),
    outputSchema: zod_1.z.object({ actions: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, type }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const actions = [];
    if (type === 'success_stories') {
        const wonSnap = await db.collection(`companies/${companyId}/leads`).where('stage', '==', 'gagne').limit(10).get();
        for (const doc of wonSnap.docs) {
            const lead = doc.data();
            if (lead['successPostCreated'])
                continue;
            const id = (0, helpers_1.generateId)();
            await db.collection(`companies/${companyId}/marketingPosts`).doc(id).set({
                id, platform: 'linkedin', status: 'draft',
                content: `Nous sommes fiers d'accompagner ${lead['company'] ?? lead['name']}. Un nouveau partenariat qui illustre notre engagement envers l'excellence.`,
                category: 'success_story', source: 'automation', createdAt: new Date(),
            });
            await doc.ref.update({ successPostCreated: true });
            actions.push(`Post LinkedIn draft: success story ${lead['company'] ?? lead['name']}`);
        }
    }
    if (type === 'content_calendar_fill') {
        const result = await exports.contentStrategyTool({ companyId, period: 'week' });
        for (const idea of (result?.ideas ?? []).slice(0, 3)) {
            const id = (0, helpers_1.generateId)();
            await db.collection(`companies/${companyId}/marketingPosts`).doc(id).set({
                id, platform: idea.platform, status: 'draft', content: `[IA] ${idea.topic}`,
                category: 'content_strategy', source: 'automation', createdAt: new Date(),
            });
            actions.push(`Draft ${idea.platform}: ${idea.topic}`);
        }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action.' };
});
const ALL_TOOLS = [
    exports.generatePostTool, exports.getPostsTool, exports.getCalendarTool, exports.schedulePostTool,
    exports.createCampaignTool, exports.getCampaignsTool, exports.writeContentTool,
    exports.seoAnalysisTool, exports.getStatsTool,
    exports.publishPostTool, exports.submitForReviewTool, exports.approvePostTool,
    exports.getPostPerformanceTool, exports.getBrandProfileTool, exports.getLeadAttributionTool,
    // PRO
    exports.roiAnalyticsTool, exports.contentStrategyTool, exports.competitorContentTool, exports.marketingAutomationTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({ response: zod_1.z.string(), contentDraft: zod_1.z.string().optional(), requiresApproval: zod_1.z.boolean() });
exports.marketingAgentFlow = genkit_config_1.ai.defineFlow({ name: 'marketingAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, language, history }) => {
    logger_1.logger.info(`[MarketingAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
    // Date anchors — never hallucinate "mai 2024" or "March 2025"
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}). MOIS PROCHAIN : ${months[(now.getMonth() + 1) % 12]} ${now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()}.`;
    })();
    // Resolve company currency for accurate stats display
    let companyCurrency = 'XOF';
    try {
        const companyDoc = await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).get();
        const c = companyDoc.data() ?? {};
        companyCurrency = c['settings']?.['currency'] ?? c['currency'] ?? 'XOF';
    }
    catch { /* default XOF */ }
    const executors = new Map();
    for (const tool of ALL_TOOLS) {
        const name = tool.__action?.name ?? '';
        if (name)
            executors.set(name, (i) => tool({ ...i, companyId }));
    }
    // Build messages with history — preserves context across turns ("1", "2", "3" refer to previous list)
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20)) {
            messages.push({ role: h.role, content: [{ text: h.content }] });
        }
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es l'Agent Marketing PRO de l'entreprise.
CompanyID: ${companyId}. Devise entreprise: ${companyCurrency}.

## 📅 CONTEXTE TEMPOREL (ne JAMAIS inventer de dates)
${dateAnchors}
Si l'utilisateur dit "ce mois", "le mois prochain", utilise STRICTEMENT les ancres ci-dessus.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages. Si l'utilisateur répond par un numéro ("1", "2", "3") ou par mots-clés courts ("oui vas-y", "celui-là"), références-toi à TA DERNIÈRE liste/proposition. Ne JAMAIS recommencer un "Bonjour, je suis l'agent marketing..." si le contexte est clair.

## TON RÔLE
Tu crées du contenu, gères les campagnes, planifies les calendriers, analyses le SEO, et suis les performances.

RÈGLES :
- NE JAMAIS publier sans approbation humaine — toujours créer en BROUILLON
- Propose le contenu avant de planifier
- Utilise les bonnes pratiques par plateforme (LinkedIn=pro, Insta=visual, Twitter=court)
- Quand l'utilisateur dit "Programme ce post" → garde le post en cours dans l'historique, ne génère pas un NOUVEAU post sans rapport
- Affiche les montants en ${companyCurrency} (PAS en EUR, sauf si la devise entreprise est EUR)
- Pour les actions, donne TOUJOURS l'ID complet (jamais "abc123..." tronqué)
- Inclus des variantes A/B quand demandé
- Suis le ROI des campagnes et propose des optimisations
${langInstr}`,
        messages,
        tools: ALL_TOOLS,
        config: { temperature: 0.6 },
    });
    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 8) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = executors.get(name);
            const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools: ALL_TOOLS, config: { temperature: 0.6 },
        });
    }
    const text = response.text;
    const hasDraft = /draft|brouillon|cree|genere|scheduled/i.test(text);
    return { response: text, contentDraft: hasDraft ? text : undefined, requiresApproval: hasDraft };
});
exports.marketingAgentTool = genkit_config_1.ai.defineTool({
    name: 'callMarketingAgent',
    description: 'Marketing PRO: social posts, ROI analytics, content strategy IA, competitor analysis, campaigns, SEO, content calendar, cross-agent automation.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, (input) => (0, exports.marketingAgentFlow)(input));
//# sourceMappingURL=marketing.agent.js.map