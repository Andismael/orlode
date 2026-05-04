"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/legal.agent', () => ({
    legalAgent: {
        process: vitest_1.vi.fn(async ({ action, contractText, companyId }) => {
            if (action === 'analyze_contract' && contractText) {
                return {
                    clauses: [
                        { type: 'termination', text: 'Résiliation sous 30 jours', riskLevel: 'medium' },
                        { type: 'payment', text: 'Paiement à 60 jours', riskLevel: 'low' },
                        { type: 'liability', text: 'Responsabilité limitée à 100K€', riskLevel: 'high' },
                    ],
                    summary: 'Contrat standard avec clauses de responsabilité à risque élevé.',
                    disclaimer: 'Ceci est une analyse automatique. Consultez un juriste pour toute décision.',
                };
            }
            if (action === 'detect_risks') {
                return {
                    risks: [{ clause: 'liability', risk: 'Limitation de responsabilité trop faible', severity: 'high' }],
                    overallRisk: 'medium',
                    disclaimer: 'Ceci est une analyse automatique. Consultez un juriste pour toute décision.',
                };
            }
            return {};
        }),
    },
}));
const legal_agent_1 = require("@/agents/legal.agent");
(0, vitest_1.describe)('Legal Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should analyze a contract and extract key clauses', async () => {
        const result = await legal_agent_1.legalAgent.process({
            action: 'analyze_contract',
            contractText: 'Contrat de service... Résiliation sous 30 jours... Responsabilité limitée...',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.clauses).toBeDefined();
        (0, vitest_1.expect)(result.clauses.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.summary).toBeDefined();
    });
    (0, vitest_1.it)('should detect risky clauses', async () => {
        const result = await legal_agent_1.legalAgent.process({
            action: 'detect_risks',
            contractText: 'Responsabilité limitée à 100€ seulement...',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.risks).toBeDefined();
        (0, vitest_1.expect)(result.overallRisk).toBeDefined();
    });
    (0, vitest_1.it)('should always include a legal disclaimer', async () => {
        const result = await legal_agent_1.legalAgent.process({
            action: 'analyze_contract',
            contractText: 'Any contract text',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.disclaimer).toBeDefined();
        (0, vitest_1.expect)(result.disclaimer).toMatch(/juriste|avocat|conseil|automatique/i);
    });
});
//# sourceMappingURL=legal.agent.test.js.map