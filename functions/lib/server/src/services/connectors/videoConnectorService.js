"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoConnectorService = exports.VideoConnectorService = void 0;
/**
 * Video Connector Service
 * Processes videos (upload or YouTube) → transcription via Gemini → index.
 * Requires: fluent-ffmpeg (npm install fluent-ffmpeg @types/fluent-ffmpeg) + ffmpeg binary on PATH
 *           @distube/ytdl-core (npm install @distube/ytdl-core) for YouTube
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../../utils/helpers");
const embeddingService_1 = require("../rag/embeddingService");
const firestoreVectorStore_1 = require("../rag/firestoreVectorStore");
const genkit_config_1 = require("../../config/genkit.config");
const logger_1 = require("../../utils/logger");
function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
function chunkTranscript(segments, maxDurationSec = 120) {
    const chunks = [];
    let current = [];
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
    if (current.length > 0)
        chunks.push(current);
    return chunks;
}
// ── Fetch video buffer ────────────────────────────────────────────────────────
async function fetchVideoBuffer(config) {
    if (config.fileBuffer) {
        return { buffer: config.fileBuffer, mimeType: config.mimeType ?? 'video/mp4' };
    }
    if (config.source === 'youtube' || config.url) {
        const url = config.url;
        // Try ytdl-core for YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const ytdl = require('@distube/ytdl-core');
                const chunks = [];
                const stream = ytdl(url, { filter: 'audioonly', quality: 'lowestaudio' });
                await new Promise((resolve, reject) => {
                    stream.on('data', (c) => chunks.push(c));
                    stream.on('end', resolve);
                    stream.on('error', reject);
                });
                return { buffer: Buffer.concat(chunks), mimeType: 'audio/webm' };
            }
            catch {
                throw new Error('Install @distube/ytdl-core to process YouTube videos: npm install @distube/ytdl-core');
            }
        }
        // Generic URL — fetch directly
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Failed to fetch video: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), mimeType: config.mimeType ?? 'video/mp4' };
    }
    throw new Error('Either fileBuffer or url is required');
}
// ── Transcription via Gemini ──────────────────────────────────────────────────
async function transcribeWithGemini(audioBuffer, mimeType, title, category) {
    const base64 = audioBuffer.toString('base64');
    const safeType = mimeType.startsWith('audio/') ? mimeType : 'audio/webm';
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            {
                media: {
                    contentType: safeType,
                    url: `data:${safeType};base64,${base64.slice(0, 2000000)}`, // 2MB limit for inline
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
    }
    catch {
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
class VideoConnectorService {
    async processVideo(config) {
        const db = (0, firebase_config_1.getFirestore)();
        const docId = (0, helpers_1.generateId)();
        const title = config.title ?? 'Untitled Video';
        logger_1.logger.info(`[VideoConnector] Processing video "${title}" for company ${config.companyId}`);
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // 4. Chunk transcript by time segments
        const segmentGroups = chunkTranscript(transcript.segments, 120);
        const toUpsert = [];
        for (let i = 0; i < segmentGroups.length; i++) {
            const group = segmentGroups[i];
            const startSec = group[0]?.startSec ?? 0;
            const endSec = group[group.length - 1]?.endSec ?? 0;
            const segText = group.map((s) => s.text).join(' ');
            const chunkText = `[Video: ${title} | ${formatTime(startSec)}-${formatTime(endSec)}] ${segText}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(chunkText);
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
        await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(config.companyId, toUpsert);
        logger_1.logger.info(`[VideoConnector] Processed "${title}" — ${toUpsert.length} chunks`);
        return {
            documentId: docId,
            chunksCreated: toUpsert.length,
            summary: transcript.summary,
            topics: transcript.topics,
            language: transcript.language,
        };
    }
    /** Import multiple YouTube videos */
    async importBatch(companyId, urls, category) {
        let processed = 0;
        let errors = 0;
        for (const url of urls) {
            try {
                await this.processVideo({ companyId, source: 'youtube', url, category });
                processed++;
            }
            catch (err) {
                errors++;
                logger_1.logger.warn(`[VideoConnector] Failed to process ${url}`, { error: err });
            }
        }
        return { processed, errors };
    }
}
exports.VideoConnectorService = VideoConnectorService;
exports.videoConnectorService = new VideoConnectorService();
//# sourceMappingURL=videoConnectorService.js.map