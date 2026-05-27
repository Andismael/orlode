/**
 * Public landing-content endpoint — returns the marketing page content
 * managed by SuperAdmin via /superadmin/landing (writes to platform/landingPage).
 *
 * GET /api/landing  → { content: {...} }   no auth
 *
 * LandingV2Page fetches this on mount and uses fields as overrides on top
 * of the hardcoded French translations. Fields not present → V2 falls back
 * to its static defaults, so a partial doc is safe.
 *
 * Cached 60s client-side so the rare CMS edit propagates quickly but
 * doesn't hammer Firestore on every page load.
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getFirestore } from '../config/firebase.config';

const router = Router();

const LANDING_DOC = 'platform/landingPage';

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const db = getFirestore();
  const snap = await db.doc(LANDING_DOC).get();
  const content = snap.exists ? snap.data() : null;
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ success: true, content: content ?? {} });
}));

export default router;
