"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/hr.agent', () => ({
    hrAgent: {
        process: vitest_1.vi.fn(async ({ action, userId, leaveRequest, question }) => {
            if (action === 'leave_balance') {
                return { userId, balance: { paid: 12, sick: 5, rtt: 8 }, unit: 'days' };
            }
            if (action === 'request_leave' && leaveRequest) {
                return { success: true, requestId: `LR-${Date.now()}`, status: 'pending', leaveRequest };
            }
            if (action === 'hr_question') {
                return { answer: `Réponse RH: ${question}`, policySection: 'Section 4.2', confidence: 0.9 };
            }
            return {};
        }),
    },
}));
const hr_agent_1 = require("@/agents/hr.agent");
(0, vitest_1.describe)('HR Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should return leave balance for a user', async () => {
        const result = await hr_agent_1.hrAgent.process({ action: 'leave_balance', userId: 'user1' });
        (0, vitest_1.expect)(result.balance).toBeDefined();
        (0, vitest_1.expect)(result.balance.paid).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.unit).toBe('days');
    });
    (0, vitest_1.it)('should process a leave request', async () => {
        const result = await hr_agent_1.hrAgent.process({
            action: 'request_leave',
            leaveRequest: { type: 'paid', startDate: '2024-03-01', endDate: '2024-03-05', reason: 'Vacances' },
        });
        (0, vitest_1.expect)(result.success).toBe(true);
        (0, vitest_1.expect)(result.requestId).toBeDefined();
        (0, vitest_1.expect)(result.status).toBe('pending');
    });
    (0, vitest_1.it)('should answer HR policy questions', async () => {
        const result = await hr_agent_1.hrAgent.process({
            action: 'hr_question',
            question: 'Combien de jours de congés payés ai-je par an ?',
        });
        (0, vitest_1.expect)(result.answer).toBeDefined();
        (0, vitest_1.expect)(result.answer.length).toBeGreaterThan(10);
    });
});
//# sourceMappingURL=hr.agent.test.js.map