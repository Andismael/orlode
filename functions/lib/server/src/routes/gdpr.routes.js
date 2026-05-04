"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const gdpr_controller_1 = require("../controllers/gdpr.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminOnly_middleware_1 = require("../middleware/adminOnly.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// Any authenticated user — their own data
router.get('/export', (0, asyncHandler_1.asyncHandler)(gdpr_controller_1.exportUserData)); // Right of Access + Portability
router.delete('/delete', (0, asyncHandler_1.asyncHandler)(gdpr_controller_1.deleteUserData)); // Right to Erasure
// Admin only
router.get('/audit-logs', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(gdpr_controller_1.getAuditLogs));
router.get('/privacy-report', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(gdpr_controller_1.getPrivacyReport));
exports.default = router;
//# sourceMappingURL=gdpr.routes.js.map