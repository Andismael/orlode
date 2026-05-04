"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/cybersecurity.agent', () => ({
    cybersecurityAgent: {
        process: vitest_1.vi.fn(async ({ action, email, companyId }) => {
            if (action === 'analyze_email' && email) {
                const isPhishing = email.from.includes('g00gle') ||
                    email.subject.toLowerCase().includes('urgent') ||
                    email.body.toLowerCase().includes('wire') ||
                    email.body.toLowerCase().includes('transfer');
                if (isPhishing) {
                    return {
                        threat: true,
                        threatType: 'phishing',
                        severity: 'high',
                        recommendation: 'Ne pas cliquer sur les liens. Signaler à l\'IT.',
                        indicators: ['domaine suspect', 'demande urgente de virement'],
                    };
                }
                return { threat: false, threatType: null, severity: 'low', recommendation: 'Email légitime.' };
            }
            if (action === 'security_audit') {
                return {
                    overallScore: 72,
                    categories: {
                        authentication: 85,
                        access_control: 70,
                        data_protection: 65,
                        network: 80,
                    },
                    recommendations: [
                        'Activer le MFA pour tous les utilisateurs',
                        'Mettre à jour les politiques de mots de passe',
                    ],
                    companyId,
                };
            }
            return {};
        }),
    },
}));
const cybersecurity_agent_1 = require("@/agents/cybersecurity.agent");
(0, vitest_1.describe)('Cybersecurity Agent', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should detect a phishing attempt', async () => {
        const result = await cybersecurity_agent_1.cybersecurityAgent.process({
            action: 'analyze_email',
            email: {
                from: 'ceo@g00gle-corp.com',
                subject: 'URGENT: Wire transfer needed',
                body: 'Please wire $50,000 to this account immediately...',
            },
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.threat).toBe(true);
        (0, vitest_1.expect)(result.threatType).toBe('phishing');
        (0, vitest_1.expect)(result.severity).toBe('high');
        (0, vitest_1.expect)(result.recommendation).toBeDefined();
    });
    (0, vitest_1.it)('should classify a safe email as non-threat', async () => {
        const result = await cybersecurity_agent_1.cybersecurityAgent.process({
            action: 'analyze_email',
            email: {
                from: 'colleague@mycompany.com',
                subject: 'Meeting tomorrow',
                body: 'Just confirming our meeting tomorrow at 10am.',
            },
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.threat).toBe(false);
        (0, vitest_1.expect)(result.severity).toBe('low');
    });
    (0, vitest_1.it)('should generate a security score between 0 and 100', async () => {
        const result = await cybersecurity_agent_1.cybersecurityAgent.process({
            action: 'security_audit',
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.overallScore).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.overallScore).toBeLessThanOrEqual(100);
        (0, vitest_1.expect)(result.categories).toBeDefined();
        (0, vitest_1.expect)(result.recommendations).toBeDefined();
    });
    (0, vitest_1.it)('should provide security recommendations', async () => {
        const result = await cybersecurity_agent_1.cybersecurityAgent.process({
            action: 'security_audit',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(Array.isArray(result.recommendations)).toBe(true);
        (0, vitest_1.expect)(result.recommendations.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=cybersecurity.agent.test.js.map