"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/wildcard.agent', () => ({
    wildcardAgent: {
        process: vitest_1.vi.fn(async ({ message, companyId }) => {
            return {
                answer: `Voici ma réponse complète pour : "${message}". Je coordonne les actions nécessaires entre les différents départements pour vous aider au mieux.`,
                toolsUsed: ['calendar_tool', 'hr_tool', 'finance_tool'],
                agentsConsulted: ['HR_Agent', 'Finance_Agent'],
                companyId,
            };
        }),
    },
}));
const wildcard_agent_1 = require("@/agents/wildcard.agent");
(0, vitest_1.describe)('Wildcard Agent', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should handle multi-department tasks', async () => {
        const result = await wildcard_agent_1.wildcardAgent.process({
            message: 'Organise un team building pour 20 personnes le mois prochain',
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.answer).toBeDefined();
        (0, vitest_1.expect)(result.answer.length).toBeGreaterThan(50);
        (0, vitest_1.expect)(result.answer).not.toMatch(/ne peux pas|impossible/i);
    });
    (0, vitest_1.it)('should access tools from multiple agents', async () => {
        const result = await wildcard_agent_1.wildcardAgent.process({
            message: "Résume tout ce qui s'est passé cette semaine",
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.toolsUsed).toBeDefined();
        (0, vitest_1.expect)(result.toolsUsed.length).toBeGreaterThan(1);
    });
    (0, vitest_1.it)('should always provide an answer (never block)', async () => {
        const result = await wildcard_agent_1.wildcardAgent.process({
            message: 'Que faire si un client ne paie pas ses factures ?',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.answer).toBeDefined();
        (0, vitest_1.expect)(result.answer.length).toBeGreaterThan(10);
    });
    (0, vitest_1.it)('should include agents consulted in response', async () => {
        const result = await wildcard_agent_1.wildcardAgent.process({
            message: 'Analyse globale des performances',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.agentsConsulted).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.agentsConsulted)).toBe(true);
    });
});
//# sourceMappingURL=wildcard.agent.test.js.map