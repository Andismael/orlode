"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightGenerationFlow = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const ragRetrievalFlow_1 = require("./ragRetrievalFlow");
const claudeService_1 = require("../../services/ai/claudeService");
const logger_1 = require("../../utils/logger");
// ── Input / Output schemas ───────────────────────────────────────────────────
const InsightGenerationInputSchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    timeRange: zod_1.z.object({
        from: zod_1.z.string().describe('ISO date string'),
        to: zod_1.z.string().describe('ISO date string'),
    }),
    focusArea: zod_1.z.string().optional().describe('Optional area to focus insights on'),
});
const InsightSchema = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    supportingData: zod_1.z.array(zod_1.z.string()),
});
const InsightGenerationOutputSchema = zod_1.z.object({
    insights: zod_1.z.array(InsightSchema),
});
// ── Flow definition ──────────────────────────────────────────────────────────
exports.insightGenerationFlow = genkit_config_1.ai.defineFlow({
    name: 'insightGenerationFlow',
    inputSchema: InsightGenerationInputSchema,
    outputSchema: InsightGenerationOutputSchema,
}, async (input) => {
    const { companyId, timeRange, focusArea } = input;
    const db = (0, firebase_config_1.getFirestore)();
    // ── Step 1: Retrieve recent documents ─────────────────────────────────
    let documentSummaries = [];
    try {
        const from = new Date(timeRange.from);
        const to = new Date(timeRange.to);
        const docsSnapshot = await db
            .collection('documents')
            .where('companyId', '==', companyId)
            .where('uploadedAt', '>=', from)
            .where('uploadedAt', '<=', to)
            .orderBy('uploadedAt', 'desc')
            .limit(20)
            .get();
        documentSummaries = docsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return `- ${data['originalName']} (${data['classification'] ?? 'unknown'}, uploaded ${String(data['uploadedAt'])})`;
        });
    }
    catch (err) {
        logger_1.logger.warn('[insightGenerationFlow] Failed to retrieve documents', { error: err });
    }
    // ── Step 2: Retrieve recent meeting summaries ──────────────────────────
    let meetingSummaries = [];
    try {
        const from = new Date(timeRange.from);
        const to = new Date(timeRange.to);
        const meetingsSnapshot = await db
            .collection('companies')
            .doc(companyId)
            .collection('meetings')
            .where('date', '>=', from)
            .where('date', '<=', to)
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        meetingSummaries = meetingsSnapshot.docs
            .map((doc) => {
            const data = doc.data();
            const analysis = data['analysis'];
            if (!analysis)
                return null;
            return `Meeting: ${analysis['summary'] ?? 'No summary'}`;
        })
            .filter((s) => s !== null);
    }
    catch (err) {
        logger_1.logger.warn('[insightGenerationFlow] Failed to retrieve meetings', { error: err });
    }
    // ── Step 3: Use RAG to find relevant trends ────────────────────────────
    const ragQuery = focusArea
        ? `Key trends and insights related to ${focusArea}`
        : 'Key business trends, risks, and opportunities';
    let ragContext = '';
    try {
        const ragResult = await (0, ragRetrievalFlow_1.ragRetrievalFlow)({
            companyId,
            query: ragQuery,
            topK: 8,
        });
        ragContext = ragResult.chunks
            .map((c) => `[${c.documentName}]: ${c.content.slice(0, 400)}`)
            .join('\n\n');
    }
    catch (err) {
        logger_1.logger.warn('[insightGenerationFlow] RAG retrieval failed', { error: err });
    }
    // ── Step 4: Generate insights with Claude ─────────────────────────────
    const focusLine = focusArea ? `Focus area: ${focusArea}\n` : '';
    const docsSection = documentSummaries.length > 0
        ? `Recent documents:\n${documentSummaries.join('\n')}`
        : 'No recent documents.';
    const meetingsSection = meetingSummaries.length > 0
        ? `Recent meeting summaries:\n${meetingSummaries.join('\n')}`
        : 'No recent meetings.';
    const ragSection = ragContext
        ? `Relevant knowledge base excerpts:\n${ragContext}`
        : '';
    const systemPrompt = `You are an expert business intelligence analyst. Generate actionable insights from corporate data.`;
    const userPrompt = `${focusLine}Time range: ${timeRange.from} to ${timeRange.to}

${docsSection}

${meetingsSection}

${ragSection}

Based on all available data, identify key business insights, trends, risks, and opportunities.

Return a JSON object:
{
  "insights": [
    {
      "title": "Short title",
      "description": "2-3 sentence description with specific observations",
      "priority": "low|medium|high|critical",
      "supportingData": ["evidence item 1", "evidence item 2"]
    }
  ]
}

Generate 3–7 high-quality insights. Return ONLY JSON.`;
    try {
        const claudeResponse = await (0, claudeService_1.chat)({
            systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            maxTokens: 3000,
            temperature: 0.4,
        });
        const cleaned = claudeResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        const insights = (parsed.insights ?? []).map((item) => ({
            title: item['title'] ?? '',
            description: item['description'] ?? '',
            priority: (['low', 'medium', 'high', 'critical'].includes(item['priority'])
                ? item['priority']
                : 'medium'),
            supportingData: Array.isArray(item['supportingData'])
                ? item['supportingData']
                : [],
        }));
        logger_1.logger.info(`[insightGenerationFlow] Generated ${insights.length} insights`);
        return { insights };
    }
    catch (err) {
        logger_1.logger.error('[insightGenerationFlow] Claude insight generation failed', { error: err });
        return { insights: [] };
    }
});
//# sourceMappingURL=insightGenerationFlow.js.map