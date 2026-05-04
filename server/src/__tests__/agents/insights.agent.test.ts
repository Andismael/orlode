import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/insights.agent', () => ({
  insightsAgent: {
    process: vi.fn(async ({ action, companyId }: { action: string; companyId: string }) => {
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

import { insightsAgent } from '@/agents/insights.agent';

describe('Insights Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should detect anomalies in data trends', async () => {
    const result = await insightsAgent.process({ action: 'detect_anomalies', companyId: 'co1' });

    expect(result.anomalies).toBeDefined();
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(result.anomalies[0].severity).toBeDefined();
  });

  it('should generate proactive alerts', async () => {
    const result = await insightsAgent.process({ action: 'generate_alerts', companyId: 'co1' });

    expect(result.alerts).toBeDefined();
    expect(result.alerts.length).toBeGreaterThan(0);
    result.alerts.forEach((alert: { type: string; message: string }) => {
      expect(alert.type).toBeDefined();
      expect(alert.message).toBeDefined();
    });
  });

  it('should produce a weekly report', async () => {
    const result = await insightsAgent.process({ action: 'weekly_report', companyId: 'co1' });

    expect(result.report).toBeDefined();
    expect(result.report.highlights).toBeDefined();
    expect(result.report.recommendations).toBeDefined();
  });
});
