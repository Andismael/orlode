"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestDocumentFlow = void 0;
const zod_1 = require("zod");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const firestore_1 = require("firebase-admin/firestore");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const documentProcessor_1 = require("../../services/rag/documentProcessor");
const textChunker_1 = require("../../services/rag/textChunker");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
const helpers_1 = require("../../utils/helpers");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
// ── Input / Output schemas ───────────────────────────────────────────────────
const IngestDocumentInputSchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    documentId: zod_1.z.string(),
    fileUrl: zod_1.z.string().optional(), // remote URL (optional)
    localPath: zod_1.z.string().optional(), // local disk path (preferred)
    fileType: zod_1.z.string(),
    fileName: zod_1.z.string(),
});
const IngestDocumentOutputSchema = zod_1.z.object({
    chunksCreated: zod_1.z.number(),
    embeddingsGenerated: zod_1.z.number(),
    entitiesExtracted: zod_1.z.number(),
    classification: zod_1.z.string(),
    confidence: zod_1.z.number(),
});
// ── Helpers ──────────────────────────────────────────────────────────────────
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https_1.default : http_1.default;
        const file = fs_1.default.createWriteStream(dest);
        proto.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
            fs_1.default.unlink(dest, () => undefined);
            reject(err);
        });
    });
}
// ── Flow definition ──────────────────────────────────────────────────────────
exports.ingestDocumentFlow = genkit_config_1.ai.defineFlow({
    name: 'ingestDocumentFlow',
    inputSchema: IngestDocumentInputSchema,
    outputSchema: IngestDocumentOutputSchema,
}, async (input) => {
    const db = (0, firebase_config_1.getFirestore)();
    const { companyId, documentId, fileUrl, localPath, fileType, fileName } = input;
    const updateStatus = async (status, extra = {}) => {
        await db.collection('documents').doc(documentId).update({
            processingStatus: status,
            ...extra,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    };
    // ── Step 1: Resolve file path ──────────────────────────────────────────
    let tmpPath;
    let ownsTmpFile = false; // true if we downloaded it and must clean it up
    if (localPath && fs_1.default.existsSync(localPath)) {
        // File already on disk — use directly
        tmpPath = localPath;
        logger_1.logger.info(`[ingestDocumentFlow] Using local file: ${tmpPath}`);
    }
    else if (fileUrl) {
        // Download from remote URL
        await updateStatus('downloading');
        tmpPath = path_1.default.join(os_1.default.tmpdir(), `corpmind_${documentId}_${Date.now()}${path_1.default.extname(fileName)}`);
        ownsTmpFile = true;
        try {
            await downloadFile(fileUrl, tmpPath);
            logger_1.logger.info(`[ingestDocumentFlow] Downloaded ${fileName} to ${tmpPath}`);
        }
        catch (err) {
            await updateStatus('failed', { error: 'Download failed' });
            throw err;
        }
    }
    else {
        await updateStatus('failed', { error: 'No file source provided' });
        throw new Error('ingestDocumentFlow: neither localPath nor fileUrl provided');
    }
    // ── Step 2: Extract text ───────────────────────────────────────────────
    await updateStatus('extracting_text');
    let extractedText = '';
    let wordCount = 0;
    let pageCount = 0;
    try {
        const extracted = await (0, documentProcessor_1.extractText)(tmpPath, fileType);
        extractedText = extracted.text;
        wordCount = extracted.metadata.wordCount;
        pageCount = extracted.metadata.pageCount ?? 0;
        logger_1.logger.info(`[ingestDocumentFlow] Extracted ${wordCount} words from ${fileName}`);
    }
    catch (err) {
        await updateStatus('failed', { error: 'Text extraction failed' });
        fs_1.default.unlink(tmpPath, () => undefined);
        throw err;
    }
    // ── Step 3: Classify via Gemini ────────────────────────────────────────
    await updateStatus('classifying');
    let classification = 'unknown';
    let classificationConfidence = 0;
    let tags = [];
    if (env_config_1.env.GOOGLE_AI_API_KEY) {
        try {
            const classifyPrompt = `Classify this corporate document in JSON:
{"category":"string","confidentiality":"public|internal|confidential|secret","tags":["..."],"department":"string|null","confidence":0.0-1.0}

File: ${fileName}
Content:
"""${extractedText.slice(0, 2000)}"""

Return ONLY JSON.`;
            const { text: classifyText } = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt: classifyPrompt,
                config: { temperature: 0.1 },
            });
            const cleaned = classifyText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(cleaned);
            classification = parsed['category'] ?? 'unknown';
            classificationConfidence = parsed['confidence'] ?? 0.5;
            tags = Array.isArray(parsed['tags']) ? parsed['tags'] : [];
            await db.collection('documents').doc(documentId).update({
                classification,
                confidentiality: parsed['confidentiality'] ?? 'internal',
                tags,
                department: parsed['department'] ?? null,
                classificationConfidence,
            });
        }
        catch (err) {
            logger_1.logger.warn('[ingestDocumentFlow] Classification failed, continuing', { error: err });
        }
    }
    // ── Step 4: Extract entities via Gemini ────────────────────────────────
    await updateStatus('extracting_entities');
    let entitiesExtracted = 0;
    const entityData = [];
    if (env_config_1.env.GOOGLE_AI_API_KEY) {
        try {
            const entityPrompt = `Extract named entities from the text. Return JSON:
{"entities":[{"type":"person|organization|date|money|location|product","value":"...","confidence":0.0-1.0}]}
Return ONLY JSON.

Text:
"""${extractedText.slice(0, 3000)}"""`;
            const { text: entityText } = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt: entityPrompt,
                config: { temperature: 0.0 },
            });
            const cleaned = entityText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(cleaned);
            const entities = parsed.entities ?? [];
            entitiesExtracted = entities.length;
            entityData.push(...entities);
            await db.collection('documents').doc(documentId).update({ entities });
        }
        catch (err) {
            logger_1.logger.warn('[ingestDocumentFlow] Entity extraction failed, continuing', { error: err });
        }
    }
    // ── Step 5: Chunk text ─────────────────────────────────────────────────
    await updateStatus('chunking');
    const chunks = (0, textChunker_1.chunkText)(extractedText, {
        documentId,
        documentName: fileName,
        companyId,
        additionalMetadata: { fileType, wordCount, pageCount },
    });
    logger_1.logger.info(`[ingestDocumentFlow] Created ${chunks.length} chunks`);
    // ── Step 6: Generate embeddings & store in Firestore ───────────────────
    await updateStatus('embedding');
    let embeddingsGenerated = 0;
    const BATCH = 20;
    for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const chunkRefs = [];
        for (const chunk of slice) {
            let embedding = [];
            if (env_config_1.env.GOOGLE_AI_API_KEY) {
                try {
                    const embedResponse = await genkit_config_1.ai.embed({
                        embedder: genkit_config_1.TEXT_EMBEDDING_MODEL,
                        content: chunk.text,
                    });
                    embedding = embedResponse[0].embedding;
                    embeddingsGenerated++;
                }
                catch (err) {
                    logger_1.logger.warn('[ingestDocumentFlow] Embedding failed for chunk, using empty vector', { error: err });
                }
            }
            const chunkId = (0, helpers_1.generateId)();
            chunkRefs.push({
                id: chunkId,
                data: {
                    documentId,
                    documentName: fileName,
                    content: chunk.text,
                    chunkIndex: chunk.chunkIndex,
                    metadata: {
                        category: classification,
                        confidentiality: 'internal',
                        language: 'en',
                        tokenCount: chunk.text.split(/\s+/).length,
                        entities: entityData,
                        tags,
                    },
                },
                embedding,
            });
        }
        // Write batch to Firestore vectorChunks sub-collection
        const batchWrite = db.batch();
        for (const { id, data, embedding } of chunkRefs) {
            const ref = db.collection(`companies/${companyId}/vectorChunks`).doc(id);
            batchWrite.set(ref, {
                ...data,
                embedding: embedding.length > 0 ? firestore_1.FieldValue.vector(embedding) : null,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        await batchWrite.commit();
    }
    // ── Step 7: Mark document as completed ────────────────────────────────
    await db.collection('documents').doc(documentId).update({
        status: 'completed',
        processingStatus: 'done',
        chunksCreated: chunks.length,
        embeddingsGenerated,
        wordCount,
        pageCount,
        processedAt: firestore_1.FieldValue.serverTimestamp(),
        // Persist extracted text so readDocumentTool can serve it without semantic search.
        // Firestore doc size limit is ~1MB — cap at 800k chars to stay safe.
        extractedText: extractedText.slice(0, 800000),
    });
    // Cleanup: only delete if we downloaded it (not if caller owns it)
    if (ownsTmpFile) {
        try {
            fs_1.default.unlinkSync(tmpPath);
        }
        catch (_) { /* ignore */ }
    }
    logger_1.logger.info(`[ingestDocumentFlow] Done: ${chunks.length} chunks, ${embeddingsGenerated} embeddings, ${entitiesExtracted} entities`);
    return {
        chunksCreated: chunks.length,
        embeddingsGenerated,
        entitiesExtracted,
        classification,
        confidence: classificationConfidence,
    };
});
//# sourceMappingURL=ingestDocumentFlow.js.map