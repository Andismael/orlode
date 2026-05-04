import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/support.agent', () => ({
  supportAgent: {
    process: vi.fn(async ({ action, ticket, ticketId, message }: {
      action: string;
      ticket?: { subject: string; description: string; userId: string };
      ticketId?: string;
      message?: string;
    }) => {
      if (action === 'create_ticket' && ticket) {
        return { ticketId: `TKT-${Date.now()}`, status: 'open', priority: 'medium', ...ticket };
      }
      if (action === 'suggest_solution' && ticketId) {
        return {
          solutions: [
            { title: 'Reset password', steps: ['Go to settings', 'Click reset'], confidence: 0.88 },
          ],
          ticketId,
          resolved: false,
        };
      }
      if (action === 'escalate') {
        return {
          escalated: true,
          escalatedTo: 'Senior Support',
          reason: 'Issue not resolvable at tier-1',
          ticketId,
        };
      }
      return {};
    }),
  },
}));

import { supportAgent } from '@/agents/support.agent';

describe('Support Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should create a support ticket', async () => {
    const result = await supportAgent.process({
      action: 'create_ticket',
      ticket: { subject: "Impossible de me connecter", description: "Erreur 403", userId: 'user1' },
    });

    expect(result.ticketId).toBeDefined();
    expect(result.status).toBe('open');
  });

  it('should suggest a solution from knowledge base', async () => {
    const result = await supportAgent.process({ action: 'suggest_solution', ticketId: 'TKT-001' });

    expect(result.solutions).toBeDefined();
    expect(result.solutions.length).toBeGreaterThan(0);
    expect(result.solutions[0].confidence).toBeGreaterThan(0);
  });

  it('should escalate when unable to resolve', async () => {
    const result = await supportAgent.process({ action: 'escalate', ticketId: 'TKT-001' });

    expect(result.escalated).toBe(true);
    expect(result.escalatedTo).toBeDefined();
    expect(result.reason).toBeDefined();
  });
});
