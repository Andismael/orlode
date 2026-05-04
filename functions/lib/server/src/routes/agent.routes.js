"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const agent_controller_1 = require("../controllers/agent.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const byoeGate_middleware_1 = require("../middleware/byoeGate.middleware");
const router = (0, express_1.Router)();
// All agent routes require auth
router.use(auth_middleware_1.authMiddleware);
// ── Multi-agent chat (orchestrator) ──────────────────────────────────────────
// POST /api/agent/conversations/:id/messages — requires BYOE or exception
router.post('/conversations/:id/messages', rateLimit_middleware_1.aiRateLimiter, (0, asyncHandler_1.asyncHandler)(byoeGate_middleware_1.byoeGate), (0, asyncHandler_1.asyncHandler)(agent_controller_1.agentSendMessage));
// ── Insights ─────────────────────────────────────────────────────────────────
// POST /api/agent/insights/run
router.post('/insights/run', (0, asyncHandler_1.asyncHandler)(agent_controller_1.runInsights));
// GET /api/agent/insights
router.get('/insights', (0, asyncHandler_1.asyncHandler)(agent_controller_1.getInsights));
// PATCH /api/agent/insights/:id/read
router.patch('/insights/:id/read', (0, asyncHandler_1.asyncHandler)(agent_controller_1.markInsightRead));
// ── Document processing ───────────────────────────────────────────────────────
// POST /api/agent/process-document
router.post('/process-document', (0, asyncHandler_1.asyncHandler)(agent_controller_1.processDocument));
// ── News Agent ────────────────────────────────────────────────────────────────
// GET  /api/agent/news          — fetch news on demand
router.get('/news', (0, asyncHandler_1.asyncHandler)(agent_controller_1.getNews));
// POST /api/agent/news/briefing — trigger scheduled briefing (cron / Cloud Scheduler)
router.post('/news/briefing', (0, asyncHandler_1.asyncHandler)(agent_controller_1.triggerNewsBriefing));
// POST /api/agent/reminders — check and send appointment reminders (cron every 5-10 min)
router.post('/reminders', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { checkAppointmentReminders } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    await checkAppointmentReminders();
    res.json({ success: true, message: 'Reminders checked' });
}));
// ── Voice Chat: Audio in → STT → Orchestrator → TTS → Audio out ─────────────
// POST /api/agent/voice — accepts audio blob, returns audio MP3 (requires BYOE or exception)
router.post('/voice', (0, asyncHandler_1.asyncHandler)(byoeGate_middleware_1.byoeGate), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required' });
        return;
    }
    const { audio, language, history } = req.body;
    if (!audio) {
        res.status(400).json({ success: false, message: 'Audio data required (base64)' });
        return;
    }
    const { logger } = await Promise.resolve().then(() => __importStar(require('../utils/logger')));
    logger.info('[VoiceChat] Processing voice input');
    try {
        // 1. STT — Transcribe audio via Gemini
        const audioBuffer = Buffer.from(audio, 'base64');
        const { transcribeAudioBuffer } = await Promise.resolve().then(() => __importStar(require('../services/meeting/transcriptionService')));
        const transcription = await transcribeAudioBuffer(audioBuffer, 'audio/webm', language ?? 'auto');
        const userText = transcription.text;
        logger.info(`[VoiceChat] STT: "${userText.slice(0, 80)}"`);
        if (!userText.trim()) {
            res.json({ success: true, data: { text: '', audioUrl: null, transcription: '' } });
            return;
        }
        // 2. Orchestrator — Get AI response
        const { runOrchestrator } = await Promise.resolve().then(() => __importStar(require('../agents/orchestrator.agent')));
        const chatHistory = (history ?? []).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
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
            const { synthesizeSpeech } = await Promise.resolve().then(() => __importStar(require('../services/tts/ttsService')));
            const ttsResult = await synthesizeSpeech({ text: replyText, language: language ?? 'fr' });
            audioBase64 = ttsResult.audioBuffer.toString('base64');
            contentType = ttsResult.contentType;
        }
        catch (ttsErr) {
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
    }
    catch (err) {
        logger.error('[VoiceChat] Error', { error: err instanceof Error ? err.message : err });
        res.status(500).json({ success: false, message: 'Voice processing failed' });
    }
}));
// ── Simulation mode (dry-run) ────────────────────────────────────────────────
// POST /api/agent/simulate — see what would happen without executing
router.post('/simulate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const message = body['message'];
    if (!message) {
        res.status(400).json({ success: false, message: 'message required' });
        return;
    }
    const companyId = req.user?.companyId ?? '';
    const userId = req.user?.uid ?? '';
    // Get user role and plan
    const db = (await Promise.resolve().then(() => __importStar(require('../config/firebase.config')))).getFirestore();
    const userDoc = await db.collection('users').doc(userId).get().catch(() => null);
    const role = userDoc?.data()?.['role'] ?? 'employee';
    const companyDoc = await db.collection('companies').doc(companyId).get().catch(() => null);
    const plan = companyDoc?.data()?.['plan'] ?? 'starter';
    const { classifyIntentFast, classifyIntentAI } = await Promise.resolve().then(() => __importStar(require('../services/ai/orchestratorIntelligence')));
    const { simulateRequest } = await Promise.resolve().then(() => __importStar(require('../services/ai/orchestratorPolicy')));
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
router.post('/meetings/:id/route-actions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid) {
        res.status(400).json({ success: false });
        return;
    }
    const { routeMeetingActions } = await Promise.resolve().then(() => __importStar(require('../agents/meeting.agent')));
    const db = (await Promise.resolve().then(() => __importStar(require('../config/firebase.config')))).getFirestore();
    const doc = await db.collection('meetings').doc(req.params.id).get();
    const actions = doc.data()?.['actionItems'] ?? [];
    const routed = await routeMeetingActions(cid, req.params.id, actions);
    res.json({ success: true, data: { routed } });
}));
router.get('/meetings/search', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid) {
        res.status(400).json({ success: false });
        return;
    }
    const { searchMeetings } = await Promise.resolve().then(() => __importStar(require('../agents/meeting.agent')));
    const result = await searchMeetings(cid, req.query['q'] ?? '');
    res.json({ success: true, data: result });
}));
router.get('/meetings/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid) {
        res.status(400).json({ success: false });
        return;
    }
    const { getMeetingStats } = await Promise.resolve().then(() => __importStar(require('../agents/meeting.agent')));
    const result = await getMeetingStats(cid);
    res.json({ success: true, data: result });
}));
exports.default = router;
//# sourceMappingURL=agent.routes.js.map