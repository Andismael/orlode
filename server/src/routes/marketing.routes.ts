/**
 * Marketing Routes PRO — Posts · Campaigns · Calendar · Content · Stats
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { requireAgentRole } from '../middleware/agentRbac.middleware';

const router = Router();
router.use(authMiddleware);
router.use(requireAgentRole('marketing'));

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

function serializeDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && '_seconds' in (val as Record<string, unknown>)) {
      out[key] = new Date((val as { _seconds: number })._seconds * 1000).toISOString();
    } else if (val && typeof val === 'object' && 'toDate' in (val as Record<string, unknown>) && typeof (val as { toDate: unknown }).toDate === 'function') {
      out[key] = ((val as { toDate: () => Date }).toDate()).toISOString();
    } else if (Array.isArray(val)) {
      out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item as Record<string, unknown>) : item);
    } else { out[key] = val; }
  }
  return out;
}
function serializeSnap(doc: FirebaseFirestore.QueryDocumentSnapshot) { return { id: doc.id, ...serializeDoc(doc.data()) }; }

// ═══════════════════════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/marketingPosts`) as FirebaseFirestore.Query;
    if (req.query['status'] && req.query['status'] !== 'all') q = q.where('status', '==', req.query['status']);
    if (req.query['platform']) q = q.where('platform', '==', req.query['platform']);
    return (await q.limit(100).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.post('/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const post = {
    id, companyId: cid, platform: body['platform'] ?? 'linkedin',
    text: body['text'] ?? '', topic: body['topic'] ?? '', tone: body['tone'] ?? 'professional',
    hashtags: Array.isArray(body['hashtags']) ? body['hashtags'] : [],
    status: body['status'] ?? 'draft', scheduledAt: body['scheduledAt'] ?? null,
    campaignId: body['campaignId'] ?? null, type: 'social_post',
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/marketingPosts`).doc(id).set(post);
  res.status(201).json({ success: true, data: post });
}));

router.patch('/posts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/marketingPosts`).doc(req.params.id)
    .update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/posts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// AI generate
router.post('/posts/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { topic, platform, tone, includeVariant } = req.body as { topic: string; platform?: string; tone?: string; includeVariant?: boolean };
  if (!topic) throw new AppError('topic required', 400);
  try {
    const { marketingAgentFlow } = await import('../agents/marketing.agent');
    const prompt = `Generate a ${tone ?? 'professional'} post for ${platform ?? 'LinkedIn'} about "${topic}".${includeVariant ? ' Include an A/B variant.' : ''}`;
    const result = await marketingAgentFlow({ request: prompt, companyId: cid, language: 'fr' });
    res.json({ success: true, data: { text: result.response } });
  } catch {
    res.json({ success: true, data: { text: `Post sur "${topic}" — generez manuellement.` } });
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/campaigns', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/campaigns`) as FirebaseFirestore.Query;
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    return (await q.limit(50).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.post('/campaigns', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const campaign = {
    id, companyId: cid, name: body['name'] ?? '', objective: body['objective'] ?? '',
    platforms: Array.isArray(body['platforms']) ? body['platforms'] : [],
    budget: body['budget'] ?? 0, startDate: body['startDate'] ?? '', endDate: body['endDate'] ?? '',
    status: 'planning', postsCount: 0,
    metrics: { impressions: 0, clicks: 0, conversions: 0, engagement: 0 },
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/campaigns`).doc(id).set(campaign);
  res.status(201).json({ success: true, data: campaign });
}));

router.patch('/campaigns/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/campaigns`).doc(req.params.id)
    .update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/campaigns/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/campaigns`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// INFLUENCERS — minimal CRM (V1). DM tracking + status pipeline.
// Persisted at companies/{cid}/influencers/{id}.
// ═══════════════════════════════════════════════════════════════════════════════

const INFLUENCER_STATUSES = ['prospect', 'contacted', 'replied', 'active', 'lost'] as const;

router.get('/influencers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/influencers`) as FirebaseFirestore.Query;
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    return (await q.limit(500).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.post('/influencers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const b = req.body as Record<string, unknown>;
  const name = String(b['name'] ?? '').trim();
  if (!name) throw new AppError('name required', 400);
  const id = generateId();
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
    status: (INFLUENCER_STATUSES as readonly string[]).includes(String(b['status'])) ? String(b['status']) : 'prospect',
    notes: String(b['notes'] ?? '').trim(),
    dmSentAt: null as Date | null,
    dmRepliedAt: null as Date | null,
    createdBy: req.user!.uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/influencers`).doc(id).set(doc);
  res.status(201).json({ success: true, data: doc });
}));

router.post('/influencers/import', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new AppError('rows[] required', 400);
  if (rows.length > 500) throw new AppError('Max 500 influencers per import', 400);

  const db = getFirestore();
  const batch = db.batch();
  const col = db.collection(`companies/${cid}/influencers`);
  let imported = 0;
  for (const r of rows) {
    const name = String(r?.name ?? '').trim();
    if (!name) continue;
    const id = generateId();
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
      createdBy: req.user!.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    imported++;
  }
  await batch.commit();
  res.json({ success: true, data: { imported } });
}));

router.patch('/influencers/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const patch: Record<string, unknown> = { ...(req.body as Record<string, unknown>), updatedAt: new Date() };
  // Stamp dmSentAt / dmRepliedAt when status transitions through the pipeline.
  if (patch['status'] === 'contacted' && !patch['dmSentAt']) patch['dmSentAt'] = new Date();
  if (patch['status'] === 'replied' && !patch['dmRepliedAt']) patch['dmRepliedAt'] = new Date();
  await getFirestore().collection(`companies/${cid}/influencers`).doc(req.params.id).update(patch);
  res.json({ success: true });
}));

router.delete('/influencers/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/influencers`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/calendar', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { month, year } = req.query as { month?: string; year?: string };
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/marketingPosts`).limit(200).get();
    const all = snap.docs.map(serializeSnap) as (Record<string, unknown> & { scheduledAt?: string })[];
    let posts = all.filter(p => p.scheduledAt);
    if (month && year) {
      const m = parseInt(month), y = parseInt(year);
      posts = posts.filter(p => { const d = new Date(p.scheduledAt!); return d.getMonth() + 1 === m && d.getFullYear() === y; });
    }
    posts.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
    return posts;
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT (articles, newsletters)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/content', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/marketingContent`) as FirebaseFirestore.Query;
    if (req.query['type']) q = q.where('type', '==', req.query['type']);
    return (await q.limit(100).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.post('/content', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const content = {
    id, companyId: cid, type: body['type'] ?? 'blog', title: body['title'] ?? '', content: body['content'] ?? '',
    tone: body['tone'] ?? 'professional', status: 'draft',
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/marketingContent`).doc(id).set(content);
  res.status(201).json({ success: true, data: content });
}));

router.delete('/content/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/marketingContent`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SEO (AI-powered)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/marketing/images/generate — Gemini/Imagen image generation for posts & flyers.
// Body: { prompt: string, style?: string, format?: '1:1'|'16:9'|'9:16'|'4:5' }
// Returns: { url: string } where url is a public Storage URL (or a data URL fallback).
router.post('/images/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId;
  if (!cid) throw new AppError('Company ID required', 400);
  const { prompt, style, format } = req.body as { prompt: string; style?: string; format?: string };
  if (!prompt || !prompt.trim()) throw new AppError('prompt required', 400);

  const aspect = format === '16:9' ? '16:9' : format === '9:16' ? '9:16' : format === '4:5' ? '4:5' : '1:1';
  const styleHint = style === 'illustration' ? 'flat illustration, vibrant'
    : style === 'minimalist' ? 'minimalist, lots of whitespace'
    : style === 'cinematic' ? 'cinematic photography, dramatic lighting'
    : 'professional photography, natural lighting, premium look';
  const finalPrompt = `${prompt}. Style: ${styleHint}. Format: ${aspect}. No text overlay.`;

  type MediaItem = { url?: string; contentType?: string };
  function extractImage(response: unknown): { buffer: Buffer; contentType: string } | null {
    const r = response as { media?: MediaItem | MediaItem[]; message?: { content?: Array<{ media?: MediaItem }> } };
    const candidates: MediaItem[] = [];
    if (r.media) Array.isArray(r.media) ? candidates.push(...r.media) : candidates.push(r.media);
    for (const part of r.message?.content ?? []) if (part?.media) candidates.push(part.media);
    for (const c of candidates) {
      if (!c.url) continue;
      const match = /^data:([^;]+);base64,(.+)$/.exec(c.url);
      if (match) return { buffer: Buffer.from(match[2] ?? '', 'base64'), contentType: match[1] ?? 'image/png' };
    }
    return null;
  }

  const { ai } = await import('../config/genkit.config');
  const candidates = [
    { model: 'googleai/gemini-2.5-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.5-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.0-flash-preview-image-generation', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/imagen-3.0-generate-001', config: { numberOfImages: 1, aspectRatio: aspect } },
  ];

  let imageBuffer: Buffer | null = null;
  let contentType = 'image/png';
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const response = await ai.generate({ model: c.model, prompt: finalPrompt, config: c.config });
      const extracted = extractImage(response);
      if (extracted) { imageBuffer = extracted.buffer; contentType = extracted.contentType; break; }
      errors.push(`${c.model}: no image data`);
    } catch (err) {
      errors.push(`${c.model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!imageBuffer) {
    throw new AppError(`Image generation unavailable. Last error: ${errors[errors.length - 1] ?? 'unknown'}`, 503);
  }

  try {
    const { getStorage } = await import('../config/firebase.config');
    const bucket = getStorage().bucket();
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
    const storagePath = `companies/${cid}/marketing/generated/${Date.now()}.${ext}`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(imageBuffer, { metadata: { contentType } });
    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    res.json({ success: true, data: { url } });
  } catch {
    // Fallback to data URL if Storage upload fails — image is still usable in the modal.
    const url = `data:${contentType};base64,${imageBuffer.toString('base64')}`;
    res.json({ success: true, data: { url } });
  }
}));

router.post('/seo/analyze', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { topic } = req.body as { topic: string };
  if (!topic) throw new AppError('topic required', 400);
  try {
    const { ai, GEMINI_FLASH } = await import('../config/genkit.config');
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `SEO analysis for "${topic}" in French. Return JSON: {"keywords":["..."],"titleSuggestions":["..."],"metaDescription":"...","tips":["..."]} ONLY.`,
      config: { temperature: 0.4 },
    });
    const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    res.json({ success: true, data: parsed });
  } catch {
    res.json({ success: true, data: { keywords: [topic], titleSuggestions: [topic], metaDescription: '', tips: [] } });
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [postsSnap, campsSnap, contentSnap] = await Promise.all([
      db.collection(`companies/${cid}/marketingPosts`).limit(500).get(),
      db.collection(`companies/${cid}/campaigns`).limit(50).get(),
      db.collection(`companies/${cid}/marketingContent`).limit(100).get(),
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
    return {
      totalPosts: posts.length, drafts, scheduled, published,
      totalCampaigns: camps.length, activeCampaigns: camps.filter(c => c['status'] === 'active').length,
      totalBudget: camps.reduce((s, c) => s + ((c['budget'] as number) ?? 0), 0),
      totalContent: contentSnap.size,
      byPlatform: Object.entries(byPlatform).map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count),
    };
  }, { totalPosts: 0, drafts: 0, scheduled: 0, published: 0, totalCampaigns: 0, activeCampaigns: 0, totalBudget: 0, totalContent: 0, byPlatform: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// POST WORKFLOW (review / approve / publish)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/posts/:id/submit-review', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).update({ status: 'review', submittedAt: new Date(), updatedAt: new Date() });
  res.json({ success: true });
}));

router.post('/posts/:id/approve', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { approved, feedback } = req.body as { approved: boolean; feedback?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (approved) { updates['status'] = 'scheduled'; updates['approvedAt'] = new Date(); }
  else { updates['status'] = 'draft'; updates['reviewFeedback'] = feedback ?? ''; }
  await getFirestore().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).update(updates);
  res.json({ success: true });
}));

router.post('/posts/:id/publish', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/marketingPosts`).doc(req.params.id).update({ status: 'published', publishedAt: new Date(), updatedAt: new Date() });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/brand', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [companyDoc, brandDoc] = await Promise.all([
      db.collection('companies').doc(cid).get(),
      db.collection(`companies/${cid}/settings`).doc('brand').get(),
    ]);
    const c = companyDoc.data() ?? {}; const b = brandDoc.data() ?? {};
    return { name: c['name'] ?? '', slogan: c['slogan'] ?? b['slogan'] ?? '', tone: b['tone'] ?? 'professional', targetAudience: b['targetAudience'] ?? '', guidelines: b['guidelines'] ?? [] };
  }, { name: '', slogan: '', tone: 'professional', targetAudience: '', guidelines: [] });
  res.json({ success: true, data });
}));

router.patch('/brand', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/settings`).doc('brand').set(req.body as Record<string, unknown>, { merge: true });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD ATTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/attribution', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/leads`).limit(500).get();
    const bySource: Record<string, number> = {};
    for (const d of snap.docs) { const s = (d.data()['source'] as string) ?? 'other'; bySource[s] = (bySource[s] ?? 0) + 1; }
    return { bySource: Object.entries(bySource).map(([source, leads]) => ({ source, leads })).sort((a, b) => b.leads - a.leads), totalLeads: snap.size };
  }, { bySource: [], totalLeads: 0 });
  res.json({ success: true, data });
}));

// PRO routes
router.get('/roi', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { roiAnalyticsTool } = await import('../agents/marketing.agent');
  res.json({ success: true, data: await (roiAnalyticsTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/content-strategy', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { contentStrategyTool } = await import('../agents/marketing.agent');
  res.json({ success: true, data: await (contentStrategyTool as (a: unknown) => Promise<unknown>)({ companyId: cid, period: req.query['period'] ?? 'week' }) });
}));

router.post('/competitor-analysis', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { competitorContentTool } = await import('../agents/marketing.agent');
  res.json({ success: true, data: await (competitorContentTool as (a: unknown) => Promise<unknown>)({ companyId: cid, competitorName: (req.body as Record<string, string>)['competitorName'] ?? '' }) });
}));

router.post('/automation/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { marketingAutomationTool } = await import('../agents/marketing.agent');
  res.json({ success: true, data: await (marketingAutomationTool as (a: unknown) => Promise<unknown>)({ companyId: cid, type: (req.body as Record<string, string>)['type'] ?? 'content_calendar_fill' }) });
}));

export default router;
