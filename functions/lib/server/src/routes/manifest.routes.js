"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Per-company PWA manifest — public endpoint that returns a manifest.json
 * personalized for the given companyId. Used so each business gets its own
 * installable app with its logo + name, instead of the generic "Orlode" PWA.
 *
 * Route: GET /api/manifest/:companyId.json[?from=<safe path>]
 *
 * No auth — anyone with a company's public URL can install. Cached 5 min
 * client-side to keep Firestore reads low even on viral installs.
 *
 * The optional `?from=/path` query param is used as the manifest's
 * start_url so the installed app opens on whichever public page the
 * user installed from (clone chat, public shop, menu, etc.). The path
 * is strictly sanitized — must begin with one of the known public
 * prefixes — otherwise we fall back to /clone/{companyId}.
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/** Public paths the install flow is allowed to deep-link to via ?from=. */
const SAFE_START_PREFIXES = [
    '/business/', '/clone/', '/shop/', '/menu/', '/hotel/', '/salon/',
    '/cabinet/', '/biens/', '/residence/', '/residences/',
    '/book/', '/my/',
];
function sanitizeStartUrl(from, companyId) {
    if (!from || typeof from !== 'string')
        return `/business/${companyId}`;
    // Strip query string + fragment so the manifest's start_url is canonical.
    const path = from.split('?')[0].split('#')[0];
    if (!path.startsWith('/'))
        return `/business/${companyId}`;
    if (!SAFE_START_PREFIXES.some(p => path.startsWith(p)))
        return `/business/${companyId}`;
    // Reasonable length cap to prevent abuse / oversized manifests.
    if (path.length > 200)
        return `/business/${companyId}`;
    return path;
}
/** Truncate the company name to keep short_name installable across OSes. */
function shortName(name) {
    return name.length <= 12 ? name : name.slice(0, 12).trim();
}
// Strip any trailing ".json" from :companyId so /api/manifest/abc.json works
// whether the router treats ".json" as part of the param or the route. Express
// already routes /api/manifest/abc.json since we mount under /api/manifest, so
// :companyId will literally contain "abc.json". We handle both cases.
function unwrapCompanyId(raw) {
    if (!raw)
        return '';
    return raw.endsWith('.json') ? raw.slice(0, -5) : raw;
}
router.get('/:companyId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = unwrapCompanyId(req.params.companyId);
    if (!companyId) {
        res.status(400).json({ error: 'companyId required' });
        return;
    }
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('companies').doc(companyId).get();
    if (!snap.exists) {
        // Slug-based public pages (shop/menu/hotel/etc.) don't have a
        // companies/{id} doc — they're keyed by their own collection ID. We
        // still serve a valid manifest using the ?name / ?logo / ?color query
        // overrides the React component passes. Browsers will use this same
        // generic manifest if a real company doc was deleted but the install
        // link is still in someone's homescreen.
        logger_1.logger.info('[Manifest] No companies/{id} doc, using query overrides', { companyId });
    }
    const company = (snap.data() ?? {});
    // Allow the page-side React component to pass overrides for slug-based
    // resources (a store doesn't live under companies/{id}, but the React
    // component still has its name + logo + color in hand).
    const nameOverride = req.query['name']?.trim();
    const logoOverride = req.query['logo']?.trim();
    const colorOverride = req.query['color']?.trim();
    const name = nameOverride || company.name?.trim() || 'Orlode';
    const logo = logoOverride || company.pwaLogoUrl || company.logoUrl || '/icons/icon-512.png';
    const theme = (colorOverride && /^#[0-9A-Fa-f]{6}$/.test(colorOverride)) ? colorOverride : (company.primaryColor || '#0F5C3F');
    const fromParam = req.query['from'] ?? undefined;
    const startUrl = sanitizeStartUrl(fromParam, companyId);
    const manifest = {
        // Unique per-company id so each install is treated as a separate app
        // by Chromium / Edge — letting users install N businesses side-by-side.
        id: `/c/${companyId}`,
        name,
        short_name: shortName(name),
        description: `${name} — installé via Orlode`,
        icons: [
            { src: logo, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: logo, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        start_url: startUrl,
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: theme,
        background_color: '#FAF7F2',
        lang: 'fr',
        categories: ['business', 'productivity'],
    };
    // 5 min CDN/client cache — long enough to avoid hammering Firestore on
    // viral install flows, short enough that name/logo updates propagate fast.
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.status(200).send(JSON.stringify(manifest));
}));
exports.default = router;
//# sourceMappingURL=manifest.routes.js.map