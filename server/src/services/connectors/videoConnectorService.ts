/**
 * Video Connector Service
 * Processes videos (upload or YouTube) → transcription via Gemini → index.
 * Requires: fluent-ffmpeg (npm install fluent-ffmpeg @types/fluent-ffmpeg) + ffmpeg binary on PATH
 *           @distube/ytdl-core (npm install @distube/ytdl-core) for YouTube
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../../utils/helpers';
import { generateEmbedding } from '../rag/embeddingService';
import { firestoreVectorStore } from '../rag/firestoreVectorStore';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { logger } from '../../utils/logger';

export type VideoSource = 'upload' | 'youtube' | 'url';
export type VideoCategory = 'meeting' | 'training' | 'presentation' | 'marketing' | 'other';

export interface VideoConfig {
  companyId: string;
  source: VideoSource;
  url?: string;
  fileBuffer?: Buffer;
  mimeType?: string;
  title?: string;
  category: VideoCategory;
}

export interface VideoProcessResult {
  documentId: string;
  chunksCreated: number;
  summary: string;
  topics: string[];
  language: string;
  durationEstimateSec?: number;
}

// ── Transcript chunking by segment ───────────────────────────────────────────

interface TranscriptSegment {
  text: string;
  startSec: number;
  endSec: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function chunkTranscript(segments: TranscriptSegment[], maxDurationSec = 120): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let currentDuration = 0;

  for (const seg of segments) {
    const segDuration = seg.endSec - seg.startSec;
    if (currentDuration + segDuration > maxDurationSec && current.length > 0) {
      chunks.push(current);
      current = [];
      currentDuration = 0;
    }
    current.push(seg);
    currentDuration += segDuration;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ── Fetch video buffer ────────────────────────────────────────────────────────

async function fetchVideoBuffer(config: VideoConfig): Promise<{ buffer: Buffer; mimeType: string }> {
  if (config.fileBuffer) {
    return { buffer: config.fileBuffer, mimeType: config.mimeType ?? 'video/mp4' };
  }

  if (config.source === 'youtube' || config.url) {
    const url = config.url!;
    // Try ytdl-core for YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ytdl = require('@distube/ytdl-core');
        const chunks: Buffer[] = [];
        const stream = ytdl(url, { filter: 'audioonly', quality: 'lowestaudio' });
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', resolve);
          stream.on('error', reject);
        });
        return { buffer: Buffer.concat(chunks), mimeType: 'audio/webm' };
      } catch {
        throw new Error('Install @distube/ytdl-core to process YouTube videos: npm install @distube/ytdl-core');
      }
    }

    // Generic URL — fetch directly
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType: config.mimeType ?? 'video/mp4' };
  }

  throw new Error('Either fileBuffer or url is required');
}

// ── Transcription via Gemini ──────────────────────────────────────────────────

async function transcribeWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
  title: string,
  category: VideoCategory,
): Promise<{ fullText: string; segments: TranscriptSegment[]; language: string; summary: string; topics: string[] }> {
  const base64 = audioBuffer.toString('base64');
  const safeType = mimeType.startsWith('audio/') ? mimeType : 'audio/webm';

  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: [
      {
        media: {
          contentType: safeType as 'audio/webm',
          url: `data:${safeType};base64,${base64.slice(0, 2_000_000)}`, // 2MB limit for inline
        },
      },
      {
        text: `Transcribe and analyze this ${category} audio/video titled "${title}".
Return JSON only (no markdown):
{
  "fullText": "complete transcript",
  "language": "detected language code (en/fr/es/ar/...)",
  "summary": "3-4 sentence summary",
  "topics": ["topic1", "topic2", "topic3"],
  "segments": [
    { "text": "segment text", "startSec": 0, "endSec": 30 }
  ]
}`,
      },
    ],
  });

  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(cleaned);
  } catch {
    // Fallback: treat entire text as one segment
    return {
      fullText: text,
      language: 'auto',
      summary: text.slice(0, 300),
      topics: [category],
      segments: [{ text, startSec: 0, endSec: 0 }],
    };
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export class VideoConnectorService {

  async processVideo(config: VideoConfig): Promise<VideoProcessResult> {
    const db = getFirestore();
    const docId = generateId();
    const title = config.title ?? 'Untitled Video';

    logger.info(`[VideoConnector] Processing video "${title}" for company ${config.companyId}`);

    // 1. Fetch video/audio buffer
    const { buffer, mimeType } = await fetchVideoBuffer(config);

    // 2. Transcribe via Gemini
    const transcript = await transcribeWithGemini(buffer, mimeType, title, config.category);

    // 3. Save document record
    await db.collection(`companies/${config.companyId}/documents`).doc(docId).set({
      id: docId,
      fileName: title,
      fileType: 'video',
      fileUrl: config.url ?? '',
      category: config.category,
      tags: ['video', config.category, ...transcript.topics],
      processing: { status: 'completed' },
      metadata: {
        source: config.source,
        summary: transcript.summary,
        keyTopics: transcript.topics,
        language: transcript.language,
        transcript: transcript.fullText.slice(0, 5000),
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 4. Chunk transcript by time segments
    const segmentGroups = chunkTranscript(transcript.segments, 120);
    const toUpsert: Array<{ id: string; data: Parameters<typeof firestoreVectorStore.upsertChunks>[1][number]['data']; embedding: number[] }> = [];

    for (let i = 0; i < segmentGroups.length; i++) {
      const group = segmentGroups[i]!;
      const startSec = group[0]?.startSec ?? 0;
      const endSec = group[group.length - 1]?.endSec ?? 0;
      const segText = group.map((s) => s.text).join(' ');
      const chunkText = `[Video: ${title} | ${formatTime(startSec)}-${formatTime(endSec)}] ${segText}`;

      const embedding = await generateEmbedding(chunkText);
      toUpsert.push({
        id: `${docId}_seg_${i}`,
        data: {
          documentId: docId,
          documentName: title,
          content: chunkText,
          chunkIndex: i,
          metadata: {
            category: config.category,
            confidentiality: 'internal',
            language: transcript.language,
            tokenCount: chunkText.split(/\s+/).length,
          },
        },
        embedding,
      });
    }

    await firestoreVectorStore.upsertChunks(config.companyId, toUpsert);

    logger.info(`[VideoConnector] Processed "${title}" — ${toUpsert.length} chunks`);

    return {
      documentId: docId,
      chunksCreated: toUpsert.length,
      summary: transcript.summary,
      topics: transcript.topics,
      language: transcript.language,
    };
  }

  /** Import multiple YouTube videos */
  async importBatch(companyId: string, urls: string[], category: VideoCategory): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;
    for (const url of urls) {
      try {
        await this.processVideo({ companyId, source: 'youtube', url, category });
        processed++;
      } catch (err) {
        errors++;
        logger.warn(`[VideoConnector] Failed to process ${url}`, { error: err });
      }
    }
    return { processed, errors };
  }
}

export const videoConnectorService = new VideoConnectorService();
