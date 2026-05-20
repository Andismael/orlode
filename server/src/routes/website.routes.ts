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
// Serves a rendered HTML preview of the site.
// Default response = HTML (what users open in a browser tab).
// Pass `?format=json` to get the raw config payload instead (for API consumers).
//
// Status check:
//   - status='published' → public preview anyone can view
//   - status='draft'     → also returns HTML but only when an authenticated admin
//                          of THIS company calls it (we accept Bearer token here
//                          so the in-app "Aperçu" button works on drafts too).
router.get('/preview/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params as { companyId: string };
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/website`).doc('config').get();
  if (!doc.exists) throw new AppError('Site not found — generate it first via /admin/website/builder.', 404);
  const data = doc.data()!;
  const status = (data['status'] as string) ?? 'draft';

  // Drafts: require the caller to be an authenticated admin of the same company.
  if (status !== 'published') {
    const authHeader = (req.header('authorization') ?? '').trim();
    const isAdminOfSameCompany = await (async () => {
      if (!authHeader.startsWith('Bearer ')) return false;
      try {
        const { getAuth } = await import('../config/firebase.config');
        const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
        return decoded.companyId === companyId;
      } catch { return false; }
    })();
    if (!isAdminOfSameCompany) {
      // Public draft = friendly stub instead of JSON 404 — guides the user
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Site non publié</title></head><body style="font-family:system-ui;max-width:520px;margin:80px auto;padding:32px;text-align:center;">
<h1 style="font-size:22px;margin:0 0 12px;">Ce site n'est pas encore publié</h1>
<p style="color:#6b7280;font-size:14px;">L'administrateur peut publier le site depuis le builder pour le rendre visible publiquement.</p>
</body></html>`);
      return;
    }
  }

  // JSON API response when explicitly requested
  if ((req.query['format'] as string) === 'json') {
    res.json({
      success: true,
      data: {
        content:      data['content']      ?? {},
        template:     data['template']     ?? 'vitrine',
        style:        data['style']        ?? 'modern',
        color:        data['color']        ?? '#6c3ce0',
        companyName:  data['companyName']  ?? '',
        widgetEnabled: data['widgetEnabled'] ?? true,
        status,
      },
    });
    return;
  }

  // Two paths:
  //   (a) Imported HTML — user pasted a full HTML page from Claude/Gemini/Bolt → we serve it as-is.
  //       We inject the Orlode chat widget before </body> so the imported site keeps the AI assistant.
  //   (b) Generated content — we build the page from the structured `content` object using our template.
  const content = (data['content'] as Record<string, unknown>) ?? {};
  const importedHtml = (content['rawHtml'] as string) ?? (data['rawHtml'] as string) ?? '';

  let html: string;
  if (importedHtml && importedHtml.trim().length > 100) {
    const widgetEnabled = (data['widgetEnabled'] as boolean) ?? true;
    const color = (data['color'] as string) ?? (data['primaryColor'] as string) ?? '#6c3ce0';
    const widgetSnippet = widgetEnabled
      ? `<script src="https://orlode.com/embed.js" data-company="${companyId}" data-color="${color}"></script>`
      : '';
    // Inject the widget right before </body>, or append if no </body> tag found
    html = importedHtml.includes('</body>')
      ? importedHtml.replace('</body>', `${widgetSnippet}</body>`)
      : importedHtml + widgetSnippet;
  } else {
    const { generateStaticHTML } = await import('../agents/website.agent');
    html = generateStaticHTML(
      content,
      (data['companyName'] as string) ?? (data['name'] as string) ?? 'Mon Site',
      (data['color'] as string) ?? (data['primaryColor'] as string) ?? '#6c3ce0',
      companyId,
      (data['widgetEnabled'] as boolean) ?? true,
      (data['template'] as string) ?? undefined,
    );
  }
  res.set('Content-Type', 'text/html; charset=utf-8');
  // Light cache so repeat opens are fast (5 min) but still pick up updates
  res.set('Cache-Control', 'public, max-age=300');
  // Add a banner if it's a draft preview (so admin knows it's not live yet)
  if (status !== 'published') {
    const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#fbbf24;color:#78350f;padding:8px 14px;font-family:system-ui;font-size:13px;font-weight:600;text-align:center;border-bottom:1px solid #f59e0b;">⚠️ Aperçu BROUILLON — non publié. Visible uniquement par toi.</div>`;
    res.send(html.replace('<body', '<body style="padding-top:36px"').replace(/(<body[^>]*>)/, `$1${banner}`));
  } else {
    res.send(html);
  }
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

// POST /api/website/import — accept HTML pasted from Claude / Gemini / Bolt / v0 / etc.
// The user generates the site on whatever AI platform they prefer, then drops the
// HTML here. Orlode hosts it + auto-injects the chat widget. Zero coupling to a
// specific AI provider — it's a "bring-your-own-site" pattern.
router.post('/import', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const { rawHtml, importedFrom, companyName, color, publish } = req.body as {
    rawHtml?: string;
    importedFrom?: 'claude' | 'gemini' | 'openai' | 'bolt' | 'v0' | 'other';
    companyName?: string;
    color?: string;
    publish?: boolean;
  };
  if (!rawHtml?.trim()) throw new AppError('rawHtml required', 400);
  if (rawHtml.length > 5_000_000) throw new AppError('HTML too large (max 5MB)', 413);

  // Sanity check — refuse if it doesn't look like HTML at all
  const looksLikeHtml = /<\/?(html|head|body|div|section|article|main|h1|p|a|img)\b/i.test(rawHtml);
  if (!looksLikeHtml) throw new AppError('Content does not appear to be HTML', 400);

  const db = getFirestore();
  await db.collection(`companies/${companyId}/website`).doc('config').set({
    content: { rawHtml: rawHtml.trim() },
    importedFrom: importedFrom ?? 'other',
    importedAt: FieldValue.serverTimestamp(),
    template: 'imported',
    style: 'imported',
    color: color ?? '#6c3ce0',
    companyName: companyName ?? '',
    widgetEnabled: true,
    status: publish ? 'published' : 'draft',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info('[Website] Imported HTML', { companyId, source: importedFrom, sizeBytes: rawHtml.length });
  res.json({
    success: true,
    data: {
      previewUrl: `/api/website/preview/${companyId}`,
      published: !!publish,
      sizeBytes: rawHtml.length,
    },
  });
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
