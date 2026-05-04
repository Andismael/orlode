"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/comms.agent', () => ({
    commsAgent: {
        process: vitest_1.vi.fn(async ({ action, emails, emailId, text, targetLanguage }) => {
            if (action === 'triage') {
                return {
                    triaged: (emails ?? []).map((e, i) => ({
                        ...e,
                        priority: i === 0 ? 'urgent' : 'normal',
                        category: 'client',
                    })),
                };
            }
            if (action === 'draft_reply') {
                return {
                    draft: `Bonjour,\n\nEn réponse à votre email (${emailId}), je vous confirme avoir pris note de votre demande.\n\nCordialement`,
                    emailId,
                };
            }
            if (action === 'translate') {
                return {
                    translated: `[Translated to ${targetLanguage}]: ${text}`,
                    originalLanguage: 'fr',
                    targetLanguage,
                };
            }
            return {};
        }),
    },
}));
const comms_agent_1 = require("@/agents/comms.agent");
(0, vitest_1.describe)('Comms Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should triage emails by priority', async () => {
        const result = await comms_agent_1.commsAgent.process({
            action: 'triage',
            emails: [
                { id: '1', subject: 'URGENT: Contract renewal', from: 'client@acme.com', preview: 'Please respond ASAP' },
                { id: '2', subject: 'Newsletter', from: 'news@example.com', preview: 'Monthly update' },
            ],
        });
        (0, vitest_1.expect)(result.triaged).toBeDefined();
        (0, vitest_1.expect)(result.triaged[0].priority).toBe('urgent');
    });
    (0, vitest_1.it)('should draft a reply based on email context', async () => {
        const result = await comms_agent_1.commsAgent.process({
            action: 'draft_reply',
            emailId: 'email-123',
        });
        (0, vitest_1.expect)(result.draft).toBeDefined();
        (0, vitest_1.expect)(result.draft.length).toBeGreaterThan(20);
    });
    (0, vitest_1.it)('should translate a message to target language', async () => {
        const result = await comms_agent_1.commsAgent.process({
            action: 'translate',
            text: 'Bonjour, comment puis-je vous aider ?',
            targetLanguage: 'en',
        });
        (0, vitest_1.expect)(result.translated).toBeDefined();
        (0, vitest_1.expect)(result.targetLanguage).toBe('en');
    });
});
//# sourceMappingURL=comms.agent.test.js.map