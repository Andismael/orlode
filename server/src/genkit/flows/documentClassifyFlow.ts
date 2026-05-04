import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Input / Output schemas ───────────────────────────────────────────────────

const DocumentClassifyInputSchema = z.object({
  textPreview: z.string().describe('First ~3000 chars of the document text'),
  fileName: z.string(),
  fileType: z.string(),
});

const DocumentClassifyOutputSchema = z.object({
  category: z.string().describe(
    'Document category, e.g. "contract", "invoice", "report", "hr_policy", "technical_spec"'
  ),
  confidentiality: z.enum(['public', 'internal', 'confidential', 'secret']),
  tags: z.array(z.string()).describe('Relevant keyword tags'),
  summary: z.string().describe('One-sentence document summary'),
  department: z.string().optional().describe('Owning department if detectable'),
  confidence: z.number().min(0).max(1).describe('Classification confidence 0–1'),
});

export type DocumentClassifyInput = z.infer<typeof DocumentClassifyInputSchema>;
export type DocumentClassifyOutput = z.infer<typeof DocumentClassifyOutputSchema>;

// ── Flow definition ──────────────────────────────────────────────────────────

export const documentClassifyFlow = ai.defineFlow(
  {
    name: 'documentClassifyFlow',
    inputSchema: DocumentClassifyInputSchema,
    outputSchema: DocumentClassifyOutputSchema,
  },
  async (input): Promise<DocumentClassifyOutput> => {
    // Graceful degradation if Google AI is not configured
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[documentClassifyFlow] GOOGLE_AI_API_KEY not set — returning default classification');
      return {
        category: 'unknown',
        confidentiality: 'internal',
        tags: [],
        summary: 'Auto-classification unavailable (Google AI not configured).',
        department: undefined,
        confidence: 0,
      };
    }

    const prompt = `You are an expert document classifier for a corporate knowledge management system.

Analyze the following document and classify it.

File name: ${input.fileName}
File type: ${input.fileType}
Document content preview:
"""
${input.textPreview.slice(0, 3000)}
"""

Respond with a valid JSON object matching this schema exactly:
{
  "category": "string (e.g. contract, invoice, report, hr_policy, technical_spec, meeting_notes, financial, legal, marketing, other)",
  "confidentiality": "public | internal | confidential | secret",
  "tags": ["array", "of", "relevant", "keywords"],
  "summary": "One sentence summary of what this document is about",
  "department": "department name or null if not detectable",
  "confidence": 0.0 to 1.0
}

Return ONLY the JSON object, no markdown, no explanation.`;

    try {
      const { text } = await ai.generate({
        model: GEMINI_FLASH,
        prompt,
        config: { temperature: 0.1 },
      });

      // Strip potential markdown fences
      const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      return DocumentClassifyOutputSchema.parse({
        category: parsed['category'] ?? 'unknown',
        confidentiality: parsed['confidentiality'] ?? 'internal',
        tags: Array.isArray(parsed['tags']) ? parsed['tags'] : [],
        summary: parsed['summary'] ?? '',
        department: parsed['department'] ?? undefined,
        confidence: typeof parsed['confidence'] === 'number' ? parsed['confidence'] : 0.5,
      });
    } catch (error) {
      logger.error('[documentClassifyFlow] Classification failed', { error });
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
);
