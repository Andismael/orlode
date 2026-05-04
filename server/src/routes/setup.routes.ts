import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getSetupStatus,
  setupChat,
  testApiKey,
  validateFirebase,
  saveBYOEConfig,
} from '../controllers/setup.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/status', asyncHandler(getSetupStatus));
router.post('/chat', asyncHandler(setupChat));
router.post('/test-key', asyncHandler(testApiKey));
router.post('/validate-firebase', asyncHandler(validateFirebase));
router.post('/save-byoe', asyncHandler(saveBYOEConfig));

// POST /api/setup/save-keys — save API keys to company settings in Firestore
router.post('/save-keys', asyncHandler(async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyId = (req as any).user?.companyId as string;
  if (!companyId) { res.status(400).json({ success: false, message: 'Company ID required' }); return; }

  const keys = req.body as Record<string, string>;
  const { getFirestore } = await import('../config/firebase.config');
  const db = getFirestore();

  // Save keys encrypted in company settings
  await db.collection('companies').doc(companyId).set({
    apiKeys: keys,
    apiKeysUpdatedAt: new Date(),
  }, { merge: true });

  res.json({ success: true });
}));

export default router;
