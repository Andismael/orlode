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
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const PLATFORMS = ['linkedin', 'instagram', 'twitter', 'facebook', 'tiktok', 'youtube'] as const;
const TONES = ['professional', 'casual', 'inspiring', 'humorous', 'bold', 'educational'] as const;
const CONTENT_TYPES = ['social_post', 'blog', 'newsletter', 'email_campaign', 'press_release', 'ad_copy'] as const;

const PLATFORM_GUIDES: Record<string, string> = {
  linkedin:  'Professional, 150-300 words, 3 hashtags max, insights',
  instagram: 'Visual-focused, 50-150 words, 10 hashtags, emojis',
  twitter:   'Max 280 chars, punchy, 2 hashtags',
  facebook:  'Conversational, 100-250 words, question at end',
  tiktok:    'Trendy, casual, 50-100 words, 8 hashtags',
  youtube:   'SEO title + description, 200 words, keywords',
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. POSTS SOCIAUX
// ══════════════════════════════════════════════════════════════════════════════

export const generatePostTool = ai.defineTool(
  {
    name: 'mkt_generatePost',
    description: 'Generate a social media post with hashtags and emojis for a specific platform.',
    inputSchema: z.object({
      companyId: z.string(), topic: z.string(),
      platform: z.enum(PLATFORMS).default('linkedin'),
      tone: z.enum(TONES).default('professional'),
      language: z.string().optional().default('fr'),
      includeVariant: z.boolean().optional().default(false).describe('Generate A/B variant'),
    }),
    outputSchema: z.object({
      postId: z.string(), post: z.string(), hashtags: z.array(z.string()),
      platform: z.string(), variant: z.string().optional(),
    }),
  },
  async ({ companyId, topic, platform, tone, language, includeVariant }) => {
    const guide = PLATFORM_GUIDES[platform] ?? '150 words max';
    const variantInstr = includeVariant ? '\nAlso generate an A/B variant with a different angle. Return JSON: {"post":"...","hashtags":[...],"variant":"..."}' : '\nReturn JSON: {"post":"...","hashtags":[...]}';

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Write a ${tone} social media post in ${language} for ${platform} about: "${topic}".
Guidelines: ${guide}.${variantInstr}
Return ONLY JSON.`,
      config: { temperature: 0.7 },
    });

    let parsed = { post: text, hashtags: [] as string[], variant: undefined as string | undefined };
    try {
      const clean = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(clean);
    } catch { /* use raw */ }

    const db = getFirestore();
    const postId = generateId();
    await db.collection(`companies/${companyId}/marketingPosts`).doc(postId).set({
      id: postId, companyId, platform, text: parsed.post,
      hashtags: parsed.hashtags, topic, tone, variant: parsed.variant ?? null,
      status: 'draft', type: 'social_post',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });

    return { postId, post: parsed.post, hashtags: parsed.hashtags ?? [], platform, variant: parsed.variant };
  }
);

export const getPostsTool = ai.defineTool(
  {
    name: 'mkt_getPosts',
    description: 'List marketing posts filtered by status or platform.',
    inputSchema: z.object({ companyId: z.string(), status: z.string().optional(), platform: z.string().optional() }),
    outputSchema: z.object({ posts: z.array(z.object({ id: z.string(), platform: z.string(), text: z.string(), status: z.string(), topic: z.string() })), total: z.number() }),
  },
  async ({ companyId, status, platform }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/marketingPosts`) as FirebaseFirestore.Query;
    if (status) q = q.where('status', '==', status);
    if (platform) q = q.where('platform', '==', platform);
    const snap = await q.limit(50).get();
    const posts = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, platform: (data['platform'] as string) ?? '', text: (data['text'] as string) ?? '', status: (data['status'] as string) ?? 'draft', topic: (data['topic'] as string) ?? '' };
    });
    return { posts, total: posts.length };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. CALENDRIER EDITORIAL
// ══════════════════════════════════════════════════════════════════════════════

export const getCalendarTool = ai.defineTool(
  {
    name: 'mkt_getCalendar',
    description: 'Get content calendar entries for a given month.',
    inputSchema: z.object({ companyId: z.string(), month: z.number().optional(), year: z.number().optional() }),
    outputSchema: z.object({ entries: z.array(z.object({ id: z.string(), date: z.string(), platform: z.string(), topic: z.string(), status: z.string() })) }),
  },
  async ({ companyId, month, year }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/marketingPosts`).where('scheduledAt', '!=', null).limit(100).get();
    let entries = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, date: (data['scheduledAt'] as string) ?? '', platform: (data['platform'] as string) ?? '', topic: (data['topic'] as string) ?? '', status: (data['status'] as string) ?? 'planned' };
    });
    if (month && year) {
      entries = entries.filter(e => { const d = new Date(e.date); return d.getMonth() + 1 === month && d.getFullYear() === year; });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return { entries };
  }
);

export const schedulePostTool = ai.defineTool(
  {
    name: 'mkt_schedulePost',
    description: 'Generate and schedule a post for a specific date.',
    inputSchema: z.object({
      companyId: z.string(), topic: z.string(), platform: z.enum(PLATFORMS).default('linkedin'),
      scheduledDate: z.string().describe('YYYY-MM-DD'), tone: z.enum(TONES).default('professional'),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({ postId: z.string(), text: z.string(), scheduledAt: z.string() }),
  },
  async ({ companyId, topic, platform, scheduledDate, tone, language }) => {
    const guide = PLATFORM_GUIDES[platform] ?? '150 words max';
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Write a ${tone} post in ${language} for ${platform} about "${topic}". ${guide}. Return only the post text ready to publish.`,
      config: { temperature: 0.6 },
    });
    const db = getFirestore();
    const postId = generateId();
    await db.collection(`companies/${companyId}/marketingPosts`).doc(postId).set({
      id: postId, companyId, platform, text: text.trim(), topic, tone,
      status: 'scheduled', scheduledAt: scheduledDate, type: 'social_post',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { postId, text: text.trim(), scheduledAt: scheduledDate };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. CAMPAGNES
// ══════════════════════════════════════════════════════════════════════════════

export const createCampaignTool = ai.defineTool(
  {
    name: 'mkt_createCampaign',
    description: 'Create a marketing campaign with goals, budget, and timeline.',
    inputSchema: z.object({
      companyId: z.string(), name: z.string(), objective: z.string(),
      platforms: z.array(z.string()), budget: z.number().optional(),
      startDate: z.string(), endDate: z.string(),
    }),
    outputSchema: z.object({ campaignId: z.string(), message: z.string() }),
  },
  async ({ companyId, name, objective, platforms, budget, startDate, endDate }) => {
    const db = getFirestore();
    const id = generateId();
    await db.collection(`companies/${companyId}/campaigns`).doc(id).set({
      id, name, objective, platforms, budget: budget ?? 0,
      startDate, endDate, status: 'planning', postsCount: 0,
      metrics: { impressions: 0, clicks: 0, conversions: 0, engagement: 0 },
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { campaignId: id, message: `Campagne "${name}" creee.` };
  }
);

export const getCampaignsTool = ai.defineTool(
  {
    name: 'mkt_getCampaigns',
    description: 'List marketing campaigns.',
    inputSchema: z.object({ companyId: z.string(), status: z.string().optional() }),
    outputSchema: z.object({ campaigns: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), budget: z.number(), platforms: z.array(z.string()), startDate: z.string(), endDate: z.string() })) }),
  },
  async ({ companyId, status }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/campaigns`) as FirebaseFirestore.Query;
    if (status) q = q.where('status', '==', status);
    const snap = await q.limit(50).get();
    const campaigns = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: (data['name'] as string) ?? '', status: (data['status'] as string) ?? 'planning', budget: (data['budget'] as number) ?? 0, platforms: (data['platforms'] as string[]) ?? [], startDate: (data['startDate'] as string) ?? '', endDate: (data['endDate'] as string) ?? '' };
    });
    return { campaigns };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. ARTICLES + EMAIL
// ══════════════════════════════════════════════════════════════════════════════

export const writeContentTool = ai.defineTool(
  {
    name: 'mkt_writeContent',
    description: 'Write a blog article, newsletter, email campaign, or press release.',
    inputSchema: z.object({
      companyId: z.string(), type: z.enum(CONTENT_TYPES).default('blog'),
      topic: z.string(), tone: z.enum(TONES).default('professional'),
      length: z.enum(['short', 'medium', 'long']).default('medium'),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({ contentId: z.string(), title: z.string(), content: z.string(), type: z.string(), wordCount: z.number() }),
  },
  async ({ companyId, type, topic, tone, length, language }) => {
    const targets = { short: 300, medium: 600, long: 1200 };
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Write a ${tone} ${type} in ${language} about "${topic}". ~${targets[length ?? 'medium']} words. Return JSON: {"title":"...","content":"..."} ONLY.`,
      config: { temperature: 0.6 },
    });
    let title = topic, content = text;
    try { const p = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); title = p.title; content = p.content; } catch {}

    const db = getFirestore();
    const id = generateId();
    await db.collection(`companies/${companyId}/marketingContent`).doc(id).set({
      id, type, title, content, tone, topic, status: 'draft', wordCount: content.split(/\s+/).length,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { contentId: id, title, content, type, wordCount: content.split(/\s+/).length };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. SEO
// ══════════════════════════════════════════════════════════════════════════════

export const seoAnalysisTool = ai.defineTool(
  {
    name: 'mkt_seoAnalysis',
    description: 'Analyze SEO potential and suggest keywords for a topic.',
    inputSchema: z.object({ companyId: z.string(), topic: z.string(), language: z.string().optional().default('fr') }),
    outputSchema: z.object({ keywords: z.array(z.string()), titleSuggestions: z.array(z.string()), metaDescription: z.string(), tips: z.array(z.string()) }),
  },
  async ({ topic, language }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `SEO analysis in ${language} for "${topic}". Return JSON: {"keywords":["..."],"titleSuggestions":["...","..."],"metaDescription":"...","tips":["...","..."]} ONLY.`,
      config: { temperature: 0.4 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); }
    catch { return { keywords: [topic], titleSuggestions: [topic], metaDescription: topic, tips: ['Optimisez vos titres', 'Utilisez des mots-cles longue traine'] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const getStatsTool = ai.defineTool(
  {
    name: 'mkt_getStats',
    description: 'Get marketing statistics and KPIs.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalPosts: z.number(), drafts: z.number(), scheduled: z.number(), published: z.number(),
      totalCampaigns: z.number(), activeCampaigns: z.number(), totalBudget: z.number(),
      byPlatform: z.array(z.object({ platform: z.string(), count: z.number() })),
      insights: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [postsSnap, campsSnap] = await Promise.all([
      db.collection(`companies/${companyId}/marketingPosts`).limit(500).get(),
      db.collection(`companies/${companyId}/campaigns`).limit(50).get(),
    ]);
    const posts = postsSnap.docs.map(d => d.data());
    const camps = campsSnap.docs.map(d => d.data());
    const byPlatform: Record<string, number> = {};
    let drafts = 0, scheduled = 0, published = 0;
    for (const p of posts) {
      const s = (p['status'] as string) ?? 'draft';
      if (s === 'draft') drafts++; else if (s === 'scheduled') scheduled++; else if (s === 'published') published++;
      const pl = (p['platform'] as string) ?? 'other';
      byPlatform[pl] = (byPlatform[pl] ?? 0) + 1;
    }
    const activeCamps = camps.filter(c => c['status'] === 'active').length;
    const totalBudget = camps.reduce((s, c) => s + ((c['budget'] as number) ?? 0), 0);
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
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. PUBLISH · REVIEW · APPROVE · PERFORMANCE · BRAND · ATTRIBUTION
// ══════════════════════════════════════════════════════════════════════════════

export const publishPostTool = ai.defineTool(
  {
    name: 'mkt_publishPost',
    description: 'Mark a post as published (after approval).',
    inputSchema: z.object({ companyId: z.string(), postId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, postId }) => {
    await getFirestore().collection(`companies/${companyId}/marketingPosts`).doc(postId).update({
      status: 'published', publishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true, message: 'Post publie.' };
  }
);

export const submitForReviewTool = ai.defineTool(
  {
    name: 'mkt_submitForReview',
    description: 'Submit a draft post for review/approval.',
    inputSchema: z.object({ companyId: z.string(), postId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, postId }) => {
    await getFirestore().collection(`companies/${companyId}/marketingPosts`).doc(postId).update({
      status: 'review', submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true, message: 'Post soumis pour validation.' };
  }
);

export const approvePostTool = ai.defineTool(
  {
    name: 'mkt_approvePost',
    description: 'Approve a post that was submitted for review.',
    inputSchema: z.object({ companyId: z.string(), postId: z.string(), approved: z.boolean(), feedback: z.string().optional() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, postId, approved, feedback }) => {
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (approved) {
      updates['status'] = 'scheduled';
      updates['approvedAt'] = FieldValue.serverTimestamp();
    } else {
      updates['status'] = 'draft';
      updates['reviewFeedback'] = feedback ?? 'Revisions necessaires.';
    }
    await getFirestore().collection(`companies/${companyId}/marketingPosts`).doc(postId).update(updates);
    return { success: true, message: approved ? 'Post approuve et planifie.' : 'Post renvoye en brouillon avec feedback.' };
  }
);

export const getPostPerformanceTool = ai.defineTool(
  {
    name: 'mkt_getPostPerformance',
    description: 'Get performance metrics for a published post.',
    inputSchema: z.object({ companyId: z.string(), postId: z.string() }),
    outputSchema: z.object({
      impressions: z.number(), clicks: z.number(), likes: z.number(),
      shares: z.number(), comments: z.number(), engagementRate: z.number(),
    }),
  },
  async ({ companyId, postId }) => {
    const doc = await getFirestore().collection(`companies/${companyId}/marketingPosts`).doc(postId).get();
    const perf = (doc.data()?.['performance'] as Record<string, number>) ?? {};
    const impressions = perf['impressions'] ?? 0;
    const clicks = perf['clicks'] ?? 0;
    const likes = perf['likes'] ?? 0;
    const shares = perf['shares'] ?? 0;
    const comments = perf['comments'] ?? 0;
    const engagementRate = impressions > 0 ? Math.round(((likes + shares + comments) / impressions) * 10000) / 100 : 0;
    return { impressions, clicks, likes, shares, comments, engagementRate };
  }
);

export const getBrandProfileTool = ai.defineTool(
  {
    name: 'mkt_getBrandProfile',
    description: 'Get the company brand profile (tone, colors, target audience, guidelines).',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      name: z.string(), slogan: z.string(), tone: z.string(),
      targetAudience: z.string(), guidelines: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const brandDoc = await db.collection(`companies/${companyId}/settings`).doc('brand').get().catch(() => null);
    const c = companyDoc.data() ?? {};
    const b = brandDoc?.data() ?? {};
    return {
      name: (c['name'] as string) ?? 'Mon Entreprise',
      slogan: (c['slogan'] as string) ?? (b['slogan'] as string) ?? '',
      tone: (b['tone'] as string) ?? 'professional',
      targetAudience: (b['targetAudience'] as string) ?? '',
      guidelines: Array.isArray(b['guidelines']) ? b['guidelines'] as string[] : [],
    };
  }
);

export const getLeadAttributionTool = ai.defineTool(
  {
    name: 'mkt_getLeadAttribution',
    description: 'Get marketing lead attribution — which campaigns/posts generated leads.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      bySource: z.array(z.object({ source: z.string(), leads: z.number() })),
      byCampaign: z.array(z.object({ campaign: z.string(), leads: z.number() })),
      totalLeads: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const leadsSnap = await db.collection(`companies/${companyId}/leads`).limit(500).get();
    const bySource: Record<string, number> = {};
    for (const d of leadsSnap.docs) {
      const src = (d.data()['source'] as string) ?? 'other';
      bySource[src] = (bySource[src] ?? 0) + 1;
    }
    return {
      bySource: Object.entries(bySource).map(([source, leads]) => ({ source, leads })).sort((a, b) => b.leads - a.leads),
      byCampaign: [], // Would need campaign tracking on leads
      totalLeads: leadsSnap.size,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PRO: ROI ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const roiAnalyticsTool = ai.defineTool(
  {
    name: 'mkt_getROIAnalytics',
    description: 'Marketing ROI analytics — cost per lead, campaign ROI, channel performance, conversion funnel.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalSpend: z.number(), totalLeads: z.number(), costPerLead: z.number(),
      byChannel: z.array(z.object({ channel: z.string(), posts: z.number(), engagement: z.number(), leads: z.number(), roi: z.number() })),
      byCampaign: z.array(z.object({ name: z.string(), budget: z.number(), spent: z.number(), leads: z.number(), roi: z.number() })),
      recommendations: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [postsSnap, campaignsSnap, leadsSnap] = await Promise.all([
      db.collection(`companies/${companyId}/marketingPosts`).limit(300).get(),
      db.collection(`companies/${companyId}/marketingCampaigns`).limit(50).get(),
      db.collection(`companies/${companyId}/leads`).where('source', '>=', 'marketing').where('source', '<=', 'marketing\uf8ff').limit(200).get(),
    ]);

    const posts = postsSnap.docs.map(d => d.data());
    const campaigns = campaignsSnap.docs.map(d => d.data());
    const totalLeads = leadsSnap.size;
    const totalSpend = campaigns.reduce((s, c) => s + ((c['spent'] as number) ?? (c['budget'] as number) ?? 0), 0);

    // By channel
    const channelMap = new Map<string, { posts: number; engagement: number; leads: number }>();
    posts.forEach(p => {
      const ch = (p['platform'] as string) ?? 'other';
      if (!channelMap.has(ch)) channelMap.set(ch, { posts: 0, engagement: 0, leads: 0 });
      const c = channelMap.get(ch)!; c.posts++; c.engagement += ((p['likes'] as number) ?? 0) + ((p['comments'] as number) ?? 0) + ((p['shares'] as number) ?? 0);
    });

    const byChannel = Array.from(channelMap.entries()).map(([ch, d]) => ({ channel: ch, ...d, roi: d.leads > 0 ? Math.round(d.leads / Math.max(d.posts, 1) * 100) : 0 })).sort((a, b) => b.engagement - a.engagement);

    const byCampaign = campaigns.map(c => ({ name: (c['name'] as string) ?? '', budget: (c['budget'] as number) ?? 0, spent: (c['spent'] as number) ?? 0, leads: (c['leadsGenerated'] as number) ?? 0, roi: (c['spent'] as number) > 0 ? Math.round(((c['leadsGenerated'] as number) ?? 0) / ((c['spent'] as number) ?? 1) * 1000) : 0 })).sort((a, b) => b.roi - a.roi);

    const { text } = await ai.generate({ model: GEMINI_FLASH, prompt: `Analyze marketing ROI in French. Spend: ${totalSpend}€, Leads: ${totalLeads}, Top channel: ${byChannel[0]?.channel ?? 'none'}. Give 3 short recommendations. Return JSON: {"recommendations":["rec1","rec2","rec3"]}`, config: { temperature: 0.3 } });
    let recs: string[] = [];
    try { recs = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).recommendations; } catch {}

    return { totalSpend, totalLeads, costPerLead: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0, byChannel, byCampaign, recommendations: recs };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CONTENT AI (generate full content strategy)
// ══════════════════════════════════════════════════════════════════════════════

export const contentStrategyTool = ai.defineTool(
  {
    name: 'mkt_generateContentStrategy',
    description: 'AI-powered content strategy — topic ideas, content calendar suggestions, trending formats.',
    inputSchema: z.object({ companyId: z.string(), period: z.enum(['week', 'month']).optional().default('week'), sector: z.string().optional() }),
    outputSchema: z.object({
      ideas: z.array(z.object({ topic: z.string(), platform: z.string(), format: z.string(), bestDay: z.string(), reasoning: z.string() })),
      trendingFormats: z.array(z.string()),
    }),
  },
  async ({ companyId, period, sector }) => {
    const db = getFirestore();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyName = (companyDoc.data()?.['name'] as string) ?? '';
    const companySector = sector ?? (companyDoc.data()?.['sector'] as string) ?? 'business';

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a ${period} content strategy for "${companyName}" (${companySector}) in French.
Include 5-7 content ideas with: topic, best platform (linkedin/instagram/twitter/facebook/tiktok), format (post/carousel/video/story/article), best day, and reasoning.
Also suggest 3 trending formats right now.
Return JSON: {"ideas":[{"topic":"...","platform":"...","format":"...","bestDay":"...","reasoning":"..."}],"trendingFormats":["format1","format2","format3"]}`,
      config: { temperature: 0.5 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { ideas: [], trendingFormats: [] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: COMPETITOR CONTENT ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

export const competitorContentTool = ai.defineTool(
  {
    name: 'mkt_analyzeCompetitorContent',
    description: 'Analyze competitor content strategy — what works, gaps, opportunities.',
    inputSchema: z.object({ companyId: z.string(), competitorName: z.string() }),
    outputSchema: z.object({ analysis: z.string(), strengths: z.array(z.string()), weaknesses: z.array(z.string()), opportunities: z.array(z.string()) }),
  },
  async ({ companyId, competitorName }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Analyze the content marketing strategy of "${competitorName}" in French. Identify strengths, weaknesses, and opportunities for us.
Return JSON: {"analysis":"2-3 paragraphs","strengths":["s1","s2"],"weaknesses":["w1","w2"],"opportunities":["o1","o2"]}`,
      config: { temperature: 0.4 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { analysis: '', strengths: [], weaknesses: [], opportunities: [] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: MARKETING AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════

export const marketingAutomationTool = ai.defineTool(
  {
    name: 'mkt_runAutomation',
    description: 'Marketing automation: deal won → success story, new product → campaign, competitor active → response post.',
    inputSchema: z.object({ companyId: z.string(), type: z.enum(['success_stories', 'product_launch', 'competitor_response', 'content_calendar_fill']) }),
    outputSchema: z.object({ actions: z.array(z.string()), message: z.string() }),
  },
  async ({ companyId, type }) => {
    const db = getFirestore();
    const actions: string[] = [];

    if (type === 'success_stories') {
      const wonSnap = await db.collection(`companies/${companyId}/leads`).where('stage', '==', 'gagne').limit(10).get();
      for (const doc of wonSnap.docs) {
        const lead = doc.data();
        if (lead['successPostCreated']) continue;
        const id = generateId();
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
      const result = await (contentStrategyTool as (a: unknown) => Promise<{ ideas: { topic: string; platform: string }[] }>)({ companyId, period: 'week' });
      for (const idea of (result?.ideas ?? []).slice(0, 3)) {
        const id = generateId();
        await db.collection(`companies/${companyId}/marketingPosts`).doc(id).set({
          id, platform: idea.platform, status: 'draft', content: `[IA] ${idea.topic}`,
          category: 'content_strategy', source: 'automation', createdAt: new Date(),
        });
        actions.push(`Draft ${idea.platform}: ${idea.topic}`);
      }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action.' };
  }
);

const ALL_TOOLS = [
  generatePostTool, getPostsTool, getCalendarTool, schedulePostTool,
  createCampaignTool, getCampaignsTool, writeContentTool,
  seoAnalysisTool, getStatsTool,
  publishPostTool, submitForReviewTool, approvePostTool,
  getPostPerformanceTool, getBrandProfileTool, getLeadAttributionTool,
  // PRO
  roiAnalyticsTool, contentStrategyTool, competitorContentTool, marketingAutomationTool,
];

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});
const OUTPUT = z.object({ response: z.string(), contentDraft: z.string().optional(), requiresApproval: z.boolean() });

export const marketingAgentFlow = ai.defineFlow(
  { name: 'marketingAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[MarketingAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
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
      const companyDoc = await getFirestore().collection('companies').doc(companyId).get();
      const c = companyDoc.data() ?? {};
      companyCurrency = ((c['settings'] as Record<string, unknown>)?.['currency'] as string) ?? (c['currency'] as string) ?? 'XOF';
    } catch { /* default XOF */ }

    const executors = new Map<string, (i: unknown) => Promise<unknown>>();
    for (const tool of ALL_TOOLS) {
      const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
      if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)({ ...(i as Record<string, unknown>), companyId }));
    }

    // Build messages with history — preserves context across turns ("1", "2", "3" refer to previous list)
    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
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
      const toolResults = await Promise.all(
        response.toolRequests.map(async (p) => {
          const { name, input, ref } = p.toolRequest;
          const exec = executors.get(name);
          const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
          return { name, ref, output };
        })
      );
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools: ALL_TOOLS, config: { temperature: 0.6 },
      });
    }

    const text = response.text;
    const hasDraft = /draft|brouillon|cree|genere|scheduled/i.test(text);
    return { response: text, contentDraft: hasDraft ? text : undefined, requiresApproval: hasDraft };
  }
);

export const marketingAgentTool = ai.defineTool(
  {
    name: 'callMarketingAgent',
    description: 'Marketing PRO: social posts, ROI analytics, content strategy IA, competitor analysis, campaigns, SEO, content calendar, cross-agent automation.',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  (input) => marketingAgentFlow(input)
);
