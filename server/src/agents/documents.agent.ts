/**
 * Documents Agent — Gemini Flash
 *
 * Pattern: sequential pipeline
 * Stages: extract text → clean → chunk → embed → index to Firestore
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH, TEXT_EMBEDDING_MODEL } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { driveSearchTool, driveDownloadTool, docsReadTool, sheetsReadTool } from './tools/mcp/googleWorkspace';
import { mcpAvailability } from '../config/mcp.config';
import { logger } from '../utils/logger';

const INPUT = z.object({
  documentId: z.string(),
  companyId:  z.string(),
  fileBuffer: z.string().describe('Base64-encoded file content'),
  fileName:   z.string(),
  mimeType:   z.string(),
});

const OUTPUT = z.object({
  success:      z.boolean(),
  chunksCreated: z.number(),
  language:     z.string(),
  summary:      z.string(),
  keyTopics:    z.array(z.string()),
});

export type DocumentsInput  = z.infer<typeof INPUT>;
export type DocumentsOutput = z.infer<typeof OUTPUT>;

// ── Helper: split text into overlapping chunks ────────────────────────────────
function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

// ── Stage 1: Extract text from document via Gemini ───────────────────────────
async function extractText(base64: string, mimeType: string, fileName: string): Promise<{ text: string; language: string }> {
  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: [
      {
        media: {
          contentType: mimeType as 'application/pdf' | 'text/plain',
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
    const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, '')) as {
      text: string; language: string;
    };
    return parsed;
  } catch {
    return { text, language: 'en' };
  }
}

// ── Stage 2: Generate metadata (summary + key topics) ────────────────────────
async function generateMetadata(text: string, fileName: string): Promise<{ summary: string; keyTopics: string[] }> {
  const { text: raw } = await ai.generate({
    model: GEMINI_FLASH,
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
    const parsed = JSON.parse(raw.replace(/^```json\s*/, '').replace(/\s*```$/, '')) as {
      summary: string; keyTopics: string[];
    };
    return parsed;
  } catch {
    return { summary: '', keyTopics: [] };
  }
}

// ── The flow (sequential pipeline) ───────────────────────────────────────────
export const documentsAgentFlow = ai.defineFlow(
  { name: 'documentsAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ documentId, companyId, fileBuffer, fileName, mimeType }): Promise<DocumentsOutput> => {
    logger.info(`[DocumentsAgent] Processing "${fileName}" for company ${companyId}`);
    const db = getFirestore();
    const docRef = db.collection('documents').doc(documentId);

    try {
      // ── Stage 1: Extract text ────────────────────────────────────────────
      await docRef.update({ status: 'extracting', updatedAt: new Date() });
      logger.info(`[DocumentsAgent] Stage 1: Extracting text from ${fileName}`);
      const { text, language } = await extractText(fileBuffer, mimeType, fileName);

      if (!text || text.length < 10) {
        await docRef.update({ status: 'failed', error: 'No text extracted', updatedAt: new Date() });
        return { success: false, chunksCreated: 0, language: 'unknown', summary: '', keyTopics: [] };
      }

      // ── Stage 2: Generate metadata ───────────────────────────────────────
      await docRef.update({ status: 'analyzing', updatedAt: new Date() });
      logger.info(`[DocumentsAgent] Stage 2: Generating metadata`);
      const { summary, keyTopics } = await generateMetadata(text, fileName);

      // ── Stage 3: Chunk the text ──────────────────────────────────────────
      await docRef.update({ status: 'chunking', updatedAt: new Date() });
      logger.info(`[DocumentsAgent] Stage 3: Chunking text (${text.length} chars)`);
      const chunks = chunkText(text);
      logger.info(`[DocumentsAgent] Created ${chunks.length} chunks`);

      // ── Stage 4: Embed + index each chunk ───────────────────────────────
      await docRef.update({ status: 'embedding', updatedAt: new Date() });
      logger.info(`[DocumentsAgent] Stage 4: Embedding and indexing chunks`);

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

        await Promise.all(
          batchChunks.map(async (chunkText, j) => {
            const chunkIndex = i + j;
            const embedResponse = await ai.embed({
              embedder: TEXT_EMBEDDING_MODEL,
              content: chunkText,
            });

            const chunkRef = db.collection('chunks').doc();
            await chunkRef.set({
              documentId,
              companyId,
              documentName: fileName,
              text:         chunkText,
              chunkIndex,
              embedding:    embedResponse[0].embedding,
              createdAt:    new Date(),
            });

            chunksCreated++;
          })
        );
      }

      // ── Stage 5: Update document record ─────────────────────────────────
      await docRef.update({
        status:       'completed',
        extractedText: text,
        language,
        summary,
        keyTopics,
        chunksCreated,
        textLength:   text.length,
        updatedAt:    new Date(),
      });

      logger.info(`[DocumentsAgent] Done: ${chunksCreated} chunks indexed for "${fileName}"`);
      return { success: true, chunksCreated, language, summary, keyTopics };

    } catch (err) {
      logger.error('[DocumentsAgent] Pipeline failed', { error: err });
      await docRef.update({ status: 'failed', error: String(err), updatedAt: new Date() }).catch(() => {});
      return { success: false, chunksCreated: 0, language: 'unknown', summary: '', keyTopics: [] };
    }
  }
);

// ── Expose as a tool for the Orchestrator ────────────────────────────────────
export const documentsAgentTool = ai.defineTool(
  {
    name: 'processDocument',
    description: 'Process and index a document into the knowledge base. Extracts text, generates metadata, chunks, embeds, and stores in vector DB. Use when a new document needs to be ingested.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => documentsAgentFlow(input)
);

// ── MCP Phase 3: Sync documents from Google Drive ────────────────────────────
const DRIVE_SYNC_INPUT = z.object({
  companyId:  z.string(),
  driveQuery: z.string().optional().default('type:document modified:this_week').describe('Drive search query'),
  maxFiles:   z.number().optional().default(10),
});

const DRIVE_SYNC_OUTPUT = z.object({
  processed: z.number(),
  skipped:   z.number(),
  failed:    z.number(),
  files:     z.array(z.object({ name: z.string(), status: z.string() })),
});

export const syncFromDriveFlow = ai.defineFlow(
  { name: 'syncFromDrive', inputSchema: DRIVE_SYNC_INPUT, outputSchema: DRIVE_SYNC_OUTPUT },
  async ({ companyId, driveQuery, maxFiles }) => {
    if (!mcpAvailability.googleWorkspace) {
      logger.warn('[DocumentsAgent] Drive sync skipped — Google Workspace MCP not available');
      return { processed: 0, skipped: 0, failed: 0, files: [] };
    }

    logger.info(`[DocumentsAgent] Syncing from Drive: "${driveQuery}"`);
    const db = getFirestore();

    // Search Drive for files
    const { files } = await driveSearchTool({ query: driveQuery ?? '', maxResults: maxFiles });
    const results: Array<{ name: string; status: string }> = [];
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
        const downloaded = await driveDownloadTool({ fileId: file.id, exportAs });

        // Create document record in Firestore
        const docRef = db.collection('documents').doc();
        await docRef.set({
          companyId,
          originalName: file.name,
          fileType:     file.mimeType,
          status:       'pending',
          driveFileId:  file.id,
          uploadedAt:   new Date(),
          source:       'google_drive',
        });

        // Run the ingestion pipeline
        await documentsAgentFlow({
          documentId:  docRef.id,
          companyId,
          fileBuffer:  downloaded.base64,
          fileName:    file.name,
          mimeType:    file.mimeType,
        });

        processed++;
        results.push({ name: file.name, status: 'indexed' });
      } catch (err) {
        failed++;
        results.push({ name: file.name, status: `failed: ${String(err).slice(0, 80)}` });
        logger.error(`[DocumentsAgent] Failed to sync "${file.name}"`, { error: err });
      }
    }

    logger.info(`[DocumentsAgent] Drive sync complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);
    return { processed, skipped, failed, files: results };
  }
);

export const syncFromDriveTool = ai.defineTool(
  {
    name: 'syncDocumentsFromDrive',
    description: 'Automatically discover and import new documents from Google Drive into the knowledge base. Skips already-indexed files. Use when asked to sync or import from Drive.',
    inputSchema:  DRIVE_SYNC_INPUT,
    outputSchema: DRIVE_SYNC_OUTPUT,
  },
  (input) => syncFromDriveFlow(input)
);
