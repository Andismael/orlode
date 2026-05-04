import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/marketing.agent', () => ({
  marketingAgent: {
    process: vi.fn(async ({ action, topic, platform, month, postId, companyId }: {
      action: string; topic?: string; platform?: string;
      month?: string; postId?: string; companyId?: string;
    }) => {
      if (action === 'generate_post') {
        return {
          content: `🚀 ${topic || 'Notre entreprise'} — Découvrez nos dernières innovations ! #innovation #business`,
          platform,
          hashtags: ['#innovation', '#business', '#tech'],
          estimatedReach: 1200,
        };
      }
      if (action === 'create_calendar') {
        return {
          calendar: [
            { date: `${month}-01`, platform: 'linkedin', topic: 'Article métier', status: 'planned' },
            { date: `${month}-07`, platform: 'twitter', topic: 'Actualité', status: 'planned' },
          ],
          month,
          companyId,
        };
      }
      if (action === 'analyze_performance' && postId) {
        return {
          postId,
          metrics: { impressions: 4500, engagements: 320, clicks: 85, shares: 12 },
          engagementRate: '7.1%',
          recommendations: ['Publier le mardi matin pour plus de reach'],
        };
      }
      return {};
    }),
  },
}));

import { marketingAgent } from '@/agents/marketing.agent';

describe('Marketing Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should generate a social media post', async () => {
    const result = await marketingAgent.process({
      action: 'generate_post',
      topic: 'Lancement de notre nouveau produit',
      platform: 'linkedin',
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(20);
    expect(result.hashtags).toBeDefined();
  });

  it('should create a content calendar', async () => {
    const result = await marketingAgent.process({
      action: 'create_calendar',
      month: '2024-02',
      companyId: 'co1',
    });

    expect(result.calendar).toBeDefined();
    expect(Array.isArray(result.calendar)).toBe(true);
    expect(result.calendar.length).toBeGreaterThan(0);
  });

  it('should analyze post performance', async () => {
    const result = await marketingAgent.process({
      action: 'analyze_performance',
      postId: 'post-123',
    });

    expect(result.metrics).toBeDefined();
    expect(result.metrics.impressions).toBeGreaterThan(0);
    expect(result.engagementRate).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });
});
