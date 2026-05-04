"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveMeetingWebhook = receiveMeetingWebhook;
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const meeting_agent_1 = require("../agents/meeting.agent");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
async function receiveMeetingWebhook(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const { source, meetingTitle, participants, language, audioBase64, audioMime, transcript, metadata, startedAt, endedAt, durationSec, } = body;
    if (!source)
        throw new error_middleware_1.AppError('source field is required', 400);
    const meetingId = (0, helpers_1.generateId)();
    const db = (0, firebase_config_1.getFirestore)();
    logger_1.logger.info(`[MeetingWebhook] Received from ${source} for company ${companyId}: "${meetingTitle ?? 'untitled'}"`);
    // 1. Create meeting record immediately
    await db.collection(`companies/${companyId}/meetings`).doc(meetingId).set({
        id: meetingId,
        title: meetingTitle ?? `Meeting from ${source}`,
        source,
        platform: metadata?.['platform'] ?? source,
        participants: participants ?? [],
        language: language ?? 'auto',
        status: 'processing',
        startedAt: startedAt ? new Date(startedAt) : firestore_1.FieldValue.serverTimestamp(),
        endedAt: endedAt ? new Date(endedAt) : null,
        durationSec: durationSec ?? null,
        externalMeetingId: metadata?.['meetingId'] ?? null,
        roomUrl: metadata?.['roomUrl'] ?? null,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // 2. Acknowledge immediately — process async
    res.json({ success: true, meetingId, status: 'processing' });
    // 3. Process in background
    setImmediate(async () => {
        try {
            let processPayload = {
                meetingId,
                companyId,
                audioMime: audioMime ?? 'audio/webm',
                title: meetingTitle,
                participants: participants ?? [],
            };
            if (audioBase64) {
                processPayload = { ...processPayload, audioBase64 };
            }
            else if (transcript) {
                // If we already have a transcript (e.g. from Zoom auto-transcription),
                // save it directly and skip transcription
                await db.collection(`companies/${companyId}/meetings`).doc(meetingId).update({
                    transcript,
                    status: 'analyzing',
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                // Still run analysis via meeting agent with the transcript embedded
                processPayload = { ...processPayload, audioBase64: undefined };
            }
            const result = await (0, meeting_agent_1.meetingAgentFlow)(processPayload);
            // 4. Save results
            await db.collection(`companies/${companyId}/meetings`).doc(meetingId).update({
                transcript: result.transcript ?? transcript ?? '',
                summary: result.summary,
                actionItems: result.actionItems,
                keyDecisions: result.keyDecisions,
                sentiment: result.sentiment,
                topics: result.topics,
                language: result.language ?? language ?? 'auto',
                status: 'completed',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            logger_1.logger.info(`[MeetingWebhook] Processing complete for meeting ${meetingId}`);
        }
        catch (err) {
            logger_1.logger.error(`[MeetingWebhook] Processing failed for meeting ${meetingId}`, { error: err });
            await db.collection(`companies/${companyId}/meetings`).doc(meetingId).update({
                status: 'failed',
                error: String(err),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }).catch(() => { });
        }
    });
}
//# sourceMappingURL=meetingWebhook.controller.js.map