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
exports.wildcardAgentTool = exports.wildcardAgentFlow = void 0;
/**
 * Wildcard Agent — Gemini Flash
 * Agent universel. Filet de sécurité quand aucun agent spécialisé ne convient.
 * Accès à tous les tools de tous les agents.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
// Import tools from all agents
const ragTools_1 = require("./tools/ragTools");
const firestoreTools_1 = require("./tools/firestoreTools");
const it_agent_1 = require("./it.agent");
const cybersecurity_agent_1 = require("./cybersecurity.agent");
const marketing_agent_1 = require("./marketing.agent");
// ── Tool list ─────────────────────────────────────────────────────────────────
const WILDCARD_TOOLS = [
    // Knowledge
    ragTools_1.searchDocumentsTool,
    ragTools_1.summarizeDocumentTool,
    // Data lookups
    firestoreTools_1.getDocumentsTool,
    firestoreTools_1.getConversationsTool,
    firestoreTools_1.getMeetingsTool,
    firestoreTools_1.getEmployeesTool,
    // IT
    it_agent_1.createTicketTool,
    it_agent_1.getAssetsTool,
    it_agent_1.getServicesTool,
    // Security
    cybersecurity_agent_1.securityScoreTool,
    cybersecurity_agent_1.incidentResponseTool,
    // Marketing
    marketing_agent_1.generatePostTool,
    marketing_agent_1.getCalendarTool,
    marketing_agent_1.getStatsTool,
    marketing_agent_1.writeContentTool,
];
const WILDCARD_EXECUTORS = new Map([
    ['searchDocuments', (i) => (0, ragTools_1.searchDocumentsTool)(i)],
    ['summarizeDocument', (i) => (0, ragTools_1.summarizeDocumentTool)(i)],
    ['getDocuments', (i) => (0, firestoreTools_1.getDocumentsTool)(i)],
    ['getConversations', (i) => (0, firestoreTools_1.getConversationsTool)(i)],
    ['getMeetings', (i) => (0, firestoreTools_1.getMeetingsTool)(i)],
    ['getEmployees', (i) => (0, firestoreTools_1.getEmployeesTool)(i)],
    ['it_createTicket', (i) => (0, it_agent_1.createTicketTool)(i)],
    ['it_getInventory', (i) => (0, it_agent_1.getAssetsTool)(i)],
    ['it_systemStatus', (i) => (0, it_agent_1.getServicesTool)(i)],
    ['sec_getSecurityScore', (i) => (0, cybersecurity_agent_1.securityScoreTool)(i)],
    ['sec_reportIncident', (i) => (0, cybersecurity_agent_1.incidentResponseTool)(i)],
    ['mkt_generatePost', (i) => (0, marketing_agent_1.generatePostTool)(i)],
    ['mkt_getContentCalendar', (i) => (0, marketing_agent_1.getCalendarTool)(i)],
    ['mkt_getAnalyticsReport', (i) => (0, marketing_agent_1.getStatsTool)(i)],
    ['mkt_writeArticle', (i) => (0, marketing_agent_1.writeContentTool)(i)],
]);
// ── Flow ──────────────────────────────────────────────────────────────────────
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    toolsUsed: zod_1.z.array(zod_1.z.string()),
});
exports.wildcardAgentFlow = genkit_config_1.ai.defineFlow({ name: 'wildcardAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language }) => {
    try {
        logger_1.logger.info(`[WildcardAgent] Request: "${request.slice(0, 80)}"`);
        const langInstr = language === 'auto' ? 'Respond in the same language as the request.' : `Respond in ${language}.`;
        let response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            system: `You are the Wildcard Agent — the universal Swiss Army knife of Orlode.
You handle ANY task that doesn't fit a specialized agent.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.

GUARDRAILS (IMPORTANT):
1. READ-ONLY by default — prefer reading/searching/listing over creating/modifying
2. SUGGESTION MODE — for write actions, PROPOSE the action first:
   "Je propose de creer un ticket IT pour ce probleme. Voulez-vous que je continue ?"
   Do NOT auto-execute write operations without framing them as a suggestion.
3. NO CRITICAL ACTIONS — never delete data, never send emails without confirmation, never modify security settings
4. ALWAYS LOG — mention which tools you used in your response
5. If unsure, ask for clarification rather than guessing

You have access to tools from ALL departments: Documents, IT, Security, Marketing, Data.
Be resourceful but SAFE. Propose, don't impose.
${langInstr}`,
            prompt: request,
            tools: WILDCARD_TOOLS,
            config: { temperature: 0.5 },
        });
        const toolsUsed = [];
        let loopCount = 0;
        while (response.toolRequests.length > 0 && loopCount < 8) {
            loopCount++;
            const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
                const { name, input, ref } = p.toolRequest;
                toolsUsed.push(name);
                const exec = WILDCARD_EXECUTORS.get(name);
                const inp = { ...input, companyId };
                const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
                return { name, ref, output };
            }));
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [
                    ...response.messages,
                    { role: 'tool', content: toolResults.map((r) => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
                ],
                tools: WILDCARD_TOOLS,
                config: { temperature: 0.5 },
            });
        }
        // PRO: Log wildcard usage for audit
        if (toolsUsed.length > 0) {
            try {
                const db = (0, firebase_config_1.getFirestore)();
                const { generateId } = await Promise.resolve().then(() => __importStar(require('../utils/helpers')));
                await db.collection(`companies/${companyId}/wildcardLogs`).doc(generateId()).set({
                    request: request.slice(0, 200), toolsUsed: [...new Set(toolsUsed)],
                    userId: userId ?? null, timestamp: new Date(),
                });
            }
            catch { }
        }
        return { response: response.text, toolsUsed: [...new Set(toolsUsed)] };
    }
    catch (err) {
        logger_1.logger.error('[WildcardAgent] Flow error:', err);
        return { response: 'An error occurred in the wildcard agent. Please try again.', toolsUsed: [] };
    }
});
exports.wildcardAgentTool = genkit_config_1.ai.defineTool({
    name: 'callWildcardAgent',
    description: 'Wildcard PRO: universal agent with guardrails (read-only default, suggestion mode for writes, mandatory logging). Multi-department fallback.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async (input) => {
    try {
        return await (0, exports.wildcardAgentFlow)(input);
    }
    catch (err) {
        logger_1.logger.error('[callWildcardAgent] Error:', err);
        return { response: 'An error occurred in the wildcard agent. Please try again.', toolsUsed: [] };
    }
});
//# sourceMappingURL=wildcard.agent.js.map