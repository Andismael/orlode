/**
 * Marketplace Agent Service
 * Fetches installed marketplace agents for a company, caches them,
 * and provides a dynamic Genkit tool to execute any marketplace agent.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { logger } from '../utils/logger';
import { MARKETPLACE_SHARED_TOOLS, MARKETPLACE_TOOL_WHITELIST } from '../agents/tools/marketplaceTools';

// ── Types ────────────────────────────────────────────────────────────────────

interface InstalledAgentConfig {
  agentId: string;
  name: string;
  systemPrompt: string;
  tools: string[];
  temperature: number;
  model: string;
  status: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

const agentCache = new Map<string, { agents: InstalledAgentConfig[]; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getInstalledMarketplaceAgents(companyId: string): Promise<InstalledAgentConfig[]> {
  const cached = agentCache.get(companyId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.agents;
  }

  try {
    const db = getFirestore();
    // Pull active + trialing in one query, then filter expired trials in memory.
    // Avoids needing a Firestore composite index on (status, trialEndsAt).
    const snap = await db.collection(`companies/${companyId}/installedAgents`)
      .where('status', 'in', ['active', 'trialing'])
      .limit(50)
      .get();

    const nowMs = Date.now();
    const agents: InstalledAgentConfig[] = snap.docs
      .filter(doc => {
        const d = doc.data();
        if (d['status'] === 'active') return true;
        // Trialing agents are accessible only while the trial window is open.
        const ends = d['trialEndsAt'];
        const endsMs =
          ends instanceof Date ? ends.getTime() :
          typeof ends?.toMillis === 'function' ? ends.toMillis() :
          typeof ends === 'string' ? new Date(ends).getTime() : 0;
        return endsMs > nowMs;
      })
      .map(doc => {
        const d = doc.data();
        const config = d['cachedConfig'] as Record<string, unknown> ?? {};
        return {
          agentId: doc.id,
          name: (config['name'] as string) ?? doc.id,
          systemPrompt: (config['systemPrompt'] as string) ?? '',
          tools: (config['tools'] as string[]) ?? [],
          temperature: (config['temperature'] as number) ?? 0.4,
          model: (config['model'] as string) ?? 'flash',
          status: (d['status'] as string) ?? 'active',
        };
      });

    // Only keep marketplace agents (those with a systemPrompt — built-in agents have empty prompts)
    const marketplaceAgents = agents.filter(a => a.systemPrompt.length > 0);

    agentCache.set(companyId, { agents: marketplaceAgents, fetchedAt: Date.now() });
    logger.info(`[MarketplaceService] Loaded ${marketplaceAgents.length} marketplace agents for company ${companyId}`);
    return marketplaceAgents;
  } catch (err) {
    logger.error('[MarketplaceService] Failed to load installed agents', { error: err });
    return [];
  }
}

// ── Dynamic agent execution ─────────────────────────────────────────────────

export async function executeMarketplaceAgent(
  agentConfig: InstalledAgentConfig,
  userMessage: string,
  companyId: string,
): Promise<string> {
  const systemPrompt = `${agentConfig.systemPrompt}

Context:
- Company ID: ${companyId}
- You are "${agentConfig.name}", a specialized AI agent installed from the Orlode Marketplace.
- You have access to real tools: calendar/appointments, client CRM, inventory, quotes, alerts, security checks, and reports.
- ALWAYS use companyId="${companyId}" when calling tools.
- Be helpful, concise, and professional.
- Respond in the same language as the user's message.`;

  // Filter shared tools to only those the agent is allowed to use
  const allowedToolNames = new Set(agentConfig.tools.length > 0 ? agentConfig.tools : MARKETPLACE_TOOL_WHITELIST);
  const agentTools = MARKETPLACE_SHARED_TOOLS.filter(t => {
    const name = (t as unknown as { __action?: { name?: string } }).__action?.name ?? '';
    return allowedToolNames.has(name);
  });

  try {
    // First generation with tools
    let response = await ai.generate({
      model: GEMINI_FLASH,
      system: systemPrompt,
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      tools: agentTools.length > 0 ? agentTools : undefined,
      config: { temperature: agentConfig.temperature },
    });

    // Agentic loop: execute tool calls (max 3 iterations)
    let loops = 0;
    while (response.toolRequests.length > 0 && loops < 3) {
      loops++;
      const toolResults = await Promise.all(
        response.toolRequests.map(async (part) => {
          const { name, input, ref } = part.toolRequest;
          let output: unknown;
          try {
            // Inject companyId
            const toolInput = { ...(input as Record<string, unknown>), companyId };
            const executor = agentTools.find(t =>
              (t as unknown as { __action?: { name?: string } }).__action?.name === name
            );
            output = executor ? await (executor as (i: unknown) => Promise<unknown>)(toolInput) : { error: `Unknown tool: ${name}` };
          } catch (err) {
            output = { error: `Tool ${name} failed: ${String(err)}` };
          }
          return { name, ref, output };
        })
      );

      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [
          ...response.messages,
          { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
        ],
        tools: agentTools.length > 0 ? agentTools : undefined,
        config: { temperature: agentConfig.temperature },
      });
    }

    return response.text || 'No response from agent.';
  } catch (err) {
    logger.error(`[MarketplaceService] Agent ${agentConfig.name} execution failed`, { error: err });
    return `Agent "${agentConfig.name}" encountered an error. Please try again.`;
  }
}

// ── Create dynamic Genkit tool for orchestrator ─────────────────────────────

export const callMarketplaceAgentTool = ai.defineTool(
  {
    name: 'callMarketplaceAgent',
    description: 'Call an installed marketplace agent by its ID. Use this for industry-specific agents (real estate, health, beauty, restaurant, etc.) that the company has installed from the marketplace.',
    inputSchema: z.object({
      agentId: z.string().describe('The ID of the marketplace agent to call'),
      request: z.string().describe('The user request to forward to the marketplace agent'),
      companyId: z.string().describe('The company ID'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const agents = await getInstalledMarketplaceAgents(input.companyId);
    const agent = agents.find(a => a.agentId === input.agentId);
    if (!agent) {
      return `Agent "${input.agentId}" is not installed. Available marketplace agents: ${agents.map(a => `${a.agentId} (${a.name})`).join(', ') || 'none'}`;
    }
    return executeMarketplaceAgent(agent, input.request, input.companyId);
  }
);

// ── Build dynamic system prompt section for orchestrator ─────────────────────

export function buildMarketplaceAgentPrompt(agents: InstalledAgentConfig[]): string {
  if (agents.length === 0) return '';

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
export function invalidateAgentCache(companyId: string): void {
  agentCache.delete(companyId);
}
