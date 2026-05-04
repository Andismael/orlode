/**
 * Meeting Webhook Controller
 * Receives meeting recordings from external services:
 * - Recall.ai bot recordings
 * - Zapier/Make.com automations from Google Meet / Zoom / Teams
 * - Direct recording uploads with API key auth
 *
 * Endpoint: POST /api/meetings/webhook
 * Auth: X-API-Key header (no Firebase required — for server-to-server)
 *
 * Completes the "video conferencing partial" — instead of a bot that joins live,
 * we receive the recording + metadata after the meeting and auto-process it.
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { meetingAgentFlow } from '../agents/meeting.agent';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

interface MeetingWebhookPayload {
  // From Recall.ai / Zapier
  source:         'recall' | 'zapier' | 'make' | 'zoom' | 'teams' | 'google_meet' | 'manual';
  meetingTitle?:  string;
  participants?:  string[];
  language?:      string;
  startedAt?:     string;
  endedAt?:       string;
  durationSec?:   number;

  // Recording (one of these)
  audioBase64?:   string;   // Base64 audio
  audioMime?:     string;
  audioUrl?:      string;   // URL to download the recording (we'll fetch it)

  // Optional transcript already computed by the source
  transcript?:    string;

  // Platform-specific metadata
  metadata?: {
    meetingId?:   string;
    roomUrl?:     string;
    organizer?:   string;
    platform?:    string;
  };
}

export async function receiveMeetingWebhook(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as MeetingWebhookPayload;
  const {
    source, meetingTitle, participants, language, audioBase64, audioMime,
    transcript, metadata, startedAt, endedAt, durationSec,
  } = body;

  if (!source) throw new AppError('source field is required', 400);

  const meetingId = generateId();
  const db = getFirestore();

  logger.info(`[MeetingWebhook] Received from ${source} for company ${companyId}: "${meetingTitle ?? 'untitled'}"`);

  // 1. Create meeting record immediately
  await db.collection(`companies/${companyId}/meetings`).doc(meetingId).set({
    id:         meetingId,
    title:      meetingTitle ?? `Meeting from ${source}`,
    source,
    platform:   metadata?.['platform'] ?? source,
    participants: participants ?? [],
    language:   language ?? 'auto',
    status:     'processing',
    startedAt:  startedAt ? new Date(startedAt) : FieldValue.serverTimestamp(),
    endedAt:    endedAt ? new Date(endedAt) : null,
    durationSec: durationSec ?? null,
    externalMeetingId: metadata?.['meetingId'] ?? null,
    roomUrl:    metadata?.['roomUrl'] ?? null,
    createdAt:  FieldValue.serverTimestamp(),
    updatedAt:  FieldValue.serverTimestamp(),
  });

  // 2. Acknowledge immediately — process async
  res.json({ success: true, meetingId, status: 'processing' });

  // 3. Process in background
  setImmediate(async () => {
    try {
      let processPayload: {
        meetingId: string;
        companyId: string;
        audioBase64?: string;
        audioMime: string;
        title?: string;
        participants?: string[];
      } = {
        meetingId,
        companyId,
        audioMime:    audioMime ?? 'audio/webm',
        title:        meetingTitle,
        participants: participants ?? [],
      };

      if (audioBase64) {
        processPayload = { ...processPayload, audioBase64 };
      } else if (transcript) {
        // If we already have a transcript (e.g. from Zoom auto-transcription),
        // save it directly and skip transcription
        await db.collection(`companies/${companyId}/meetings`).doc(meetingId).update({
          transcript,
          status:    'analyzing',
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Still run analysis via meeting agent with the transcript embedded
        processPayload = { ...processPayload, audioBase64: undefined };
      }

      const result = await meetingAgentFlow(processPayload);

      // 4. Save results
      await db.collection(`companies/${companyId}/meetings`).doc(meetingId).update({
        transcript:   result.transcript ?? transcript ?? '',
        summary:      result.summary,
        actionItems:  result.actionItems,
        keyDecisions: result.keyDecisions,
        sentiment:    result.sentiment,
        topics:       result.topics,
        language:     result.language ?? language ?? 'auto',
        status:       'completed',
        updatedAt:    FieldValue.serverTimestamp(),
      });

      logger.info(`[MeetingWebhook] Processing complete for meeting ${meetingId}`);
    } catch (err) {
      logger.error(`[MeetingWebhook] Processing failed for meeting ${meetingId}`, { error: err });
      await db.collection(`companies/${companyId}/meetings`).doc(meetingId).update({
        status:    'failed',
        error:     String(err),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
  });
}
