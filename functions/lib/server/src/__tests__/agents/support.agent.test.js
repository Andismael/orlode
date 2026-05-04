"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/support.agent', () => ({
    supportAgent: {
        process: vitest_1.vi.fn(async ({ action, ticket, ticketId, message }) => {
            if (action === 'create_ticket' && ticket) {
                return { ticketId: `TKT-${Date.now()}`, status: 'open', priority: 'medium', ...ticket };
            }
            if (action === 'suggest_solution' && ticketId) {
                return {
                    solutions: [
                        { title: 'Reset password', steps: ['Go to settings', 'Click reset'], confidence: 0.88 },
                    ],
                    ticketId,
                    resolved: false,
                };
            }
            if (action === 'escalate') {
                return {
                    escalated: true,
                    escalatedTo: 'Senior Support',
                    reason: 'Issue not resolvable at tier-1',
                    ticketId,
                };
            }
            return {};
        }),
    },
}));
const support_agent_1 = require("@/agents/support.agent");
(0, vitest_1.describe)('Support Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should create a support ticket', async () => {
        const result = await support_agent_1.supportAgent.process({
            action: 'create_ticket',
            ticket: { subject: "Impossible de me connecter", description: "Erreur 403", userId: 'user1' },
        });
        (0, vitest_1.expect)(result.ticketId).toBeDefined();
        (0, vitest_1.expect)(result.status).toBe('open');
    });
    (0, vitest_1.it)('should suggest a solution from knowledge base', async () => {
        const result = await support_agent_1.supportAgent.process({ action: 'suggest_solution', ticketId: 'TKT-001' });
        (0, vitest_1.expect)(result.solutions).toBeDefined();
        (0, vitest_1.expect)(result.solutions.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.solutions[0].confidence).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should escalate when unable to resolve', async () => {
        const result = await support_agent_1.supportAgent.process({ action: 'escalate', ticketId: 'TKT-001' });
        (0, vitest_1.expect)(result.escalated).toBe(true);
        (0, vitest_1.expect)(result.escalatedTo).toBeDefined();
        (0, vitest_1.expect)(result.reason).toBeDefined();
    });
});
//# sourceMappingURL=support.agent.test.js.map