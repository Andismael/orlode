import { Router } from 'express';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  agentSendMessage,
  runInsights,
  processDocument,
  getInsights,
  markInsightRead,
  triggerNewsBriefing,
  getNews,
} from '../controllers/agent.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { aiRateLimiter } from '../middleware/rateLimit.middleware';
import { byoeGate } from '../middleware/byoeGate.middleware';

const router = Router();

// All agent routes require auth
router.use(authMiddleware);

// ── Multi-agent chat (orchestrator) ──────────────────────────────────────────
// POST /api/agent/conversations/:id/messages — requires BYOE or exception
router.post('/conversations/:id/messages', aiRateLimiter, asyncHandler(byoeGate), asyncHandler(agentSendMessage));

// ── Insights ─────────────────────────────────────────────────────────────────
// POST /api/agent/insights/run
router.post('/insights/run', asyncHandler(runInsights));

// GET /api/agent/insights
router.get('/insights', asyncHandler(getInsights));

// PATCH /api/agent/insights/:id/read
router.patch('/insights/:id/read', asyncHandler(markInsightRead));

// ── Document processing ───────────────────────────────────────────────────────
// POST /api/agent/process-document
router.post('/process-document', asyncHandler(processDocument));

// ── News Agent ────────────────────────────────────────────────────────────────
// GET  /api/agent/news          — fetch news on demand
router.get('/news', asyncHandler(getNews));

// POST /api/agent/news/briefing — trigger scheduled briefing (cron / Cloud Scheduler)
router.post('/news/briefing', asyncHandler(triggerNewsBriefing));

// POST /api/agent/reminders — check and send appointment reminders (cron every 5-10 min)
router.post('/reminders', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { checkAppointmentReminders } = await import('../services/notificationService');
  await checkAppointmentReminders();
  res.json({ success: true, message: 'Reminders checked' });
}));

// ── Voice Chat: Audio in → STT → Orchestrator → TTS → Audio out ─────────────
// POST /api/agent/voice — accepts audio blob, returns audio MP3 (requires BYOE or exception)
router.post('/voice', asyncHandler(byoeGate), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) { res.status(400).json({ success: false, message: 'Company ID required' }); return; }

  const { audio, language, history } = req.body as { audio: string; language?: string; history?: { role: string; content: string }[] };
  if (!audio) { res.status(400).json({ success: false, message: 'Audio data required (base64)' }); return; }

  const { logger } = await import('../utils/logger');
  logger.info('[VoiceChat] Processing voice input');

  try {
    // 1. STT — Transcribe audio via Gemini
    const audioBuffer = Buffer.from(audio, 'base64');
    const { transcribeAudioBuffer } = await import('../services/meeting/transcriptionService');
    const transcription = await transcribeAudioBuffer(audioBuffer, 'audio/webm', language ?? 'auto');
    const userText = transcription.text;
    logger.info(`[VoiceChat] STT: "${userText.slice(0, 80)}"`);

    if (!userText.trim()) {
      res.json({ success: true, data: { text: '', audioUrl: null, transcription: '' } });
      return;
    }

    // 2. Orchestrator — Get AI response
    const { runOrchestrator } = await import('../agents/orchestrator.agent');
    const chatHistory = (history ?? []).map(h => ({
      role: h.role === 'assistant' ? 'model' as const : 'user' as const,
      content: h.content,
    }));

    const result = await runOrchestrator({
      message: userText,
      companyId,
      userId: req.user?.uid ?? '',
      history: chatHistory,
      language: language ?? 'fr',
    });
    const replyText = result.reply;
    logger.info(`[VoiceChat] AI: "${replyText.slice(0, 80)}"`);

    // 3. TTS — Synthesize response to audio (graceful fallback)
    let audioBase64 = '';
    let contentType = 'audio/mpeg';
    try {
      const { synthesizeSpeech } = await import('../services/tts/ttsService');
      const ttsResult = await synthesizeSpeech({ text: replyText, language: language ?? 'fr' });
      audioBase64 = ttsResult.audioBuffer.toString('base64');
      contentType = ttsResult.contentType;
    } catch (ttsErr) {
      logger.warn('[VoiceChat] TTS failed, returning text-only (client will use browser TTS)', {
        error: ttsErr instanceof Error ? ttsErr.message : ttsErr,
      });
      // Don't fail the whole request — client will fallback to browser TTS
    }

    res.json({
      success: true,
      data: {
        transcription: userText,
        text: replyText,
        audio: audioBase64 || null,
        contentType,
        agentsUsed: result.agentsUsed,
        ttsAvailable: !!audioBase64,
      },
    });
  } catch (err) {
    logger.error('[VoiceChat] Error', { error: err instanceof Error ? err.message : err });
    res.status(500).json({ success: false, message: 'Voice processing failed' });
  }
}));

// ── Simulation mode (dry-run) ────────────────────────────────────────────────
// POST /api/agent/simulate — see what would happen without executing
router.post('/simulate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const message = body['message'] as string;
  if (!message) { res.status(400).json({ success: false, message: 'message required' }); return; }

  const companyId = req.user?.companyId ?? '';
  const userId = req.user?.uid ?? '';

  // Get user role and plan
  const db = (await import('../config/firebase.config')).getFirestore();
  const userDoc = await db.collection('users').doc(userId).get().catch(() => null);
  const role = (userDoc?.data()?.['role'] as string) ?? 'employee';
  const companyDoc = await db.collection('companies').doc(companyId).get().catch(() => null);
  const plan = (companyDoc?.data()?.['plan'] as string) ?? 'starter';

  const { classifyIntentFast, classifyIntentAI } = await import('../services/ai/orchestratorIntelligence');
  const { simulateRequest } = await import('../services/ai/orchestratorPolicy');

  // Classify intent
  let intent = classifyIntentFast(message);
  if (intent.confidence < 0.6) {
    intent = await classifyIntentAI(message, '');
  }

  // Simulate
  const result = simulateRequest(message, intent, role, companyId, userId, plan);

  res.json({ success: true, data: result });
}));

// ── Meeting PRO routes ──────────────────────────────────────────────────────
router.post('/meetings/:id/route-actions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) { res.status(400).json({ success: false }); return; }
  const { routeMeetingActions } = await import('../agents/meeting.agent');
  const db = (await import('../config/firebase.config')).getFirestore();
  const doc = await db.collection('meetings').doc(req.params.id).get();
  const actions = (doc.data()?.['actionItems'] as { task: string; assignee?: string; dueDate?: string; priority: string }[]) ?? [];
  const routed = await routeMeetingActions(cid, req.params.id, actions as import('../agents/meeting.agent').MeetingOutput['actionItems']);
  res.json({ success: true, data: { routed } });
}));

router.get('/meetings/search', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) { res.status(400).json({ success: false }); return; }
  const { searchMeetings } = await import('../agents/meeting.agent');
  const result = await searchMeetings(cid, (req.query['q'] as string) ?? '');
  res.json({ success: true, data: result });
}));

router.get('/meetings/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) { res.status(400).json({ success: false }); return; }
  const { getMeetingStats } = await import('../agents/meeting.agent');
  const result = await getMeetingStats(cid);
  res.json({ success: true, data: result });
}));

export default router;
