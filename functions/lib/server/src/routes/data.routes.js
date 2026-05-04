"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const data_controller_1 = require("../controllers/data.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const planEnforcement_middleware_1 = require("../middleware/planEnforcement.middleware");
const router = (0, express_1.Router)();
// All data routes require auth
router.use(auth_middleware_1.authMiddleware);
// GET /api/data/documents
router.get('/documents', (0, asyncHandler_1.asyncHandler)(data_controller_1.getDocuments));
// POST /api/data/documents (file upload) — with plan limit enforcement
router.post('/documents', rateLimit_middleware_1.uploadRateLimiter, (0, asyncHandler_1.asyncHandler)(planEnforcement_middleware_1.enforceDocumentLimit), upload_middleware_1.singleFileUpload, (0, asyncHandler_1.asyncHandler)(data_controller_1.uploadDocument));
// GET /api/data/documents/:id/status
router.get('/documents/:id/status', (0, asyncHandler_1.asyncHandler)(data_controller_1.getDocumentStatus));
// DELETE /api/data/documents/:id
router.delete('/documents/:id', (0, asyncHandler_1.asyncHandler)(data_controller_1.deleteDocument));
// POST /api/data/reclassify — reclassify all unclassified documents
router.post('/reclassify', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required' });
        return;
    }
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const db = getFirestore();
    const snap = await db.collection('documents').where('companyId', '==', companyId).get();
    const unclassified = snap.docs.filter(d => !d.data()['classification']);
    // Reclassify in background
    setImmediate(async () => {
        const { documentClassifyFlow } = await Promise.resolve().then(() => __importStar(require('../genkit/flows/documentClassifyFlow')));
        const { logger } = await Promise.resolve().then(() => __importStar(require('../utils/logger')));
        for (const doc of unclassified) {
            try {
                const data = doc.data();
                const preview = (data['extractedText'] ?? data['originalName'] ?? '').slice(0, 3000);
                const result = await documentClassifyFlow({
                    textPreview: preview,
                    fileName: data['originalName'] ?? '',
                    fileType: data['fileType'] ?? '',
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
            }
            catch (err) {
                logger.warn(`[Reclassify] Failed for ${doc.id}`, { error: err.message });
            }
        }
    });
    res.json({ success: true, data: { queued: unclassified.length } });
}));
exports.default = router;
//# sourceMappingURL=data.routes.js.map