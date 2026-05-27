"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const firebase_config_1 = require("../config/firebase.config");
const router = (0, express_1.Router)();
const LANDING_DOC = 'platform/landingPage';
router.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.doc(LANDING_DOC).get();
    const content = snap.exists ? snap.data() : null;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ success: true, content: content ?? {} });
}));
exports.default = router;
//# sourceMappingURL=landing.routes.js.map