"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeetings = getMeetings;
exports.getMeeting = getMeeting;
exports.createMeeting = createMeeting;
exports.updateMeeting = updateMeeting;
exports.deleteMeeting = deleteMeeting;
exports.transcribeMeeting = transcribeMeeting;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const transcriptionService_1 = require("../services/meeting/transcriptionService");
const meetingAnalysisFlow_1 = require("../genkit/flows/meetingAnalysisFlow");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
// GET /api/meetings
async function getMeetings(req, res) {
    const companyId = req.query['companyId'] ?? req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const status = req.query['status'];
    let query = db.collection('meetings').where('companyId', '==', companyId);
    if (status === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        query = query.where('date', '>=', start).where('date', '<=', end);
    }
    else if (status === 'upcoming') {
        query = query.where('date', '>=', new Date()).where('status', '==', 'scheduled');
    }
    else if (status === 'completed') {
        query = query.where('status', '==', 'completed');
    }
    try {
        const snapshot = await query.orderBy('date', 'desc').limit(100).get();
        const meetings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        res.json({ success: true, data: meetings });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Missing index or emulator not running — return empty list so UI doesn't crash
        if (msg.includes('index') || msg.includes('FAILED_PRECONDITION') || msg.includes('UNAVAILABLE')) {
            logger_1.logger.warn('getMeetings: Firestore query failed (index or connection)', { msg });
            res.json({ success: true, data: [] });
            return;
        }
        throw err;
    }
}
// GET /api/meetings/:id
async function getMeeting(req, res) {
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('meetings').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Meeting not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}
// POST /api/meetings
async function createMeeting(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const body = req.body;
    const companyId = body.companyId ?? req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const id = (0, helpers_1.generateId)();
    const now = new Date();
    const meeting = {
        companyId,
        title: body.title ?? 'Untitled Meeting',
        description: body.description,
        date: body.date ? new Date(body.date) : now,
        duration: body.duration ?? 60,
        participants: body.participants ?? [],
        status: 'scheduled',
        hasTranscript: false,
        createdBy: req.user.uid,
        createdAt: now,
        updatedAt: now,
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('meetings').doc(id).set(meeting);
    res.status(201).json({ success: true, data: { id, ...meeting } });
}
// PUT /api/meetings/:id
async function updateMeeting(req, res) {
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('meetings').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Meeting not found', 404);
    const updates = { ...req.body, updatedAt: new Date() };
    await db.collection('meetings').doc(id).update(updates);
    res.json({ success: true, data: { id, ...doc.data(), ...updates } });
}
// DELETE /api/meetings/:id
async function deleteMeeting(req, res) {
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('meetings').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Meeting not found', 404);
    await db.collection('meetings').doc(id).delete();
    res.json({ success: true, message: 'Meeting deleted' });
}
// POST /api/meetings/:id/transcribe
// Accepts multipart/form-data with field "audio" (audio or video file)
async function transcribeMeeting(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('meetings').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Meeting not found', 404);
    const meetingData = doc.data();
    // multer puts the file on req.file
    const file = req.file;
    if (!file)
        throw new error_middleware_1.AppError('No audio/video file uploaded', 400);
    const allowedMimeTypes = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
        'audio/mp4', 'audio/x-m4a', 'audio/flac',
        'video/mp4', 'video/webm', 'video/quicktime',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new error_middleware_1.AppError(`Unsupported file type: ${file.mimetype}`, 400);
    }
    logger_1.logger.info(`[TranscribeController] Starting transcription for meeting ${id}, file: ${file.originalname}`);
    // Mark meeting as processing
    await db.collection('meetings').doc(id).update({
        transcriptionStatus: 'processing',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Step 1 — Transcribe with Gemini
    const transcription = await (0, transcriptionService_1.transcribeAudioBuffer)(file.buffer, file.mimetype);
    // Step 2 — Analyse: summary, action items, sentiment
    const meetingType = meetingData['meetingType'] ?? 'other';
    const analysis = await (0, meetingAnalysisFlow_1.meetingAnalysisFlow)({
        companyId: meetingData.companyId,
        meetingId: id,
        transcript: transcription.text,
        participants: meetingData.participants,
        meetingType: meetingType,
    });
    // Step 3 — Persist everything to Firestore
    const updates = {
        status: 'completed',
        hasTranscript: true,
        transcriptionStatus: 'done',
        transcript: transcription.segments,
        transcriptText: transcription.text,
        transcriptLanguage: transcription.language,
        transcriptWordCount: transcription.wordCount,
        summary: analysis.summary,
        keyDecisions: analysis.keyDecisions,
        actionItems: analysis.actionItems.map((item, i) => ({
            id: `ai-${i}`,
            text: item.description,
            assignee: item.assignee ?? null,
            dueDate: item.dueDate ?? null,
            priority: item.priority,
            status: 'open',
            createdAt: new Date(),
        })),
        sentiment: analysis.sentiment,
        topics: analysis.topics,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await db.collection('meetings').doc(id).update(updates);
    logger_1.logger.info(`[TranscribeController] Transcription complete for meeting ${id}`);
    res.json({
        success: true,
        data: {
            id,
            transcriptText: transcription.text,
            transcriptWordCount: transcription.wordCount,
            language: transcription.language,
            segments: transcription.segments,
            summary: analysis.summary,
            keyDecisions: analysis.keyDecisions,
            actionItems: updates.actionItems,
            sentiment: analysis.sentiment,
            topics: analysis.topics,
        },
    });
}
//# sourceMappingURL=meeting.controller.js.map