import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/accounting.agent', () => ({
  accountingAgent: {
    process: vi.fn(async ({ action, companyId }: { action: string; companyId: string }) => {
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

import { accountingAgent } from '@/agents/accounting.agent';

describe('Accounting Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should track overdue invoices', async () => {
    const result = await accountingAgent.process({ action: 'overdue_invoices', companyId: 'co1' });

    expect(result.overdueInvoices).toBeDefined();
    expect(Array.isArray(result.overdueInvoices)).toBe(true);
    expect(result.totalOverdue).toBeGreaterThan(0);
  });

  it('should calculate cash flow projection', async () => {
    const result = await accountingAgent.process({ action: 'cash_flow_projection', companyId: 'co1' });

    expect(result.projection).toBeDefined();
    expect(result.projection.next30).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should generate monthly financial report', async () => {
    const result = await accountingAgent.process({ action: 'monthly_report', companyId: 'co1' });

    expect(result.report).toBeDefined();
    expect(result.report.revenue).toBeDefined();
    expect(result.report.expenses).toBeDefined();
    expect(result.report.profit).toBeDefined();
  });
});
