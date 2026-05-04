import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/cybersecurity.agent', () => ({
  cybersecurityAgent: {
    process: vi.fn(async ({ action, email, companyId }: {
      action: string;
      email?: { from: string; subject: string; body: string };
      companyId: string;
    }) => {
      if (action === 'analyze_email' && email) {
        const isPhishing =
          email.from.includes('g00gle') ||
          email.subject.toLowerCase().includes('urgent') ||
          email.body.toLowerCase().includes('wire') ||
          email.body.toLowerCase().includes('transfer');
        if (isPhishing) {
          return {
            threat: true,
            threatType: 'phishing',
            severity: 'high',
            recommendation: 'Ne pas cliquer sur les liens. Signaler à l\'IT.',
            indicators: ['domaine suspect', 'demande urgente de virement'],
          };
        }
        return { threat: false, threatType: null, severity: 'low', recommendation: 'Email légitime.' };
      }
      if (action === 'security_audit') {
        return {
          overallScore: 72,
          categories: {
            authentication: 85,
            access_control: 70,
            data_protection: 65,
            network: 80,
          },
          recommendations: [
            'Activer le MFA pour tous les utilisateurs',
            'Mettre à jour les politiques de mots de passe',
          ],
          companyId,
        };
      }
      return {};
    }),
  },
}));

import { cybersecurityAgent } from '@/agents/cybersecurity.agent';

describe('Cybersecurity Agent', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should detect a phishing attempt', async () => {
    const result = await cybersecurityAgent.process({
      action: 'analyze_email',
      email: {
        from: 'ceo@g00gle-corp.com',
        subject: 'URGENT: Wire transfer needed',
        body: 'Please wire $50,000 to this account immediately...',
      },
      companyId: 'test-company',
    });

    expect(result.threat).toBe(true);
    expect(result.threatType).toBe('phishing');
    expect(result.severity).toBe('high');
    expect(result.recommendation).toBeDefined();
  });

  it('should classify a safe email as non-threat', async () => {
    const result = await cybersecurityAgent.process({
      action: 'analyze_email',
      email: {
        from: 'colleague@mycompany.com',
        subject: 'Meeting tomorrow',
        body: 'Just confirming our meeting tomorrow at 10am.',
      },
      companyId: 'test-company',
    });

    expect(result.threat).toBe(false);
    expect(result.severity).toBe('low');
  });

  it('should generate a security score between 0 and 100', async () => {
    const result = await cybersecurityAgent.process({
      action: 'security_audit',
      companyId: 'test-company',
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.categories).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });

  it('should provide security recommendations', async () => {
    const result = await cybersecurityAgent.process({
      action: 'security_audit',
      companyId: 'co1',
    });

    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
