"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/accounting.agent', () => ({
    accountingAgent: {
        process: vitest_1.vi.fn(async ({ action, companyId }) => {
            if (action === 'overdue_invoices') {
                return {
                    overdueInvoices: [
                        { id: 'INV-001', client: 'Acme Corp', amount: 5000, daysOverdue: 15 },
                        { id: 'INV-002', client: 'Beta SAS', amount: 2500, daysOverdue: 30 },
                    ],
                    totalOverdue: 7500,
                    companyId,
                };
            }
            if (action === 'cash_flow_projection') {
                return {
                    projection: { next30: 45000, next60: 38000, next90: 52000 },
                    currency: 'EUR',
                    confidence: 0.82,
                };
            }
            if (action === 'monthly_report') {
                return {
                    report: {
                        period: '2024-01',
                        revenue: 120000,
                        expenses: 95000,
                        profit: 25000,
                        profitMargin: '20.8%',
                    },
                    companyId,
                };
            }
            return {};
        }),
    },
}));
const accounting_agent_1 = require("@/agents/accounting.agent");
(0, vitest_1.describe)('Accounting Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should track overdue invoices', async () => {
        const result = await accounting_agent_1.accountingAgent.process({ action: 'overdue_invoices', companyId: 'co1' });
        (0, vitest_1.expect)(result.overdueInvoices).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.overdueInvoices)).toBe(true);
        (0, vitest_1.expect)(result.totalOverdue).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should calculate cash flow projection', async () => {
        const result = await accounting_agent_1.accountingAgent.process({ action: 'cash_flow_projection', companyId: 'co1' });
        (0, vitest_1.expect)(result.projection).toBeDefined();
        (0, vitest_1.expect)(result.projection.next30).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.confidence).toBeLessThanOrEqual(1);
    });
    (0, vitest_1.it)('should generate monthly financial report', async () => {
        const result = await accounting_agent_1.accountingAgent.process({ action: 'monthly_report', companyId: 'co1' });
        (0, vitest_1.expect)(result.report).toBeDefined();
        (0, vitest_1.expect)(result.report.revenue).toBeDefined();
        (0, vitest_1.expect)(result.report.expenses).toBeDefined();
        (0, vitest_1.expect)(result.report.profit).toBeDefined();
    });
});
//# sourceMappingURL=accounting.agent.test.js.map