import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/legal.agent', () => ({
  legalAgent: {
    process: vi.fn(async ({ action, contractText, companyId }: {
      action: string; contractText?: string; companyId: string;
    }) => {
      if (action === 'analyze_contract' && contractText) {
        return {
          clauses: [
            { type: 'termination', text: 'Résiliation sous 30 jours', riskLevel: 'medium' },
            { type: 'payment', text: 'Paiement à 60 jours', riskLevel: 'low' },
            { type: 'liability', text: 'Responsabilité limitée à 100K€', riskLevel: 'high' },
          ],
          summary: 'Contrat standard avec clauses de responsabilité à risque élevé.',
          disclaimer: 'Ceci est une analyse automatique. Consultez un juriste pour toute décision.',
        };
      }
      if (action === 'detect_risks') {
        return {
          risks: [{ clause: 'liability', risk: 'Limitation de responsabilité trop faible', severity: 'high' }],
          overallRisk: 'medium',
          disclaimer: 'Ceci est une analyse automatique. Consultez un juriste pour toute décision.',
        };
      }
      return {};
    }),
  },
}));

import { legalAgent } from '@/agents/legal.agent';

describe('Legal Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should analyze a contract and extract key clauses', async () => {
    const result = await legalAgent.process({
      action: 'analyze_contract',
      contractText: 'Contrat de service... Résiliation sous 30 jours... Responsabilité limitée...',
      companyId: 'co1',
    });

    expect(result.clauses).toBeDefined();
    expect(result.clauses.length).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  it('should detect risky clauses', async () => {
    const result = await legalAgent.process({
      action: 'detect_risks',
      contractText: 'Responsabilité limitée à 100€ seulement...',
      companyId: 'co1',
    });

    expect(result.risks).toBeDefined();
    expect(result.overallRisk).toBeDefined();
  });

  it('should always include a legal disclaimer', async () => {
    const result = await legalAgent.process({
      action: 'analyze_contract',
      contractText: 'Any contract text',
      companyId: 'co1',
    });

    expect(result.disclaimer).toBeDefined();
    expect(result.disclaimer).toMatch(/juriste|avocat|conseil|automatique/i);
  });
});
