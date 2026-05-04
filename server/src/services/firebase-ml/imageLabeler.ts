import { z } from 'zod';
import { ai, GEMINI_FLASH_LITE } from '../../config/genkit.config';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImageLabel {
  label: string;
  confidence: number;
  category: string;
}

const imageLabelResponseSchema = z.object({
  labels: z.array(
    z.object({
      label: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.string(),
    })
  ),
});

// ── ImageLabeler ──────────────────────────────────────────────────────────────

export class ImageLabeler {
  /**
   * Label the content of an image using Gemini Vision.
   *
   * @param imageBase64 Base64-encoded image data (no data-URI prefix)
   * @param mimeType    MIME type of the image (e.g. image/jpeg)
   * @returns Array of labels with confidence scores
   */
  async labelImage(imageBase64: string, mimeType = 'image/jpeg'): Promise<ImageLabel[]> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[ImageLabeler] GOOGLE_AI_API_KEY not set — image labeling unavailable');
      return [];
    }

    const prompt = `Describe and label this image for a corporate document management system.

Return a JSON object:
{
  "labels": [
    {
      "label": "short descriptive label",
      "confidence": 0.0-1.0,
      "category": "chart|diagram|photo|screenshot|logo|signature|table|text|other"
    }
  ]
}

Return up to 10 labels sorted by confidence (highest first). Return ONLY the JSON object.`;

    try {
      const { text } = await ai.generate({
        model: GEMINI_FLASH_LITE,
        prompt: [
          { text: prompt },
          { media: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
        config: { temperature: 0.1 },
      });

      const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = imageLabelResponseSchema.parse(JSON.parse(cleaned));
      return parsed.labels;
    } catch (err) {
      logger.error('[ImageLabeler] labelImage failed', { error: err });
      return [];
    }
  }
}

export const imageLabeler = new ImageLabeler();
