import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getConversations,
  postCreateConversation,
  getMessages,
  sendMessage,
  deleteConversationHandler,
  submitFeedback,
} from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { aiRateLimiter } from '../middleware/rateLimit.middleware';
import { byoeGate } from '../middleware/byoeGate.middleware';
import { enforceMessageQuota } from '../middleware/planEnforcement.middleware';

const router = Router();

// All chat routes require auth
router.use(authMiddleware);

// GET /api/chat/conversations
router.get('/conversations', asyncHandler(getConversations));

// POST /api/chat/conversations
router.post('/conversations', asyncHandler(postCreateConversation));

// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', asyncHandler(getMessages));

// DELETE /api/chat/conversations/:id
router.delete('/conversations/:id', asyncHandler(deleteConversationHandler));

// POST /api/chat/conversations/:id/messages (streaming) — quota + BYOE gated
router.post('/conversations/:id/messages',
  aiRateLimiter,
  asyncHandler(enforceMessageQuota),
  asyncHandler(byoeGate),
  asyncHandler(sendMessage),
);

// PATCH /api/chat/conversations/:id/messages/:messageId/feedback
router.patch('/conversations/:id/messages/:messageId/feedback', asyncHandler(submitFeedback));

export default router;
