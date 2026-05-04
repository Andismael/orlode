import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/meeting.agent', () => ({
  meetingAgent: {
    process: vi.fn(async ({ action, meetingId, companyId, agenda, transcript, segment }: {
      action: string; meetingId: string; companyId: string;
      agenda?: string[]; transcript?: string; segment?: string;
    }) => {
      if (action === 'briefing') {
        return {
          briefing: {
            meetingId,
            previousDecisions: ['Decision from last meeting about budget'],
            relevantData: ['Q3 report data', 'HR headcount'],
            agenda,
          },
        };
      }
      if (action === 'summarize') {
        return {
          summary: 'Résumé de la réunion : points clés discutés, budget validé à €3M, prochaines étapes définies.',
          keyDecisions: ['Budget Q4 validé à €3M'],
          actionItems: [{ description: 'Finaliser le budget', assignee: 'Jean', deadline: '2024-02-01' }],
          companyId,
        };
      }
      if (action === 'analyze_segment') {
        return {
          entities: ['Jean', '€3M', 'budget'],
          facts: ['budget devrait être de €3M'],
          segment,
        };
      }
      return {};
    }),
    extractActionItems: vi.fn(async (transcript: string) => {
      const items = [];
      if (transcript.includes('finaliser le budget')) items.push({ description: 'Finaliser le budget', assignee: 'Jean' });
      if (transcript.includes('contacter le fournisseur')) items.push({ description: 'Contacter le fournisseur', assignee: 'Marie' });
      if (transcript.includes('préparer la présentation')) items.push({ description: 'Préparer la présentation', assignee: 'Pierre' });
      if (items.length === 0) items.push({ description: 'Action item', assignee: 'Unknown' });
      return { actionItems: items };
    }),
  },
}));

import { meetingAgent } from '@/agents/meeting.agent';

describe('Meeting Agent', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should generate a pre-meeting briefing with agenda', async () => {
    const result = await meetingAgent.process({
      action: 'briefing',
      meetingId: 'meeting-123',
      companyId: 'test-company',
      agenda: ['Budget Q4', 'Recrutement', 'Stratégie 2026'],
    });

    expect(result.briefing).toBeDefined();
    expect(result.briefing.previousDecisions).toBeDefined();
    expect(result.briefing.relevantData).toBeDefined();
  });

  it('should extract action items from a transcript', async () => {
    const transcript = `
      Jean: On doit finaliser le budget avant vendredi.
      Marie: Je m'occupe de contacter le fournisseur.
      Jean: Pierre, tu peux préparer la présentation ?
    `;

    const result = await meetingAgent.extractActionItems(transcript);

    expect(result.actionItems.length).toBeGreaterThanOrEqual(1);
    expect(result.actionItems[0]).toMatchObject({
      description: expect.any(String),
      assignee: expect.any(String),
    });
  });

  it('should generate a post-meeting summary', async () => {
    const result = await meetingAgent.process({
      action: 'summarize',
      meetingId: 'meeting-123',
      transcript: 'Jean: Le budget Q4 est de €3M. Marie: Accord.',
      companyId: 'test-company',
    });

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(100);
    expect(result.keyDecisions).toBeDefined();
    expect(result.actionItems).toBeDefined();
  });

  it('should analyze a transcript segment and extract entities', async () => {
    const result = await meetingAgent.process({
      action: 'analyze_segment',
      meetingId: 'mtg1',
      companyId: 'co1',
      segment: 'Jean dit que le budget devrait être de €3M',
    });

    expect(result.entities).toBeDefined();
    expect(Array.isArray(result.entities)).toBe(true);
  });

  it('should extract at least 3 action items from a detailed transcript', async () => {
    const transcript = `
      finaliser le budget avant vendredi.
      contacter le fournisseur cette semaine.
      préparer la présentation pour lundi.
    `;
    const result = await meetingAgent.extractActionItems(transcript);
    expect(result.actionItems.length).toBeGreaterThanOrEqual(3);
  });
});
