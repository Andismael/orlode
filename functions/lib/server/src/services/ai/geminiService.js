"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiService = exports.GeminiService = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── GeminiService ────────────────────────────────────────────────────────────
class GeminiService {
    isEnabled() {
        return Boolean(env_config_1.env.GOOGLE_AI_API_KEY);
    }
    warnDisabled(method) {
        logger_1.logger.warn(`[GeminiService.${method}] GOOGLE_AI_API_KEY not set — Gemini unavailable`);
    }
    /**
     * Generate text from a plain-string prompt.
     */
    async generate(prompt, options = {}) {
        if (!this.isEnabled()) {
            this.warnDisabled('generate');
            return '';
        }
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt,
            config: {
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxOutputTokens ?? 2048,
            },
        });
        return text;
    }
    /**
     * Generate structured output validated against a Zod schema.
     */
    async generateWithSchema(prompt, schema) {
        if (!this.isEnabled()) {
            this.warnDisabled('generateWithSchema');
            return schema.parse({});
        }
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt,
            config: { temperature: 0.1 },
        });
        const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return schema.parse(JSON.parse(cleaned));
    }
    /**
     * Generate a dense text embedding vector.
     */
    async embedText(text) {
        if (!this.isEnabled()) {
            this.warnDisabled('embedText');
            return [];
        }
        const response = await genkit_config_1.ai.embed({
            embedder: genkit_config_1.TEXT_EMBEDDING_MODEL,
            content: text,
        });
        return response[0]?.embedding ?? response;
    }
    /**
     * Analyze an image and return a descriptive text response.
     */
    async analyzeImage(imageBase64, prompt) {
        if (!this.isEnabled()) {
            this.warnDisabled('analyzeImage');
            return '';
        }
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: [
                { text: prompt },
                { media: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
            config: { temperature: 0.1 },
        });
        return text;
    }
    /**
     * Detect the language of a text snippet (returns BCP-47 code).
     */
    async detectLanguage(text) {
        if (!this.isEnabled()) {
            this.warnDisabled('detectLanguage');
            return 'unknown';
        }
        const preview = text.slice(0, 500);
        // Ultra low-cost — simple task
        const { text: result } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH_LITE,
            prompt: `Detect the language of the following text. Respond with only the BCP-47 language code (e.g. en, fr, ar, es, de). No explanation.\n\nText:\n"""${preview}"""`,
            config: { temperature: 0.0 },
        });
        return result.trim().toLowerCase().split(/\s/)[0] ?? 'unknown';
    }
    /**
     * Translate text to a target language.
     */
    async translate(text, targetLang) {
        if (!this.isEnabled()) {
            this.warnDisabled('translate');
            return text;
        }
        return this.generate(`Translate the following text to ${targetLang}. Return only the translated text, no explanation.\n\n"""${text}"""`, { temperature: 0.1 });
    }
    /**
     * Extract named entities from text.
     */
    async extractEntities(text) {
        if (!this.isEnabled()) {
            this.warnDisabled('extractEntities');
            return [];
        }
        const entitySchema = zod_1.z.object({
            entities: zod_1.z.array(zod_1.z.object({
                type: zod_1.z.enum(['person', 'organization', 'date', 'money', 'location', 'product']),
                value: zod_1.z.string(),
                confidence: zod_1.z.number().min(0).max(1),
            })),
        });
        const prompt = `Extract named entities from the following text. Respond with a JSON object matching:
{ "entities": [ { "type": "person|organization|date|money|location|product", "value": "...", "confidence": 0.0-1.0 } ] }
Return ONLY the JSON object.

Text:
"""${text.slice(0, 4000)}"""`;
        try {
            const result = await this.generateWithSchema(prompt, entitySchema);
            return result.entities;
        }
        catch {
            return [];
        }
    }
    /**
     * Classify a document given its text content and file name.
     */
    async classifyDocument(text, fileName) {
        if (!this.isEnabled()) {
            this.warnDisabled('classifyDocument');
            return {
                category: 'unknown',
                confidentiality: 'internal',
                tags: [],
                summary: 'Classification unavailable.',
                confidence: 0,
            };
        }
        const classificationSchema = zod_1.z.object({
            category: zod_1.z.string(),
            confidentiality: zod_1.z.enum(['public', 'internal', 'confidential', 'secret']),
            tags: zod_1.z.array(zod_1.z.string()),
            summary: zod_1.z.string(),
            department: zod_1.z.string().optional(),
            confidence: zod_1.z.number(),
        });
        const prompt = `Classify this document:
File: ${fileName}
Content preview:
"""${text.slice(0, 2000)}"""

Respond with JSON:
{ "category": "...", "confidentiality": "public|internal|confidential|secret", "tags": [], "summary": "...", "department": "...", "confidence": 0.0-1.0 }`;
        try {
            return await this.generateWithSchema(prompt, classificationSchema);
        }
        catch {
            return {
                category: 'unknown',
                confidentiality: 'internal',
                tags: [],
                summary: 'Classification failed.',
                confidence: 0,
            };
        }
    }
}
exports.GeminiService = GeminiService;
exports.geminiService = new GeminiService();
//# sourceMappingURL=geminiService.js.map