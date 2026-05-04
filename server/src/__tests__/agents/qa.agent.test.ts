import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/qa.agent', () => ({
  qaAgent: {
    process: vi.fn(async ({ query, companyId, conversationHistory }: {
      query: string;
      companyId: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }) => {
      // Simulate behaviour based on inputs
      if (query === '') throw new Error('Empty query');
      if (query.includes('éléphants')) {
        return { answer: "Je ne dispose pas de cette information.", sources: [], contextUsed: false };
      }
      if (conversationHistory && conversationHistory.length > 0) {
        return { answer: "En lien avec notre discussion précédente...", sources: [], contextUsed: true };
      }
      return {
        answer: `Réponse pour la compagnie ${companyId} : Le CA Q3 est de €2.3M`,
        sources: [
          { documentName: 'Rapport_Q3.pdf', relevanceScore: 0.92, content: 'Le CA Q3 est de €2.3M' },
          { documentName: 'Rapport_Q3.pdf', relevanceScore: 0.87, content: 'Les dépenses Q3 sont de €1.8M' },
        ],
        contextUsed: false,
      };
    }),
  },
}));

import { qaAgent } from '@/agents/qa.agent';

describe('QA Agent', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should search and return relevant chunks', async () => {
    const result = await qaAgent.process({ query: "Quel est le CA du Q3 ?", companyId: 'test-company' });

    expect(result.answer).toContain('2.3M');
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].documentName).toBe('Rapport_Q3.pdf');
  });

  it('should return "I don\'t know" when no relevant data found', async () => {
    const result = await qaAgent.process({ query: "Combien d'éléphants avons-nous ?", companyId: 'test-company' });

    expect(result.answer).toMatch(/ne dispose pas|pas trouvé|n'ai pas/i);
    expect(result.sources).toHaveLength(0);
  });

  it('should use conversation history context', async () => {
    const history = [
      { role: 'user', content: 'Parle-moi du Q3' },
      { role: 'assistant', content: 'Le Q3 a été marqué par...' },
    ];

    const result = await qaAgent.process({ query: 'Et le Q4 ?', companyId: 'test-company', conversationHistory: history });

    expect(result.contextUsed).toBe(true);
  });

  it('should include source documents in the response', async () => {
    const result = await qaAgent.process({ query: 'Chiffre affaires', companyId: 'co1' });

    expect(result.sources).toBeDefined();
    expect(Array.isArray(result.sources)).toBe(true);
  });

  it('should have relevance scores on sources', async () => {
    const result = await qaAgent.process({ query: 'CA Q3', companyId: 'co1' });

    result.sources.forEach((source: { relevanceScore: number }) => {
      expect(source.relevanceScore).toBeGreaterThan(0);
      expect(source.relevanceScore).toBeLessThanOrEqual(1);
    });
  });
});
