import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/agents/meeting.agent', () => ({
  meetingAgent: {
    process: vi.fn(async ({ action, meetingId, companyId, agenda, transcript, segment }: {
      action: string; meetingId: string; companyId: string;
      agenda?: string[]; transcript?: string; segment?: string;
    }) => {
      if (action === 'briefing') {
        return { briefing: { meetingId, agenda, previousDecisions: ['Last month: budget frozen'], relevantData: [] } };
      }
      if (action === 'analyze_segment') {
        return { entities: ['Jean', '€3M', 'budget'], facts: ['budget = €3M'], segment };
      }
      if (action === 'summarize') {
        return {
          summary: `Réunion ${meetingId}: Budget Q4 validé à €3M. Équipe alignée sur la stratégie.`,
          keyDecisions: ['Budget Q4 = €3M'],
          actionItems: [{ description: 'Envoyer récap', assignee: 'Jean', deadline: '2024-01-15' }],
          companyId,
          transcript,
        };
      }
      return {};
    }),
    extractActionItems: vi.fn(async (transcript: string) => ({
      actionItems: transcript.split('\n').filter(l => l.includes('doit') || l.includes('va')).map(l => ({
        description: l.trim(),
        assignee: 'Unknown',
      })),
    })),
  },
}));

import { meetingAgent } from '@/agents/meeting.agent';

describe('Flow: Meeting Complete (briefing → live → summary)', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should handle full meeting lifecycle', async () => {
    // 1. Pre-meeting briefing
    const briefing = await meetingAgent.process({
      action: 'briefing',
      meetingId: 'mtg1',
      companyId: 'test-co',
      agenda: ['Budget Q4'],
    });

    expect(briefing.briefing).toBeDefined();
    expect(briefing.briefing.previousDecisions).toBeDefined();

    // 2. Live analysis
    const analysis = await meetingAgent.process({
      action: 'analyze_segment',
      segment: 'Jean dit que le budget devrait être de €3M',
      meetingId: 'mtg1',
      companyId: 'test-co',
    });

    expect(analysis.entities).toBeDefined();
    expect(analysis.entities).toContain('€3M');

    // 3. Post-meeting summary
    const summary = await meetingAgent.process({
      action: 'summarize',
      meetingId: 'mtg1',
      transcript: "Jean: Le budget Q4 est de €3M.\nMarie: D'accord, on lance.",
      companyId: 'test-co',
    });

    expect(summary.summary).toBeDefined();
    expect(summary.summary.length).toBeGreaterThan(50);
    expect(summary.actionItems).toBeDefined();
    expect(summary.keyDecisions).toContain('Budget Q4 = €3M');
  });

  it('should extract action items from transcript', async () => {
    const transcript = 'Jean doit finaliser le budget.\nMarie va contacter le client.';
    const result = await meetingAgent.extractActionItems(transcript);

    expect(result.actionItems.length).toBeGreaterThanOrEqual(2);
  });
});
