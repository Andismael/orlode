"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFromDriveTool = exports.syncFromDriveFlow = exports.documentsAgentTool = exports.documentsAgentFlow = void 0;
/**
 * Documents Agent — Gemini Flash
 *
 * Pattern: sequential pipeline
 * Stages: extract text → clean → chunk → embed → index to Firestore
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const googleWorkspace_1 = require("./tools/mcp/googleWorkspace");
const mcp_config_1 = require("../config/mcp.config");
const logger_1 = require("../utils/logger");
const INPUT = zod_1.z.object({
    documentId: zod_1.z.string(),
    companyId: zod_1.z.string(),
    fileBuffer: zod_1.z.string().describe('Base64-encoded file content'),
    fileName: zod_1.z.string(),
    mimeType: zod_1.z.string(),
});
const OUTPUT = zod_1.z.object({
    success: zod_1.z.boolean(),
    chunksCreated: zod_1.z.number(),
    language: zod_1.z.string(),
    summary: zod_1.z.string(),
    keyTopics: zod_1.z.array(zod_1.z.string()),
});
// ── Helper: split text into overlapping chunks ────────────────────────────────
function chunkText(text, chunkSize = 800, overlap = 100) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    return chunks;
}
// ── Stage 1: Extract text from document via Gemini ───────────────────────────
async function extractText(base64, mimeType, fileName) {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            {
                media: {
                    contentType: mimeType,
                    url: `data:${mimeType};base64,${base64}`,
                },
            },
            {
                text: `Extract ALL text content from this document named "${fileName}".

🚫 ZÉRO FABRICATION : si le document est illisible, vide, corrompu ou non textuel (image scannée sans OCR, etc.), retourne {"text": "", "language": "unknown"}. N'invente JAMAIS de contenu pour combler le vide.

Return JSON: {"text": "full extracted text exactly as written", "language": "detected language code (en/fr/es/etc) or 'unknown'"}
Return ONLY JSON, no markdown.`,
            },
        ],
        config: { temperature: 0 },
    });
    try {
        const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return parsed;
    }
    catch {
        return { text, language: 'en' };
    }
}
// ── Stage 2: Generate metadata (summary + key topics) ────────────────────────
async function generateMetadata(text, fileName) {
    const { text: raw } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze this document and extract metadata.

🚫 ZÉRO FABRICATION : si le contenu fourni est vide ou illisible, retourne summary: "" et keyTopics: []. N'invente JAMAIS de sujets ou de résumés.

Return JSON: {"summary": "2-3 sentence summary based ONLY on the actual content", "keyTopics": ["topic1", "topic2", "topic3", "topic4", "topic5"]}

Document: ${fileName}
Content (first 4000 chars):
${text.slice(0, 4000)}

Return ONLY JSON.`,
        config: { temperature: 0.1 },
    });
    try {
        const parsed = JSON.parse(raw.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return parsed;
    }
    catch {
        return { summary: '', keyTopics: [] };
    }
}
// ── The flow (sequential pipeline) ───────────────────────────────────────────
exports.documentsAgentFlow = genkit_config_1.ai.defineFlow({ name: 'documentsAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ documentId, companyId, fileBuffer, fileName, mimeType }) => {
    logger_1.logger.info(`[DocumentsAgent] Processing "${fileName}" for company ${companyId}`);
    const db = (0, firebase_config_1.getFirestore)();
    const docRef = db.collection('documents').doc(documentId);
    try {
        // ── Stage 1: Extract text ────────────────────────────────────────────
        await docRef.update({ status: 'extracting', updatedAt: new Date() });
        logger_1.logger.info(`[DocumentsAgent] Stage 1: Extracting text from ${fileName}`);
        const { text, language } = await extractText(fileBuffer, mimeType, fileName);
        if (!text || text.length < 10) {
            await docRef.update({ status: 'failed', error: 'No text extracted', updatedAt: new Date() });
            return { success: false, chunksCreated: 0, language: 'unknown', summary: '', keyTopics: [] };
        }
        // ── Stage 2: Generate metadata ───────────────────────────────────────
        await docRef.update({ status: 'analyzing', updatedAt: new Date() });
        logger_1.logger.info(`[DocumentsAgent] Stage 2: Generating metadata`);
        const { summary, keyTopics } = await generateMetadata(text, fileName);
        // ── Stage 3: Chunk the text ──────────────────────────────────────────
        await docRef.update({ status: 'chunking', updatedAt: new Date() });
        logger_1.logger.info(`[DocumentsAgent] Stage 3: Chunking text (${text.length} chars)`);
        const chunks = chunkText(text);
        logger_1.logger.info(`[DocumentsAgent] Created ${chunks.length} chunks`);
        // ── Stage 4: Embed + index each chunk ───────────────────────────────
        await docRef.update({ status: 'embedding', updatedAt: new Date() });
        logger_1.logger.info(`[DocumentsAgent] Stage 4: Embedding and indexing chunks`);
        const batch = db.batch();
        // Delete existing chunks for this document first
        const existingChunks = await db.collection('chunks')
            .where('documentId', '==', documentId)
            .get();
        existingChunks.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        // Embed in batches of 5 to avoid rate limits
        let chunksCreated = 0;
        const BATCH_SIZE = 5;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batchChunks = chunks.slice(i, i + BATCH_SIZE);
            await Promise.all(batchChunks.map(async (chunkText, j) => {
                const chunkIndex = i + j;
                const embedResponse = await genkit_config_1.ai.embed({
                    embedder: genkit_config_1.TEXT_EMBEDDING_MODEL,
                    content: chunkText,
                });
                const chunkRef = db.collection('chunks').doc();
                await chunkRef.set({
                    documentId,
                    companyId,
                    documentName: fileName,
                    text: chunkText,
                    chunkIndex,
                    embedding: embedResponse[0].embedding,
                    createdAt: new Date(),
                });
                chunksCreated++;
            }));
        }
        // ── Stage 5: Update document record ─────────────────────────────────
        await docRef.update({
            status: 'completed',
            extractedText: text,
            language,
            summary,
            keyTopics,
            chunksCreated,
            textLength: text.length,
            updatedAt: new Date(),
        });
        logger_1.logger.info(`[DocumentsAgent] Done: ${chunksCreated} chunks indexed for "${fileName}"`);
        return { success: true, chunksCreated, language, summary, keyTopics };
    }
    catch (err) {
        logger_1.logger.error('[DocumentsAgent] Pipeline failed', { error: err });
        await docRef.update({ status: 'failed', error: String(err), updatedAt: new Date() }).catch(() => { });
        return { success: false, chunksCreated: 0, language: 'unknown', summary: '', keyTopics: [] };
    }
});
// ── Expose as a tool for the Orchestrator ────────────────────────────────────
exports.documentsAgentTool = genkit_config_1.ai.defineTool({
    name: 'processDocument',
    description: 'Process and index a document into the knowledge base. Extracts text, generates metadata, chunks, embeds, and stores in vector DB. Use when a new document needs to be ingested.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.documentsAgentFlow)(input));
// ── MCP Phase 3: Sync documents from Google Drive ────────────────────────────
const DRIVE_SYNC_INPUT = zod_1.z.object({
    companyId: zod_1.z.string(),
    driveQuery: zod_1.z.string().optional().default('type:document modified:this_week').describe('Drive search query'),
    maxFiles: zod_1.z.number().optional().default(10),
});
const DRIVE_SYNC_OUTPUT = zod_1.z.object({
    processed: zod_1.z.number(),
    skipped: zod_1.z.number(),
    failed: zod_1.z.number(),
    files: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), status: zod_1.z.string() })),
});
exports.syncFromDriveFlow = genkit_config_1.ai.defineFlow({ name: 'syncFromDrive', inputSchema: DRIVE_SYNC_INPUT, outputSchema: DRIVE_SYNC_OUTPUT }, async ({ companyId, driveQuery, maxFiles }) => {
    if (!mcp_config_1.mcpAvailability.googleWorkspace) {
        logger_1.logger.warn('[DocumentsAgent] Drive sync skipped — Google Workspace MCP not available');
        return { processed: 0, skipped: 0, failed: 0, files: [] };
    }
    logger_1.logger.info(`[DocumentsAgent] Syncing from Drive: "${driveQuery}"`);
    const db = (0, firebase_config_1.getFirestore)();
    // Search Drive for files
    const { files } = await (0, googleWorkspace_1.driveSearchTool)({ query: driveQuery ?? '', maxResults: maxFiles });
    const results = [];
    let processed = 0, skipped = 0, failed = 0;
    for (const file of files) {
        try {
            // Check if already indexed
            const existing = await db.collection('documents')
                .where('companyId', '==', companyId)
                .where('driveFileId', '==', file.id)
                .limit(1)
                .get();
            if (!existing.empty) {
                skipped++;
                results.push({ name: file.name, status: 'skipped (already indexed)' });
                continue;
            }
            // Download file
            const exportAs = file.mimeType.includes('google-apps.document') ? 'text/plain' : undefined;
            const downloaded = await (0, googleWorkspace_1.driveDownloadTool)({ fileId: file.id, exportAs });
            // Create document record in Firestore
            const docRef = db.collection('documents').doc();
            await docRef.set({
                companyId,
                originalName: file.name,
                fileType: file.mimeType,
                status: 'pending',
                driveFileId: file.id,
                uploadedAt: new Date(),
                source: 'google_drive',
            });
            // Run the ingestion pipeline
            await (0, exports.documentsAgentFlow)({
                documentId: docRef.id,
                companyId,
                fileBuffer: downloaded.base64,
                fileName: file.name,
                mimeType: file.mimeType,
            });
            processed++;
            results.push({ name: file.name, status: 'indexed' });
        }
        catch (err) {
            failed++;
            results.push({ name: file.name, status: `failed: ${String(err).slice(0, 80)}` });
            logger_1.logger.error(`[DocumentsAgent] Failed to sync "${file.name}"`, { error: err });
        }
    }
    logger_1.logger.info(`[DocumentsAgent] Drive sync complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);
    return { processed, skipped, failed, files: results };
});
exports.syncFromDriveTool = genkit_config_1.ai.defineTool({
    name: 'syncDocumentsFromDrive',
    description: 'Automatically discover and import new documents from Google Drive into the knowledge base. Skips already-indexed files. Use when asked to sync or import from Drive.',
    inputSchema: DRIVE_SYNC_INPUT,
    outputSchema: DRIVE_SYNC_OUTPUT,
}, (input) => (0, exports.syncFromDriveFlow)(input));
//# sourceMappingURL=documents.agent.js.map