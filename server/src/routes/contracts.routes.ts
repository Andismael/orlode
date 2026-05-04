/**
 * Contracts routes — thin proxy over the Wemas bridge.
 *
 * Reads come from Wemas (source of truth). Writes (create/send) also go
 * through Wemas. Firestore stays as a read-cache only.
 *
 *   GET    /api/contracts            — list
 *   GET    /api/contracts/:id        — single
 *   POST   /api/contracts            — create + send
 *   POST   /api/contracts/:id/resend — re-trigger signature email
 *   POST   /api/contracts/provision  — manually trigger Wemas org provisioning
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  isWemasConfigured,
  listContracts,
  getContract,
  createAndSendContract,
  resendContract,
  provisionOrgIfNeeded,
  getWemasFrontendUrl,
} from '../services/wemas/wemasBridge';

const router = Router();
router.use(authMiddleware);

// GET /api/contracts/status — feature flag for the UI
router.get('/status', (_req, res) => {
  res.json({
    success: true,
    data: { configured: isWemasConfigured(), frontendUrl: getWemasFrontendUrl() },
  });
});

// GET /api/contracts — list contracts for current company
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  if (!isWemasConfigured()) {
    return res.json({ success: true, data: [], wemasConfigured: false });
  }
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '50', 10), 200);
  const list = await listContracts(companyId, limit);
  res.json({ success: true, data: list, wemasConfigured: true });
}));

// GET /api/contracts/:id — single contract
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const contract = await getContract(companyId, req.params['id']!);
  res.json({ success: true, data: contract });
}));

// POST /api/contracts — create + send for signature
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { signatoryName, signatoryEmail, signatoryPhone, contractContent, contractType, senderName, sendNow } = req.body as {
    signatoryName?: string; signatoryEmail?: string; signatoryPhone?: string;
    contractContent?: string; contractType?: string; senderName?: string; sendNow?: boolean;
  };
  if (!signatoryName || !signatoryEmail || !contractContent) {
    throw new AppError('signatoryName, signatoryEmail, contractContent required', 400);
  }
  const result = await createAndSendContract({
    companyId, signatoryName, signatoryEmail, signatoryPhone,
    contractContent, contractType, senderName, sendNow,
  });
  res.json({ success: true, data: result });
}));

// POST /api/contracts/:id/resend — re-send the signature email
router.post('/:id/resend', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const result = await resendContract(companyId, req.params['id']!);
  res.json({ success: true, data: result });
}));

// POST /api/contracts/provision — manually provision the Wemas org for this company
// (auto-runs on first contract, but admins may want to pre-provision for branding)
router.post('/provision', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const wemasOrgId = await provisionOrgIfNeeded(companyId);
  res.json({ success: true, data: { wemasOrgId } });
}));

export default router;
