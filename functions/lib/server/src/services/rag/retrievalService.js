"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveRelevantChunks = retrieveRelevantChunks;
exports.buildContext = buildContext;
const embeddingService_1 = require("./embeddingService");
const vectorStore_1 = require("./vectorStore");
const logger_1 = require("../../utils/logger");
/**
 * Retrieve the most relevant document chunks for a given query.
 * Flow: embed query → search Pinecone → return top-K chunks
 */
async function retrieveRelevantChunks(query, companyId, topK = 5, minScore = 0.3) {
    logger_1.logger.debug(`Retrieving chunks for query: "${query.slice(0, 80)}..." in company ${companyId}`);
    // Embed the query
    const queryEmbedding = await (0, embeddingService_1.generateEmbedding)(query);
    // Search Pinecone
    const results = await (0, vectorStore_1.querySimilar)(queryEmbedding, companyId, topK);
    // Filter by minimum score and map to clean interface
    const chunks = results
        .filter((r) => r.score >= minScore)
        .map((r) => ({
        id: r.id,
        text: r.metadata['text'] ?? '',
        documentId: r.metadata['documentId'] ?? '',
        documentName: r.metadata['documentName'] ?? 'Unknown document',
        chunkIndex: r.metadata['chunkIndex'] ?? 0,
        score: r.score,
        metadata: r.metadata,
    }));
    logger_1.logger.info(`Retrieved ${chunks.length} relevant chunks (topK=${topK}, minScore=${minScore})`);
    return chunks;
}
/**
 * Build a formatted context string from retrieved chunks.
 */
function buildContext(chunks) {
    if (chunks.length === 0)
        return '';
    return chunks
        .map((chunk, i) => `[Document ${i + 1}: "${chunk.documentName}"]\n${chunk.text}`)
        .join('\n\n---\n\n');
}
//# sourceMappingURL=retrievalService.js.map