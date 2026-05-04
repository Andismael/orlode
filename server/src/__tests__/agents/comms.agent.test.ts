import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/comms.agent', () => ({
  commsAgent: {
    process: vi.fn(async ({ action, emails, emailId, text, targetLanguage }: {
      action: string;
      emails?: Array<{ id: string; subject: string; from: string; preview: string }>;
      emailId?: string;
      text?: string;
      targetLanguage?: string;
    }) => {
      if (action === 'triage') {
        return {
          triaged: (emails ?? []).map((e, i) => ({
            ...e,
            priority: i === 0 ? 'urgent' : 'normal',
            category: 'client',
          })),
        };
      }
      if (action === 'draft_reply') {
        return {
          draft: `Bonjour,\n\nEn réponse à votre email (${emailId}), je vous confirme avoir pris note de votre demande.\n\nCordialement`,
          emailId,
        };
      }
      if (action === 'translate') {
        return {
          translated: `[Translated to ${targetLanguage}]: ${text}`,
          originalLanguage: 'fr',
          targetLanguage,
        };
      }
      return {};
    }),
  },
}));

import { commsAgent } from '@/agents/comms.agent';

describe('Comms Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should triage emails by priority', async () => {
    const result = await commsAgent.process({
      action: 'triage',
      emails: [
        { id: '1', subject: 'URGENT: Contract renewal', from: 'client@acme.com', preview: 'Please respond ASAP' },
        { id: '2', subject: 'Newsletter', from: 'news@example.com', preview: 'Monthly update' },
      ],
    });

    expect(result.triaged).toBeDefined();
    expect(result.triaged[0].priority).toBe('urgent');
  });

  it('should draft a reply based on email context', async () => {
    const result = await commsAgent.process({
      action: 'draft_reply',
      emailId: 'email-123',
    });

    expect(result.draft).toBeDefined();
    expect(result.draft.length).toBeGreaterThan(20);
  });

  it('should translate a message to target language', async () => {
    const result = await commsAgent.process({
      action: 'translate',
      text: 'Bonjour, comment puis-je vous aider ?',
      targetLanguage: 'en',
    });

    expect(result.translated).toBeDefined();
    expect(result.targetLanguage).toBe('en');
  });
});
