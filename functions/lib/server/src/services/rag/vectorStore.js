"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertChunks = upsertChunks;
exports.querySimilar = querySimilar;
exports.deleteDocumentVectors = deleteDocumentVectors;
exports.deleteCompanyVectors = deleteCompanyVectors;
const pinecone_config_1 = require("../../config/pinecone.config");
const logger_1 = require("../../utils/logger");
const helpers_1 = require("../../utils/helpers");
/**
 * Upsert text chunks with their embeddings into Pinecone.
 * Uses namespace = companyId for data isolation.
 */
async function upsertChunks(chunks, embeddings, companyId) {
    if (chunks.length !== embeddings.length) {
        throw new Error('Chunks and embeddings arrays must have the same length');
    }
    const index = (0, pinecone_config_1.getPineconeIndex)();
    const namespace = index.namespace(companyId);
    const vectors = chunks.map((chunk, i) => ({
        id: chunk.id,
        values: embeddings[i],
        metadata: {
            ...chunk.metadata,
            text: chunk.text.slice(0, 1000), // Store excerpt for retrieval
        },
    }));
    // Pinecone has a limit of 100 vectors per upsert call
    const batches = (0, helpers_1.chunkArray)(vectors, 100);
    for (const batch of batches) {
        await namespace.upsert(batch);
        logger_1.logger.debug(`Upserted ${batch.length} vectors to Pinecone namespace: ${companyId}`);
    }
}
/**
 * Query Pinecone for the top-k most similar vectors.
 */
async function querySimilar(queryEmbedding, companyId, topK = 5, filter) {
    const index = (0, pinecone_config_1.getPineconeIndex)();
    const namespace = index.namespace(companyId);
    const results = await namespace.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter,
    });
    return (results.matches ?? []).map((match) => ({
        id: match.id,
        score: match.score ?? 0,
        metadata: (match.metadata ?? {}),
    }));
}
/**
 * Delete all vectors for a specific document.
 */
async function deleteDocumentVectors(documentId, companyId) {
    const index = (0, pinecone_config_1.getPineconeIndex)();
    const namespace = index.namespace(companyId);
    // Delete by metadata filter
    await namespace.deleteMany({
        documentId: { $eq: documentId },
    });
    logger_1.logger.info(`Deleted vectors for document ${documentId} from namespace ${companyId}`);
}
/**
 * Delete all vectors for a company (use with caution).
 */
async function deleteCompanyVectors(companyId) {
    const index = (0, pinecone_config_1.getPineconeIndex)();
    const namespace = index.namespace(companyId);
    await namespace.deleteAll();
    logger_1.logger.info(`Deleted all vectors for company ${companyId}`);
}
//# sourceMappingURL=vectorStore.js.map