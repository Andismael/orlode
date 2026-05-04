"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentClassifier = exports.DocumentClassifier = void 0;
const documentClassifyFlow_1 = require("../../genkit/flows/documentClassifyFlow");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── DocumentClassifier ────────────────────────────────────────────────────────
class DocumentClassifier {
    /**
     * Classify a document using the Gemini-powered documentClassifyFlow.
     *
     * @param text     Full or preview document text (first 3000 chars is sufficient)
     * @param fileName Original file name
     * @returns ClassificationResult with sensible defaults if AI is not available
     */
    async classify(text, fileName) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[DocumentClassifier] GOOGLE_AI_API_KEY not set — returning default classification');
            return {
                category: 'unknown',
                confidentiality: 'internal',
                tags: [],
                summary: 'Auto-classification unavailable.',
                department: undefined,
                confidence: 0,
            };
        }
        const fileType = this.inferFileType(fileName);
        try {
            const result = await (0, documentClassifyFlow_1.documentClassifyFlow)({
                textPreview: text.slice(0, 3000),
                fileName,
                fileType,
            });
            logger_1.logger.info(`[DocumentClassifier] Classified "${fileName}" as "${result.category}" (confidence: ${result.confidence})`);
            return result;
        }
        catch (err) {
            logger_1.logger.error('[DocumentClassifier] classify failed', { fileName, error: err });
            return {
                category: 'unknown',
                confidentiality: 'internal',
                tags: [],
                summary: 'Classification failed.',
                department: undefined,
                confidence: 0,
            };
        }
    }
    inferFileType(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
        const mimeMap = {
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            txt: 'text/plain',
            csv: 'text/csv',
            md: 'text/markdown',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
        };
        return mimeMap[ext] ?? 'application/octet-stream';
    }
}
exports.DocumentClassifier = DocumentClassifier;
exports.documentClassifier = new DocumentClassifier();
//# sourceMappingURL=documentClassifier.js.map