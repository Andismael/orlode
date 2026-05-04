import { generateEmbedding } from './embeddingService';
import { querySimilar } from './vectorStore';
import { logger } from '../../utils/logger';

export interface RetrievedChunk {
  id: string;
  text: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * Retrieve the most relevant document chunks for a given query.
 * Flow: embed query → search Pinecone → return top-K chunks
 */
export async function retrieveRelevantChunks(
  query: string,
  companyId: string,
  topK = 5,
  minScore = 0.3
): Promise<RetrievedChunk[]> {
  logger.debug(`Retrieving chunks for query: "${query.slice(0, 80)}..." in company ${companyId}`);

  // Embed the query
  const queryEmbedding = await generateEmbedding(query);

  // Search Pinecone
  const results = await querySimilar(queryEmbedding, companyId, topK);

  // Filter by minimum score and map to clean interface
  const chunks: RetrievedChunk[] = results
    .filter((r) => r.score >= minScore)
    .map((r) => ({
      id: r.id,
      text: (r.metadata['text'] as string | undefined) ?? '',
      documentId: (r.metadata['documentId'] as string | undefined) ?? '',
      documentName: (r.metadata['documentName'] as string | undefined) ?? 'Unknown document',
      chunkIndex: (r.metadata['chunkIndex'] as number | undefined) ?? 0,
      score: r.score,
      metadata: r.metadata,
    }));

  logger.info(`Retrieved ${chunks.length} relevant chunks (topK=${topK}, minScore=${minScore})`);
  return chunks;
}

/**
 * Build a formatted context string from retrieved chunks.
 */
export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';

  return chunks
    .map((chunk, i) =>
      `[Document ${i + 1}: "${chunk.documentName}"]\n${chunk.text}`
    )
    .join('\n\n---\n\n');
}
