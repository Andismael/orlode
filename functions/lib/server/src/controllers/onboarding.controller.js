"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnboardingStatus = getOnboardingStatus;
exports.saveOnboardingStep = saveOnboardingStep;
exports.completeOnboarding = completeOnboarding;
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
// GET /api/onboarding/status
async function getOnboardingStatus(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists)
        throw new error_middleware_1.AppError('Company not found', 404);
    const data = companyDoc.data();
    res.json({
        success: true,
        data: {
            completed: data['onboardingCompleted'] === true,
            currentStep: data['onboardingStep'] ?? 0,
            completedAt: data['onboardingCompletedAt'] ?? null,
        },
    });
}
// PATCH /api/onboarding/step — save progress without completing
async function saveOnboardingStep(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (!req.user?.uid)
        throw new error_middleware_1.AppError('User not authenticated', 401);
    const { step, data } = req.body;
    if (typeof step !== 'number')
        throw new error_middleware_1.AppError('step (number) is required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const update = {
        onboardingStep: step,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    // Merge step data into company settings / top-level fields
    if (data?.companyName)
        update['name'] = data.companyName;
    if (data?.language)
        update['settings.language'] = data.language;
    if (data?.timezone)
        update['settings.timezone'] = data.timezone;
    if (data?.aiPersonality)
        update['settings.aiPersonality'] = data.aiPersonality;
    await db.collection('companies').doc(companyId).update(update);
    logger_1.logger.info(`[Onboarding] Step ${step} saved for company ${companyId}`);
    res.json({ success: true, step });
}
// POST /api/onboarding/complete
async function completeOnboarding(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('companies').doc(companyId).update({
        onboardingCompleted: true,
        onboardingCompletedAt: firestore_1.FieldValue.serverTimestamp(),
        onboardingStep: 5,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info(`[Onboarding] Completed for company ${companyId}`);
    res.json({ success: true, message: 'Onboarding complete' });
}
//# sourceMappingURL=onboarding.controller.js.map