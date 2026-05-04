"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentClassifyFlow = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Input / Output schemas ───────────────────────────────────────────────────
const DocumentClassifyInputSchema = zod_1.z.object({
    textPreview: zod_1.z.string().describe('First ~3000 chars of the document text'),
    fileName: zod_1.z.string(),
    fileType: zod_1.z.string(),
});
const DocumentClassifyOutputSchema = zod_1.z.object({
    category: zod_1.z.string().describe('Document category, e.g. "contract", "invoice", "report", "hr_policy", "technical_spec"'),
    confidentiality: zod_1.z.enum(['public', 'internal', 'confidential', 'secret']),
    tags: zod_1.z.array(zod_1.z.string()).describe('Relevant keyword tags'),
    summary: zod_1.z.string().describe('One-sentence document summary'),
    department: zod_1.z.string().optional().describe('Owning department if detectable'),
    confidence: zod_1.z.number().min(0).max(1).describe('Classification confidence 0–1'),
});
// ── Flow definition ──────────────────────────────────────────────────────────
exports.documentClassifyFlow = genkit_config_1.ai.defineFlow({
    name: 'documentClassifyFlow',
    inputSchema: DocumentClassifyInputSchema,
    outputSchema: DocumentClassifyOutputSchema,
}, async (input) => {
    // Graceful degradation if Google AI is not configured
    if (!env_config_1.env.GOOGLE_AI_API_KEY) {
        logger_1.logger.warn('[documentClassifyFlow] GOOGLE_AI_API_KEY not set — returning default classification');
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
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt,
            config: { temperature: 0.1 },
        });
        // Strip potential markdown fences
        const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        return DocumentClassifyOutputSchema.parse({
            category: parsed['category'] ?? 'unknown',
            confidentiality: parsed['confidentiality'] ?? 'internal',
            tags: Array.isArray(parsed['tags']) ? parsed['tags'] : [],
            summary: parsed['summary'] ?? '',
            department: parsed['department'] ?? undefined,
            confidence: typeof parsed['confidence'] === 'number' ? parsed['confidence'] : 0.5,
        });
    }
    catch (error) {
        logger_1.logger.error('[documentClassifyFlow] Classification failed', { error });
        return {
            category: 'unknown',
            confidentiality: 'internal',
            tags: [],
            summary: 'Classification failed.',
            department: undefined,
            confidence: 0,
        };
    }
});
//# sourceMappingURL=documentClassifyFlow.js.map