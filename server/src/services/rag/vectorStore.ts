import { getPineconeIndex } from '../../config/pinecone.config';
import { logger } from '../../utils/logger';
import { chunkArray } from '../../utils/helpers';
import type { TextChunk } from './textChunker';

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * Upsert text chunks with their embeddings into Pinecone.
 * Uses namespace = companyId for data isolation.
 */
export async function upsertChunks(
  chunks: TextChunk[],
  embeddings: number[][],
  companyId: string
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error('Chunks and embeddings arrays must have the same length');
  }

  const index = getPineconeIndex();
  const namespace = index.namespace(companyId);

  const vectors: VectorRecord[] = chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i]!,
    metadata: {
      ...chunk.metadata,
      text: chunk.text.slice(0, 1000), // Store excerpt for retrieval
    },
  }));

  // Pinecone has a limit of 100 vectors per upsert call
  const batches = chunkArray(vectors, 100);

  for (const batch of batches) {
    await namespace.upsert(batch as Parameters<typeof namespace.upsert>[0]);
    logger.debug(`Upserted ${batch.length} vectors to Pinecone namespace: ${companyId}`);
  }
}

/**
 * Query Pinecone for the top-k most similar vectors.
 */
export async function querySimilar(
  queryEmbedding: number[],
  companyId: string,
  topK = 5,
  filter?: Record<string, unknown>
): Promise<QueryResult[]> {
  const index = getPineconeIndex();
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
    metadata: (match.metadata ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Delete all vectors for a specific document.
 */
export async function deleteDocumentVectors(
  documentId: string,
  companyId: string
): Promise<void> {
  const index = getPineconeIndex();
  const namespace = index.namespace(companyId);

  // Delete by metadata filter
  await namespace.deleteMany({
    documentId: { $eq: documentId },
  });

  logger.info(`Deleted vectors for document ${documentId} from namespace ${companyId}`);
}

/**
 * Delete all vectors for a company (use with caution).
 */
export async function deleteCompanyVectors(companyId: string): Promise<void> {
  const index = getPineconeIndex();
  const namespace = index.namespace(companyId);
  await namespace.deleteAll();
  logger.info(`Deleted all vectors for company ${companyId}`);
}
