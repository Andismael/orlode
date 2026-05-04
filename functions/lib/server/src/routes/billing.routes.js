"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const asyncHandler_1 = require("../utils/asyncHandler");
const billing_controller_1 = require("../controllers/billing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Stripe webhook — raw body required, no auth
router.post('/webhook', express_2.default.raw({ type: 'application/json' }), (0, asyncHandler_1.asyncHandler)(billing_controller_1.handleStripeWebhook));
// Public — plan catalog
router.get('/plans', (0, asyncHandler_1.asyncHandler)(billing_controller_1.getPlans));
// Protected
router.use(auth_middleware_1.authMiddleware);
router.get('/subscription', (0, asyncHandler_1.asyncHandler)(billing_controller_1.getSubscription));
router.get('/usage', (0, asyncHandler_1.asyncHandler)(billing_controller_1.getUsage));
router.post('/checkout', (0, asyncHandler_1.asyncHandler)(billing_controller_1.createCheckout));
router.post('/portal', (0, asyncHandler_1.asyncHandler)(billing_controller_1.createPortal));
router.post('/cancel', (0, asyncHandler_1.asyncHandler)(billing_controller_1.cancelSubscription));
exports.default = router;
//# sourceMappingURL=billing.routes.js.map