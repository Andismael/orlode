import { z } from 'zod';
import { ai, GEMINI_FLASH, TEXT_EMBEDDING_MODEL } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger';

// ── Vector search tool ────────────────────────────────────────────────────────
export const searchDocumentsTool = ai.defineTool(
  {
    name: 'searchDocuments',
    description: 'Semantic search through company documents using vector similarity. Use this to find relevant information before answering questions.',
    inputSchema: z.object({
      query:     z.string().describe('The search query or question'),
      companyId: z.string(),
      topK:      z.number().optional().default(5),
    }),
    outputSchema: z.object({
      chunks: z.array(z.object({
        id:           z.string(),
        text:         z.string(),
        documentName: z.string(),
        score:        z.number(),
        page:         z.number().optional(),
      })),
    }),
  },
  async ({ query, companyId, topK }) => {
    try {
      const db = getFirestore();

      // Generate query embedding
      const embedResponse = await ai.embed({
        embedder: TEXT_EMBEDDING_MODEL,
        content:  query,
      });
      const queryVector = embedResponse[0].embedding;

      // Firestore vector search in subcollection
      const colRef = db.collection(`companies/${companyId}/vectorChunks`);
      const snap = await (colRef as FirebaseFirestore.CollectionReference)
        .findNearest('embedding', FieldValue.vector(queryVector), {
          limit:           topK,
          distanceMeasure: 'COSINE',
        })
        .get();

      const chunks = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id:           doc.id,
          text:         (d['content'] as string) ?? '',
          documentName: (d['documentName'] as string) ?? '',
          score:        1 - ((d['_distance'] as number | undefined) ?? 0),
          page:         (d['chunkIndex'] as number | undefined),
        };
      });

      logger.debug(`[RAGTool] Found ${chunks.length} chunks for query: "${query.slice(0, 50)}"`);
      return { chunks };
    } catch (err) {
      logger.error('[RAGTool] searchDocuments failed', { error: err });
      return { chunks: [] };
    }
  }
);

// ── Summarize document tool ───────────────────────────────────────────────────
export const summarizeDocumentTool = ai.defineTool(
  {
    name: 'summarizeDocument',
    description: 'Generate a concise summary of a specific document by its ID.',
    inputSchema: z.object({
      documentId: z.string(),
      companyId:  z.string(),
      maxChunks:  z.number().optional().default(10),
    }),
    outputSchema: z.object({
      summary:  z.string(),
      docName:  z.string(),
      keyPoints: z.array(z.string()),
    }),
  },
  async ({ documentId, companyId, maxChunks }) => {
    const db = getFirestore();

    const chunksSnap = await db.collection('chunks')
      .where('companyId', '==', companyId)
      .where('documentId', '==', documentId)
      .orderBy('chunkIndex', 'asc')
      .limit(maxChunks)
      .get();

    if (chunksSnap.empty) {
      return { summary: 'Document not found or not indexed.', docName: '', keyPoints: [] };
    }

    const docName = (chunksSnap.docs[0].data()['documentName'] as string) ?? 'Document';
    const fullText = chunksSnap.docs.map((d) => d.data()['text'] as string).join('\n\n');

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Summarize this document concisely. Return JSON:
{"summary": "2-3 paragraph summary", "keyPoints": ["point1", "point2", ...]}

Document: ${docName}
Content:
${fullText.slice(0, 8000)}

Return ONLY JSON.`,
      config: { temperature: 0.1 },
    });

    try {
      const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, '')) as {
        summary: string; keyPoints: string[];
      };
      return { summary: parsed.summary, docName, keyPoints: parsed.keyPoints };
    } catch {
      return { summary: text, docName, keyPoints: [] };
    }
  }
);
