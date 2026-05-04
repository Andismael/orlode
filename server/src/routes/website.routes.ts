/**
 * Website Routes — full website builder API.
 *
 *   GET    /api/website/config       — load current site config
 *   PUT    /api/website/config       — save site (manual builder + wizard publish)
 *   POST   /api/website/generate     — AI generation (calls generateWebsiteTool)
 *   POST   /api/website/update       — AI in-builder modifications (calls updateWebsiteTool)
 *   POST   /api/website/leads        — public lead capture from the widget chat (no auth)
 *   GET    /api/website/leads        — list captured leads
 *   GET    /api/website/preview/:cid — public site preview JSON for static HTML render
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response, Request } from 'express';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

// ── PUBLIC endpoints (no auth) — must be declared BEFORE router.use(authMiddleware) ──

// POST /api/website/leads/:companyId — capture a lead from the public widget chat
router.post('/leads/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params as { companyId: string };
  if (!companyId) throw new AppError('companyId required', 400);

  const { name, email, phone, message, source } = req.body as {
    name?: string; email?: string; phone?: string; message?: string; source?: string;
  };
  if (!email && !phone) throw new AppError('email or phone required', 400);

  const db = getFirestore();
  // Verify the company actually has a website (defense against scraping random IDs)
  const cfg = await db.collection(`companies/${companyId}/website`).doc('config').get();
  if (!cfg.exists) throw new AppError('Site not found', 404);

  const ref = await db.collection(`companies/${companyId}/website/config/leads`).add({
    name: name?.slice(0, 200) ?? null,
    email: email?.slice(0, 200) ?? null,
    phone: phone?.slice(0, 50) ?? null,
    message: message?.slice(0, 2000) ?? null,
    source: source?.slice(0, 50) ?? 'widget',
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info('[Website] Lead captured', { companyId, leadId: ref.id });
  res.json({ success: true, data: { leadId: ref.id } });
}));

// GET /api/website/preview/:companyId — public site JSON for static rendering
router.get('/preview/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params as { companyId: string };
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/website`).doc('config').get();
  if (!doc.exists) throw new AppError('Site not found', 404);
  const data = doc.data()!;
  // Only expose published sites publicly
  if ((data['status'] as string) !== 'published') throw new AppError('Site not published', 404);
  res.json({
    success: true,
    data: {
      content:      data['content']      ?? {},
      template:     data['template']     ?? 'vitrine',
      style:        data['style']        ?? 'modern',
      color:        data['color']        ?? '#6c3ce0',
      companyName:  data['companyName']  ?? '',
      widgetEnabled: data['widgetEnabled'] ?? true,
    },
  });
}));

// ── AUTHENTICATED endpoints ──────────────────────────────────────────────────

router.use(authMiddleware);

// GET /api/website/config — load current site config
router.get('/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/website`).doc('config').get();
  res.json({ success: true, data: doc.exists ? doc.data() : null });
}));

// PUT /api/website/config — save site config
// Accepts both the old shape ({ content, color, template, ... }) AND the new
// wizard shape ({ name, tagline, services, sections, primaryColor, ... }).
// We normalize into a single doc that the manual builder + wizard + preview all use.
router.put('/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const body = req.body as Record<string, unknown>;
  const db = getFirestore();

  // Filter out undefined values — Firestore rejects undefined fields.
  const allowedKeys = [
    // Core / manual builder
    'content', 'color', 'template', 'companyName', 'status', 'slug', 'widgetEnabled', 'pages',
    // Wizard / AI-generated metadata
    'enabled', 'name', 'tagline', 'services', 'primaryColor', 'secondaryColor',
    'type', 'audience', 'tone', 'cta', 'sections', 'sourceUrl', 'generatedBy',
    // AI-generated content tree (wizard puts site copy here)
    'aiContent', 'industry', 'language', 'style',
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowedKeys) {
    if (body[k] !== undefined) update[k] = body[k];
  }

  // Sensible defaults for first-save scenarios — only set if missing
  if (update['status']        === undefined) update['status']        = 'draft';
  if (update['widgetEnabled'] === undefined) update['widgetEnabled'] = true;
  update['updatedAt'] = FieldValue.serverTimestamp();

  await db.collection(`companies/${companyId}/website`).doc('config').set(update, { merge: true });
  res.json({ success: true, data: { fieldsSaved: Object.keys(update).length } });
}));

// POST /api/website/generate — AI generation (lazy-import to keep cold-start lean)
router.post('/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const {
    template = 'vitrine',
    style    = 'modern',
    color    = '#6c3ce0',
    pages    = ['home', 'about', 'services', 'contact'],
    language = 'fr',
    provider, // 'claude' | 'gemini' | 'openai' — recorded but real switch is a follow-up
  } = req.body as {
    template?: 'vitrine' | 'ecommerce' | 'listing';
    style?: 'modern' | 'minimal' | 'bold' | 'african' | 'corporate';
    color?: string;
    pages?: string[];
    language?: string;
    provider?: 'claude' | 'gemini' | 'openai';
  };

  const { generateWebsiteTool } = await import('../agents/website.agent');
  try {
    const out = await generateWebsiteTool({ companyId, template, style, color, pages, language });
    // Stamp the chosen provider for the success-state copy in the UI
    if (provider) {
      const db = getFirestore();
      await db.collection(`companies/${companyId}/website`).doc('config').set(
        { generatedByProvider: provider, generatedByLabel: provider, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    res.json({ success: true, data: out });
  } catch (err) {
    logger.error('[Website] Generation failed', { err: String(err), companyId });
    throw new AppError(`Generation failed: ${(err as Error).message ?? String(err)}`, 502);
  }
}));

// POST /api/website/update — AI modifications (chat from the manual builder)
router.post('/update', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { instruction } = req.body as { instruction?: string };
  if (!instruction?.trim()) throw new AppError('instruction required', 400);

  const { updateWebsiteTool } = await import('../agents/website.agent');
  try {
    const out = await updateWebsiteTool({ companyId, instruction });
    res.json({ success: true, data: out });
  } catch (err) {
    logger.error('[Website] Update failed', { err: String(err), companyId });
    throw new AppError(`Update failed: ${(err as Error).message ?? String(err)}`, 502);
  }
}));

// GET /api/website/leads — list captured leads
router.get('/leads', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/website/config/leads`)
    .orderBy('createdAt', 'desc').limit(100).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

export default router;
