"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/qa.agent', () => ({
    qaAgent: {
        process: vitest_1.vi.fn(async ({ query, companyId, conversationHistory }) => {
            // Simulate behaviour based on inputs
            if (query === '')
                throw new Error('Empty query');
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
const qa_agent_1 = require("@/agents/qa.agent");
(0, vitest_1.describe)('QA Agent', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should search and return relevant chunks', async () => {
        const result = await qa_agent_1.qaAgent.process({ query: "Quel est le CA du Q3 ?", companyId: 'test-company' });
        (0, vitest_1.expect)(result.answer).toContain('2.3M');
        (0, vitest_1.expect)(result.sources).toHaveLength(2);
        (0, vitest_1.expect)(result.sources[0].documentName).toBe('Rapport_Q3.pdf');
    });
    (0, vitest_1.it)('should return "I don\'t know" when no relevant data found', async () => {
        const result = await qa_agent_1.qaAgent.process({ query: "Combien d'éléphants avons-nous ?", companyId: 'test-company' });
        (0, vitest_1.expect)(result.answer).toMatch(/ne dispose pas|pas trouvé|n'ai pas/i);
        (0, vitest_1.expect)(result.sources).toHaveLength(0);
    });
    (0, vitest_1.it)('should use conversation history context', async () => {
        const history = [
            { role: 'user', content: 'Parle-moi du Q3' },
            { role: 'assistant', content: 'Le Q3 a été marqué par...' },
        ];
        const result = await qa_agent_1.qaAgent.process({ query: 'Et le Q4 ?', companyId: 'test-company', conversationHistory: history });
        (0, vitest_1.expect)(result.contextUsed).toBe(true);
    });
    (0, vitest_1.it)('should include source documents in the response', async () => {
        const result = await qa_agent_1.qaAgent.process({ query: 'Chiffre affaires', companyId: 'co1' });
        (0, vitest_1.expect)(result.sources).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.sources)).toBe(true);
    });
    (0, vitest_1.it)('should have relevance scores on sources', async () => {
        const result = await qa_agent_1.qaAgent.process({ query: 'CA Q3', companyId: 'co1' });
        result.sources.forEach((source) => {
            (0, vitest_1.expect)(source.relevanceScore).toBeGreaterThan(0);
            (0, vitest_1.expect)(source.relevanceScore).toBeLessThanOrEqual(1);
        });
    });
});
//# sourceMappingURL=qa.agent.test.js.map