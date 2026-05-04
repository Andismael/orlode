"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrExtractionFlow = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Input / Output schemas ───────────────────────────────────────────────────
const OCRExtractionInputSchema = zod_1.z.object({
    imageBase64: zod_1.z.string().describe('Base64-encoded image data (no data-URI prefix)'),
    mimeType: zod_1.z
        .string()
        .describe('MIME type of the image, e.g. image/png, image/jpeg, application/pdf'),
});
const OCRExtractionOutputSchema = zod_1.z.object({
    extractedText: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
    detectedLanguage: zod_1.z.string().describe('BCP-47 language code, e.g. en, fr, ar'),
    blocks: zod_1.z.array(zod_1.z.object({
        text: zod_1.z.string(),
        type: zod_1.z.enum(['paragraph', 'heading', 'table', 'list', 'other']),
    })),
});
// ── Flow definition ──────────────────────────────────────────────────────────
exports.ocrExtractionFlow = genkit_config_1.ai.defineFlow({
    name: 'ocrExtractionFlow',
    inputSchema: OCRExtractionInputSchema,
    outputSchema: OCRExtractionOutputSchema,
}, async (input) => {
    if (!env_config_1.env.GOOGLE_AI_API_KEY) {
        logger_1.logger.warn('[ocrExtractionFlow] GOOGLE_AI_API_KEY not set — OCR unavailable');
        return {
            extractedText: '',
            confidence: 0,
            detectedLanguage: 'unknown',
            blocks: [],
        };
    }
    try {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
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
        const parsed = JSON.parse(cleaned);
        return OCRExtractionOutputSchema.parse({
            extractedText: parsed['extractedText'] ?? '',
            confidence: typeof parsed['confidence'] === 'number' ? parsed['confidence'] : 0.8,
            detectedLanguage: parsed['detectedLanguage'] ?? 'unknown',
            blocks: Array.isArray(parsed['blocks']) ? parsed['blocks'] : [],
        });
    }
    catch (error) {
        logger_1.logger.error('[ocrExtractionFlow] OCR failed', { error });
        return {
            extractedText: '',
            confidence: 0,
            detectedLanguage: 'unknown',
            blocks: [],
        };
    }
});
//# sourceMappingURL=ocrExtractionFlow.js.map