import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import fs from 'fs';
import { getFirestore, getStorage } from '../config/firebase.config';
import { ingestDocumentFlow } from '../genkit/flows/ingestDocumentFlow';
import { documentClassifyFlow } from '../genkit/flows/documentClassifyFlow';
import { extractText } from '../services/rag/documentProcessor';
import { firestoreVectorStore } from '../services/rag/firestoreVectorStore';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';
import type { CompanyDocument } from '../models/Document';
import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { env } from '../config/env.config';

// ── POST /api/data/documents ──────────────────────────────────────────────────

export async function uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) throw new AppError('No file uploaded', 400);
  if (!req.user) throw new AppError('Not authenticated', 401);

  const companyId = (req.body as { companyId?: string }).companyId ?? req.user.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { file } = req;
  const db = getFirestore();
  const documentId = generateId();

  // Create Firestore record immediately so the client can track progress
  const docData: Omit<CompanyDocument, 'id'> = {
    companyId,
    originalName: file.originalname,
    storagePath: '',
    fileType: file.mimetype,
    fileSize: file.size,
    status: 'processing',
    uploadedBy: req.user.uid,
    uploadedAt: new Date(),
  };

  await db.collection('documents').doc(documentId).set({
    ...docData,
    processingStatus: 'queued',
    processingSteps: [],
  });

  // Return immediately — processing runs async
  res.status(201).json({
    success: true,
    data: { id: documentId, ...docData },
  });

  // Run async pipeline (non-blocking)
  processDocumentAsync(documentId, companyId, file, db).catch((err) => {
    logger.error('[data.controller] Async document processing failed', { documentId, error: err });
  });
}

// ── Async processing pipeline (v2: Genkit-based) ─────────────────────────────

async function processDocumentAsync(
  documentId: string,
  companyId: string,
  file: Express.Multer.File,
  db: admin.firestore.Firestore
): Promise<void> {
  let storagePath = ''; // set later if Storage upload succeeds

  const setStep = async (step: string): Promise<void> => {
    await db.collection('documents').doc(documentId).update({
      processingStatus: step,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.debug(`[data.controller] Document ${documentId} — step: ${step}`);
  };

  try {
    logger.info(`[data.controller] Processing document ${documentId}: ${file.originalname}`);
    await setStep('uploading');

    // ── Step 1: Quick classification before full ingestion ───────────────
    await setStep('classifying');

    let earlyClassification = 'unknown';
    let earlyConfidentiality = 'internal';
    let earlyTags: string[] = [];

    if (env.GOOGLE_AI_API_KEY) {
      try {
        // Extract a small text preview for fast classification
        const extracted = await extractText(file.path, file.mimetype);
        const preview = extracted.text.slice(0, 3000);

        const classification = await documentClassifyFlow({
          textPreview: preview,
          fileName: file.originalname,
          fileType: file.mimetype,
        });

        earlyClassification = classification.category;
        earlyConfidentiality = classification.confidentiality;
        earlyTags = classification.tags;

        await db.collection('documents').doc(documentId).update({
          classification: earlyClassification,
          confidentiality: earlyConfidentiality,
          tags: earlyTags,
          summary: classification.summary,
          department: classification.department ?? null,
          classificationConfidence: classification.confidence,
        });

        logger.info(
          `[data.controller] Pre-classified "${file.originalname}" as "${earlyClassification}" (${(classification.confidence * 100).toFixed(0)}%)`
        );
      } catch (err) {
        logger.warn('[data.controller] Early classification failed, continuing', { error: err });
      }
    }

    // ── Step 2: Run Genkit ingestDocumentFlow directly from local file ────
    await setStep('ingesting');

    const result = await ingestDocumentFlow({
      companyId,
      documentId,
      localPath: file.path,
      fileType: file.mimetype,
      fileName: file.originalname,
    });

    // ── Step 3: Upload to Firebase Storage (optional backup) ──────────────
    // Non-blocking — failure here does NOT mark the document as failed
    setImmediate(async () => {
      try {
        const bucket = getStorage().bucket();
        storagePath = `companies/${companyId}/documents/${documentId}/${file.originalname}`;
        if (fs.existsSync(file.path)) {
          await bucket.upload(file.path, {
            destination: storagePath,
            metadata: { contentType: file.mimetype },
          });
          await db.collection('documents').doc(documentId).update({ storagePath });
          logger.info(`[data.controller] Uploaded ${file.originalname} to Storage`);
        }
      } catch (err) {
        logger.warn('[data.controller] Storage upload failed (non-critical)', { error: err });
      }
    });

    logger.info(
      `[data.controller] Document ${documentId} ingested: ` +
        `${result.chunksCreated} chunks, ${result.embeddingsGenerated} embeddings, ` +
        `${result.entitiesExtracted} entities`
    );

    // The ingestDocumentFlow already updates Firestore status to 'completed'.
    // We add any pre-classification data that was determined before the flow ran.
    if (earlyClassification !== 'unknown' && result.classification === 'unknown') {
      await db.collection('documents').doc(documentId).update({
        classification: earlyClassification,
        confidentiality: earlyConfidentiality,
        tags: earlyTags,
      });
    }
  } catch (error) {
    logger.error(`[data.controller] Document processing failed for ${documentId}`, { error });
    await db.collection('documents').doc(documentId).update({
      status: 'failed',
      processingStatus: 'failed',
      error: error instanceof Error ? error.message : 'Processing failed',
      storagePath,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } finally {
    // Clean up local temp file
    try {
      fs.unlinkSync(file.path);
    } catch (_e) {
      // Ignore cleanup errors
    }
  }
}

// ── GET /api/data/documents ───────────────────────────────────────────────────

export async function getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = (req.query['companyId'] as string | undefined) ?? req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const snapshot = await db
    .collection('documents')
    .where('companyId', '==', companyId)
    .limit(100)
    .get();

  const documents = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aDate = (a as Record<string, unknown>)['uploadedAt'];
      const bDate = (b as Record<string, unknown>)['uploadedAt'];
      const aTime = aDate instanceof Date ? aDate.getTime() : (aDate as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const bTime = bDate instanceof Date ? bDate.getTime() : (bDate as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    });

  res.json({ success: true, data: documents });
}

// ── DELETE /api/data/documents/:id ───────────────────────────────────────────

export async function deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  if (!req.user) throw new AppError('Not authenticated', 401);

  const db = getFirestore();
  const docRef = db.collection('documents').doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) throw new AppError('Document not found', 404);

  const data = docSnap.data() as CompanyDocument;

  if (data.companyId !== req.user.companyId) {
    throw new AppError('Forbidden', 403);
  }

  // Delete from Firebase Storage
  if (data.storagePath) {
    try {
      const bucket = getStorage().bucket();
      await bucket.file(data.storagePath).delete();
    } catch (err) {
      logger.warn('[data.controller] Failed to delete file from storage', { error: err });
    }
  }

  // Delete vector chunks from Firestore
  try {
    await firestoreVectorStore.deleteByDocument(data.companyId, id);
  } catch (err) {
    logger.warn('[data.controller] Failed to delete vector chunks', { error: err });
  }

  // Delete Firestore document record
  await docRef.delete();

  res.json({ success: true, message: 'Document deleted' });
}

// ── GET /api/data/documents/:id/status ───────────────────────────────────────

export async function getDocumentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();
  const doc = await db.collection('documents').doc(id).get();
  if (!doc.exists) throw new AppError('Document not found', 404);

  const data = doc.data() as CompanyDocument & {
    processingStatus?: string;
    chunksCreated?: number;
    embeddingsGenerated?: number;
    classification?: string;
    confidentiality?: string;
  };

  res.json({
    success: true,
    data: {
      status: data.status,
      processingStatus: data.processingStatus ?? data.status,
      chunksCreated: data.chunksCreated,
      embeddingsGenerated: data.embeddingsGenerated,
      classification: data.classification,
      confidentiality: data.confidentiality,
    },
  });
}
