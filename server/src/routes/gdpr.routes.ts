import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { exportUserData, deleteUserData, getAuditLogs, getPrivacyReport } from '../controllers/gdpr.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnlyMiddleware } from '../middleware/adminOnly.middleware';

const router = Router();

router.use(authMiddleware);

// Any authenticated user — their own data
router.get('/export',  asyncHandler(exportUserData));   // Right of Access + Portability
router.delete('/delete', asyncHandler(deleteUserData)); // Right to Erasure

// Admin only
router.get('/audit-logs',     adminOnlyMiddleware, asyncHandler(getAuditLogs));
router.get('/privacy-report', adminOnlyMiddleware, asyncHandler(getPrivacyReport));

export default router;
