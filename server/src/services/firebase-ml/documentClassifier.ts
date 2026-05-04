import { documentClassifyFlow } from '../../genkit/flows/documentClassifyFlow';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  category: string;
  confidentiality: 'public' | 'internal' | 'confidential' | 'secret';
  tags: string[];
  summary: string;
  department?: string;
  confidence: number;
}

// ── DocumentClassifier ────────────────────────────────────────────────────────

export class DocumentClassifier {
  /**
   * Classify a document using the Gemini-powered documentClassifyFlow.
   *
   * @param text     Full or preview document text (first 3000 chars is sufficient)
   * @param fileName Original file name
   * @returns ClassificationResult with sensible defaults if AI is not available
   */
  async classify(text: string, fileName: string): Promise<ClassificationResult> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[DocumentClassifier] GOOGLE_AI_API_KEY not set — returning default classification');
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
      const result = await documentClassifyFlow({
        textPreview: text.slice(0, 3000),
        fileName,
        fileType,
      });

      logger.info(`[DocumentClassifier] Classified "${fileName}" as "${result.category}" (confidence: ${result.confidence})`);
      return result;
    } catch (err) {
      logger.error('[DocumentClassifier] classify failed', { fileName, error: err });
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

  private inferFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
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

export const documentClassifier = new DocumentClassifier();
