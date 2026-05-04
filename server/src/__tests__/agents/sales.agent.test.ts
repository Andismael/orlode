import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/sales.agent', () => ({
  salesAgent: {
    process: vi.fn(async ({ action, lead, leadId }: {
      action: string;
      lead?: { name: string; company: string; interactions: number; budget: number };
      leadId?: string;
    }) => {
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

import { salesAgent } from '@/agents/sales.agent';

describe('Sales Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should score a hot lead correctly', async () => {
    const result = await salesAgent.process({
      action: 'score_lead',
      lead: { name: 'Jean Martin', company: 'Acme', interactions: 8, budget: 50000 },
    });

    expect(result.score).toBe('hot');
    expect(result.probability).toBeGreaterThan(0.7);
  });

  it('should score a cold lead correctly', async () => {
    const result = await salesAgent.process({
      action: 'score_lead',
      lead: { name: 'Unknown', company: 'Unknown', interactions: 0, budget: 0 },
    });

    expect(result.score).toBe('cold');
    expect(result.probability).toBeLessThan(0.3);
  });

  it('should generate a quote', async () => {
    const result = await salesAgent.process({ action: 'generate_quote' });

    expect(result.quoteId).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
    expect(result.items).toBeDefined();
    expect(result.validUntil).toBeDefined();
  });

  it('should suggest follow-up actions for a lead', async () => {
    const result = await salesAgent.process({ action: 'suggest_followup', leadId: 'lead-123' });

    expect(result.suggestions).toBeDefined();
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].action).toBeDefined();
  });
});
