/**
 * Azure credentials management (admin-only).
 *
 * GET  /api/azure/status      — which services are configured (no secrets)
 * POST /api/azure/docintel    { endpoint, key }
 * POST /api/azure/speech      { region, key }
 * POST /api/azure/openai      { endpoint, key, deployment }
 */
import { Router } from 'express';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { getAzureStatus, saveAzureConfig } from '../services/azure/azureService';

const router = Router();
router.use(authMiddleware);

function adminOnly(req: AuthenticatedRequest): void {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'owner' && role !== 'manager') {
    throw new AppError('Admins uniquement', 403);
  }
}

router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const status = await getAzureStatus(companyId);
  res.json({ success: true, data: status });
}));

router.post('/docintel', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  adminOnly(req);
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { endpoint, key } = req.body as { endpoint?: string; key?: string };
  if (!endpoint || !key) throw new AppError('endpoint + key required', 400);
  await saveAzureConfig(companyId, { docIntel: { endpoint, key } });
  res.json({ success: true });
}));

router.post('/speech', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  adminOnly(req);
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { region, key } = req.body as { region?: string; key?: string };
  if (!region || !key) throw new AppError('region + key required', 400);
  await saveAzureConfig(companyId, { speech: { region, key } });
  res.json({ success: true });
}));

router.post('/openai', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  adminOnly(req);
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { endpoint, key, deployment } = req.body as { endpoint?: string; key?: string; deployment?: string };
  if (!endpoint || !key) throw new AppError('endpoint + key required', 400);
  await saveAzureConfig(companyId, { openai: { endpoint, key, deployment } });
  res.json({ success: true });
}));

export default router;
