"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const chat_controller_1 = require("../controllers/chat.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const byoeGate_middleware_1 = require("../middleware/byoeGate.middleware");
const planEnforcement_middleware_1 = require("../middleware/planEnforcement.middleware");
const router = (0, express_1.Router)();
// All chat routes require auth
router.use(auth_middleware_1.authMiddleware);
// GET /api/chat/conversations
router.get('/conversations', (0, asyncHandler_1.asyncHandler)(chat_controller_1.getConversations));
// POST /api/chat/conversations
router.post('/conversations', (0, asyncHandler_1.asyncHandler)(chat_controller_1.postCreateConversation));
// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', (0, asyncHandler_1.asyncHandler)(chat_controller_1.getMessages));
// DELETE /api/chat/conversations/:id
router.delete('/conversations/:id', (0, asyncHandler_1.asyncHandler)(chat_controller_1.deleteConversationHandler));
// POST /api/chat/conversations/:id/messages (streaming) — quota + BYOE gated
router.post('/conversations/:id/messages', rateLimit_middleware_1.aiRateLimiter, (0, asyncHandler_1.asyncHandler)(planEnforcement_middleware_1.enforceMessageQuota), (0, asyncHandler_1.asyncHandler)(byoeGate_middleware_1.byoeGate), (0, asyncHandler_1.asyncHandler)(chat_controller_1.sendMessage));
// PATCH /api/chat/conversations/:id/messages/:messageId/feedback
router.patch('/conversations/:id/messages/:messageId/feedback', (0, asyncHandler_1.asyncHandler)(chat_controller_1.submitFeedback));
exports.default = router;
//# sourceMappingURL=chat.routes.js.map