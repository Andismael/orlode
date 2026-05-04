import fs from 'fs';
import { ocrExtractionFlow } from '../../genkit/flows/ocrExtractionFlow';
import { logger } from '../../utils/logger';
import { env } from '../../config/env.config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OCRResult {
  extractedText: string;
  confidence: number;
  detectedLanguage: string;
  blocks: Array<{
    text: string;
    type: 'paragraph' | 'heading' | 'table' | 'list' | 'other';
  }>;
}

// ── OCRService ────────────────────────────────────────────────────────────────

export class OCRService {
  /**
   * Returns true when the extracted text is too short to be reliable —
   * indicating the file is likely a scanned image and needs OCR.
   */
  needsOCR(extractedText: string): boolean {
    return extractedText.trim().length < 100;
  }

  /**
   * Run OCR via Gemini Vision on a base64-encoded image.
   */
  async extractTextFromImageBase64(base64: string, mimeType: string): Promise<OCRResult> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[OCRService] GOOGLE_AI_API_KEY not set — OCR unavailable');
      return {
        extractedText: '',
        confidence: 0,
        detectedLanguage: 'unknown',
        blocks: [],
      };
    }

    return ocrExtractionFlow({ imageBase64: base64, mimeType });
  }

  /**
   * Smart extraction: read the file buffer directly, then call Vision only if
   * the result looks like a scanned document (less than 100 chars of text).
   */
  async smartExtract(fileBuffer: Buffer, fileType: string): Promise<string> {
    // If not an image/PDF type that may need OCR, return empty and let the
    // caller decide (documentProcessor handles .pdf, .docx etc.)
    const ocrTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];

    if (!ocrTypes.includes(fileType)) {
      logger.debug('[OCRService] Not an image type, skipping OCR');
      return '';
    }

    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[OCRService] GOOGLE_AI_API_KEY not set — smartExtract unavailable');
      return '';
    }

    const base64 = fileBuffer.toString('base64');
    const result = await this.extractTextFromImageBase64(base64, fileType);
    return result.extractedText;
  }

  /**
   * Read a file from disk, run smart extraction, return text.
   */
  async extractFromFilePath(filePath: string, mimeType: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      return this.smartExtract(buffer, mimeType);
    } catch (err) {
      logger.error('[OCRService] Failed to read file', { filePath, error: err });
      return '';
    }
  }
}

export const ocrService = new OCRService();
