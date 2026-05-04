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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const asyncHandler_1 = require("../utils/asyncHandler");
const meeting_controller_1 = require("../controllers/meeting.controller");
const meetingWebhook_controller_1 = require("../controllers/meetingWebhook.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
// 100 MB limit for audio/video files — stored in memory buffer
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
});
router.use(auth_middleware_1.authMiddleware);
router.get('/', (0, asyncHandler_1.asyncHandler)(meeting_controller_1.getMeetings));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(meeting_controller_1.getMeeting));
router.post('/', (0, asyncHandler_1.asyncHandler)(meeting_controller_1.createMeeting));
router.put('/:id', (0, asyncHandler_1.asyncHandler)(meeting_controller_1.updateMeeting));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(meeting_controller_1.deleteMeeting));
// Transcription — accepts single audio/video file in field "audio"
router.post('/:id/transcribe', upload.single('audio'), (0, asyncHandler_1.asyncHandler)(meeting_controller_1.transcribeMeeting));
// Webhook — receives recordings from Recall.ai / Zapier / Zoom / Teams / Google Meet
// Authenticated via API key (X-API-Key header) — no Firebase token needed for server-to-server
router.post('/webhook', (0, asyncHandler_1.asyncHandler)(meetingWebhook_controller_1.receiveMeetingWebhook));
// ── ACTION ENGINE ───────────────────────────────────────────────────────────
// POST /api/meetings/:id/detect-actions — run LLM on the transcript to extract actions
router.post('/:id/detect-actions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const meetingRef = db.collection(`companies/${companyId}/meetings`).doc(id);
    const doc = await meetingRef.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Meeting not found', 404);
    const data = doc.data() ?? {};
    // Flatten transcript if structured
    const raw = data['transcript'];
    let transcript = '';
    if (typeof raw === 'string')
        transcript = raw;
    else if (Array.isArray(raw))
        transcript = raw.map((t) => `${t.speaker ?? '?'}: ${t.text ?? ''}`).join('\n');
    if (!transcript) {
        res.json({ success: true, data: { actions: [] }, message: 'Aucun transcript pour ce meeting' });
        return;
    }
    const { detectActionsFromTranscript, getEngineConfig, isAutoExecutable, executeAction } = await Promise.resolve().then(() => __importStar(require('../services/actionEngine/actionEngineService')));
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
    const autoExecuted = [];
    if (cfg.mode === 'auto') {
        for (const a of actions) {
            if (!isAutoExecutable(a, cfg))
                continue;
            const ref = meetingRef.collection('actions').doc(a.id);
            // Idempotent claim: transaction sets status to 'executing' only if still 'pending'
            const claimed = await db.runTransaction(async (tx) => {
                const s = await tx.get(ref);
                const status = s.data()?.['status'];
                if (status !== 'pending')
                    return false;
                tx.update(ref, { status: 'executing', executionStartedAt: new Date() });
                return true;
            });
            if (!claimed)
                continue;
            try {
                const result = await executeAction(companyId, a);
                await ref.update({
                    status: result.success ? 'executed' : 'failed',
                    executedAt: result.success ? new Date() : null,
                    executeResult: result,
                    autoExecuted: true,
                });
                autoExecuted.push({ id: a.id, success: result.success, message: result.message });
            }
            catch (err) {
                await ref.update({ status: 'failed', executeResult: { success: false, message: String(err) } });
                autoExecuted.push({ id: a.id, success: false, message: String(err) });
            }
        }
    }
    res.json({ success: true, data: { actions, config: cfg, autoExecuted } });
}));
// GET /api/meetings/:id/actions — list detected actions
router.get('/:id/actions', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { id } = req.params;
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/meetings/${id}/actions`).get();
    const actions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: actions });
}));
// PATCH /api/meetings/:id/actions/:actionId — update action params (modification)
router.patch('/:id/actions/:actionId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { id, actionId } = req.params;
    const body = req.body;
    const updates = { updatedAt: new Date() };
    if (body.params)
        updates['params'] = body.params;
    if (body.status)
        updates['status'] = body.status;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/meetings/${id}/actions`).doc(actionId).update(updates);
    res.json({ success: true });
}));
// POST /api/meetings/:id/actions/:actionId/execute — idempotent execution via transaction
router.post('/:id/actions/:actionId/execute', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { id, actionId } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/meetings/${id}/actions`).doc(actionId);
    // Phase 1 — atomic claim: only transition pending|validated|modified|failed → executing
    const claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return { ok: false, code: 'NOT_FOUND' };
        const data = snap.data() ?? {};
        const status = data['status'];
        if (status === 'executed')
            return { ok: false, code: 'ALREADY_EXECUTED', data };
        if (status === 'executing')
            return { ok: false, code: 'IN_PROGRESS', data };
        if (status === 'rejected')
            return { ok: false, code: 'REJECTED', data };
        tx.update(ref, {
            status: 'executing',
            executionStartedAt: new Date(),
            executionLock: true,
        });
        return { ok: true, action: { id: snap.id, ...data } };
    });
    if (!claim.ok) {
        if (claim.code === 'NOT_FOUND')
            throw new error_middleware_1.AppError('Action not found', 404);
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
    const { executeAction } = await Promise.resolve().then(() => __importStar(require('../services/actionEngine/actionEngineService')));
    let result;
    try {
        result = await executeAction(companyId, claim.action);
    }
    catch (err) {
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
router.get('/action-engine/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { getEngineConfig } = await Promise.resolve().then(() => __importStar(require('../services/actionEngine/actionEngineService')));
    const cfg = await getEngineConfig(companyId);
    res.json({ success: true, data: cfg });
}));
// PATCH /api/meetings/action-engine/config — update mode + threshold
router.patch('/action-engine/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const body = req.body;
    const updates = { updatedAt: new Date() };
    if (body.mode && ['manual', 'semi_auto', 'auto'].includes(body.mode)) {
        updates['settings.actionEngineMode'] = body.mode;
    }
    if (typeof body.autoExecuteThreshold === 'number') {
        const t = Math.max(0, Math.min(1, body.autoExecuteThreshold));
        updates['settings.autoExecuteThreshold'] = t;
    }
    await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).set(updates, { merge: true });
    res.json({ success: true });
}));
// DELETE /api/meetings/:id/actions/:actionId — reject action
router.delete('/:id/actions/:actionId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { id, actionId } = req.params;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/meetings/${id}/actions`).doc(actionId).update({
        status: 'rejected', updatedAt: new Date(),
    });
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=meeting.routes.js.map