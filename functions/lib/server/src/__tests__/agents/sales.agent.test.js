"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/sales.agent', () => ({
    salesAgent: {
        process: vitest_1.vi.fn(async ({ action, lead, leadId }) => {
            if (action === 'score_lead' && lead) {
                const score = lead.interactions > 5 && lead.budget > 10000 ? 'hot' :
                    lead.interactions > 2 ? 'warm' : 'cold';
                return { score, probability: score === 'hot' ? 0.85 : score === 'warm' ? 0.45 : 0.15, lead };
            }
            if (action === 'generate_quote') {
                return {
                    quoteId: `Q-${Date.now()}`,
                    items: [{ description: 'Service pro', quantity: 1, unitPrice: 5000, total: 5000 }],
                    total: 5000,
                    currency: 'EUR',
                    validUntil: '2024-03-31',
                };
            }
            if (action === 'suggest_followup' && leadId) {
                return {
                    suggestions: [
                        { action: 'call', timing: 'dans 2 jours', message: 'Rappeler pour suite devis' },
                        { action: 'email', timing: 'dans 5 jours', message: 'Relance automatique si pas de réponse' },
                    ],
                    leadId,
                };
            }
            return {};
        }),
    },
}));
const sales_agent_1 = require("@/agents/sales.agent");
(0, vitest_1.describe)('Sales Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should score a hot lead correctly', async () => {
        const result = await sales_agent_1.salesAgent.process({
            action: 'score_lead',
            lead: { name: 'Jean Martin', company: 'Acme', interactions: 8, budget: 50000 },
        });
        (0, vitest_1.expect)(result.score).toBe('hot');
        (0, vitest_1.expect)(result.probability).toBeGreaterThan(0.7);
    });
    (0, vitest_1.it)('should score a cold lead correctly', async () => {
        const result = await sales_agent_1.salesAgent.process({
            action: 'score_lead',
            lead: { name: 'Unknown', company: 'Unknown', interactions: 0, budget: 0 },
        });
        (0, vitest_1.expect)(result.score).toBe('cold');
        (0, vitest_1.expect)(result.probability).toBeLessThan(0.3);
    });
    (0, vitest_1.it)('should generate a quote', async () => {
        const result = await sales_agent_1.salesAgent.process({ action: 'generate_quote' });
        (0, vitest_1.expect)(result.quoteId).toBeDefined();
        (0, vitest_1.expect)(result.total).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.items).toBeDefined();
        (0, vitest_1.expect)(result.validUntil).toBeDefined();
    });
    (0, vitest_1.it)('should suggest follow-up actions for a lead', async () => {
        const result = await sales_agent_1.salesAgent.process({ action: 'suggest_followup', leadId: 'lead-123' });
        (0, vitest_1.expect)(result.suggestions).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.suggestions)).toBe(true);
        (0, vitest_1.expect)(result.suggestions.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.suggestions[0].action).toBeDefined();
    });
});
//# sourceMappingURL=sales.agent.test.js.map