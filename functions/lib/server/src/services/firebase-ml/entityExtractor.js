"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityExtractor = exports.EntityExtractor = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Schemas ──────────────────────────────────────────────────────────────────
const entitySchema = zod_1.z.object({
    entities: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['person', 'organization', 'date', 'money', 'location', 'product']),
        value: zod_1.z.string(),
        confidence: zod_1.z.number().min(0).max(1),
    })),
});
const financialEntitySchema = zod_1.z.object({
    financialEntities: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['revenue', 'expense', 'profit', 'budget', 'investment', 'currency', 'percentage', 'other']),
        value: zod_1.z.string(),
        amount: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        context: zod_1.z.string().optional(),
        confidence: zod_1.z.number().min(0).max(1),
    })),
});
// ── EntityExtractor ──────────────────────────────────────────────────────────
class EntityExtractor {
    /**
     * Extract general named entities from arbitrary text.
     */
    async extractEntities(text) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[EntityExtractor] GOOGLE_AI_API_KEY not set — entity extraction unavailable');
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
            const { text: responseText } = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt,
                config: { temperature: 0.0 },
            });
            const cleaned = responseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = entitySchema.parse(JSON.parse(cleaned));
            return parsed.entities;
        }
        catch (err) {
            logger_1.logger.error('[EntityExtractor] extractEntities failed', { error: err });
            return [];
        }
    }
    /**
     * Extract financial-specific data points from text (amounts, currencies, percentages).
     */
    async extractFinancialData(text) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[EntityExtractor] GOOGLE_AI_API_KEY not set — financial extraction unavailable');
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
            const { text: responseText } = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt,
                config: { temperature: 0.0 },
            });
            const cleaned = responseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = financialEntitySchema.parse(JSON.parse(cleaned));
            return parsed.financialEntities;
        }
        catch (err) {
            logger_1.logger.error('[EntityExtractor] extractFinancialData failed', { error: err });
            return [];
        }
    }
}
exports.EntityExtractor = EntityExtractor;
exports.entityExtractor = new EntityExtractor();
//# sourceMappingURL=entityExtractor.js.map