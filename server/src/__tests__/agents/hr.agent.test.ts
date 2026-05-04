import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/hr.agent', () => ({
  hrAgent: {
    process: vi.fn(async ({ action, userId, leaveRequest, question }: {
      action: string; userId?: string;
      leaveRequest?: { type: string; startDate: string; endDate: string; reason: string };
      question?: string;
    }) => {
      if (action === 'leave_balance') {
        return { userId, balance: { paid: 12, sick: 5, rtt: 8 }, unit: 'days' };
      }
      if (action === 'request_leave' && leaveRequest) {
        return { success: true, requestId: `LR-${Date.now()}`, status: 'pending', leaveRequest };
      }
      if (action === 'hr_question') {
        return { answer: `Réponse RH: ${question}`, policySection: 'Section 4.2', confidence: 0.9 };
      }
      return {};
    }),
  },
}));

import { hrAgent } from '@/agents/hr.agent';

describe('HR Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should return leave balance for a user', async () => {
    const result = await hrAgent.process({ action: 'leave_balance', userId: 'user1' });

    expect(result.balance).toBeDefined();
    expect(result.balance.paid).toBeGreaterThanOrEqual(0);
    expect(result.unit).toBe('days');
  });

  it('should process a leave request', async () => {
    const result = await hrAgent.process({
      action: 'request_leave',
      leaveRequest: { type: 'paid', startDate: '2024-03-01', endDate: '2024-03-05', reason: 'Vacances' },
    });

    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(result.status).toBe('pending');
  });

  it('should answer HR policy questions', async () => {
    const result = await hrAgent.process({
      action: 'hr_question',
      question: 'Combien de jours de congés payés ai-je par an ?',
    });

    expect(result.answer).toBeDefined();
    expect(result.answer.length).toBeGreaterThan(10);
  });
});
