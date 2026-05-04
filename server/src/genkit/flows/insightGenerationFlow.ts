import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { ragRetrievalFlow } from './ragRetrievalFlow';
import { chat } from '../../services/ai/claudeService';
import { logger } from '../../utils/logger';

// ── Input / Output schemas ───────────────────────────────────────────────────

const InsightGenerationInputSchema = z.object({
  companyId: z.string(),
  timeRange: z.object({
    from: z.string().describe('ISO date string'),
    to: z.string().describe('ISO date string'),
  }),
  focusArea: z.string().optional().describe('Optional area to focus insights on'),
});

const InsightSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  supportingData: z.array(z.string()),
});

const InsightGenerationOutputSchema = z.object({
  insights: z.array(InsightSchema),
});

export type InsightGenerationInput = z.infer<typeof InsightGenerationInputSchema>;
export type InsightGenerationOutput = z.infer<typeof InsightGenerationOutputSchema>;

// ── Flow definition ──────────────────────────────────────────────────────────

export const insightGenerationFlow = ai.defineFlow(
  {
    name: 'insightGenerationFlow',
    inputSchema: InsightGenerationInputSchema,
    outputSchema: InsightGenerationOutputSchema,
  },
  async (input): Promise<InsightGenerationOutput> => {
    const { companyId, timeRange, focusArea } = input;
    const db = getFirestore();

    // ── Step 1: Retrieve recent documents ─────────────────────────────────
    let documentSummaries: string[] = [];
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
        const data = doc.data() as Record<string, unknown>;
        return `- ${data['originalName']} (${data['classification'] ?? 'unknown'}, uploaded ${String(data['uploadedAt'])})`;
      });
    } catch (err) {
      logger.warn('[insightGenerationFlow] Failed to retrieve documents', { error: err });
    }

    // ── Step 2: Retrieve recent meeting summaries ──────────────────────────
    let meetingSummaries: string[] = [];
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
          const data = doc.data() as Record<string, unknown>;
          const analysis = data['analysis'] as Record<string, unknown> | undefined;
          if (!analysis) return null;
          return `Meeting: ${analysis['summary'] ?? 'No summary'}`;
        })
        .filter((s): s is string => s !== null);
    } catch (err) {
      logger.warn('[insightGenerationFlow] Failed to retrieve meetings', { error: err });
    }

    // ── Step 3: Use RAG to find relevant trends ────────────────────────────
    const ragQuery = focusArea
      ? `Key trends and insights related to ${focusArea}`
      : 'Key business trends, risks, and opportunities';

    let ragContext = '';
    try {
      const ragResult = await ragRetrievalFlow({
        companyId,
        query: ragQuery,
        topK: 8,
      });

      ragContext = ragResult.chunks
        .map((c) => `[${c.documentName}]: ${c.content.slice(0, 400)}`)
        .join('\n\n');
    } catch (err) {
      logger.warn('[insightGenerationFlow] RAG retrieval failed', { error: err });
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
      const claudeResponse = await chat({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 3000,
        temperature: 0.4,
      });

      const cleaned = claudeResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as { insights?: Array<Record<string, unknown>> };

      const insights = (parsed.insights ?? []).map((item) => ({
        title: (item['title'] as string | undefined) ?? '',
        description: (item['description'] as string | undefined) ?? '',
        priority: (['low', 'medium', 'high', 'critical'].includes(item['priority'] as string)
          ? item['priority']
          : 'medium') as 'low' | 'medium' | 'high' | 'critical',
        supportingData: Array.isArray(item['supportingData'])
          ? (item['supportingData'] as string[])
          : [],
      }));

      logger.info(`[insightGenerationFlow] Generated ${insights.length} insights`);
      return { insights };
    } catch (err) {
      logger.error('[insightGenerationFlow] Claude insight generation failed', { error: err });
      return { insights: [] };
    }
  }
);
