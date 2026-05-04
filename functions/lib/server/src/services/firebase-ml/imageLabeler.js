"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageLabeler = exports.ImageLabeler = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
const imageLabelResponseSchema = zod_1.z.object({
    labels: zod_1.z.array(zod_1.z.object({
        label: zod_1.z.string(),
        confidence: zod_1.z.number().min(0).max(1),
        category: zod_1.z.string(),
    })),
});
// ── ImageLabeler ──────────────────────────────────────────────────────────────
class ImageLabeler {
    /**
     * Label the content of an image using Gemini Vision.
     *
     * @param imageBase64 Base64-encoded image data (no data-URI prefix)
     * @param mimeType    MIME type of the image (e.g. image/jpeg)
     * @returns Array of labels with confidence scores
     */
    async labelImage(imageBase64, mimeType = 'image/jpeg') {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[ImageLabeler] GOOGLE_AI_API_KEY not set — image labeling unavailable');
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
            const { text } = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH_LITE,
                prompt: [
                    { text: prompt },
                    { media: { url: `data:${mimeType};base64,${imageBase64}` } },
                ],
                config: { temperature: 0.1 },
            });
            const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = imageLabelResponseSchema.parse(JSON.parse(cleaned));
            return parsed.labels;
        }
        catch (err) {
            logger_1.logger.error('[ImageLabeler] labelImage failed', { error: err });
            return [];
        }
    }
}
exports.ImageLabeler = ImageLabeler;
exports.imageLabeler = new ImageLabeler();
//# sourceMappingURL=imageLabeler.js.map