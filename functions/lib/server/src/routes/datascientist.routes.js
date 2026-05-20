"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Data Scientist Routes — V1 mocks for the redesign page.
 *
 * Endpoints (auth required):
 *   GET  /api/datascientist/snapshot      — module-by-module KPIs + sparklines
 *   GET  /api/datascientist/correlations  — 7×7 matrix
 *   POST /api/datascientist/analyze       — free-form question → mock insight
 *   POST /api/datascientist/predict       — forecast for a metric+horizon
 *   GET  /api/datascientist/auto-insights — 3 hardcoded high-impact findings
 *
 * V1 returns mock-realistic data; real impl can later plug in the
 * datascientist.agent.ts tools. This unblocks the front-end redesign.
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const featureFlags_1 = require("../config/featureFlags");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── Feature flag gate ──────────────────────────────────────────────────────
// The Data Scientist agent is gated behind a whitelist while we replace
// mocked data with real calculations. Non-whitelisted tenants get a 403
// with `error: 'feature_disabled'` so the frontend can show its
// "arrive bientôt" empty state.
router.use((req, res, next) => {
    if (!(0, featureFlags_1.isDataScientistEnabled)(req.user?.companyId)) {
        return res.status(403).json({
            success: false,
            error: 'feature_disabled',
            message: 'Cet agent est en bêta — disponible bientôt.',
        });
    }
    next();
});
// ── Helpers ────────────────────────────────────────────────────────────────
function rngSparkline(seed, n = 12, base = 30, jitter = 18) {
    // Deterministic pseudo-random sparkline so the same companyId yields
    // the same shape across refreshes — feels stable, not chaotic.
    const out = [];
    let s = seed || 1;
    for (let i = 0; i < n; i++) {
        s = (s * 9301 + 49297) % 233280;
        const r = s / 233280;
        out.push(Math.round(base + (r - 0.5) * jitter * 2));
    }
    return out;
}
function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
// ── GET /snapshot ──────────────────────────────────────────────────────────
router.get('/snapshot', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId ?? 'anon';
    const seed = hashStr(companyId);
    res.json({
        success: true,
        data: {
            modules: {
                sales: { value: 47, delta: 12, sparkline: rngSparkline(seed + 1, 12, 38, 14) },
                hr: { value: 24, delta: 0, sparkline: rngSparkline(seed + 2, 12, 24, 4) },
                support: { value: 8, delta: -5, sparkline: rngSparkline(seed + 3, 12, 12, 6) },
                finance: { value: 12500, delta: 8, sparkline: rngSparkline(seed + 4, 12, 11000, 3500) },
                marketing: { value: 1240, delta: 22, sparkline: rngSparkline(seed + 5, 12, 1100, 400) },
                it: { value: 3, delta: 0, sparkline: rngSparkline(seed + 6, 12, 4, 3) },
                reception: { value: 18, delta: 4, sparkline: rngSparkline(seed + 7, 12, 16, 8) },
            },
            generatedAt: new Date().toISOString(),
        },
    });
}));
// ── GET /correlations ──────────────────────────────────────────────────────
router.get('/correlations', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Symmetric matrix, diagonal = 1.
    // Realistic-ish strengths derived from common business intuitions.
    const labels = ['sales', 'marketing', 'hr', 'support', 'finance', 'it', 'reception'];
    const m = [
        //         sales  mkt    hr     supp   fin    it     rec
        /*sales*/ [1.00, 0.78, -0.12, 0.31, 0.65, -0.05, 0.42],
        /*mkt*/ [0.78, 1.00, 0.04, 0.22, 0.48, -0.02, 0.36],
        /*hr*/ [-0.12, 0.04, 1.00, -0.55, 0.18, 0.21, 0.08],
        /*supp*/ [0.31, 0.22, -0.55, 1.00, -0.08, 0.44, 0.12],
        /*fin*/ [0.65, 0.48, 0.18, -0.08, 1.00, 0.09, 0.27],
        /*it*/ [-0.05, -0.02, 0.21, 0.44, 0.09, 1.00, 0.03],
        /*rec*/ [0.42, 0.36, 0.08, 0.12, 0.27, 0.03, 1.00],
    ];
    res.json({ success: true, data: { labels, matrix: m } });
}));
// ── POST /analyze ──────────────────────────────────────────────────────────
router.post('/analyze', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const question = String(req.body?.question ?? '').slice(0, 500);
    // V1 mock — returns a deterministic-ish answer based on the question text.
    // Real impl would call ds_findCorrelations + ai.generate.
    const q = question.toLowerCase();
    let summary = 'Analyse en cours sur les modules disponibles.';
    let detail = 'Les corrélations détectées suggèrent un lien modéré entre les modules cités, sans cause directe identifiée.';
    if (q.includes('marketing') && (q.includes('vente') || q.includes('sales'))) {
        summary = 'Forte corrélation marketing → ventes (r = 0.78).';
        detail = 'Sur les 90 derniers jours, chaque semaine avec ≥3 posts publiés est suivie d\'une hausse moyenne de +18% de leads la semaine suivante. Maintiens la cadence.';
    }
    else if (q.includes('rh') || q.includes('hr') || q.includes('présence')) {
        summary = 'Corrélation négative présence ↔ tickets support (r = -0.55).';
        detail = 'Les jours avec moins de 70% de présence voient le temps de résolution augmenter de ~40%. Évite les ponts/congés groupés sur le pôle support.';
    }
    else if (q.includes('cash') || q.includes('finance') || q.includes('trésorerie')) {
        summary = 'Le cash flow suit les ventes avec un décalage de 30 jours.';
        detail = 'Chaque pic de leads gagnés se traduit en trésorerie ~30 jours plus tard (délai moyen de paiement). Active la relance à J+15 pour réduire ce décalage.';
    }
    else if (question.trim().length > 0) {
        summary = `Question reçue : "${question.slice(0, 80)}"`;
        detail = 'Pas de corrélation forte détectée pour cette question. Essaie de la reformuler en citant 2 modules précis (ex: "ventes vs marketing").';
    }
    res.json({ success: true, data: { question, summary, detail, confidence: 0.72 } });
}));
// ── POST /predict ──────────────────────────────────────────────────────────
router.post('/predict', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const metric = String(req.body?.metric ?? 'revenue');
    const horizonMonths = Math.max(1, Math.min(12, Number(req.body?.horizonMonths ?? 3)));
    // Build 6 past months + N predicted months.
    // Mock with mild upward trend + light noise.
    const now = new Date();
    const monthLabel = (offset) => {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        return d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' });
    };
    const baseByMetric = {
        revenue: 8500,
        leads: 40,
        tickets: 12,
        effectif: 22,
    };
    const base = baseByMetric[metric] ?? 1000;
    const trend = base * 0.05; // +5% per month average
    const past = [];
    for (let i = -6; i < 0; i++) {
        const noise = (Math.sin(i * 1.7) * 0.07) * base;
        past.push({
            month: monthLabel(i),
            value: Math.round(base + trend * (i + 6) + noise),
            type: 'past',
        });
    }
    const predicted = [];
    for (let i = 0; i < horizonMonths; i++) {
        const value = Math.round(base + trend * (6 + i) + (Math.sin(i * 0.9) * 0.04) * base);
        const spread = Math.round(value * (0.08 + i * 0.03)); // wider band further out
        predicted.push({
            month: monthLabel(i + 1),
            value,
            low: value - spread,
            high: value + spread,
            type: 'predicted',
        });
    }
    const factors = [
        'Tendance saisonnière (printemps = +12% historique)',
        'Croissance leads continue depuis 3 mois',
        'Réduction des annulations clients (-8% mois précédent)',
    ];
    res.json({ success: true, data: { metric, horizonMonths, past, predicted, factors } });
}));
// ── GET /auto-insights ─────────────────────────────────────────────────────
router.get('/auto-insights', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'i1', score: 87, message: 'Tes ventes augmentent de 23% quand le marketing publie 3+ fois/semaine.', pair: ['sales', 'marketing'] },
            { id: 'i2', score: 72, message: 'Le support reçoit +40% de tickets dans les 7 jours après un lancement produit.', pair: ['support', 'marketing'] },
            { id: 'i3', score: 64, message: 'Tes meilleurs commerciaux ferment 2.3× plus de deals avec leads chauds (score ≥ 70).', pair: ['sales', 'hr'] },
        ],
    });
}));
exports.default = router;
//# sourceMappingURL=datascientist.routes.js.map