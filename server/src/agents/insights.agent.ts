/**
 * Insights Agent — Gemini Pro
 *
 * Pattern: proactive loop
 * Responsibility: 24/7 monitoring of company data. Detects trends, anomalies,
 * and generates actionable recommendations. Can be triggered on-demand or
 * run on a schedule (cron). Persists insights to Firestore dashboard.
 */
import { z } from 'zod';
import { ai, GEMINI_PRO } from '../config/genkit.config';
import {
  getDocumentsTool,
  getConversationsTool,
  getMeetingsTool,
  getEmployeesTool,
  saveInsightTool,
} from './tools/firestoreTools';
import {
  sheetsReadTool,
  docsCreateTool,
  slidesCreateTool,
  driveSearchTool,
} from './tools/mcp/googleWorkspace';
import { mcpAvailability } from '../config/mcp.config';
import { logger } from '../utils/logger';

const INPUT = z.object({
  companyId: z.string(),
  mode:      z.enum(['full', 'quick', 'documents', 'meetings', 'conversations'])
             .optional().default('full'),
  maxInsights: z.number().optional().default(5),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  insightsGenerated: z.number(),
  insights: z.array(z.object({
    type:     z.enum(['trend', 'anomaly', 'recommendation', 'alert']),
    title:    z.string(),
    body:     z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  })),
  summary: z.string(),
});

export type InsightsInput  = z.infer<typeof INPUT>;
export type InsightsOutput = z.infer<typeof OUTPUT>;

// ── The flow (loop pattern) ───────────────────────────────────────────────────
export const insightsAgentFlow = ai.defineFlow(
  { name: 'insightsAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ companyId, mode, maxInsights, history }): Promise<InsightsOutput> => {
    logger.info(`[InsightsAgent] Starting ${mode} analysis for company ${companyId} (history=${history?.length ?? 0})`);

    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    const systemPrompt = `Tu es un analyste BI proactif pour une plateforme IA d'entreprise.
Ton rôle : analyser les données de l'entreprise et générer des insights actionnables.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour les fenêtres temporelles ("cette semaine", "ce mois"), calcule à partir de cette ancre — ne fabrique jamais de dates passées.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages précédents. Quand l'utilisateur dit "cet insight", "cette anomalie", "ça", référence-toi à l'élément le plus récent. Ne repars PAS à zéro si le contexte est clair.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS prétendre avoir fait une action sans appel d'outil réussi.
INTERDIT :
- Inventer des chiffres / KPI / tendances sans appel tool
- Affirmer qu'une corrélation existe sans données
- Pretendre avoir détecté une anomalie sans calcul
RÈGLE : APPELLE le tool. Si succès → confirme avec les vrais champs. Si échec → dis la vraie raison. L'utilisateur préfère "je n'ai pas pu" honnête à une fausse confirmation.

Use the available tools to gather data, then generate insights of these types:
- trend: Positive or notable patterns you observe
- anomaly: Unusual patterns that need attention
- recommendation: Specific action the company should take
- alert: Urgent issues requiring immediate action

Be specific, data-driven, and actionable. Generate at most ${maxInsights} insights.
Always save insights using the saveInsight tool.
After saving all insights, provide a brief executive summary.`;

    // Determine which tools to make available based on mode
    // Base tools (always available via Firestore)
    const baseFull  = [getDocumentsTool, getConversationsTool, getMeetingsTool, getEmployeesTool, saveInsightTool];
    const baseQuick = [getDocumentsTool, getConversationsTool, saveInsightTool];

    // MCP tools (added when Google Workspace MCP is available)
    const mcpTools = mcpAvailability.googleWorkspace
      ? [sheetsReadTool, docsCreateTool, slidesCreateTool, driveSearchTool]
      : [];

    const allTools = [...baseFull, ...mcpTools];
    const toolsByMode: Record<string, typeof allTools> = {
      full:          allTools,
      quick:         [...baseQuick, ...mcpTools],
      documents:     [getDocumentsTool, saveInsightTool, ...(mcpAvailability.googleWorkspace ? [driveSearchTool] : [])],
      meetings:      [getMeetingsTool, getEmployeesTool, saveInsightTool],
      conversations: [getConversationsTool, saveInsightTool],
    };
    const tools = toolsByMode[mode ?? 'full'] ?? allTools;

    const initialPrompt = `Analyze all available data for company ${companyId} and generate insights.
Start by gathering data with the available tools, then analyze patterns, and save your insights.
Focus on: document indexing health, conversation patterns, meeting productivity, and team engagement.`;

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: initialPrompt }] });

    // ── Agentic loop: keep running until agent stops calling tools ────────
    let response = await ai.generate({
      model:  GEMINI_PRO,
      system: systemPrompt,
      messages,
      tools,
      config: { temperature: 0.3 },
    });

    let loopCount = 0;
    const MAX_LOOPS = 10;

    // Build a tool executor map (name → async function)
    const toolExecutors = new Map<string, (input: unknown) => Promise<unknown>>([
      ['getDocuments',     (i) => getDocumentsTool(i as Parameters<typeof getDocumentsTool>[0])],
      ['getConversations', (i) => getConversationsTool(i as Parameters<typeof getConversationsTool>[0])],
      ['getMeetings',      (i) => getMeetingsTool(i as Parameters<typeof getMeetingsTool>[0])],
      ['getEmployees',     (i) => getEmployeesTool(i as Parameters<typeof getEmployeesTool>[0])],
      ['saveInsight',      (i) => saveInsightTool(i as Parameters<typeof saveInsightTool>[0])],
      // MCP tools (graceful: won't be called if not in activeTools)
      ['sheets_read',    (i) => sheetsReadTool(i as Parameters<typeof sheetsReadTool>[0])],
      ['docs_create',    (i) => docsCreateTool(i as Parameters<typeof docsCreateTool>[0])],
      ['slides_create',  (i) => slidesCreateTool(i as Parameters<typeof slidesCreateTool>[0])],
      ['drive_search',   (i) => driveSearchTool(i as Parameters<typeof driveSearchTool>[0])],
    ]);

    while (response.toolRequests.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;
      const names = response.toolRequests.map((p) => p.toolRequest.name).join(', ');
      logger.debug(`[InsightsAgent] Tool loop iteration ${loopCount}, tools: ${names}`);

      const toolResults = await Promise.all(
        response.toolRequests.map(async (part) => {
          const { name, input, ref } = part.toolRequest;
          const executor = toolExecutors.get(name);
          let output: unknown;
          try {
            output = executor ? await executor(input) : { error: `Unknown tool: ${name}` };
          } catch (err) {
            logger.warn(`[InsightsAgent] Tool ${name} failed`, { error: err });
            output = { error: String(err) };
          }
          return { name, ref, output };
        })
      );

      response = await ai.generate({
        model:    GEMINI_PRO,
        messages: [
          ...response.messages,
          {
            role:    'tool' as const,
            content: toolResults.map((r) => ({
              toolResponse: { name: r.name, ref: r.ref, output: r.output },
            })),
          },
        ],
        tools,
        config: { temperature: 0.3 },
      });
    }

    // ── Extract saved insights from tool calls ────────────────────────────
    const insights: InsightsOutput['insights'] = [];
    for (const msg of response.messages) {
      for (const part of msg.content ?? []) {
        const toolReq = (part as Record<string, unknown>)['toolRequest'] as {
          name?: string;
          input?: Record<string, unknown>;
        } | undefined;

        if (toolReq?.name === 'saveInsight' && toolReq.input) {
          insights.push({
            type:     (toolReq.input['type'] as InsightsOutput['insights'][number]['type']) ?? 'recommendation',
            title:    (toolReq.input['title'] as string) ?? '',
            body:     (toolReq.input['body'] as string) ?? '',
            priority: (toolReq.input['priority'] as InsightsOutput['insights'][number]['priority']) ?? 'medium',
          });
        }
      }
    }

    const summary = response.text || `Generated ${insights.length} insights for company ${companyId}.`;
    logger.info(`[InsightsAgent] Complete: ${insights.length} insights generated after ${loopCount} loops`);

    return { insightsGenerated: insights.length, insights, summary };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: EXPLAINABILITY + PROACTIVE ALERTS
// ══════════════════════════════════════════════════════════════════════════════

import { generateId } from '../utils/helpers';
import { getFirestore as getFS2 } from '../config/firebase.config';
import { GEMINI_FLASH } from '../config/genkit.config';

/** Generate explainable insights with root cause analysis */
export async function generateExplainableInsights(companyId: string): Promise<{ insights: { metric: string; change: string; explanation: string; rootCause: string; action: string; severity: string }[] }> {
  const db = getFS2();
  const [leadsSnap, ticketsSnap, invoicesSnap] = await Promise.all([
    db.collection(`companies/${companyId}/leads`).limit(200).get(),
    db.collection(`companies/${companyId}/supportTickets`).limit(200).get(),
    db.collection(`companies/${companyId}/invoices`).limit(200).get(),
  ]);

  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: `Analyze this company data and generate explainable insights in French. For each insight, explain WHY the metric changed.
Data: ${leadsSnap.size} leads, ${ticketsSnap.size} support tickets, ${invoicesSnap.size} invoices.
Return JSON: {"insights":[{"metric":"Leads","change":"-15% cette semaine","explanation":"Baisse du trafic LinkedIn","rootCause":"Pas de post depuis 5 jours","action":"Publier 2 posts cette semaine","severity":"warning"}]}
Generate 3-5 insights with root causes.`,
    config: { temperature: 0.3 },
  });

  try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { insights: [] }; }
}

/** Send proactive alert notifications */
export async function sendProactiveAlerts(companyId: string): Promise<string[]> {
  const result = await generateExplainableInsights(companyId);
  const alerts: string[] = [];
  const { createNotification } = await import('../services/notificationService');

  for (const insight of result.insights) {
    if (insight.severity === 'warning' || insight.severity === 'critical') {
      await createNotification({
        companyId, type: 'agent_alert',
        title: `${insight.metric}: ${insight.change}`,
        message: `${insight.explanation}. Cause: ${insight.rootCause}. Action: ${insight.action}`,
        actionUrl: '/insights', icon: 'TrendingUp',
        severity: insight.severity === 'critical' ? 'error' : 'warning',
      }).catch(() => {});
      alerts.push(`${insight.metric}: ${insight.change} — ${insight.rootCause}`);
    }
  }
  return alerts;
}

// ── Expose as a tool for the Orchestrator ────────────────────────────────────
export const insightsAgentTool = ai.defineTool(
  {
    name: 'generateInsights',
    description: 'Insights PRO: proactive BI with explainability (WHY metrics change), root cause analysis, proactive alerts, trend detection, anomaly alerts.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => insightsAgentFlow(input)
);
