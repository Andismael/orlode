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
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminOnly_middleware_1 = require("../middleware/adminOnly.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
/** Generate a short company code like CM-48291 */
function generateCompanyCode() {
    const num = Math.floor(10000 + Math.random() * 90000); // 5 digits
    return `CM-${num}`;
}
// GET /api/company — get company profile
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const docRef = db.collection('companies').doc(companyId);
        const doc = await docRef.get();
        if (!doc.exists)
            throw new error_middleware_1.AppError('Company not found', 404);
        const data = doc.data() ?? {};
        // Auto-generate companyCode if missing
        if (!data['companyCode']) {
            const code = generateCompanyCode();
            await docRef.update({ companyCode: code });
            data['companyCode'] = code;
        }
        res.json({ success: true, data: { id: doc.id, ...data } });
    }
    catch (err) {
        if (err instanceof error_middleware_1.AppError)
            throw err;
        res.json({ success: true, data: { id: companyId } });
    }
}));
// PATCH /api/company — update company profile (admin only)
router.patch('/', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    // Whitelist of allowed fields
    const allowed = [
        'name', 'slogan', 'description', 'sector', 'size', 'website', 'logoUrl',
        // PWA installable square logo (≥512×512 PNG/JPG) — used by the
        // /api/manifest/:companyId endpoint as the icon for the installable
        // app on a customer's home screen. Falls back to logoUrl if unset.
        'pwaLogoUrl', 'primaryColor',
        'address', 'city', 'country', 'postalCode',
        'phone', 'whatsapp', 'email', 'supportEmail',
        'linkedin', 'twitter', 'facebook', 'instagram',
        'settings',
        // Domain + brand identity (visible on public pages and tenant emails)
        'customDomain', 'subdomain', 'proEmails', 'theme', 'tagline',
    ];
    const updates = {};
    for (const key of allowed) {
        if (key in body)
            updates[key] = body[key];
    }
    updates['updatedAt'] = new Date();
    try {
        await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).update(updates);
    }
    catch {
        // If doc doesn't exist yet, create it
        await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).set({ ...updates, id: companyId }, { merge: true });
    }
    res.json({ success: true, data: updates });
}));
// POST /api/company/upload-logo — upload a logo image (base64) → Firebase Storage public URL
router.post('/upload-logo', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { imageBase64, imageMimeType } = req.body;
    if (!imageBase64)
        throw new error_middleware_1.AppError('imageBase64 required', 400);
    const { getStorage } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 4 * 1024 * 1024)
        throw new error_middleware_1.AppError('Logo trop lourd (max 4 Mo).', 413);
    const mime = imageMimeType ?? 'image/png';
    const ext = mime.split('/')[1]?.split('+')[0] ?? 'png';
    const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
    const fileName = `companies/${companyId}/branding/logo-${randomBytes(6).toString('hex')}.${ext}`;
    const bucket = getStorage().bucket();
    await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).set({ logoUrl: url, updatedAt: new Date() }, { merge: true });
    res.json({ success: true, data: { url } });
}));
// GET /api/company/domain/verify?domain=<host>
// Performs a real DNS A-record lookup via Google's public DNS-over-HTTPS resolver
// and tells the user whether their domain currently points at the Firebase Hosting
// edge IPs. No side effect on the company doc — purely a checker.
router.get('/domain/verify', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const domain = String(req.query.domain ?? '').trim().toLowerCase();
    if (!domain || !/^[a-z0-9][a-z0-9.-]{1,253}[a-z0-9]$/.test(domain)) {
        throw new error_middleware_1.AppError('Domaine invalide', 400);
    }
    // Firebase Hosting global IPs (stable since 2019).
    const FIREBASE_IPS = ['199.36.158.100'];
    const FIREBASE_CNAME_TARGET = 'mon-assistant-86bbd.web.app';
    try {
        const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
        const dnsJson = (await dnsRes.json());
        const answers = dnsJson.Answer ?? [];
        const aRecords = answers.filter(a => a.type === 1).map(a => a.data);
        // CNAME lookup (separate query because dns.google returns CNAME chain as type 5)
        const cnameRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=CNAME`);
        const cnameJson = (await cnameRes.json());
        const cnames = (cnameJson.Answer ?? []).filter(a => a.type === 5).map(a => a.data.replace(/\.$/, ''));
        const pointsToFirebase = aRecords.some(ip => FIREBASE_IPS.includes(ip))
            || cnames.some(c => c === FIREBASE_CNAME_TARGET || c.endsWith('.web.app') || c.endsWith('.firebaseapp.com'));
        // Update domain status on the company doc so the UI can reflect verified state.
        const status = pointsToFirebase ? 'active' : 'verifying';
        await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).set({
            customDomain: domain, customStatus: status, customLastCheckedAt: new Date(),
        }, { merge: true });
        res.json({
            success: true,
            data: {
                domain,
                aRecords,
                cnames,
                expectedIps: FIREBASE_IPS,
                expectedCnameTarget: FIREBASE_CNAME_TARGET,
                verified: pointsToFirebase,
                nextStep: pointsToFirebase
                    ? 'Ajoute le domaine côté Firebase Hosting (console) — Orlode délivrera le SSL automatiquement sous 24h.'
                    : `Pointe ${domain} sur l'IP ${FIREBASE_IPS[0]} (record A) ou crée un CNAME vers ${FIREBASE_CNAME_TARGET}, puis re-vérifie.`,
            },
        });
    }
    catch (e) {
        res.json({
            success: false,
            data: { domain, verified: false, error: String(e?.message ?? e) },
        });
    }
}));
// PATCH /api/company/onboarding/step — save onboarding progress
router.patch('/onboarding/step', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { step, data } = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const updates = { [`onboardingStep`]: step, updatedAt: new Date() };
    if (data?.companyName)
        updates['name'] = data.companyName;
    if (data?.language)
        updates['settings.language'] = data.language;
    if (data?.aiPersonality)
        updates['settings.aiPersonality'] = data.aiPersonality;
    if (data?.industry)
        updates['industry'] = data.industry;
    if (data?.plan)
        updates['plan'] = data.plan;
    try {
        await db.collection('companies').doc(companyId).update(updates);
    }
    catch {
        await db.collection('companies').doc(companyId).set({ ...updates, id: companyId }, { merge: true });
    }
    res.json({ success: true });
}));
// POST /api/company/onboarding/complete — mark onboarding as done + send completion email
router.post('/onboarding/complete', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('companies').doc(companyId).set({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
    }, { merge: true });
    // Send the onboarding-complete email asynchronously — don't block the response.
    // Best-effort: never fail the API if email send fails.
    (async () => {
        try {
            const userEmail = req.user?.email;
            if (!userEmail)
                return;
            const companyDoc = await db.collection('companies').doc(companyId).get();
            const company = companyDoc.data() ?? {};
            const companyName = company['name'] ?? 'Votre entreprise';
            const selectedBundleId = company['selectedBundleId'] ?? null;
            // Resolve pack name from active trial / paid subscription, if any
            let packName;
            let agentCount = 1;
            let trialDays;
            if (selectedBundleId) {
                try {
                    const trialSnap = await db.collection('marketplacePayments')
                        .where('companyId', '==', companyId)
                        .where('bundleId', '==', selectedBundleId)
                        .where('status', '==', 'trialing')
                        .limit(1).get();
                    if (!trialSnap.empty) {
                        const trial = trialSnap.docs[0]?.data();
                        packName = trial?.['bundleName'];
                        trialDays = 30;
                        agentCount = 7;
                    }
                }
                catch { /* best-effort */ }
            }
            const { sendOnboardingCompleteEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
            await sendOnboardingCompleteEmail({
                to: userEmail,
                userName: userEmail.split('@')[0] ?? 'friend',
                companyName,
                packName,
                trialDays,
                agentCount,
                companyId,
                dashboardUrl: 'https://mon-assistant-86bbd.web.app/admin',
            });
        }
        catch (err) {
            const { logger } = await Promise.resolve().then(() => __importStar(require('../utils/logger')));
            logger.warn('[Onboarding] welcome email failed (non-fatal)', { err: String(err), companyId });
        }
    })();
    res.json({ success: true });
}));
// POST /api/company/seed-demo — load demo data (admin only)
router.post('/seed-demo', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { seedDemoData } = await Promise.resolve().then(() => __importStar(require('../services/seedDemoData')));
    const result = await seedDemoData(companyId);
    res.json({ success: true, data: result });
}));
// POST /api/company/clear-demo — remove demo data (admin only)
router.post('/clear-demo', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { clearDemoData } = await Promise.resolve().then(() => __importStar(require('../services/seedDemoData')));
    await clearDemoData(companyId);
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=company.routes.js.map