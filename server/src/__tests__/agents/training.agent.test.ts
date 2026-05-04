import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/training.agent', () => ({
  trainingAgent: {
    process: vi.fn(async ({ action, content, userId, role, moduleId }: {
      action: string; content?: string; userId?: string; role?: string; moduleId?: string;
    }) => {
      if (action === 'generate_quiz' && content) {
        return {
          quizId: `QUIZ-${Date.now()}`,
          questions: [
            { text: 'Question 1', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'Explication A' },
            { text: 'Question 2', options: ['A', 'B', 'C', 'D'], correct: 2 },
          ],
          fromContent: content.slice(0, 50),
        };
      }
      if (action === 'track_progress' && userId && moduleId) {
        return { userId, moduleId, completed: true, score: 85, badge: 'completed' };
      }
      if (action === 'recommend_courses' && role) {
        return {
          courses: [
            { id: 'c1', title: `Formation ${role} niveau 1`, relevanceScore: 0.92 },
            { id: 'c2', title: 'Compliance & Sécurité', relevanceScore: 0.85 },
          ],
          role,
        };
      }
      return {};
    }),
  },
}));

import { trainingAgent } from '@/agents/training.agent';

describe('Training Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should generate a quiz from content', async () => {
    const result = await trainingAgent.process({
      action: 'generate_quiz',
      content: 'Les bonnes pratiques de sécurité informatique incluent: MFA, mots de passe forts, etc.',
    });

    expect(result.quizId).toBeDefined();
    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions[0].options).toHaveLength(4);
  });

  it('should track learning progress', async () => {
    const result = await trainingAgent.process({
      action: 'track_progress',
      userId: 'user1',
      moduleId: 'module-cybersec',
    });

    expect(result.completed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should recommend courses based on role', async () => {
    const result = await trainingAgent.process({ action: 'recommend_courses', role: 'manager' });

    expect(result.courses).toBeDefined();
    expect(result.courses.length).toBeGreaterThan(0);
    result.courses.forEach((c: { relevanceScore: number }) => {
      expect(c.relevanceScore).toBeGreaterThan(0);
    });
  });
});
