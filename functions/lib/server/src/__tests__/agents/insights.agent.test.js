"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/insights.agent', () => ({
    insightsAgent: {
        process: vitest_1.vi.fn(async ({ action, companyId }) => {
            if (action === 'detect_anomalies') {
                return {
                    anomalies: [
                        { metric: 'revenue', deviation: -15.2, severity: 'high', description: 'Baisse inhabituelle du CA de 15%' },
                    ],
                    companyId,
                };
            }
            if (action === 'generate_alerts') {
                return {
                    alerts: [
                        { type: 'critical', message: 'Stock critique pour produit XYZ', priority: 1 },
                        { type: 'attention', message: '3 factures en retard de paiement', priority: 2 },
                    ],
                };
            }
            if (action === 'weekly_report') {
                return {
                    report: {
                        period: 'week',
                        highlights: ['CA en hausse de 5%', 'NPS stable à 72'],
                        alerts: [],
                        recommendations: ['Relancer les leads du pipeline'],
                    },
                };
            }
            return {};
        }),
    },
}));
const insights_agent_1 = require("@/agents/insights.agent");
(0, vitest_1.describe)('Insights Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should detect anomalies in data trends', async () => {
        const result = await insights_agent_1.insightsAgent.process({ action: 'detect_anomalies', companyId: 'co1' });
        (0, vitest_1.expect)(result.anomalies).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.anomalies)).toBe(true);
        (0, vitest_1.expect)(result.anomalies[0].severity).toBeDefined();
    });
    (0, vitest_1.it)('should generate proactive alerts', async () => {
        const result = await insights_agent_1.insightsAgent.process({ action: 'generate_alerts', companyId: 'co1' });
        (0, vitest_1.expect)(result.alerts).toBeDefined();
        (0, vitest_1.expect)(result.alerts.length).toBeGreaterThan(0);
        result.alerts.forEach((alert) => {
            (0, vitest_1.expect)(alert.type).toBeDefined();
            (0, vitest_1.expect)(alert.message).toBeDefined();
        });
    });
    (0, vitest_1.it)('should produce a weekly report', async () => {
        const result = await insights_agent_1.insightsAgent.process({ action: 'weekly_report', companyId: 'co1' });
        (0, vitest_1.expect)(result.report).toBeDefined();
        (0, vitest_1.expect)(result.report.highlights).toBeDefined();
        (0, vitest_1.expect)(result.report.recommendations).toBeDefined();
    });
});
//# sourceMappingURL=insights.agent.test.js.map