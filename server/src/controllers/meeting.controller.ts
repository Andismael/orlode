import type { Response } from 'express';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import type { Meeting } from '../models/Meeting';
import { transcribeAudioBuffer } from '../services/meeting/transcriptionService';
import { meetingAnalysisFlow } from '../genkit/flows/meetingAnalysisFlow';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

// GET /api/meetings
export async function getMeetings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = (req.query['companyId'] as string | undefined) ?? req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const status = req.query['status'] as string | undefined;

  let query = db.collection('meetings').where('companyId', '==', companyId) as FirebaseFirestore.Query;

  if (status === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    query = query.where('date', '>=', start).where('date', '<=', end);
  } else if (status === 'upcoming') {
    query = query.where('date', '>=', new Date()).where('status', '==', 'scheduled');
  } else if (status === 'completed') {
    query = query.where('status', '==', 'completed');
  }

  try {
    const snapshot = await query.orderBy('date', 'desc').limit(100).get();
    const meetings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: meetings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Missing index or emulator not running — return empty list so UI doesn't crash
    if (msg.includes('index') || msg.includes('FAILED_PRECONDITION') || msg.includes('UNAVAILABLE')) {
      logger.warn('getMeetings: Firestore query failed (index or connection)', { msg });
      res.json({ success: true, data: [] });
      return;
    }
    throw err;
  }
}

// GET /api/meetings/:id
export async function getMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();
  const doc = await db.collection('meetings').doc(id).get();
  if (!doc.exists) throw new AppError('Meeting not found', 404);
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}

// POST /api/meetings
export async function createMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);

  const body = req.body as Partial<Meeting>;
  const companyId = body.companyId ?? req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const id = generateId();
  const now = new Date();

  const meeting: Omit<Meeting, 'id'> = {
    companyId,
    title: body.title ?? 'Untitled Meeting',
    description: body.description,
    date: body.date ? new Date(body.date as unknown as string) : now,
    duration: body.duration ?? 60,
    participants: body.participants ?? [],
    status: 'scheduled',
    hasTranscript: false,
    createdBy: req.user.uid,
    createdAt: now,
    updatedAt: now,
  };

  const db = getFirestore();
  await db.collection('meetings').doc(id).set(meeting);

  res.status(201).json({ success: true, data: { id, ...meeting } });
}

// PUT /api/meetings/:id
export async function updateMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();

  const doc = await db.collection('meetings').doc(id).get();
  if (!doc.exists) throw new AppError('Meeting not found', 404);

  const updates = { ...(req.body as Partial<Meeting>), updatedAt: new Date() };
  await db.collection('meetings').doc(id).update(updates);

  res.json({ success: true, data: { id, ...doc.data(), ...updates } });
}

// DELETE /api/meetings/:id
export async function deleteMeeting(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();

  const doc = await db.collection('meetings').doc(id).get();
  if (!doc.exists) throw new AppError('Meeting not found', 404);

  await db.collection('meetings').doc(id).delete();
  res.json({ success: true, message: 'Meeting deleted' });
}

// POST /api/meetings/:id/transcribe
// Accepts multipart/form-data with field "audio" (audio or video file)
export async function transcribeMeeting(
  req: AuthenticatedRequest & Request,
  res: Response
): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);

  const { id } = req.params as { id: string };
  const db = getFirestore();

  const doc = await db.collection('meetings').doc(id).get();
  if (!doc.exists) throw new AppError('Meeting not found', 404);

  const meetingData = doc.data() as Meeting;

  // multer puts the file on req.file
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) throw new AppError('No audio/video file uploaded', 400);

  const allowedMimeTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
    'audio/mp4', 'audio/x-m4a', 'audio/flac',
    'video/mp4', 'video/webm', 'video/quicktime',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError(`Unsupported file type: ${file.mimetype}`, 400);
  }

  logger.info(`[TranscribeController] Starting transcription for meeting ${id}, file: ${file.originalname}`);

  // Mark meeting as processing
  await db.collection('meetings').doc(id).update({
    transcriptionStatus: 'processing',
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Step 1 — Transcribe with Gemini
  const transcription = await transcribeAudioBuffer(file.buffer, file.mimetype);

  // Step 2 — Analyse: summary, action items, sentiment
  const meetingType = (meetingData as unknown as Record<string, string>)['meetingType'] ?? 'other';
  const analysis = await meetingAnalysisFlow({
    companyId: meetingData.companyId,
    meetingId: id,
    transcript: transcription.text,
    participants: meetingData.participants,
    meetingType: meetingType as 'standup' | 'planning' | 'review' | 'client' | 'board' | 'other',
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
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('meetings').doc(id).update(updates);

  logger.info(`[TranscribeController] Transcription complete for meeting ${id}`);

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
