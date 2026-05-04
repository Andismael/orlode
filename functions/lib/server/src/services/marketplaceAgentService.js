"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callMarketplaceAgentTool = void 0;
exports.getInstalledMarketplaceAgents = getInstalledMarketplaceAgents;
exports.executeMarketplaceAgent = executeMarketplaceAgent;
exports.buildMarketplaceAgentPrompt = buildMarketplaceAgentPrompt;
exports.invalidateAgentCache = invalidateAgentCache;
/**
 * Marketplace Agent Service
 * Fetches installed marketplace agents for a company, caches them,
 * and provides a dynamic Genkit tool to execute any marketplace agent.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
const marketplaceTools_1 = require("../agents/tools/marketplaceTools");
// ── Cache ────────────────────────────────────────────────────────────────────
const agentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
async function getInstalledMarketplaceAgents(companyId) {
    const cached = agentCache.get(companyId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.agents;
    }
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${companyId}/installedAgents`)
            .where('status', '==', 'active')
            .limit(50)
            .get();
        const agents = snap.docs.map(doc => {
            const d = doc.data();
            const config = d['cachedConfig'] ?? {};
            return {
                agentId: doc.id,
                name: config['name'] ?? doc.id,
                systemPrompt: config['systemPrompt'] ?? '',
                tools: config['tools'] ?? [],
                temperature: config['temperature'] ?? 0.4,
                model: config['model'] ?? 'flash',
                status: d['status'] ?? 'active',
            };
        });
        // Only keep marketplace agents (those with a systemPrompt — built-in agents have empty prompts)
        const marketplaceAgents = agents.filter(a => a.systemPrompt.length > 0);
        agentCache.set(companyId, { agents: marketplaceAgents, fetchedAt: Date.now() });
        logger_1.logger.info(`[MarketplaceService] Loaded ${marketplaceAgents.length} marketplace agents for company ${companyId}`);
        return marketplaceAgents;
    }
    catch (err) {
        logger_1.logger.error('[MarketplaceService] Failed to load installed agents', { error: err });
        return [];
    }
}
// ── Dynamic agent execution ─────────────────────────────────────────────────
async function executeMarketplaceAgent(agentConfig, userMessage, companyId) {
    const systemPrompt = `${agentConfig.systemPrompt}

Context:
- Company ID: ${companyId}
- You are "${agentConfig.name}", a specialized AI agent installed from the Orlode Marketplace.
- You have access to real tools: calendar/appointments, client CRM, inventory, quotes, alerts, security checks, and reports.
- ALWAYS use companyId="${companyId}" when calling tools.
- Be helpful, concise, and professional.
- Respond in the same language as the user's message.`;
    // Filter shared tools to only those the agent is allowed to use
    const allowedToolNames = new Set(agentConfig.tools.length > 0 ? agentConfig.tools : marketplaceTools_1.MARKETPLACE_TOOL_WHITELIST);
    const agentTools = marketplaceTools_1.MARKETPLACE_SHARED_TOOLS.filter(t => {
        const name = t.__action?.name ?? '';
        return allowedToolNames.has(name);
    });
    try {
        // First generation with tools
        let response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            system: systemPrompt,
            messages: [{ role: 'user', content: [{ text: userMessage }] }],
            tools: agentTools.length > 0 ? agentTools : undefined,
            config: { temperature: agentConfig.temperature },
        });
        // Agentic loop: execute tool calls (max 3 iterations)
        let loops = 0;
        while (response.toolRequests.length > 0 && loops < 3) {
            loops++;
            const toolResults = await Promise.all(response.toolRequests.map(async (part) => {
                const { name, input, ref } = part.toolRequest;
                let output;
                try {
                    // Inject companyId
                    const toolInput = { ...input, companyId };
                    const executor = agentTools.find(t => t.__action?.name === name);
                    output = executor ? await executor(toolInput) : { error: `Unknown tool: ${name}` };
                }
                catch (err) {
                    output = { error: `Tool ${name} failed: ${String(err)}` };
                }
                return { name, ref, output };
            }));
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [
                    ...response.messages,
                    { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
                ],
                tools: agentTools.length > 0 ? agentTools : undefined,
                config: { temperature: agentConfig.temperature },
            });
        }
        return response.text || 'No response from agent.';
    }
    catch (err) {
        logger_1.logger.error(`[MarketplaceService] Agent ${agentConfig.name} execution failed`, { error: err });
        return `Agent "${agentConfig.name}" encountered an error. Please try again.`;
    }
}
// ── Create dynamic Genkit tool for orchestrator ─────────────────────────────
exports.callMarketplaceAgentTool = genkit_config_1.ai.defineTool({
    name: 'callMarketplaceAgent',
    description: 'Call an installed marketplace agent by its ID. Use this for industry-specific agents (real estate, health, beauty, restaurant, etc.) that the company has installed from the marketplace.',
    inputSchema: zod_1.z.object({
        agentId: zod_1.z.string().describe('The ID of the marketplace agent to call'),
        request: zod_1.z.string().describe('The user request to forward to the marketplace agent'),
        companyId: zod_1.z.string().describe('The company ID'),
    }),
    outputSchema: zod_1.z.string(),
}, async (input) => {
    const agents = await getInstalledMarketplaceAgents(input.companyId);
    const agent = agents.find(a => a.agentId === input.agentId);
    if (!agent) {
        return `Agent "${input.agentId}" is not installed. Available marketplace agents: ${agents.map(a => `${a.agentId} (${a.name})`).join(', ') || 'none'}`;
    }
    return executeMarketplaceAgent(agent, input.request, input.companyId);
});
// ── Build dynamic system prompt section for orchestrator ─────────────────────
function buildMarketplaceAgentPrompt(agents) {
    if (agents.length === 0)
        return '';
    const agentList = agents.map(a => `  - "${a.agentId}" → ${a.name}`).join('\n');
    return `

## Installed Marketplace Agents:
This company has installed the following marketplace agents. Use callMarketplaceAgent to route requests to them:
${agentList}

## Marketplace Routing:
- When the user's request matches an installed marketplace agent's specialty, call it via callMarketplaceAgent with the agent's ID.
- These agents handle industry-specific tasks (real estate, health, beauty, restaurant, repair, etc.)
- Always pass the full user request to the marketplace agent.`;
}
// Invalidate cache when agent is installed/uninstalled
function invalidateAgentCache(companyId) {
    agentCache.delete(companyId);
}
//# sourceMappingURL=marketplaceAgentService.js.map