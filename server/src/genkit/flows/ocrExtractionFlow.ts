import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Input / Output schemas ───────────────────────────────────────────────────

const OCRExtractionInputSchema = z.object({
  imageBase64: z.string().describe('Base64-encoded image data (no data-URI prefix)'),
  mimeType: z
    .string()
    .describe('MIME type of the image, e.g. image/png, image/jpeg, application/pdf'),
});

const OCRExtractionOutputSchema = z.object({
  extractedText: z.string(),
  confidence: z.number().min(0).max(1),
  detectedLanguage: z.string().describe('BCP-47 language code, e.g. en, fr, ar'),
  blocks: z.array(
    z.object({
      text: z.string(),
      type: z.enum(['paragraph', 'heading', 'table', 'list', 'other']),
    })
  ),
});

export type OCRExtractionInput = z.infer<typeof OCRExtractionInputSchema>;
export type OCRExtractionOutput = z.infer<typeof OCRExtractionOutputSchema>;

// ── Flow definition ──────────────────────────────────────────────────────────

export const ocrExtractionFlow = ai.defineFlow(
  {
    name: 'ocrExtractionFlow',
    inputSchema: OCRExtractionInputSchema,
    outputSchema: OCRExtractionOutputSchema,
  },
  async (input): Promise<OCRExtractionOutput> => {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[ocrExtractionFlow] GOOGLE_AI_API_KEY not set — OCR unavailable');
      return {
        extractedText: '',
        confidence: 0,
        detectedLanguage: 'unknown',
        blocks: [],
      };
    }

    try {
      const { text } = await ai.generate({
        model: GEMINI_FLASH,
        prompt: [
          {
            text: `Extract all text from this document image. Preserve structure and formatting as faithfully as possible.

After extracting the text, respond with a JSON object in the following format:
{
  "extractedText": "the full extracted text with preserved line breaks",
  "confidence": 0.0 to 1.0,
  "detectedLanguage": "BCP-47 code such as en, fr, ar, es",
  "blocks": [
    { "text": "...", "type": "paragraph | heading | table | list | other" }
  ]
}

Return ONLY the JSON object.`,
          },
          {
            media: {
              url: `data:${input.mimeType};base64,${input.imageBase64}`,
            },
          },
        ],
        config: { temperature: 0.0 },
      });

      const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      return OCRExtractionOutputSchema.parse({
        extractedText: parsed['extractedText'] ?? '',
        confidence: typeof parsed['confidence'] === 'number' ? parsed['confidence'] : 0.8,
        detectedLanguage: parsed['detectedLanguage'] ?? 'unknown',
        blocks: Array.isArray(parsed['blocks']) ? parsed['blocks'] : [],
      });
    } catch (error) {
      logger.error('[ocrExtractionFlow] OCR failed', { error });
      return {
        extractedText: '',
        confidence: 0,
        detectedLanguage: 'unknown',
        blocks: [],
      };
    }
  }
);
