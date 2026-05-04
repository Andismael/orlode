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
        'address', 'city', 'country', 'postalCode',
        'phone', 'whatsapp', 'email', 'supportEmail',
        'linkedin', 'twitter', 'facebook', 'instagram',
        'settings',
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
// POST /api/company/onboarding/complete — mark onboarding as done
router.post('/onboarding/complete', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).set({ onboardingCompleted: true, onboardingCompletedAt: new Date() }, { merge: true });
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