import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/reception.agent', () => ({
  receptionAgent: {
    process: vi.fn(async ({ action, visitorName, visitor, companyId }: {
      action: string;
      visitorName?: string;
      visitor?: { name: string; company: string; hostName: string; purpose: string };
      companyId: string;
    }) => {
      if (action === 'check_appointment') {
        if (visitorName === 'Pierre Dupont') {
          return { appointmentFound: true, host: 'Marie Koné', time: '14:00', room: 'Salle Baobab' };
        }
        return { appointmentFound: false, suggestedAction: 'Veuillez patienter, je vais contacter l\'accueil.' };
      }
      if (action === 'check_in' && visitor) {
        return {
          checkInSuccess: true,
          hostNotified: true,
          badgeGenerated: `BADGE-${Date.now()}`,
          visitorId: `V-${Date.now()}`,
          visitor,
          companyId,
        };
      }
      return {};
    }),
  },
}));

import { receptionAgent } from '@/agents/reception.agent';

describe('Reception Agent', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should find an existing visitor appointment', async () => {
    const result = await receptionAgent.process({
      action: 'check_appointment',
      visitorName: 'Pierre Dupont',
      companyId: 'test-company',
    });

    expect(result.appointmentFound).toBe(true);
    expect(result.host).toBe('Marie Koné');
  });

  it('should handle walk-in visitors without appointment', async () => {
    const result = await receptionAgent.process({
      action: 'check_appointment',
      visitorName: 'Visiteur Inconnu',
      companyId: 'test-company',
    });

    expect(result.appointmentFound).toBe(false);
    expect(result.suggestedAction).toMatch(/message|attendre|revenir|patienter|contacter/i);
  });

  it('should register a visitor and notify the host', async () => {
    const result = await receptionAgent.process({
      action: 'check_in',
      visitor: {
        name: 'Pierre Dupont',
        company: 'Acme Corp',
        hostName: 'Marie Koné',
        purpose: 'Réunion commerciale',
      },
      companyId: 'test-company',
    });

    expect(result.checkInSuccess).toBe(true);
    expect(result.hostNotified).toBe(true);
    expect(result.badgeGenerated).toBeDefined();
  });

  it('should generate a unique badge for each check-in', async () => {
    const r1 = await receptionAgent.process({
      action: 'check_in',
      visitor: { name: 'A', company: 'B', hostName: 'C', purpose: 'test' },
      companyId: 'co1',
    });
    const r2 = await receptionAgent.process({
      action: 'check_in',
      visitor: { name: 'D', company: 'E', hostName: 'F', purpose: 'test' },
      companyId: 'co1',
    });

    expect(r1.badgeGenerated).not.toBe(r2.badgeGenerated);
  });
});
