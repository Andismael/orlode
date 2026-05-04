import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { ai, TEXT_EMBEDDING_MODEL } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { chat } from '../../services/ai/claudeService';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Input / Output schemas ───────────────────────────────────────────────────

const RAGRetrievalInputSchema = z.object({
  companyId: z.string(),
  query: z.string(),
  filters: z
    .object({
      category: z.string().optional(),
      confidentiality: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })
    .optional(),
  topK: z.number().int().min(1).max(50).optional().default(10),
});

const RetrievedChunkSchema = z.object({
  content: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  relevanceScore: z.number(),
  metadata: z.record(z.unknown()),
});

const RAGRetrievalOutputSchema = z.object({
  chunks: z.array(RetrievedChunkSchema),
});

export type RAGRetrievalInput = z.infer<typeof RAGRetrievalInputSchema>;
export type RAGRetrievalOutput = z.infer<typeof RAGRetrievalOutputSchema>;
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

// ── Flow definition ──────────────────────────────────────────────────────────

export const ragRetrievalFlow = ai.defineFlow(
  {
    name: 'ragRetrievalFlow',
    inputSchema: RAGRetrievalInputSchema,
    outputSchema: RAGRetrievalOutputSchema,
  },
  async (input): Promise<RAGRetrievalOutput> => {
    const { companyId, query, filters = {}, topK = 10 } = input;
    const db = getFirestore();

    // ── Step 1: Generate query embedding ──────────────────────────────────
    let queryVector: number[] = [];

    if (env.GOOGLE_AI_API_KEY) {
      try {
        const embedResponse = await ai.embed({
          embedder: TEXT_EMBEDDING_MODEL,
          content: query,
        });
        queryVector = embedResponse[0].embedding;
      } catch (err) {
        logger.warn('[ragRetrievalFlow] Query embedding failed, falling back to text search', { error: err });
      }
    }

    // ── Step 2: Vector search in Firestore ────────────────────────────────
    let rawChunks: Array<{
      id: string;
      content: string;
      documentId: string;
      documentName: string;
      score: number;
      metadata: Record<string, unknown>;
    }> = [];

    if (queryVector.length > 0) {
      try {
        const colRef = db.collection(`companies/${companyId}/vectorChunks`);

        const vectorQuery = (colRef as FirebaseFirestore.CollectionReference).findNearest(
          'embedding',
          FieldValue.vector(queryVector),
          {
            limit: topK * 2, // Fetch more for re-ranking
            distanceMeasure: 'COSINE',
          }
        );

        const snapshot = await vectorQuery.get();

        rawChunks = snapshot.docs.map((doc, idx) => {
          const data = doc.data() as Record<string, unknown>;
          const distanceVal = data['_distance'];
          const score = typeof distanceVal === 'number'
            ? 1 - distanceVal
            : 1 - idx / Math.max(snapshot.docs.length, 1);

          return {
            id: doc.id,
            content: (data['content'] as string | undefined) ?? '',
            documentId: (data['documentId'] as string | undefined) ?? '',
            documentName: (data['documentName'] as string | undefined) ?? 'Unknown',
            score,
            metadata: (data['metadata'] as Record<string, unknown> | undefined) ?? {},
          };
        });

        logger.debug(`[ragRetrievalFlow] Firestore vector search returned ${rawChunks.length} chunks`);
      } catch (err) {
        logger.warn('[ragRetrievalFlow] Firestore vector search failed', { error: err });
      }
    }

    // Fallback: keyword-based text search when vector search is unavailable
    if (rawChunks.length === 0) {
      logger.info('[ragRetrievalFlow] Falling back to keyword search');
      const snapshot = await db
        .collection(`companies/${companyId}/vectorChunks`)
        .orderBy('createdAt', 'desc')
        .limit(topK * 2)
        .get();

      const keywords = query.toLowerCase().split(/\s+/);
      rawChunks = snapshot.docs
        .map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const content = ((data['content'] as string | undefined) ?? '').toLowerCase();
          const matchCount = keywords.filter((kw) => content.includes(kw)).length;

          return {
            id: doc.id,
            content: (data['content'] as string | undefined) ?? '',
            documentId: (data['documentId'] as string | undefined) ?? '',
            documentName: (data['documentName'] as string | undefined) ?? 'Unknown',
            score: matchCount / Math.max(keywords.length, 1),
            metadata: (data['metadata'] as Record<string, unknown> | undefined) ?? {},
          };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK * 2);
    }

    // Apply category/confidentiality filters
    if (filters.category) {
      rawChunks = rawChunks.filter(
        (c) => (c.metadata['category'] as string | undefined) === filters.category
      );
    }
    if (filters.confidentiality) {
      rawChunks = rawChunks.filter(
        (c) => (c.metadata['confidentiality'] as string | undefined) === filters.confidentiality
      );
    }

    // ── Step 3: Re-rank with Gemini 3 Pro ─────────────────────────────────
    const candidates = rawChunks.slice(0, topK * 2);
    let finalChunks: RetrievedChunk[];

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
    } else {
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

        const reRankResponse = await chat({
          systemPrompt: 'Tu es un assistant de classement de documents. Retourne uniquement du JSON valide.',
          messages: [{ role: 'user', content: reRankPrompt }],
          maxTokens: 256,
          temperature: 0.0,
        });

        const cleaned = reRankResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const rankedIndices = JSON.parse(cleaned) as number[];
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
      } catch (err) {
        logger.warn('[ragRetrievalFlow] Re-ranking failed, using vector scores', { error: err });
        finalChunks = candidates.slice(0, topK).map((c) => ({
          content: c.content,
          documentId: c.documentId,
          documentName: c.documentName,
          relevanceScore: c.score,
          metadata: c.metadata,
        }));
      }
    }

    logger.info(`[ragRetrievalFlow] Returning ${finalChunks.length} chunks for query`);
    return { chunks: finalChunks };
  }
);
