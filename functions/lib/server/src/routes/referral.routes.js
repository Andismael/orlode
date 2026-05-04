"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Referral Routes — Creator affiliate system
 * Track referrals, credit creators, commission on plans + agents
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ── PUBLIC: Track referral click (no auth) ──────────────────────────────────
// GET /api/referral/track/:creatorId — log a referral click
router.get('/track/:creatorId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { creatorId } = req.params;
    const agentId = req.query['agent'];
    const db = (0, firebase_config_1.getFirestore)();
    // Log click
    await db.collection('referralClicks').add({
        creatorId,
        agentId: agentId ?? null,
        ip: req.ip ?? '',
        userAgent: req.headers['user-agent'] ?? '',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Increment creator click count
    await db.collection('creatorProfiles').doc(creatorId).update({
        totalClicks: firestore_1.FieldValue.increment(1),
    }).catch(() => { });
    logger_1.logger.info('[Referral] Click tracked', { creatorId, agentId });
    // Return referral data (client stores in cookie/localStorage)
    res.json({ success: true, data: { creatorId, agentId: agentId ?? null, tracked: true } });
}));
// ── PUBLIC: Record conversion (called after registration) ───────────────────
// POST /api/referral/convert — credit creator for new signup
router.post('/convert', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { creatorId, userId, agentId } = req.body;
    if (!creatorId || !userId)
        throw new error_middleware_1.AppError('creatorId and userId required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    // Check not already converted
    const existing = await db.collection('referrals')
        .where('userId', '==', userId).limit(1).get();
    if (!existing.empty) {
        return res.json({ success: true, data: { alreadyConverted: true } });
    }
    // Create referral record
    await db.collection('referrals').add({
        creatorId,
        userId,
        agentId: agentId ?? null,
        status: 'active',
        planCommissionRate: 0.10, // 10% of plan revenue
        agentCommissionRate: 0.70, // 70% of agent revenue
        totalEarnings: 0,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Update creator stats
    await db.collection('creatorProfiles').doc(creatorId).update({
        totalReferrals: firestore_1.FieldValue.increment(1),
    }).catch(() => { });
    // Tag user as referred
    await db.collection('users').doc(userId).update({
        referredBy: creatorId,
        referralAgent: agentId ?? null,
    }).catch(() => { });
    logger_1.logger.info('[Referral] Conversion recorded', { creatorId, userId, agentId });
    res.json({ success: true, data: { converted: true } });
}));
// ── PROTECTED: Creator referral dashboard ───────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
// GET /api/referral/my-stats — creator's referral stats
router.get('/my-stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // Get creator profile
    const profileDoc = await db.collection('creatorProfiles').doc(uid).get();
    const profile = profileDoc.data() ?? {};
    // Get referrals
    const referralsSnap = await db.collection('referrals')
        .where('creatorId', '==', uid).limit(100).get();
    const referrals = referralsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Get clicks (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
    const clicksSnap = await db.collection('referralClicks')
        .where('creatorId', '==', uid)
        .where('createdAt', '>=', thirtyDaysAgo)
        .limit(1000).get();
    const totalClicks = profile['totalClicks'] ?? clicksSnap.size;
    const totalReferrals = referrals.length;
    const totalEarnings = referrals.reduce((s, r) => s + (r['totalEarnings'] ?? 0), 0);
    const conversionRate = totalClicks > 0 ? `${Math.round((totalReferrals / totalClicks) * 100)}%` : '0%';
    // Referral link
    const referralLink = `https://orlode.com/ref/${uid}`;
    res.json({
        success: true,
        data: {
            referralLink,
            totalClicks,
            totalReferrals,
            totalEarnings,
            conversionRate,
            recentClicks30d: clicksSnap.size,
            referrals: referrals.slice(0, 20),
        },
    });
}));
// GET /api/referral/my-link — just get the referral link
router.get('/my-link', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    res.json({
        success: true,
        data: {
            link: `https://orlode.com/ref/${uid}`,
            agentLinks: [], // Could be populated with per-agent links
        },
    });
}));
exports.default = router;
//# sourceMappingURL=referral.routes.js.map