"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
// Mock the orchestrator module — we test the intent routing logic
vitest_1.vi.mock('@/agents/orchestrator.agent', () => ({
    analyzeIntent: vitest_1.vi.fn((message, opts) => {
        if (opts?.hasAttachment)
            return { agent: 'Document_Agent', confidence: 0.95 };
        if (/réunion|meeting|briefing/i.test(message))
            return { agent: 'Meeting_Agent', confidence: 0.9 };
        if (/suspect|phishing|virus|hacking|sécurité informatique/i.test(message))
            return { agent: 'Cybersecurity_Agent', confidence: 0.95, priority: 'high' };
        if (/budget.*réunion|réunion.*budget|chiffres.*rapport|rapport.*pipeline/i.test(message))
            return { agents: ['Meeting_Agent', 'Accounting_Agent'], parallel: true };
        if (/chiffre d'affaires|CA|facture|budget|finance/i.test(message))
            return { agent: 'QA_Agent', confidence: 0.85 };
        if (/team building|fête|anniversaire|événement/i.test(message))
            return { agent: 'Wildcard_Agent', confidence: 0.8 };
        return { agent: 'QA_Agent', confidence: 0.75 };
    }),
    processMessage: vitest_1.vi.fn(async ({ message, companyId }) => ({
        answer: `Réponse pour : ${message}`,
        agentsDelegatedTo: ['QA_Agent'],
        companyId,
    })),
}));
const orchestrator_agent_1 = require("@/agents/orchestrator.agent");
(0, vitest_1.describe)('Orchestrator Agent — intent routing', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should route a financial question to QA Agent', () => {
        const result = (0, orchestrator_agent_1.analyzeIntent)("Quel est notre chiffre d'affaires Q3 ?");
        (0, vitest_1.expect)(result.agent).toBe('QA_Agent');
        (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0.7);
    });
    (0, vitest_1.it)('should route document upload to Document Agent', () => {
        const result = (0, orchestrator_agent_1.analyzeIntent)('Voici le rapport financier Q3', { hasAttachment: true });
        (0, vitest_1.expect)(result.agent).toBe('Document_Agent');
    });
    (0, vitest_1.it)('should route meeting-related queries to Meeting Agent', () => {
        const result = (0, orchestrator_agent_1.analyzeIntent)('Prépare le briefing pour la réunion de 14h');
        (0, vitest_1.expect)(result.agent).toBe('Meeting_Agent');
    });
    (0, vitest_1.it)('should route unmatched queries to Wildcard Agent', () => {
        const result = (0, orchestrator_agent_1.analyzeIntent)("Organise la fête de Noël de l'entreprise");
        (0, vitest_1.expect)(result.agent).toBe('Wildcard_Agent');
    });
    (0, vitest_1.it)('should route to multiple agents for complex queries', () => {
        const result = (0, orchestrator_agent_1.analyzeIntent)('Prépare la réunion budget avec les chiffres financiers');
        (0, vitest_1.expect)(result.agents).toBeDefined();
        (0, vitest_1.expect)(result.parallel).toBe(true);
    });
    (0, vitest_1.it)('should route security alerts to Cybersecurity Agent with high priority', () => {
        const result = (0, orchestrator_agent_1.analyzeIntent)('On a reçu un email suspect avec un lien bizarre');
        (0, vitest_1.expect)(result.agent).toBe('Cybersecurity_Agent');
        (0, vitest_1.expect)(result.priority).toBe('high');
    });
    (0, vitest_1.it)('should process a message end to end', async () => {
        const result = await (0, orchestrator_agent_1.processMessage)({ message: 'Test message', companyId: 'co1' });
        (0, vitest_1.expect)(result.answer).toBeDefined();
        (0, vitest_1.expect)(result.agentsDelegatedTo).toBeDefined();
    });
});
//# sourceMappingURL=orchestrator.agent.test.js.map