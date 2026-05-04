"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioConnectorService = exports.AudioConnectorService = void 0;
/**
 * Audio Connector Service
 * Handles MP3/WAV/M4A uploads, podcast RSS feeds, and call recordings.
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../../utils/helpers");
const embeddingService_1 = require("../rag/embeddingService");
const firestoreVectorStore_1 = require("../rag/firestoreVectorStore");
const genkit_config_1 = require("../../config/genkit.config");
const logger_1 = require("../../utils/logger");
function parseRssFeed(xml) {
    const episodes = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const item = itemMatch[1];
        const titleMatch = item.match(/<title><!\[CDATA\[([^\]]+)\]\]>|<title>([^<]+)<\/title>/i);
        const enclosureMatch = item.match(/<enclosure[^>]+url\s*=\s*["']([^"']+)["']/i);
        const linkMatch = item.match(/<link>([^<]+)<\/link>/i);
        const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/i);
        const url = enclosureMatch?.[1] ?? linkMatch?.[1] ?? '';
        const title = titleMatch?.[1] ?? titleMatch?.[2] ?? url;
        if (url) {
            episodes.push({ title: title.trim(), url: url.trim(), pubDate: pubDateMatch?.[1] });
        }
    }
    return episodes;
}
// ── Transcription via Gemini ──────────────────────────────────────────────────
async function transcribeAudio(buffer, mimeType, title, category) {
    const base64 = buffer.toString('base64');
    const safeType = (mimeType.startsWith('audio/') ? mimeType : 'audio/mpeg');
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            {
                media: {
                    contentType: safeType,
                    url: `data:${safeType};base64,${base64.slice(0, 2000000)}`,
                },
            },
            {
                text: `Transcribe and analyze this ${category} audio titled "${title}".
Return JSON only (no markdown):
{
  "fullText": "complete transcript",
  "language": "detected language code",
  "summary": "2-3 sentence summary",
  "topics": ["topic1", "topic2"],
  "sentiment": "positive/neutral/negative"
}`,
            },
        ],
    });
    try {
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
        return JSON.parse(cleaned);
    }
    catch {
        return { fullText: text, language: 'auto', summary: text.slice(0, 300), topics: [category], sentiment: 'neutral' };
    }
}
// ── Service ───────────────────────────────────────────────────────────────────
class AudioConnectorService {
    async processAudio(config) {
        const db = (0, firebase_config_1.getFirestore)();
        const docId = (0, helpers_1.generateId)();
        const title = config.title ?? 'Untitled Audio';
        logger_1.logger.info(`[AudioConnector] Processing "${title}" for company ${config.companyId}`);
        // Fetch buffer if URL
        let buffer;
        let mimeType;
        if (config.fileBuffer) {
            buffer = config.fileBuffer;
            mimeType = config.mimeType ?? 'audio/mpeg';
        }
        else if (config.url) {
            const response = await fetch(config.url);
            if (!response.ok)
                throw new Error(`Failed to fetch audio: ${response.statusText}`);
            buffer = Buffer.from(await response.arrayBuffer());
            mimeType = response.headers.get('content-type') ?? 'audio/mpeg';
        }
        else {
            throw new Error('fileBuffer or url required');
        }
        // Transcribe
        const result = await transcribeAudio(buffer, mimeType, title, config.category);
        // Save document record
        await db.collection(`companies/${config.companyId}/documents`).doc(docId).set({
            id: docId,
            fileName: title,
            fileType: 'audio',
            fileUrl: config.url ?? '',
            category: config.category,
            tags: ['audio', config.category, ...result.topics],
            processing: { status: 'completed' },
            metadata: {
                source: config.source,
                summary: result.summary,
                language: result.language,
                sentiment: result.sentiment,
                transcript: result.fullText.slice(0, 5000),
            },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Chunk the transcript (every ~800 words)
        const words = result.fullText.split(/\s+/);
        const chunkSize = 800;
        const toUpsert = [];
        for (let i = 0; i < words.length; i += chunkSize) {
            const segment = words.slice(i, i + chunkSize).join(' ');
            const chunkIdx = Math.floor(i / chunkSize);
            const chunkText = `[Audio: ${title}] ${segment}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(chunkText);
            toUpsert.push({
                id: `${docId}_chunk_${chunkIdx}`,
                data: {
                    documentId: docId,
                    documentName: title,
                    content: chunkText,
                    chunkIndex: chunkIdx,
                    metadata: {
                        category: config.category,
                        confidentiality: 'internal',
                        language: result.language,
                        tokenCount: segment.split(/\s+/).length,
                    },
                },
                embedding,
            });
        }
        if (toUpsert.length === 0) {
            // Fallback: index full text as one chunk
            const embedding = await (0, embeddingService_1.generateEmbedding)(result.fullText);
            toUpsert.push({
                id: `${docId}_chunk_0`,
                data: {
                    documentId: docId,
                    documentName: title,
                    content: result.fullText,
                    chunkIndex: 0,
                    metadata: { category: config.category, confidentiality: 'internal', language: result.language, tokenCount: words.length },
                },
                embedding,
            });
        }
        await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(config.companyId, toUpsert);
        logger_1.logger.info(`[AudioConnector] Processed "${title}" — ${toUpsert.length} chunks`);
        return { documentId: docId, chunksCreated: toUpsert.length, summary: result.summary, language: result.language, topics: result.topics };
    }
    /** Import all episodes from a podcast RSS feed */
    async importPodcastFeed(companyId, rssUrl, maxEpisodes = 20) {
        const response = await fetch(rssUrl, { headers: { 'User-Agent': 'Orlode/1.0' } });
        if (!response.ok)
            throw new Error(`Failed to fetch RSS: ${response.statusText}`);
        const xml = await response.text();
        const episodes = parseRssFeed(xml).slice(0, maxEpisodes);
        let processed = 0;
        let errors = 0;
        for (const ep of episodes) {
            try {
                await this.processAudio({
                    companyId,
                    source: 'podcast_rss',
                    url: ep.url,
                    title: ep.title,
                    category: 'podcast',
                });
                processed++;
            }
            catch (err) {
                errors++;
                logger_1.logger.warn(`[AudioConnector] Failed episode "${ep.title}"`, { error: err });
            }
        }
        return { processed, errors };
    }
}
exports.AudioConnectorService = AudioConnectorService;
exports.audioConnectorService = new AudioConnectorService();
//# sourceMappingURL=audioConnectorService.js.map