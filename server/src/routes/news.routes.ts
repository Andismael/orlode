/**
 * News Routes PRO — Articles, Briefings, Competitors, Alerts, Bookmarks, Trending, Digest
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';

const router = Router();
router.use(authMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => { try { return await fn(); } catch { return fallback; } };

// ═══════════════════════════════════════════════════════════════════════════════
// ARTICLES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/articles', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  let q = getFirestore().collection(`companies/${cid}/newsArticles`) as FirebaseFirestore.Query;
  if (req.query['category']) q = q.where('category', '==', req.query['category']);
  if (req.query['importance']) q = q.where('importance', '==', req.query['importance']);
  const snap = await q.orderBy('savedAt', 'desc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// BRIEFINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/briefings', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/newsBriefings`).orderBy('createdAt', 'desc').limit(20).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.get('/briefings/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/newsBriefings`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Briefing not found', 404);
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// Trigger new briefing via agent
router.post('/briefings/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { newsAgentFlow } = await import('../agents/news.agent');
    const topics = (req.body as Record<string, unknown>)['topics'] as string[] ?? ['breaking news', 'business', 'technology'];
    const result = await newsAgentFlow({ request: `Generate a news briefing. Topics: ${topics.join(', ')}`, companyId: cid, language: 'fr' });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Generation echouee' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITORS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/competitors', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/competitors`).limit(20).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/competitors', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const comp = { id, name: body['name'] ?? '', website: body['website'] ?? '', sector: body['sector'] ?? '', notes: body['notes'] ?? '', addedAt: new Date(), addedBy: req.user!.uid };
  await getFirestore().collection(`companies/${cid}/competitors`).doc(id).set(comp);
  res.status(201).json({ success: true, data: comp });
}));

router.delete('/competitors/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/competitors`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// Analyze competitor via agent
router.post('/competitors/:id/analyze', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/competitors`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Competitor not found', 404);
  const name = (doc.data()!['name'] as string) ?? '';
  try {
    const { trackCompetitorTool } = await import('../agents/news.agent');
    const result = await (trackCompetitorTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'analyze', competitorName: name, sector: doc.data()!['sector'] });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Analyse echouee' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/alerts/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/settings`).doc('newsConfig').get();
  res.json({ success: true, data: doc.exists ? doc.data() : { keywords: [], schedule: ['07:00', '12:00', '18:00'], categories: ['business', 'technology'], notifyChannels: ['in_app'], enabled: false } });
}));

router.post('/alerts/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/settings`).doc('newsConfig').set({ ...(req.body as Record<string, unknown>), updatedAt: new Date() }, { merge: true });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/bookmarks', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/newsBookmarks`).orderBy('savedAt', 'desc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/bookmarks', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  await getFirestore().collection(`companies/${cid}/newsBookmarks`).doc(id).set({
    id, title: body['title'] ?? '', summary: body['summary'] ?? '', source: body['source'] ?? '',
    url: body['url'] ?? null, notes: body['notes'] ?? '', userId: req.user!.uid, savedAt: new Date(),
  });
  res.status(201).json({ success: true, data: { id } });
}));

router.delete('/bookmarks/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/newsBookmarks`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TRENDING
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/trending', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { getTrendingTool } = await import('../agents/news.agent');
    const result = await (getTrendingTool as (args: unknown) => Promise<unknown>)({ companyId: cid, sector: req.query['sector'] as string, language: 'fr' });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { trending: [] } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SENTIMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sentiment', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const topic = (req.query['topic'] as string) ?? 'business';
  try {
    const { analyzeSentimentTool } = await import('../agents/news.agent');
    const result = await (analyzeSentimentTool as (args: unknown) => Promise<unknown>)({ companyId: cid, topic, language: 'fr' });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { topic, overallSentiment: 'neutral', score: 0.5 } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// DIGEST
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/digest/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { generateDigestTool } = await import('../agents/news.agent');
    const result = await (generateDigestTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, period: (req.body as Record<string, string>)['period'] ?? 'daily', language: 'fr',
    });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Generation echouee' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const [artSnap, briefSnap, compSnap, bookSnap, configDoc] = await Promise.all([
    db.collection(`companies/${cid}/newsArticles`).limit(500).get(),
    db.collection(`companies/${cid}/newsBriefings`).limit(50).get(),
    db.collection(`companies/${cid}/competitors`).limit(20).get(),
    db.collection(`companies/${cid}/newsBookmarks`).limit(100).get(),
    db.collection(`companies/${cid}/settings`).doc('newsConfig').get(),
  ]);
  const articles = artSnap.docs.map(d => d.data());
  const categories: Record<string, number> = {};
  const sentiments: Record<string, number> = {};
  articles.forEach(a => {
    const c = (a['category'] as string) ?? 'other'; categories[c] = (categories[c] ?? 0) + 1;
    const s = (a['sentiment'] as string) ?? 'neutral'; sentiments[s] = (sentiments[s] ?? 0) + 1;
  });
  res.json({ success: true, data: {
    totalArticles: artSnap.size, totalBriefings: briefSnap.size,
    competitors: compSnap.size, bookmarks: bookSnap.size,
    alertsEnabled: configDoc.data()?.['enabled'] ?? false,
    alertKeywords: (configDoc.data()?.['keywords'] as string[]) ?? [],
    byCategory: Object.entries(categories).map(([k, v]) => ({ category: k, count: v })).sort((a, b) => b.count - a.count),
    bySentiment: sentiments,
  }});
}));

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE (correlation + smart alerts + auto-actions)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/news/intelligence/run — run full pipeline
router.post('/intelligence/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { runFullIntelligencePipeline } = await import('../services/newsIntelligence');
    const result = await runFullIntelligencePipeline(cid);
    res.json({ success: true, data: result });
  } catch (err) { res.json({ success: true, data: { insights: [], alerts: [], actions: [], error: String(err) } }); }
}));

// GET /api/news/insights — correlation insights
router.get('/insights', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/newsInsights`).orderBy('createdAt', 'desc').limit(20).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// GET /api/news/alerts — smart alerts
router.get('/alerts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/newsAlerts`).orderBy('createdAt', 'desc').limit(20).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// GET /api/news/auto-actions — history of automatic actions
router.get('/auto-actions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/newsAutoActions`).orderBy('executedAt', 'desc').limit(20).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

export default router;
