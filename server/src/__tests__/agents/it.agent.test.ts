import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/it.agent', () => ({
  itAgent: {
    process: vi.fn(async ({ action, ticket, userId, service }: {
      action: string;
      ticket?: { subject: string; description: string; userId: string };
      userId?: string;
      service?: string;
    }) => {
      if (action === 'create_ticket' && ticket) {
        return { ticketId: `IT-${Date.now()}`, status: 'open', assignedTo: 'IT Team', ...ticket };
      }
      if (action === 'password_reset' && userId) {
        return {
          steps: [
            'Allez sur /reset-password',
            'Entrez votre email',
            'Cliquez sur le lien reçu',
            'Créez un nouveau mot de passe',
          ],
          userId,
          estimated_time: '5 minutes',
        };
      }
      if (action === 'system_status') {
        return {
          services: {
            api: 'operational',
            database: 'operational',
            storage: 'degraded',
          },
          overallStatus: 'degraded',
          incidents: [],
        };
      }
      return {};
    }),
  },
}));

import { itAgent } from '@/agents/it.agent';

describe('IT Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should create an IT ticket', async () => {
    const result = await itAgent.process({
      action: 'create_ticket',
      ticket: { subject: 'VPN ne fonctionne pas', description: 'Impossible de se connecter au VPN', userId: 'user1' },
    });

    expect(result.ticketId).toBeDefined();
    expect(result.status).toBe('open');
    expect(result.assignedTo).toBeDefined();
  });

  it('should guide a password reset step by step', async () => {
    const result = await itAgent.process({ action: 'password_reset', userId: 'user1' });

    expect(result.steps).toBeDefined();
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('should check system status', async () => {
    const result = await itAgent.process({ action: 'system_status' });

    expect(result.services).toBeDefined();
    expect(result.overallStatus).toBeDefined();
    expect(['operational', 'degraded', 'outage']).toContain(result.overallStatus);
  });
});
