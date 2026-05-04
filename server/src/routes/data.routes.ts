import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  getDocumentStatus,
} from '../controllers/data.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { singleFileUpload } from '../middleware/upload.middleware';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware';
import { enforceDocumentLimit } from '../middleware/planEnforcement.middleware';

const router = Router();

// All data routes require auth
router.use(authMiddleware);

// GET /api/data/documents
router.get('/documents', asyncHandler(getDocuments));

// POST /api/data/documents (file upload) — with plan limit enforcement
router.post(
  '/documents',
  uploadRateLimiter,
  asyncHandler(enforceDocumentLimit),
  singleFileUpload,
  asyncHandler(uploadDocument)
);

// GET /api/data/documents/:id/status
router.get('/documents/:id/status', asyncHandler(getDocumentStatus));

// DELETE /api/data/documents/:id
router.delete('/documents/:id', asyncHandler(deleteDocument));

// POST /api/data/reclassify — reclassify all unclassified documents
router.post('/reclassify', asyncHandler(async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyId = (req as any).user?.companyId as string;
  if (!companyId) { res.status(400).json({ success: false, message: 'Company ID required' }); return; }

  const { getFirestore } = await import('../config/firebase.config');
  const db = getFirestore();
  const snap = await db.collection('documents').where('companyId', '==', companyId).get();

  const unclassified = snap.docs.filter(d => !d.data()['classification']);

  // Reclassify in background
  setImmediate(async () => {
    const { documentClassifyFlow } = await import('../genkit/flows/documentClassifyFlow');
    const { logger } = await import('../utils/logger');

    for (const doc of unclassified) {
      try {
        const data = doc.data();
        const preview = (data['extractedText'] as string ?? data['originalName'] as string ?? '').slice(0, 3000);
        const result = await documentClassifyFlow({
          textPreview: preview,
          fileName: data['originalName'] as string ?? '',
          fileType: data['fileType'] as string ?? '',
        });
        await doc.ref.update({
          classification: result.category,
          confidentiality: result.confidentiality,
          tags: result.tags,
          summary: result.summary,
          department: result.department ?? null,
          classificationConfidence: result.confidence,
        });
        logger.info(`[Reclassify] ${data['originalName']} → ${result.category}`);
      } catch (err) {
        logger.warn(`[Reclassify] Failed for ${doc.id}`, { error: (err as Error).message });
      }
    }
  });

  res.json({ success: true, data: { queued: unclassified.length } });
}));

export default router;
