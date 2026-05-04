"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Creator routes — Agent creator portal (Phase 4)
 * Anyone can create, publish, and manage their own AI agents
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── CREATOR REGISTRATION ────────────────────────────────────────────────────
// POST /api/creator/register — become a creator
router.post('/register', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { portfolio, motivation } = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    // Create or update creator profile
    await db.collection('creatorProfiles').doc(uid).set({
        userId: uid,
        displayName: req.user?.['displayName'] ?? req.user?.email ?? '',
        email: req.user?.email ?? '',
        portfolio: portfolio ?? '',
        motivation: motivation ?? '',
        verified: false,
        isCreator: true,
        totalAgents: 0,
        totalInstalls: 0,
        totalRevenue: 0,
        commission: 0.7,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    // Set isCreator + skip onboarding on company doc.
    // NOTE: we do NOT set plan='creator' here — that only happens via Stripe webhook
    // after the user actually pays. Without payment, plan stays 'free' and they can
    // complete their profile but can't publish until they upgrade.
    const companyRef = companyId ? companyId : uid;
    const existingCompany = await db.collection('companies').doc(companyRef).get();
    const companyUpdate = {
        isCreator: true,
        onboardingCompleted: true,
        name: req.user?.['displayName'] ?? 'Creator',
        ownerId: uid,
        settings: { language: 'fr', aiPersonality: 'professional' },
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    // Only set plan if the doc doesn't already have one (new user)
    if (!existingCompany.exists || !existingCompany.data()?.['plan']) {
        companyUpdate['plan'] = 'free';
    }
    await db.collection('companies').doc(companyRef).set(companyUpdate, { merge: true });
    // Set on user doc too
    await db.collection('users').doc(uid).set({
        isCreator: true,
        companyId: companyRef,
    }, { merge: true }).catch(() => { });
    logger_1.logger.info('[Creator] New creator registered', { uid, email: req.user?.email });
    res.json({ success: true, data: { isCreator: true } });
}));
// ── CREATOR PROFILE ─────────────────────────────────────────────────────────
// GET /api/creator/profile
router.get('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('creatorProfiles').doc(uid).get();
    if (!doc.exists) {
        // Auto-create profile
        const profile = {
            userId: uid,
            displayName: req.user?.['name'] ?? 'Creator',
            email: req.user?.email ?? '',
            companyId: req.user?.companyId ?? '',
            verified: false,
            totalAgents: 0,
            totalInstalls: 0,
            totalRevenue: 0,
            stripeConnectId: null,
            createdAt: new Date(),
        };
        await db.collection('creatorProfiles').doc(uid).set(profile);
        return res.json({ success: true, data: profile });
    }
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));
// PUT /api/creator/profile
router.put('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { displayName, bio, website, avatar } = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('creatorProfiles').doc(uid).update({
        ...(displayName && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(website !== undefined && { website }),
        ...(avatar !== undefined && { avatar }),
        updatedAt: new Date(),
    });
    res.json({ success: true });
}));
// ── MY AGENTS ───────────────────────────────────────────────────────────────
// GET /api/creator/agents — list my created agents
router.get('/agents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('marketplaceAgents')
        .where('creatorId', '==', uid)
        .limit(50).get();
    const agents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: agents });
}));
// POST /api/creator/agents — create a new agent
router.post('/agents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { name, description, longDescription, icon, category, industry, features, systemPrompt, tools, temperature, pricingModel, priceUSD, color, } = req.body;
    if (!name || !description || !systemPrompt) {
        throw new error_middleware_1.AppError('name, description, and systemPrompt are required', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    // Gate: only Creator plan (or higher) can build/save agents for the marketplace.
    const companyId = req.user?.companyId ?? uid;
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const plan = (companyDoc.data()?.['plan'] ?? 'free').toLowerCase();
    const allowedPlans = ['creator', 'pro', 'premium', 'business', 'enterprise'];
    const userDoc = await db.collection('users').doc(uid).get();
    const isSuperAdmin = userDoc.data()?.['superAdmin'] === true;
    if (!isSuperAdmin && !allowedPlans.includes(plan)) {
        throw new error_middleware_1.AppError('La création d\'agents pour le marketplace est réservée au plan Creator ($9.99/mois) ou supérieur.', 402);
    }
    const agentId = (0, helpers_1.generateId)();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');
    // Fetch creator profile for name
    const profileDoc = await db.collection('creatorProfiles').doc(uid).get();
    const creatorName = profileDoc.data()?.['displayName'] ?? 'Creator';
    const agentData = {
        id: agentId,
        slug,
        name,
        description,
        longDescription: longDescription ?? description,
        icon: icon ?? '🤖',
        category: category ?? 'industry',
        industry: industry ?? 'General',
        tags: [],
        features: features ?? [],
        systemPrompt,
        tools: (tools ?? ['searchDocuments']).filter(t => ['searchDocuments', 'getDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'createQuote', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies'].includes(t) // Whitelist safe tools
        ),
        temperature: temperature ?? 0.5,
        model: 'flash',
        creatorId: uid,
        creatorName,
        creatorType: 'third_party',
        pricingModel: pricingModel ?? 'free',
        priceUSD: priceUSD ?? 0,
        status: 'pending_review', // Needs admin approval
        installCount: 0,
        avgRating: 0,
        ratingCount: 0,
        version: '1.0',
        color: color ?? 'from-gray-500 to-gray-700',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await db.collection('marketplaceAgents').doc(agentId).set(agentData);
    // Update creator stats
    await db.collection('creatorProfiles').doc(uid).update({
        totalAgents: (profileDoc.data()?.['totalAgents'] ?? 0) + 1,
    }).catch(() => { });
    res.json({ success: true, data: agentData });
}));
// PUT /api/creator/agents/:id — update my agent
router.put('/agents/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('marketplaceAgents').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Agent not found', 404);
    if (doc.data()?.['creatorId'] !== uid)
        throw new error_middleware_1.AppError('Not your agent', 403);
    const allowed = [
        'name', 'description', 'longDescription', 'icon', 'category', 'industry',
        'features', 'systemPrompt', 'temperature', 'pricingModel', 'priceUSD', 'color',
    ];
    const updates = { updatedAt: new Date() };
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    }
    // If content changed, revert to pending review
    if (updates['systemPrompt'] || updates['name']) {
        updates['status'] = 'pending_review';
    }
    // Re-whitelist tools
    if (updates['tools']) {
        updates['tools'] = (updates['tools'] ?? []).filter(t => ['searchDocuments', 'getDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'createQuote', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies'].includes(t));
    }
    await db.collection('marketplaceAgents').doc(req.params.id).update(updates);
    res.json({ success: true });
}));
// DELETE /api/creator/agents/:id — delete my agent
router.delete('/agents/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('marketplaceAgents').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Agent not found', 404);
    if (doc.data()?.['creatorId'] !== uid)
        throw new error_middleware_1.AppError('Not your agent', 403);
    await db.collection('marketplaceAgents').doc(req.params.id).delete();
    res.json({ success: true });
}));
// POST /api/creator/agents/:id/submit — submit for review
router.post('/agents/:id/submit', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // Gate: only paid Creator plan (or Pro/Premium) can publish to the marketplace.
    const companyId = req.user?.companyId ?? uid;
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const plan = (companyDoc.data()?.['plan'] ?? 'free').toLowerCase();
    const allowedPlans = ['creator', 'pro', 'premium', 'business', 'enterprise'];
    const userDoc = await db.collection('users').doc(uid).get();
    const isSuperAdmin = userDoc.data()?.['superAdmin'] === true;
    if (!isSuperAdmin && !allowedPlans.includes(plan)) {
        throw new error_middleware_1.AppError('La publication sur le marketplace est réservée au plan Creator ($9.99/mois) ou supérieur. Passez à Creator pour publier vos agents et garder 100% des ventes.', 402);
    }
    const doc = await db.collection('marketplaceAgents').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Agent not found', 404);
    if (doc.data()?.['creatorId'] !== uid)
        throw new error_middleware_1.AppError('Not your agent', 403);
    const agentData = doc.data();
    // Run AI auto-review
    let aiReview = null;
    try {
        const { reviewAgentSubmissionTool } = await Promise.resolve().then(() => __importStar(require('../agents/approval.agent')));
        aiReview = await reviewAgentSubmissionTool({
            agentName: agentData['name'] ?? '',
            description: agentData['description'] ?? '',
            longDescription: agentData['longDescription'] ?? '',
            systemPrompt: agentData['systemPrompt'] ?? '',
            features: agentData['features'] ?? [],
            pricingModel: agentData['pricingModel'] ?? 'free',
            priceUSD: agentData['priceUSD'] ?? 0,
            industry: agentData['industry'] ?? '',
        });
    }
    catch (err) {
        logger_1.logger.warn('[Creator] AI review failed', { error: err });
    }
    // Auto-approve if score >= 70, auto-reject if score < 40
    const score = aiReview?.score ?? 50;
    const autoDecision = score >= 70 ? 'approved' : score < 40 ? 'rejected' : 'pending_review';
    await db.collection('marketplaceAgents').doc(req.params.id).update({
        status: autoDecision === 'approved' ? 'approved' : 'pending_review',
        submittedAt: new Date(),
        aiReview: aiReview ?? null,
        aiScore: score,
        aiRecommendation: aiReview?.recommendation ?? 'needs_review',
    });
    res.json({ success: true, data: { status: autoDecision, aiReview } });
}));
// ── CREATOR EARNINGS ────────────────────────────────────────────────────────
// GET /api/creator/earnings
router.get('/earnings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // Get my agents
    const agentsSnap = await db.collection('marketplaceAgents')
        .where('creatorId', '==', uid)
        .get();
    const agentIds = agentsSnap.docs.map(d => d.id);
    if (agentIds.length === 0) {
        return res.json({
            success: true,
            data: { totalRevenue: 0, totalInstalls: 0, commission: 0.7, agents: [] },
        });
    }
    // Get payments for my agents
    const paymentsSnap = await db.collection('marketplacePayments')
        .where('status', '==', 'completed')
        .get();
    const myPayments = paymentsSnap.docs.filter(d => agentIds.includes(d.data()['agentId']));
    const totalRevenue = myPayments.reduce((sum, d) => sum + (d.data()['amountUSD'] ?? 0), 0);
    const commission = 0.7; // Creator gets 70%, Orlode keeps 30%
    const creatorEarnings = totalRevenue * commission;
    const agentEarnings = agentIds.map(id => {
        const agentData = agentsSnap.docs.find(d => d.id === id)?.data();
        const payments = myPayments.filter(d => d.data()['agentId'] === id);
        return {
            agentId: id,
            name: agentData?.['name'] ?? id,
            installs: agentData?.['installCount'] ?? 0,
            revenue: payments.reduce((sum, d) => sum + (d.data()['amountUSD'] ?? 0), 0),
            avgRating: agentData?.['avgRating'] ?? 0,
        };
    });
    res.json({
        success: true,
        data: { totalRevenue, creatorEarnings, commission, agents: agentEarnings },
    });
}));
// ── ADMIN: REVIEW AGENTS ────────────────────────────────────────────────────
// GET /api/creator/admin/pending — list pending review agents
router.get('/admin/pending', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.user?.role !== 'admin')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('marketplaceAgents')
        .where('status', '==', 'pending_review')
        .limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// POST /api/creator/admin/review/:id — approve or reject agent
router.post('/admin/review/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.user?.role !== 'admin')
        throw new error_middleware_1.AppError('Admin only', 403);
    const { action, reason } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
        throw new error_middleware_1.AppError('action must be "approve" or "reject"', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('marketplaceAgents').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Agent not found', 404);
    await db.collection('marketplaceAgents').doc(req.params.id).update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: new Date(),
        reviewedBy: req.user?.uid,
        reviewReason: reason ?? '',
        ...(action === 'approve' ? { publishedAt: new Date() } : {}),
    });
    res.json({ success: true });
}));
// ── WITHDRAWALS ─────────────────────────────────────────────────────────────
// POST /api/creator/withdrawals/initiate — start withdrawal, generate OTP
router.post('/withdrawals/initiate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { amount, method, recipientPhone } = req.body;
    if (!amount || amount <= 0)
        throw new error_middleware_1.AppError('amount must be positive', 400);
    if (!method)
        throw new error_middleware_1.AppError('method required', 400);
    // Verify creator has enough balance
    const db = (0, firebase_config_1.getFirestore)();
    const profileDoc = await db.collection('creatorProfiles').doc(uid).get();
    if (!profileDoc.exists)
        throw new error_middleware_1.AppError('Creator profile not found', 404);
    const profile = profileDoc.data() ?? {};
    const balance = profile['totalRevenue'] ?? 0;
    const alreadyWithdrawn = profile['totalWithdrawn'] ?? 0;
    const available = balance - alreadyWithdrawn;
    if (amount > available) {
        throw new error_middleware_1.AppError(`Insufficient balance: ${available} FCFA available`, 400);
    }
    // Generate 6-digit OTP. In production, send via SMS/email.
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const wid = `wd_${(0, helpers_1.generateId)()}`;
    await db.collection('creatorWithdrawals').doc(wid).set({
        id: wid,
        userId: uid,
        amount,
        method,
        recipientPhone: recipientPhone ?? '',
        status: 'pending_otp',
        otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info(`[creator] withdrawal initiate ${wid} by ${uid} for ${amount} ${method}`);
    // OTP is logged for dev — in prod, integrate SMS provider here.
    logger_1.logger.info(`[creator] withdrawal OTP for ${wid}: ${otp}`);
    res.json({ success: true, withdrawalId: wid });
}));
// POST /api/creator/withdrawals/confirm — confirm withdrawal with OTP
router.post('/withdrawals/confirm', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { amount, method, recipientPhone, otp } = req.body;
    if (!otp)
        throw new error_middleware_1.AppError('otp required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    // Find latest pending withdrawal for this user matching amount
    const snap = await db.collection('creatorWithdrawals')
        .where('userId', '==', uid)
        .where('status', '==', 'pending_otp')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
        .catch(() => ({ docs: [] }));
    const match = snap.docs.find((d) => {
        const data = d.data();
        return data.otp === otp && (!amount || data.amount === amount);
    });
    if (!match)
        throw new error_middleware_1.AppError('Invalid OTP or withdrawal not found', 400);
    const data = match.data();
    const expires = data.otpExpiresAt?.toDate ? data.otpExpiresAt.toDate() : new Date(data.otpExpiresAt);
    if (expires.getTime() < Date.now()) {
        throw new error_middleware_1.AppError('OTP expired', 400);
    }
    await match.ref.update({
        status: 'confirmed',
        confirmedAt: firestore_1.FieldValue.serverTimestamp(),
        method: method ?? data.method,
        recipientPhone: recipientPhone ?? data.recipientPhone,
    });
    // Increment totalWithdrawn on creator profile
    await db.collection('creatorProfiles').doc(uid).set({
        totalWithdrawn: firestore_1.FieldValue.increment(data.amount),
        lastWithdrawalAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    logger_1.logger.info(`[creator] withdrawal ${match.id} confirmed for ${uid}`);
    res.json({ success: true, withdrawalId: match.id });
}));
// GET /api/creator/withdrawals — list user's withdrawals
router.get('/withdrawals', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('creatorWithdrawals')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
        .catch(() => ({ docs: [] }));
    res.json({ success: true, data: snap.docs.map((d) => {
            const data = d.data();
            delete data.otp; // never expose OTP
            return { id: d.id, ...data };
        }) });
}));
// ── KYC FISCAL INFO ─────────────────────────────────────────────────────────
// POST /api/creator/kyc/fiscal-info — save fiscal/tax info
router.post('/kyc/fiscal-info', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { type, nif, address, fiscalCountry } = req.body;
    if (!type)
        throw new error_middleware_1.AppError('type required (individual|company)', 400);
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('creatorProfiles').doc(uid).set({
        fiscal: {
            type,
            nif: nif ?? '',
            address: address ?? '',
            country: fiscalCountry ?? '',
            submittedAt: firestore_1.FieldValue.serverTimestamp(),
        },
    }, { merge: true });
    logger_1.logger.info(`[creator] fiscal info submitted by ${uid}`);
    res.json({ success: true });
}));
// GET /api/creator/kyc/fiscal-info — fetch saved fiscal info
router.get('/kyc/fiscal-info', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const profileDoc = await db.collection('creatorProfiles').doc(uid).get();
    const fiscal = (profileDoc.data() ?? {})['fiscal'] ?? null;
    res.json({ success: true, data: fiscal });
}));
exports.default = router;
//# sourceMappingURL=creator.routes.js.map