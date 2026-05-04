"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrService = exports.OCRService = void 0;
const fs_1 = __importDefault(require("fs"));
const ocrExtractionFlow_1 = require("../../genkit/flows/ocrExtractionFlow");
const logger_1 = require("../../utils/logger");
const env_config_1 = require("../../config/env.config");
// ── OCRService ────────────────────────────────────────────────────────────────
class OCRService {
    /**
     * Returns true when the extracted text is too short to be reliable —
     * indicating the file is likely a scanned image and needs OCR.
     */
    needsOCR(extractedText) {
        return extractedText.trim().length < 100;
    }
    /**
     * Run OCR via Gemini Vision on a base64-encoded image.
     */
    async extractTextFromImageBase64(base64, mimeType) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[OCRService] GOOGLE_AI_API_KEY not set — OCR unavailable');
            return {
                extractedText: '',
                confidence: 0,
                detectedLanguage: 'unknown',
                blocks: [],
            };
        }
        return (0, ocrExtractionFlow_1.ocrExtractionFlow)({ imageBase64: base64, mimeType });
    }
    /**
     * Smart extraction: read the file buffer directly, then call Vision only if
     * the result looks like a scanned document (less than 100 chars of text).
     */
    async smartExtract(fileBuffer, fileType) {
        // If not an image/PDF type that may need OCR, return empty and let the
        // caller decide (documentProcessor handles .pdf, .docx etc.)
        const ocrTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];
        if (!ocrTypes.includes(fileType)) {
            logger_1.logger.debug('[OCRService] Not an image type, skipping OCR');
            return '';
        }
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[OCRService] GOOGLE_AI_API_KEY not set — smartExtract unavailable');
            return '';
        }
        const base64 = fileBuffer.toString('base64');
        const result = await this.extractTextFromImageBase64(base64, fileType);
        return result.extractedText;
    }
    /**
     * Read a file from disk, run smart extraction, return text.
     */
    async extractFromFilePath(filePath, mimeType) {
        try {
            const buffer = fs_1.default.readFileSync(filePath);
            return this.smartExtract(buffer, mimeType);
        }
        catch (err) {
            logger_1.logger.error('[OCRService] Failed to read file', { filePath, error: err });
            return '';
        }
    }
}
exports.OCRService = OCRService;
exports.ocrService = new OCRService();
//# sourceMappingURL=ocrService.js.map