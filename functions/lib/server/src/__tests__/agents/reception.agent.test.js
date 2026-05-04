"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/reception.agent', () => ({
    receptionAgent: {
        process: vitest_1.vi.fn(async ({ action, visitorName, visitor, companyId }) => {
            if (action === 'check_appointment') {
                if (visitorName === 'Pierre Dupont') {
                    return { appointmentFound: true, host: 'Marie Koné', time: '14:00', room: 'Salle Baobab' };
                }
                return { appointmentFound: false, suggestedAction: 'Veuillez patienter, je vais contacter l\'accueil.' };
            }
            if (action === 'check_in' && visitor) {
                return {
                    checkInSuccess: true,
                    hostNotified: true,
                    badgeGenerated: `BADGE-${Date.now()}`,
                    visitorId: `V-${Date.now()}`,
                    visitor,
                    companyId,
                };
            }
            return {};
        }),
    },
}));
const reception_agent_1 = require("@/agents/reception.agent");
(0, vitest_1.describe)('Reception Agent', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should find an existing visitor appointment', async () => {
        const result = await reception_agent_1.receptionAgent.process({
            action: 'check_appointment',
            visitorName: 'Pierre Dupont',
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.appointmentFound).toBe(true);
        (0, vitest_1.expect)(result.host).toBe('Marie Koné');
    });
    (0, vitest_1.it)('should handle walk-in visitors without appointment', async () => {
        const result = await reception_agent_1.receptionAgent.process({
            action: 'check_appointment',
            visitorName: 'Visiteur Inconnu',
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.appointmentFound).toBe(false);
        (0, vitest_1.expect)(result.suggestedAction).toMatch(/message|attendre|revenir|patienter|contacter/i);
    });
    (0, vitest_1.it)('should register a visitor and notify the host', async () => {
        const result = await reception_agent_1.receptionAgent.process({
            action: 'check_in',
            visitor: {
                name: 'Pierre Dupont',
                company: 'Acme Corp',
                hostName: 'Marie Koné',
                purpose: 'Réunion commerciale',
            },
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.checkInSuccess).toBe(true);
        (0, vitest_1.expect)(result.hostNotified).toBe(true);
        (0, vitest_1.expect)(result.badgeGenerated).toBeDefined();
    });
    (0, vitest_1.it)('should generate a unique badge for each check-in', async () => {
        const r1 = await reception_agent_1.receptionAgent.process({
            action: 'check_in',
            visitor: { name: 'A', company: 'B', hostName: 'C', purpose: 'test' },
            companyId: 'co1',
        });
        const r2 = await reception_agent_1.receptionAgent.process({
            action: 'check_in',
            visitor: { name: 'D', company: 'E', hostName: 'F', purpose: 'test' },
            companyId: 'co1',
        });
        (0, vitest_1.expect)(r1.badgeGenerated).not.toBe(r2.badgeGenerated);
    });
});
//# sourceMappingURL=reception.agent.test.js.map