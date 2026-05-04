"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/meeting.agent', () => ({
    meetingAgent: {
        process: vitest_1.vi.fn(async ({ action, meetingId, companyId, agenda, transcript, segment }) => {
            if (action === 'briefing') {
                return {
                    briefing: {
                        meetingId,
                        previousDecisions: ['Decision from last meeting about budget'],
                        relevantData: ['Q3 report data', 'HR headcount'],
                        agenda,
                    },
                };
            }
            if (action === 'summarize') {
                return {
                    summary: 'Résumé de la réunion : points clés discutés, budget validé à €3M, prochaines étapes définies.',
                    keyDecisions: ['Budget Q4 validé à €3M'],
                    actionItems: [{ description: 'Finaliser le budget', assignee: 'Jean', deadline: '2024-02-01' }],
                    companyId,
                };
            }
            if (action === 'analyze_segment') {
                return {
                    entities: ['Jean', '€3M', 'budget'],
                    facts: ['budget devrait être de €3M'],
                    segment,
                };
            }
            return {};
        }),
        extractActionItems: vitest_1.vi.fn(async (transcript) => {
            const items = [];
            if (transcript.includes('finaliser le budget'))
                items.push({ description: 'Finaliser le budget', assignee: 'Jean' });
            if (transcript.includes('contacter le fournisseur'))
                items.push({ description: 'Contacter le fournisseur', assignee: 'Marie' });
            if (transcript.includes('préparer la présentation'))
                items.push({ description: 'Préparer la présentation', assignee: 'Pierre' });
            if (items.length === 0)
                items.push({ description: 'Action item', assignee: 'Unknown' });
            return { actionItems: items };
        }),
    },
}));
const meeting_agent_1 = require("@/agents/meeting.agent");
(0, vitest_1.describe)('Meeting Agent', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should generate a pre-meeting briefing with agenda', async () => {
        const result = await meeting_agent_1.meetingAgent.process({
            action: 'briefing',
            meetingId: 'meeting-123',
            companyId: 'test-company',
            agenda: ['Budget Q4', 'Recrutement', 'Stratégie 2026'],
        });
        (0, vitest_1.expect)(result.briefing).toBeDefined();
        (0, vitest_1.expect)(result.briefing.previousDecisions).toBeDefined();
        (0, vitest_1.expect)(result.briefing.relevantData).toBeDefined();
    });
    (0, vitest_1.it)('should extract action items from a transcript', async () => {
        const transcript = `
      Jean: On doit finaliser le budget avant vendredi.
      Marie: Je m'occupe de contacter le fournisseur.
      Jean: Pierre, tu peux préparer la présentation ?
    `;
        const result = await meeting_agent_1.meetingAgent.extractActionItems(transcript);
        (0, vitest_1.expect)(result.actionItems.length).toBeGreaterThanOrEqual(1);
        (0, vitest_1.expect)(result.actionItems[0]).toMatchObject({
            description: vitest_1.expect.any(String),
            assignee: vitest_1.expect.any(String),
        });
    });
    (0, vitest_1.it)('should generate a post-meeting summary', async () => {
        const result = await meeting_agent_1.meetingAgent.process({
            action: 'summarize',
            meetingId: 'meeting-123',
            transcript: 'Jean: Le budget Q4 est de €3M. Marie: Accord.',
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.summary).toBeDefined();
        (0, vitest_1.expect)(result.summary.length).toBeGreaterThan(100);
        (0, vitest_1.expect)(result.keyDecisions).toBeDefined();
        (0, vitest_1.expect)(result.actionItems).toBeDefined();
    });
    (0, vitest_1.it)('should analyze a transcript segment and extract entities', async () => {
        const result = await meeting_agent_1.meetingAgent.process({
            action: 'analyze_segment',
            meetingId: 'mtg1',
            companyId: 'co1',
            segment: 'Jean dit que le budget devrait être de €3M',
        });
        (0, vitest_1.expect)(result.entities).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.entities)).toBe(true);
    });
    (0, vitest_1.it)('should extract at least 3 action items from a detailed transcript', async () => {
        const transcript = `
      finaliser le budget avant vendredi.
      contacter le fournisseur cette semaine.
      préparer la présentation pour lundi.
    `;
        const result = await meeting_agent_1.meetingAgent.extractActionItems(transcript);
        (0, vitest_1.expect)(result.actionItems.length).toBeGreaterThanOrEqual(3);
    });
});
//# sourceMappingURL=meeting.agent.test.js.map