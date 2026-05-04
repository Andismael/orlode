"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeDocumentTool = exports.searchDocumentsTool = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../../utils/logger");
// ── Vector search tool ────────────────────────────────────────────────────────
exports.searchDocumentsTool = genkit_config_1.ai.defineTool({
    name: 'searchDocuments',
    description: 'Semantic search through company documents using vector similarity. Use this to find relevant information before answering questions.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('The search query or question'),
        companyId: zod_1.z.string(),
        topK: zod_1.z.number().optional().default(5),
    }),
    outputSchema: zod_1.z.object({
        chunks: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            text: zod_1.z.string(),
            documentName: zod_1.z.string(),
            score: zod_1.z.number(),
            page: zod_1.z.number().optional(),
        })),
    }),
}, async ({ query, companyId, topK }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Generate query embedding
        const embedResponse = await genkit_config_1.ai.embed({
            embedder: genkit_config_1.TEXT_EMBEDDING_MODEL,
            content: query,
        });
        const queryVector = embedResponse[0].embedding;
        // Firestore vector search in subcollection
        const colRef = db.collection(`companies/${companyId}/vectorChunks`);
        const snap = await colRef
            .findNearest('embedding', firestore_1.FieldValue.vector(queryVector), {
            limit: topK,
            distanceMeasure: 'COSINE',
        })
            .get();
        const chunks = snap.docs.map((doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                text: d['content'] ?? '',
                documentName: d['documentName'] ?? '',
                score: 1 - (d['_distance'] ?? 0),
                page: d['chunkIndex'],
            };
        });
        logger_1.logger.debug(`[RAGTool] Found ${chunks.length} chunks for query: "${query.slice(0, 50)}"`);
        return { chunks };
    }
    catch (err) {
        logger_1.logger.error('[RAGTool] searchDocuments failed', { error: err });
        return { chunks: [] };
    }
});
// ── Summarize document tool ───────────────────────────────────────────────────
exports.summarizeDocumentTool = genkit_config_1.ai.defineTool({
    name: 'summarizeDocument',
    description: 'Generate a concise summary of a specific document by its ID.',
    inputSchema: zod_1.z.object({
        documentId: zod_1.z.string(),
        companyId: zod_1.z.string(),
        maxChunks: zod_1.z.number().optional().default(10),
    }),
    outputSchema: zod_1.z.object({
        summary: zod_1.z.string(),
        docName: zod_1.z.string(),
        keyPoints: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ documentId, companyId, maxChunks }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const chunksSnap = await db.collection('chunks')
        .where('companyId', '==', companyId)
        .where('documentId', '==', documentId)
        .orderBy('chunkIndex', 'asc')
        .limit(maxChunks)
        .get();
    if (chunksSnap.empty) {
        return { summary: 'Document not found or not indexed.', docName: '', keyPoints: [] };
    }
    const docName = chunksSnap.docs[0].data()['documentName'] ?? 'Document';
    const fullText = chunksSnap.docs.map((d) => d.data()['text']).join('\n\n');
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Summarize this document concisely. Return JSON:
{"summary": "2-3 paragraph summary", "keyPoints": ["point1", "point2", ...]}

Document: ${docName}
Content:
${fullText.slice(0, 8000)}

Return ONLY JSON.`,
        config: { temperature: 0.1 },
    });
    try {
        const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return { summary: parsed.summary, docName, keyPoints: parsed.keyPoints };
    }
    catch {
        return { summary: text, docName, keyPoints: [] };
    }
});
//# sourceMappingURL=ragTools.js.map