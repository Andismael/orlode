import { Router } from 'express';
import type { Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  transcribeMeeting,
} from '../controllers/meeting.controller';
import { receiveMeetingWebhook } from '../controllers/meetingWebhook.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// 100 MB limit for audio/video files — stored in memory buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.use(authMiddleware);

router.get('/',    asyncHandler(getMeetings));
router.get('/:id', asyncHandler(getMeeting));
router.post('/',   asyncHandler(createMeeting));
router.put('/:id', asyncHandler(updateMeeting));
router.delete('/:id', asyncHandler(deleteMeeting));

// Transcription — accepts single audio/video file in field "audio"
router.post('/:id/transcribe', upload.single('audio'), asyncHandler(transcribeMeeting));

// Webhook — receives recordings from Recall.ai / Zapier / Zoom / Teams / Google Meet
// Authenticated via API key (X-API-Key header) — no Firebase token needed for server-to-server
router.post('/webhook', asyncHandler(receiveMeetingWebhook));

// ── ACTION ENGINE ───────────────────────────────────────────────────────────

// POST /api/meetings/:id/detect-actions — run LLM on the transcript to extract actions
router.post('/:id/detect-actions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { id } = req.params;
  const db = getFirestore();

  const meetingRef = db.collection(`companies/${companyId}/meetings`).doc(id);
  const doc = await meetingRef.get();
  if (!doc.exists) throw new AppError('Meeting not found', 404);
  const data = doc.data() ?? {};

  // Flatten transcript if structured
  const raw = data['transcript'];
  let transcript = '';
  if (typeof raw === 'string') transcript = raw;
  else if (Array.isArray(raw)) transcript = raw.map((t: { speaker?: string; text?: string }) => `${t.speaker ?? '?'}: ${t.text ?? ''}`).join('\n');
  if (!transcript) {
    res.json({ success: true, data: { actions: [] }, message: 'Aucun transcript pour ce meeting' });
    return;
  }

  const { detectActionsFromTranscript, getEngineConfig, isAutoExecutable, executeAction } = await import('../services/actionEngine/actionEngineService');
  const actions = await detectActionsFromTranscript(transcript, `Titre: ${data['title'] ?? ''}`);
  const cfg = await getEngineConfig(companyId);

  // Persist each action
  const batch = db.batch();
  for (const a of actions) {
    const ref = meetingRef.collection('actions').doc(a.id);
    batch.set(ref, a);
  }
  await batch.commit();

  // Auto-execute eligible actions (mode === 'auto' AND confidence ≥ threshold AND not sensitive)
  const autoExecuted: Array<{ id: string; success: boolean; message: string }> = [];
  if (cfg.mode === 'auto') {
    for (const a of actions) {
      if (!isAutoExecutable(a, cfg)) continue;
      const ref = meetingRef.collection('actions').doc(a.id);

      // Idempotent claim: transaction sets status to 'executing' only if still 'pending'
      const claimed = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const status = s.data()?.['status'] as string | undefined;
        if (status !== 'pending') return false;
        tx.update(ref, { status: 'executing', executionStartedAt: new Date() });
        return true;
      });
      if (!claimed) continue;

      try {
        const result = await executeAction(companyId, a);
        await ref.update({
          status: result.success ? 'executed' : 'failed',
          executedAt: result.success ? new Date() : null,
          executeResult: result,
          autoExecuted: true,
        });
        autoExecuted.push({ id: a.id, success: result.success, message: result.message });
      } catch (err) {
        await ref.update({ status: 'failed', executeResult: { success: false, message: String(err) } });
        autoExecuted.push({ id: a.id, success: false, message: String(err) });
      }
    }
  }

  res.json({ success: true, data: { actions, config: cfg, autoExecuted } });
}));

// GET /api/meetings/:id/actions — list detected actions
router.get('/:id/actions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { id } = req.params;
  const snap = await getFirestore().collection(`companies/${companyId}/meetings/${id}/actions`).get();
  const actions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, data: actions });
}));

// PATCH /api/meetings/:id/actions/:actionId — update action params (modification)
router.patch('/:id/actions/:actionId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { id, actionId } = req.params;
  const body = req.body as { params?: Record<string, unknown>; status?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.params) updates['params'] = body.params;
  if (body.status) updates['status'] = body.status;
  await getFirestore().collection(`companies/${companyId}/meetings/${id}/actions`).doc(actionId).update(updates);
  res.json({ success: true });
}));

// POST /api/meetings/:id/actions/:actionId/execute — idempotent execution via transaction
router.post('/:id/actions/:actionId/execute', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { id, actionId } = req.params;
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/meetings/${id}/actions`).doc(actionId);

  // Phase 1 — atomic claim: only transition pending|validated|modified|failed → executing
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const, code: 'NOT_FOUND' as const };
    const data = snap.data() ?? {};
    const status = data['status'] as string | undefined;

    if (status === 'executed') return { ok: false as const, code: 'ALREADY_EXECUTED' as const, data };
    if (status === 'executing') return { ok: false as const, code: 'IN_PROGRESS' as const, data };
    if (status === 'rejected') return { ok: false as const, code: 'REJECTED' as const, data };

    tx.update(ref, {
      status: 'executing',
      executionStartedAt: new Date(),
      executionLock: true,
    });
    return { ok: true as const, action: { id: snap.id, ...data } as import('../services/actionEngine/actionEngineService').DetectedAction };
  });

  if (!claim.ok) {
    if (claim.code === 'NOT_FOUND') throw new AppError('Action not found', 404);
    if (claim.code === 'ALREADY_EXECUTED') {
      res.json({ success: true, data: { actionId, result: claim.data?.['executeResult'] }, message: 'Déjà exécutée' });
      return;
    }
    if (claim.code === 'IN_PROGRESS') {
      res.status(409).json({ success: false, message: 'Exécution déjà en cours' });
      return;
    }
    res.status(400).json({ success: false, message: 'Action rejetée, impossible d\'exécuter' });
    return;
  }

  // Phase 2 — run the tool outside the transaction
  const { executeAction } = await import('../services/actionEngine/actionEngineService');
  let result;
  try {
    result = await executeAction(companyId, claim.action);
  } catch (err) {
    result = { success: false, message: String(err) };
  }

  await ref.update({
    status: result.success ? 'executed' : 'failed',
    executedAt: result.success ? new Date() : null,
    executeResult: result,
    executionLock: false,
  });

  res.json({ success: result.success, data: { actionId, result } });
}));

// GET /api/meetings/action-engine/config — read current mode + threshold
router.get('/action-engine/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { getEngineConfig } = await import('../services/actionEngine/actionEngineService');
  const cfg = await getEngineConfig(companyId);
  res.json({ success: true, data: cfg });
}));

// PATCH /api/meetings/action-engine/config — update mode + threshold
router.patch('/action-engine/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const body = req.body as { mode?: 'manual' | 'semi_auto' | 'auto'; autoExecuteThreshold?: number };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.mode && ['manual', 'semi_auto', 'auto'].includes(body.mode)) {
    updates['settings.actionEngineMode'] = body.mode;
  }
  if (typeof body.autoExecuteThreshold === 'number') {
    const t = Math.max(0, Math.min(1, body.autoExecuteThreshold));
    updates['settings.autoExecuteThreshold'] = t;
  }
  await getFirestore().collection('companies').doc(companyId).set(updates, { merge: true });
  res.json({ success: true });
}));

// DELETE /api/meetings/:id/actions/:actionId — reject action
router.delete('/:id/actions/:actionId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { id, actionId } = req.params;
  await getFirestore().collection(`companies/${companyId}/meetings/${id}/actions`).doc(actionId).update({
    status: 'rejected', updatedAt: new Date(),
  });
  res.json({ success: true });
}));

export default router;
