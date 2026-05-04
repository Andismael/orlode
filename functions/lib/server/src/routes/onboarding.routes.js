"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const onboarding_controller_1 = require("../controllers/onboarding.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/status', (0, asyncHandler_1.asyncHandler)(onboarding_controller_1.getOnboardingStatus));
router.patch('/step', (0, asyncHandler_1.asyncHandler)(onboarding_controller_1.saveOnboardingStep));
router.post('/complete', (0, asyncHandler_1.asyncHandler)(onboarding_controller_1.completeOnboarding));
exports.default = router;
//# sourceMappingURL=onboarding.routes.js.map