import { z } from 'zod';
import https from 'https';
import http from 'http';
import { FieldValue } from 'firebase-admin/firestore';
import { ai, GEMINI_FLASH, TEXT_EMBEDDING_MODEL } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { extractText } from '../../services/rag/documentProcessor';
import { chunkText } from '../../services/rag/textChunker';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/helpers';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── Input / Output schemas ───────────────────────────────────────────────────

const IngestDocumentInputSchema = z.object({
  companyId: z.string(),
  documentId: z.string(),
  fileUrl: z.string().optional(),   // remote URL (optional)
  localPath: z.string().optional(), // local disk path (preferred)
  fileType: z.string(),
  fileName: z.string(),
});

const IngestDocumentOutputSchema = z.object({
  chunksCreated: z.number(),
  embeddingsGenerated: z.number(),
  entitiesExtracted: z.number(),
  classification: z.string(),
  confidence: z.number(),
});

export type IngestDocumentInput = z.infer<typeof IngestDocumentInputSchema>;
export type IngestDocumentOutput = z.infer<typeof IngestDocumentOutputSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => undefined);
      reject(err);
    });
  });
}

// ── Flow definition ──────────────────────────────────────────────────────────

export const ingestDocumentFlow = ai.defineFlow(
  {
    name: 'ingestDocumentFlow',
    inputSchema: IngestDocumentInputSchema,
    outputSchema: IngestDocumentOutputSchema,
  },
  async (input): Promise<IngestDocumentOutput> => {
    const db = getFirestore();
    const { companyId, documentId, fileUrl, localPath, fileType, fileName } = input;

    const updateStatus = async (status: string, extra: Record<string, unknown> = {}): Promise<void> => {
      await db.collection('documents').doc(documentId).update({
        processingStatus: status,
        ...extra,
        updatedAt: FieldValue.serverTimestamp(),
      });
    };

    // ── Step 1: Resolve file path ──────────────────────────────────────────
    let tmpPath: string;
    let ownsTmpFile = false; // true if we downloaded it and must clean it up

    if (localPath && fs.existsSync(localPath)) {
      // File already on disk — use directly
      tmpPath = localPath;
      logger.info(`[ingestDocumentFlow] Using local file: ${tmpPath}`);
    } else if (fileUrl) {
      // Download from remote URL
      await updateStatus('downloading');
      tmpPath = path.join(os.tmpdir(), `corpmind_${documentId}_${Date.now()}${path.extname(fileName)}`);
      ownsTmpFile = true;
      try {
        await downloadFile(fileUrl, tmpPath);
        logger.info(`[ingestDocumentFlow] Downloaded ${fileName} to ${tmpPath}`);
      } catch (err) {
        await updateStatus('failed', { error: 'Download failed' });
        throw err;
      }
    } else {
      await updateStatus('failed', { error: 'No file source provided' });
      throw new Error('ingestDocumentFlow: neither localPath nor fileUrl provided');
    }

    // ── Step 2: Extract text ───────────────────────────────────────────────
    await updateStatus('extracting_text');
    let extractedText = '';
    let wordCount = 0;
    let pageCount = 0;

    try {
      const extracted = await extractText(tmpPath, fileType);
      extractedText = extracted.text;
      wordCount = extracted.metadata.wordCount;
      pageCount = extracted.metadata.pageCount ?? 0;
      logger.info(`[ingestDocumentFlow] Extracted ${wordCount} words from ${fileName}`);
    } catch (err) {
      await updateStatus('failed', { error: 'Text extraction failed' });
      fs.unlink(tmpPath, () => undefined);
      throw err;
    }

    // ── Step 3: Classify via Gemini ────────────────────────────────────────
    await updateStatus('classifying');
    let classification = 'unknown';
    let classificationConfidence = 0;
    let tags: string[] = [];

    if (env.GOOGLE_AI_API_KEY) {
      try {
        const classifyPrompt = `Classify this corporate document in JSON:
{"category":"string","confidentiality":"public|internal|confidential|secret","tags":["..."],"department":"string|null","confidence":0.0-1.0}

File: ${fileName}
Content:
"""${extractedText.slice(0, 2000)}"""

Return ONLY JSON.`;

        const { text: classifyText } = await ai.generate({
          model: GEMINI_FLASH,
          prompt: classifyPrompt,
          config: { temperature: 0.1 },
        });

        const cleaned = classifyText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        classification = (parsed['category'] as string | undefined) ?? 'unknown';
        classificationConfidence = (parsed['confidence'] as number | undefined) ?? 0.5;
        tags = Array.isArray(parsed['tags']) ? (parsed['tags'] as string[]) : [];

        await db.collection('documents').doc(documentId).update({
          classification,
          confidentiality: parsed['confidentiality'] ?? 'internal',
          tags,
          department: parsed['department'] ?? null,
          classificationConfidence,
        });
      } catch (err) {
        logger.warn('[ingestDocumentFlow] Classification failed, continuing', { error: err });
      }
    }

    // ── Step 4: Extract entities via Gemini ────────────────────────────────
    await updateStatus('extracting_entities');
    let entitiesExtracted = 0;
    const entityData: Array<{ type: string; value: string; confidence: number }> = [];

    if (env.GOOGLE_AI_API_KEY) {
      try {
        const entityPrompt = `Extract named entities from the text. Return JSON:
{"entities":[{"type":"person|organization|date|money|location|product","value":"...","confidence":0.0-1.0}]}
Return ONLY JSON.

Text:
"""${extractedText.slice(0, 3000)}"""`;

        const { text: entityText } = await ai.generate({
          model: GEMINI_FLASH,
          prompt: entityPrompt,
          config: { temperature: 0.0 },
        });

        const cleaned = entityText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned) as { entities?: Array<{ type: string; value: string; confidence: number }> };
        const entities = parsed.entities ?? [];
        entitiesExtracted = entities.length;
        entityData.push(...entities);

        await db.collection('documents').doc(documentId).update({ entities });
      } catch (err) {
        logger.warn('[ingestDocumentFlow] Entity extraction failed, continuing', { error: err });
      }
    }

    // ── Step 5: Chunk text ─────────────────────────────────────────────────
    await updateStatus('chunking');
    const chunks = chunkText(extractedText, {
      documentId,
      documentName: fileName,
      companyId,
      additionalMetadata: { fileType, wordCount, pageCount },
    });
    logger.info(`[ingestDocumentFlow] Created ${chunks.length} chunks`);

    // ── Step 6: Generate embeddings & store in Firestore ───────────────────
    await updateStatus('embedding');
    let embeddingsGenerated = 0;

    const BATCH = 20;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const chunkRefs: Array<{ id: string; data: Record<string, unknown>; embedding: number[] }> = [];

      for (const chunk of slice) {
        let embedding: number[] = [];

        if (env.GOOGLE_AI_API_KEY) {
          try {
            const embedResponse = await ai.embed({
              embedder: TEXT_EMBEDDING_MODEL,
              content: chunk.text,
            });
            embedding = embedResponse[0].embedding;
            embeddingsGenerated++;
          } catch (err) {
            logger.warn('[ingestDocumentFlow] Embedding failed for chunk, using empty vector', { error: err });
          }
        }

        const chunkId = generateId();
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
          embedding: embedding.length > 0 ? FieldValue.vector(embedding) : null,
          createdAt: FieldValue.serverTimestamp(),
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
      processedAt: FieldValue.serverTimestamp(),
      // Persist extracted text so readDocumentTool can serve it without semantic search.
      // Firestore doc size limit is ~1MB — cap at 800k chars to stay safe.
      extractedText: extractedText.slice(0, 800000),
    });

    // Cleanup: only delete if we downloaded it (not if caller owns it)
    if (ownsTmpFile) {
      try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    }

    logger.info(
      `[ingestDocumentFlow] Done: ${chunks.length} chunks, ${embeddingsGenerated} embeddings, ${entitiesExtracted} entities`
    );

    return {
      chunksCreated: chunks.length,
      embeddingsGenerated,
      entitiesExtracted,
      classification,
      confidence: classificationConfidence,
    };
  }
);
