"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightsAgentTool = exports.insightsAgentFlow = void 0;
exports.generateExplainableInsights = generateExplainableInsights;
exports.sendProactiveAlerts = sendProactiveAlerts;
/**
 * Insights Agent — Gemini Pro
 *
 * Pattern: proactive loop
 * Responsibility: 24/7 monitoring of company data. Detects trends, anomalies,
 * and generates actionable recommendations. Can be triggered on-demand or
 * run on a schedule (cron). Persists insights to Firestore dashboard.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firestoreTools_1 = require("./tools/firestoreTools");
const googleWorkspace_1 = require("./tools/mcp/googleWorkspace");
const mcp_config_1 = require("../config/mcp.config");
const logger_1 = require("../utils/logger");
const INPUT = zod_1.z.object({
    companyId: zod_1.z.string(),
    mode: zod_1.z.enum(['full', 'quick', 'documents', 'meetings', 'conversations'])
        .optional().default('full'),
    maxInsights: zod_1.z.number().optional().default(5),
});
const OUTPUT = zod_1.z.object({
    insightsGenerated: zod_1.z.number(),
    insights: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['trend', 'anomaly', 'recommendation', 'alert']),
        title: zod_1.z.string(),
        body: zod_1.z.string(),
        priority: zod_1.z.enum(['low', 'medium', 'high']),
    })),
    summary: zod_1.z.string(),
});
// ── The flow (loop pattern) ───────────────────────────────────────────────────
exports.insightsAgentFlow = genkit_config_1.ai.defineFlow({ name: 'insightsAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ companyId, mode, maxInsights }) => {
    logger_1.logger.info(`[InsightsAgent] Starting ${mode} analysis for company ${companyId}`);
    const systemPrompt = `You are a proactive business intelligence analyst for a corporate AI platform.
Your job is to analyze company data and generate actionable insights.

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
    const baseFull = [firestoreTools_1.getDocumentsTool, firestoreTools_1.getConversationsTool, firestoreTools_1.getMeetingsTool, firestoreTools_1.getEmployeesTool, firestoreTools_1.saveInsightTool];
    const baseQuick = [firestoreTools_1.getDocumentsTool, firestoreTools_1.getConversationsTool, firestoreTools_1.saveInsightTool];
    // MCP tools (added when Google Workspace MCP is available)
    const mcpTools = mcp_config_1.mcpAvailability.googleWorkspace
        ? [googleWorkspace_1.sheetsReadTool, googleWorkspace_1.docsCreateTool, googleWorkspace_1.slidesCreateTool, googleWorkspace_1.driveSearchTool]
        : [];
    const allTools = [...baseFull, ...mcpTools];
    const toolsByMode = {
        full: allTools,
        quick: [...baseQuick, ...mcpTools],
        documents: [firestoreTools_1.getDocumentsTool, firestoreTools_1.saveInsightTool, ...(mcp_config_1.mcpAvailability.googleWorkspace ? [googleWorkspace_1.driveSearchTool] : [])],
        meetings: [firestoreTools_1.getMeetingsTool, firestoreTools_1.getEmployeesTool, firestoreTools_1.saveInsightTool],
        conversations: [firestoreTools_1.getConversationsTool, firestoreTools_1.saveInsightTool],
    };
    const tools = toolsByMode[mode ?? 'full'] ?? allTools;
    // ── Agentic loop: keep running until agent stops calling tools ────────
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_PRO,
        system: systemPrompt,
        prompt: `Analyze all available data for company ${companyId} and generate insights.
Start by gathering data with the available tools, then analyze patterns, and save your insights.
Focus on: document indexing health, conversation patterns, meeting productivity, and team engagement.`,
        tools,
        config: { temperature: 0.3 },
    });
    let loopCount = 0;
    const MAX_LOOPS = 10;
    // Build a tool executor map (name → async function)
    const toolExecutors = new Map([
        ['getDocuments', (i) => (0, firestoreTools_1.getDocumentsTool)(i)],
        ['getConversations', (i) => (0, firestoreTools_1.getConversationsTool)(i)],
        ['getMeetings', (i) => (0, firestoreTools_1.getMeetingsTool)(i)],
        ['getEmployees', (i) => (0, firestoreTools_1.getEmployeesTool)(i)],
        ['saveInsight', (i) => (0, firestoreTools_1.saveInsightTool)(i)],
        // MCP tools (graceful: won't be called if not in activeTools)
        ['sheets_read', (i) => (0, googleWorkspace_1.sheetsReadTool)(i)],
        ['docs_create', (i) => (0, googleWorkspace_1.docsCreateTool)(i)],
        ['slides_create', (i) => (0, googleWorkspace_1.slidesCreateTool)(i)],
        ['drive_search', (i) => (0, googleWorkspace_1.driveSearchTool)(i)],
    ]);
    while (response.toolRequests.length > 0 && loopCount < MAX_LOOPS) {
        loopCount++;
        const names = response.toolRequests.map((p) => p.toolRequest.name).join(', ');
        logger_1.logger.debug(`[InsightsAgent] Tool loop iteration ${loopCount}, tools: ${names}`);
        const toolResults = await Promise.all(response.toolRequests.map(async (part) => {
            const { name, input, ref } = part.toolRequest;
            const executor = toolExecutors.get(name);
            let output;
            try {
                output = executor ? await executor(input) : { error: `Unknown tool: ${name}` };
            }
            catch (err) {
                logger_1.logger.warn(`[InsightsAgent] Tool ${name} failed`, { error: err });
                output = { error: String(err) };
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_PRO,
            messages: [
                ...response.messages,
                {
                    role: 'tool',
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
    const insights = [];
    for (const msg of response.messages) {
        for (const part of msg.content ?? []) {
            const toolReq = part['toolRequest'];
            if (toolReq?.name === 'saveInsight' && toolReq.input) {
                insights.push({
                    type: toolReq.input['type'] ?? 'recommendation',
                    title: toolReq.input['title'] ?? '',
                    body: toolReq.input['body'] ?? '',
                    priority: toolReq.input['priority'] ?? 'medium',
                });
            }
        }
    }
    const summary = response.text || `Generated ${insights.length} insights for company ${companyId}.`;
    logger_1.logger.info(`[InsightsAgent] Complete: ${insights.length} insights generated after ${loopCount} loops`);
    return { insightsGenerated: insights.length, insights, summary };
});
const firebase_config_1 = require("../config/firebase.config");
const genkit_config_2 = require("../config/genkit.config");
/** Generate explainable insights with root cause analysis */
async function generateExplainableInsights(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const [leadsSnap, ticketsSnap, invoicesSnap] = await Promise.all([
        db.collection(`companies/${companyId}/leads`).limit(200).get(),
        db.collection(`companies/${companyId}/supportTickets`).limit(200).get(),
        db.collection(`companies/${companyId}/invoices`).limit(200).get(),
    ]);
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_2.GEMINI_FLASH,
        prompt: `Analyze this company data and generate explainable insights in French. For each insight, explain WHY the metric changed.
Data: ${leadsSnap.size} leads, ${ticketsSnap.size} support tickets, ${invoicesSnap.size} invoices.
Return JSON: {"insights":[{"metric":"Leads","change":"-15% cette semaine","explanation":"Baisse du trafic LinkedIn","rootCause":"Pas de post depuis 5 jours","action":"Publier 2 posts cette semaine","severity":"warning"}]}
Generate 3-5 insights with root causes.`,
        config: { temperature: 0.3 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { insights: [] };
    }
}
/** Send proactive alert notifications */
async function sendProactiveAlerts(companyId) {
    const result = await generateExplainableInsights(companyId);
    const alerts = [];
    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    for (const insight of result.insights) {
        if (insight.severity === 'warning' || insight.severity === 'critical') {
            await createNotification({
                companyId, type: 'agent_alert',
                title: `${insight.metric}: ${insight.change}`,
                message: `${insight.explanation}. Cause: ${insight.rootCause}. Action: ${insight.action}`,
                actionUrl: '/insights', icon: 'TrendingUp',
                severity: insight.severity === 'critical' ? 'error' : 'warning',
            }).catch(() => { });
            alerts.push(`${insight.metric}: ${insight.change} — ${insight.rootCause}`);
        }
    }
    return alerts;
}
// ── Expose as a tool for the Orchestrator ────────────────────────────────────
exports.insightsAgentTool = genkit_config_1.ai.defineTool({
    name: 'generateInsights',
    description: 'Insights PRO: proactive BI with explainability (WHY metrics change), root cause analysis, proactive alerts, trend detection, anomaly alerts.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.insightsAgentFlow)(input));
//# sourceMappingURL=insights.agent.js.map