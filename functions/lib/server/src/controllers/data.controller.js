"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = uploadDocument;
exports.getDocuments = getDocuments;
exports.deleteDocument = deleteDocument;
exports.getDocumentStatus = getDocumentStatus;
const fs_1 = __importDefault(require("fs"));
const firebase_config_1 = require("../config/firebase.config");
const ingestDocumentFlow_1 = require("../genkit/flows/ingestDocumentFlow");
const documentClassifyFlow_1 = require("../genkit/flows/documentClassifyFlow");
const documentProcessor_1 = require("../services/rag/documentProcessor");
const firestoreVectorStore_1 = require("../services/rag/firestoreVectorStore");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
const helpers_1 = require("../utils/helpers");
const firestore_1 = require("firebase-admin/firestore");
const env_config_1 = require("../config/env.config");
// ── POST /api/data/documents ──────────────────────────────────────────────────
async function uploadDocument(req, res) {
    if (!req.file)
        throw new error_middleware_1.AppError('No file uploaded', 400);
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    // SECURITY: companyId is ALWAYS derived from the JWT — never from request body
    // (a malicious user could otherwise upload a document attributed to another tenant).
    const companyId = req.user.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { file } = req;
    const db = (0, firebase_config_1.getFirestore)();
    const documentId = (0, helpers_1.generateId)();
    // Create Firestore record immediately so the client can track progress
    const docData = {
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
        logger_1.logger.error('[data.controller] Async document processing failed', { documentId, error: err });
    });
}
// ── Async processing pipeline (v2: Genkit-based) ─────────────────────────────
async function processDocumentAsync(documentId, companyId, file, db) {
    let storagePath = ''; // set later if Storage upload succeeds
    const setStep = async (step) => {
        await db.collection('documents').doc(documentId).update({
            processingStatus: step,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        logger_1.logger.debug(`[data.controller] Document ${documentId} — step: ${step}`);
    };
    try {
        logger_1.logger.info(`[data.controller] Processing document ${documentId}: ${file.originalname}`);
        await setStep('uploading');
        // ── Step 1: Quick classification before full ingestion ───────────────
        await setStep('classifying');
        let earlyClassification = 'unknown';
        let earlyConfidentiality = 'internal';
        let earlyTags = [];
        if (env_config_1.env.GOOGLE_AI_API_KEY) {
            try {
                // Extract a small text preview for fast classification
                const extracted = await (0, documentProcessor_1.extractText)(file.path, file.mimetype);
                const preview = extracted.text.slice(0, 3000);
                const classification = await (0, documentClassifyFlow_1.documentClassifyFlow)({
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
                logger_1.logger.info(`[data.controller] Pre-classified "${file.originalname}" as "${earlyClassification}" (${(classification.confidence * 100).toFixed(0)}%)`);
            }
            catch (err) {
                logger_1.logger.warn('[data.controller] Early classification failed, continuing', { error: err });
            }
        }
        // ── Step 2: Run Genkit ingestDocumentFlow directly from local file ────
        await setStep('ingesting');
        const result = await (0, ingestDocumentFlow_1.ingestDocumentFlow)({
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
                const bucket = (0, firebase_config_1.getStorage)().bucket();
                storagePath = `companies/${companyId}/documents/${documentId}/${file.originalname}`;
                if (fs_1.default.existsSync(file.path)) {
                    await bucket.upload(file.path, {
                        destination: storagePath,
                        metadata: { contentType: file.mimetype },
                    });
                    await db.collection('documents').doc(documentId).update({ storagePath });
                    logger_1.logger.info(`[data.controller] Uploaded ${file.originalname} to Storage`);
                }
            }
            catch (err) {
                logger_1.logger.warn('[data.controller] Storage upload failed (non-critical)', { error: err });
            }
        });
        logger_1.logger.info(`[data.controller] Document ${documentId} ingested: ` +
            `${result.chunksCreated} chunks, ${result.embeddingsGenerated} embeddings, ` +
            `${result.entitiesExtracted} entities`);
        // The ingestDocumentFlow already updates Firestore status to 'completed'.
        // We add any pre-classification data that was determined before the flow ran.
        if (earlyClassification !== 'unknown' && result.classification === 'unknown') {
            await db.collection('documents').doc(documentId).update({
                classification: earlyClassification,
                confidentiality: earlyConfidentiality,
                tags: earlyTags,
            });
        }
    }
    catch (error) {
        logger_1.logger.error(`[data.controller] Document processing failed for ${documentId}`, { error });
        await db.collection('documents').doc(documentId).update({
            status: 'failed',
            processingStatus: 'failed',
            error: error instanceof Error ? error.message : 'Processing failed',
            storagePath,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    finally {
        // Clean up local temp file
        try {
            fs_1.default.unlinkSync(file.path);
        }
        catch (_e) {
            // Ignore cleanup errors
        }
    }
}
// ── GET /api/data/documents ───────────────────────────────────────────────────
async function getDocuments(req, res) {
    // SECURITY: companyId from JWT only — never trust the query param.
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snapshot = await db
        .collection('documents')
        .where('companyId', '==', companyId)
        .limit(100)
        .get();
    const documents = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
        const aDate = a['uploadedAt'];
        const bDate = b['uploadedAt'];
        const aTime = aDate instanceof Date ? aDate.getTime() : aDate?.toDate?.()?.getTime() ?? 0;
        const bTime = bDate instanceof Date ? bDate.getTime() : bDate?.toDate?.()?.getTime() ?? 0;
        return bTime - aTime;
    });
    res.json({ success: true, data: documents });
}
// ── DELETE /api/data/documents/:id ───────────────────────────────────────────
async function deleteDocument(req, res) {
    const { id } = req.params;
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const docRef = db.collection('documents').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists)
        throw new error_middleware_1.AppError('Document not found', 404);
    const data = docSnap.data();
    if (data.companyId !== req.user.companyId) {
        throw new error_middleware_1.AppError('Forbidden', 403);
    }
    // Delete from Firebase Storage
    if (data.storagePath) {
        try {
            const bucket = (0, firebase_config_1.getStorage)().bucket();
            await bucket.file(data.storagePath).delete();
        }
        catch (err) {
            logger_1.logger.warn('[data.controller] Failed to delete file from storage', { error: err });
        }
    }
    // Delete vector chunks from Firestore
    try {
        await firestoreVectorStore_1.firestoreVectorStore.deleteByDocument(data.companyId, id);
    }
    catch (err) {
        logger_1.logger.warn('[data.controller] Failed to delete vector chunks', { error: err });
    }
    // Delete Firestore document record
    await docRef.delete();
    res.json({ success: true, message: 'Document deleted' });
}
// ── GET /api/data/documents/:id/status ───────────────────────────────────────
async function getDocumentStatus(req, res) {
    const { id } = req.params;
    if (!req.user?.companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('documents').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Document not found', 404);
    const data = doc.data();
    // SECURITY: cross-tenant guard — refuse if doc belongs to another company
    if (data.companyId !== req.user.companyId) {
        throw new error_middleware_1.AppError('Document not found', 404);
    }
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
//# sourceMappingURL=data.controller.js.map