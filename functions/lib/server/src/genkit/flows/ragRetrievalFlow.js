"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragRetrievalFlow = void 0;
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const claudeService_1 = require("../../services/ai/claudeService");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Input / Output schemas ───────────────────────────────────────────────────
const RAGRetrievalInputSchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    query: zod_1.z.string(),
    filters: zod_1.z
        .object({
        category: zod_1.z.string().optional(),
        confidentiality: zod_1.z.string().optional(),
        dateFrom: zod_1.z.string().optional(),
        dateTo: zod_1.z.string().optional(),
    })
        .optional(),
    topK: zod_1.z.number().int().min(1).max(50).optional().default(10),
});
const RetrievedChunkSchema = zod_1.z.object({
    content: zod_1.z.string(),
    documentId: zod_1.z.string(),
    documentName: zod_1.z.string(),
    relevanceScore: zod_1.z.number(),
    metadata: zod_1.z.record(zod_1.z.unknown()),
});
const RAGRetrievalOutputSchema = zod_1.z.object({
    chunks: zod_1.z.array(RetrievedChunkSchema),
});
// ── Flow definition ──────────────────────────────────────────────────────────
exports.ragRetrievalFlow = genkit_config_1.ai.defineFlow({
    name: 'ragRetrievalFlow',
    inputSchema: RAGRetrievalInputSchema,
    outputSchema: RAGRetrievalOutputSchema,
}, async (input) => {
    const { companyId, query, filters = {}, topK = 10 } = input;
    const db = (0, firebase_config_1.getFirestore)();
    // ── Step 1: Generate query embedding ──────────────────────────────────
    let queryVector = [];
    if (env_config_1.env.GOOGLE_AI_API_KEY) {
        try {
            const embedResponse = await genkit_config_1.ai.embed({
                embedder: genkit_config_1.TEXT_EMBEDDING_MODEL,
                content: query,
            });
            queryVector = embedResponse[0].embedding;
        }
        catch (err) {
            logger_1.logger.warn('[ragRetrievalFlow] Query embedding failed, falling back to text search', { error: err });
        }
    }
    // ── Step 2: Vector search in Firestore ────────────────────────────────
    let rawChunks = [];
    if (queryVector.length > 0) {
        try {
            const colRef = db.collection(`companies/${companyId}/vectorChunks`);
            const vectorQuery = colRef.findNearest('embedding', firestore_1.FieldValue.vector(queryVector), {
                limit: topK * 2, // Fetch more for re-ranking
                distanceMeasure: 'COSINE',
            });
            const snapshot = await vectorQuery.get();
            rawChunks = snapshot.docs.map((doc, idx) => {
                const data = doc.data();
                const distanceVal = data['_distance'];
                const score = typeof distanceVal === 'number'
                    ? 1 - distanceVal
                    : 1 - idx / Math.max(snapshot.docs.length, 1);
                return {
                    id: doc.id,
                    content: data['content'] ?? '',
                    documentId: data['documentId'] ?? '',
                    documentName: data['documentName'] ?? 'Unknown',
                    score,
                    metadata: data['metadata'] ?? {},
                };
            });
            logger_1.logger.debug(`[ragRetrievalFlow] Firestore vector search returned ${rawChunks.length} chunks`);
        }
        catch (err) {
            logger_1.logger.warn('[ragRetrievalFlow] Firestore vector search failed', { error: err });
        }
    }
    // Fallback: keyword-based text search when vector search is unavailable
    if (rawChunks.length === 0) {
        logger_1.logger.info('[ragRetrievalFlow] Falling back to keyword search');
        const snapshot = await db
            .collection(`companies/${companyId}/vectorChunks`)
            .orderBy('createdAt', 'desc')
            .limit(topK * 2)
            .get();
        const keywords = query.toLowerCase().split(/\s+/);
        rawChunks = snapshot.docs
            .map((doc) => {
            const data = doc.data();
            const content = (data['content'] ?? '').toLowerCase();
            const matchCount = keywords.filter((kw) => content.includes(kw)).length;
            return {
                id: doc.id,
                content: data['content'] ?? '',
                documentId: data['documentId'] ?? '',
                documentName: data['documentName'] ?? 'Unknown',
                score: matchCount / Math.max(keywords.length, 1),
                metadata: data['metadata'] ?? {},
            };
        })
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK * 2);
    }
    // Apply category/confidentiality filters
    if (filters.category) {
        rawChunks = rawChunks.filter((c) => c.metadata['category'] === filters.category);
    }
    if (filters.confidentiality) {
        rawChunks = rawChunks.filter((c) => c.metadata['confidentiality'] === filters.confidentiality);
    }
    // ── Step 3: Re-rank with Gemini 3 Pro ─────────────────────────────────
    const candidates = rawChunks.slice(0, topK * 2);
    let finalChunks;
    if (candidates.length === 0) {
        return { chunks: [] };
    }
    if (candidates.length <= topK) {
        // No need to re-rank, just format
        finalChunks = candidates.map((c) => ({
            content: c.content,
            documentId: c.documentId,
            documentName: c.documentName,
            relevanceScore: c.score,
            metadata: c.metadata,
        }));
    }
    else {
        try {
            const candidateList = candidates
                .map((c, i) => `[${i}] "${c.documentName}": ${c.content.slice(0, 300)}`)
                .join('\n\n');
            const reRankPrompt = `Re-rank the following document chunks by relevance to the query.

Query: "${query}"

Chunks:
${candidateList}

Return a JSON array of chunk indices in order of relevance (most relevant first), limited to the top ${topK}:
[0, 3, 1, ...]

Return ONLY the JSON array.`;
            const reRankResponse = await (0, claudeService_1.chat)({
                systemPrompt: 'Tu es un assistant de classement de documents. Retourne uniquement du JSON valide.',
                messages: [{ role: 'user', content: reRankPrompt }],
                maxTokens: 256,
                temperature: 0.0,
            });
            const cleaned = reRankResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const rankedIndices = JSON.parse(cleaned);
            const validIndices = rankedIndices
                .filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length)
                .slice(0, topK);
            finalChunks = validIndices.map((idx, rank) => ({
                content: candidates[idx].content,
                documentId: candidates[idx].documentId,
                documentName: candidates[idx].documentName,
                relevanceScore: 1 - rank / Math.max(validIndices.length, 1),
                metadata: candidates[idx].metadata,
            }));
        }
        catch (err) {
            logger_1.logger.warn('[ragRetrievalFlow] Re-ranking failed, using vector scores', { error: err });
            finalChunks = candidates.slice(0, topK).map((c) => ({
                content: c.content,
                documentId: c.documentId,
                documentName: c.documentName,
                relevanceScore: c.score,
                metadata: c.metadata,
            }));
        }
    }
    logger_1.logger.info(`[ragRetrievalFlow] Returning ${finalChunks.length} chunks for query`);
    return { chunks: finalChunks };
});
//# sourceMappingURL=ragRetrievalFlow.js.map