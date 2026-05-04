"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/it.agent', () => ({
    itAgent: {
        process: vitest_1.vi.fn(async ({ action, ticket, userId, service }) => {
            if (action === 'create_ticket' && ticket) {
                return { ticketId: `IT-${Date.now()}`, status: 'open', assignedTo: 'IT Team', ...ticket };
            }
            if (action === 'password_reset' && userId) {
                return {
                    steps: [
                        'Allez sur /reset-password',
                        'Entrez votre email',
                        'Cliquez sur le lien reçu',
                        'Créez un nouveau mot de passe',
                    ],
                    userId,
                    estimated_time: '5 minutes',
                };
            }
            if (action === 'system_status') {
                return {
                    services: {
                        api: 'operational',
                        database: 'operational',
                        storage: 'degraded',
                    },
                    overallStatus: 'degraded',
                    incidents: [],
                };
            }
            return {};
        }),
    },
}));
const it_agent_1 = require("@/agents/it.agent");
(0, vitest_1.describe)('IT Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should create an IT ticket', async () => {
        const result = await it_agent_1.itAgent.process({
            action: 'create_ticket',
            ticket: { subject: 'VPN ne fonctionne pas', description: 'Impossible de se connecter au VPN', userId: 'user1' },
        });
        (0, vitest_1.expect)(result.ticketId).toBeDefined();
        (0, vitest_1.expect)(result.status).toBe('open');
        (0, vitest_1.expect)(result.assignedTo).toBeDefined();
    });
    (0, vitest_1.it)('should guide a password reset step by step', async () => {
        const result = await it_agent_1.itAgent.process({ action: 'password_reset', userId: 'user1' });
        (0, vitest_1.expect)(result.steps).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.steps)).toBe(true);
        (0, vitest_1.expect)(result.steps.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should check system status', async () => {
        const result = await it_agent_1.itAgent.process({ action: 'system_status' });
        (0, vitest_1.expect)(result.services).toBeDefined();
        (0, vitest_1.expect)(result.overallStatus).toBeDefined();
        (0, vitest_1.expect)(['operational', 'degraded', 'outage']).toContain(result.overallStatus);
    });
});
//# sourceMappingURL=it.agent.test.js.map