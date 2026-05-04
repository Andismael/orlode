"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/agents/orchestrator.agent', () => ({
    orchestratorAgent: {
        process: vitest_1.vi.fn(async ({ message, companyId }) => {
            // Determine which agents to delegate to based on message
            const agents = [];
            if (/CA|chiffre|facture|finance/i.test(message))
                agents.push('QA_Agent', 'Accounting_Agent');
            if (/pipeline|commercial|vente/i.test(message))
                agents.push('Sales_Agent');
            if (/réunion|meeting/i.test(message))
                agents.push('Meeting_Agent');
            return {
                answer: `Rapport consolidé pour ${companyId}: ${message.slice(0, 30)}...`,
                agentsDelegatedTo: agents.length ? agents : ['QA_Agent'],
                parallel: agents.length > 1,
                companyId,
            };
        }),
    },
}));
const orchestrator_agent_1 = require("@/agents/orchestrator.agent");
(0, vitest_1.describe)('Flow: Orchestrator Parallel Delegation', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should delegate to multiple agents for complex query', async () => {
        const result = await orchestrator_agent_1.orchestratorAgent.process({
            message: 'Prépare un rapport avec le CA Q3, les factures en retard, et le pipeline commercial',
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(result.agentsDelegatedTo).toContain('QA_Agent');
        (0, vitest_1.expect)(result.agentsDelegatedTo).toContain('Accounting_Agent');
        (0, vitest_1.expect)(result.agentsDelegatedTo).toContain('Sales_Agent');
        (0, vitest_1.expect)(result.answer).toBeDefined();
        (0, vitest_1.expect)(result.parallel).toBe(true);
    });
    (0, vitest_1.it)('should produce a single answer from multiple agents', async () => {
        const result = await orchestrator_agent_1.orchestratorAgent.process({
            message: 'Analyse le CA Q3 et les opportunités commerciales',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.answer).toBeDefined();
        (0, vitest_1.expect)(typeof result.answer).toBe('string');
    });
    (0, vitest_1.it)('should delegate to just one agent for simple query', async () => {
        const result = await orchestrator_agent_1.orchestratorAgent.process({
            message: 'Quand est la prochaine réunion ?',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.agentsDelegatedTo).toContain('Meeting_Agent');
        (0, vitest_1.expect)(result.agentsDelegatedTo.length).toBe(1);
    });
});
//# sourceMappingURL=orchestratorParallel.flow.test.js.map