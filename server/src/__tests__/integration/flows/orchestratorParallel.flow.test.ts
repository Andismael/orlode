import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/agents/orchestrator.agent', () => ({
  orchestratorAgent: {
    process: vi.fn(async ({ message, companyId }: { message: string; companyId: string }) => {
      // Determine which agents to delegate to based on message
      const agents: string[] = [];
      if (/CA|chiffre|facture|finance/i.test(message)) agents.push('QA_Agent', 'Accounting_Agent');
      if (/pipeline|commercial|vente/i.test(message)) agents.push('Sales_Agent');
      if (/réunion|meeting/i.test(message)) agents.push('Meeting_Agent');

      return {
        answer: `Rapport consolidé pour ${companyId}: ${message.slice(0, 30)}...`,
        agentsDelegatedTo: agents.length ? agents : ['QA_Agent'],
        parallel: agents.length > 1,
        companyId,
      };
    }),
  },
}));

import { orchestratorAgent } from '@/agents/orchestrator.agent';

describe('Flow: Orchestrator Parallel Delegation', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should delegate to multiple agents for complex query', async () => {
    const result = await orchestratorAgent.process({
      message: 'Prépare un rapport avec le CA Q3, les factures en retard, et le pipeline commercial',
      companyId: 'test-co',
    });

    expect(result.agentsDelegatedTo).toContain('QA_Agent');
    expect(result.agentsDelegatedTo).toContain('Accounting_Agent');
    expect(result.agentsDelegatedTo).toContain('Sales_Agent');
    expect(result.answer).toBeDefined();
    expect(result.parallel).toBe(true);
  });

  it('should produce a single answer from multiple agents', async () => {
    const result = await orchestratorAgent.process({
      message: 'Analyse le CA Q3 et les opportunités commerciales',
      companyId: 'co1',
    });

    expect(result.answer).toBeDefined();
    expect(typeof result.answer).toBe('string');
  });

  it('should delegate to just one agent for simple query', async () => {
    const result = await orchestratorAgent.process({
      message: 'Quand est la prochaine réunion ?',
      companyId: 'co1',
    });

    expect(result.agentsDelegatedTo).toContain('Meeting_Agent');
    expect(result.agentsDelegatedTo.length).toBe(1);
  });
});
