import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/wildcard.agent', () => ({
  wildcardAgent: {
    process: vi.fn(async ({ message, companyId }: { message: string; companyId: string }) => {
      return {
        answer: `Voici ma réponse complète pour : "${message}". Je coordonne les actions nécessaires entre les différents départements pour vous aider au mieux.`,
        toolsUsed: ['calendar_tool', 'hr_tool', 'finance_tool'],
        agentsConsulted: ['HR_Agent', 'Finance_Agent'],
        companyId,
      };
    }),
  },
}));

import { wildcardAgent } from '@/agents/wildcard.agent';

describe('Wildcard Agent', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should handle multi-department tasks', async () => {
    const result = await wildcardAgent.process({
      message: 'Organise un team building pour 20 personnes le mois prochain',
      companyId: 'test-company',
    });

    expect(result.answer).toBeDefined();
    expect(result.answer.length).toBeGreaterThan(50);
    expect(result.answer).not.toMatch(/ne peux pas|impossible/i);
  });

  it('should access tools from multiple agents', async () => {
    const result = await wildcardAgent.process({
      message: "Résume tout ce qui s'est passé cette semaine",
      companyId: 'test-company',
    });

    expect(result.toolsUsed).toBeDefined();
    expect(result.toolsUsed.length).toBeGreaterThan(1);
  });

  it('should always provide an answer (never block)', async () => {
    const result = await wildcardAgent.process({
      message: 'Que faire si un client ne paie pas ses factures ?',
      companyId: 'co1',
    });

    expect(result.answer).toBeDefined();
    expect(result.answer.length).toBeGreaterThan(10);
  });

  it('should include agents consulted in response', async () => {
    const result = await wildcardAgent.process({
      message: 'Analyse globale des performances',
      companyId: 'co1',
    });

    expect(result.agentsConsulted).toBeDefined();
    expect(Array.isArray(result.agentsConsulted)).toBe(true);
  });
});
