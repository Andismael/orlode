import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Schemas ──────────────────────────────────────────────────────────────────

const entitySchema = z.object({
  entities: z.array(
    z.object({
      type: z.enum(['person', 'organization', 'date', 'money', 'location', 'product']),
      value: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const financialEntitySchema = z.object({
  financialEntities: z.array(
    z.object({
      type: z.enum(['revenue', 'expense', 'profit', 'budget', 'investment', 'currency', 'percentage', 'other']),
      value: z.string(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      context: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export type ExtractedEntity = z.infer<typeof entitySchema>['entities'][number];
export type FinancialEntity = z.infer<typeof financialEntitySchema>['financialEntities'][number];

// ── EntityExtractor ──────────────────────────────────────────────────────────

export class EntityExtractor {
  /**
   * Extract general named entities from arbitrary text.
   */
  async extractEntities(text: string): Promise<ExtractedEntity[]> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[EntityExtractor] GOOGLE_AI_API_KEY not set — entity extraction unavailable');
      return [];
    }

    const prompt = `Extract named entities from the following text.

Return a JSON object:
{
  "entities": [
    { "type": "person|organization|date|money|location|product", "value": "...", "confidence": 0.0-1.0 }
  ]
}

Return ONLY the JSON object. No markdown.

Text:
"""${text.slice(0, 4000)}"""`;

    try {
      const { text: responseText } = await ai.generate({
        model: GEMINI_FLASH,
        prompt,
        config: { temperature: 0.0 },
      });

      const cleaned = responseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = entitySchema.parse(JSON.parse(cleaned));
      return parsed.entities;
    } catch (err) {
      logger.error('[EntityExtractor] extractEntities failed', { error: err });
      return [];
    }
  }

  /**
   * Extract financial-specific data points from text (amounts, currencies, percentages).
   */
  async extractFinancialData(text: string): Promise<FinancialEntity[]> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[EntityExtractor] GOOGLE_AI_API_KEY not set — financial extraction unavailable');
      return [];
    }

    const prompt = `Extract financial data points from the following text.

Return a JSON object:
{
  "financialEntities": [
    {
      "type": "revenue|expense|profit|budget|investment|currency|percentage|other",
      "value": "raw text value",
      "amount": numeric value if available,
      "currency": "currency code if applicable",
      "context": "brief context sentence",
      "confidence": 0.0-1.0
    }
  ]
}

Return ONLY the JSON object. No markdown.

Text:
"""${text.slice(0, 4000)}"""`;

    try {
      const { text: responseText } = await ai.generate({
        model: GEMINI_FLASH,
        prompt,
        config: { temperature: 0.0 },
      });

      const cleaned = responseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = financialEntitySchema.parse(JSON.parse(cleaned));
      return parsed.financialEntities;
    } catch (err) {
      logger.error('[EntityExtractor] extractFinancialData failed', { error: err });
      return [];
    }
  }
}

export const entityExtractor = new EntityExtractor();
