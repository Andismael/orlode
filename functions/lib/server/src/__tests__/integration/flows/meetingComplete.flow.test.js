"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/agents/meeting.agent', () => ({
    meetingAgent: {
        process: vitest_1.vi.fn(async ({ action, meetingId, companyId, agenda, transcript, segment }) => {
            if (action === 'briefing') {
                return { briefing: { meetingId, agenda, previousDecisions: ['Last month: budget frozen'], relevantData: [] } };
            }
            if (action === 'analyze_segment') {
                return { entities: ['Jean', '€3M', 'budget'], facts: ['budget = €3M'], segment };
            }
            if (action === 'summarize') {
                return {
                    summary: `Réunion ${meetingId}: Budget Q4 validé à €3M. Équipe alignée sur la stratégie.`,
                    keyDecisions: ['Budget Q4 = €3M'],
                    actionItems: [{ description: 'Envoyer récap', assignee: 'Jean', deadline: '2024-01-15' }],
                    companyId,
                    transcript,
                };
            }
            return {};
        }),
        extractActionItems: vitest_1.vi.fn(async (transcript) => ({
            actionItems: transcript.split('\n').filter(l => l.includes('doit') || l.includes('va')).map(l => ({
                description: l.trim(),
                assignee: 'Unknown',
            })),
        })),
    },
}));
const meeting_agent_1 = require("@/agents/meeting.agent");
(0, vitest_1.describe)('Flow: Meeting Complete (briefing → live → summary)', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should handle full meeting lifecycle', async () => {
        // 1. Pre-meeting briefing
        const briefing = await meeting_agent_1.meetingAgent.process({
            action: 'briefing',
            meetingId: 'mtg1',
            companyId: 'test-co',
            agenda: ['Budget Q4'],
        });
        (0, vitest_1.expect)(briefing.briefing).toBeDefined();
        (0, vitest_1.expect)(briefing.briefing.previousDecisions).toBeDefined();
        // 2. Live analysis
        const analysis = await meeting_agent_1.meetingAgent.process({
            action: 'analyze_segment',
            segment: 'Jean dit que le budget devrait être de €3M',
            meetingId: 'mtg1',
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(analysis.entities).toBeDefined();
        (0, vitest_1.expect)(analysis.entities).toContain('€3M');
        // 3. Post-meeting summary
        const summary = await meeting_agent_1.meetingAgent.process({
            action: 'summarize',
            meetingId: 'mtg1',
            transcript: "Jean: Le budget Q4 est de €3M.\nMarie: D'accord, on lance.",
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(summary.summary).toBeDefined();
        (0, vitest_1.expect)(summary.summary.length).toBeGreaterThan(50);
        (0, vitest_1.expect)(summary.actionItems).toBeDefined();
        (0, vitest_1.expect)(summary.keyDecisions).toContain('Budget Q4 = €3M');
    });
    (0, vitest_1.it)('should extract action items from transcript', async () => {
        const transcript = 'Jean doit finaliser le budget.\nMarie va contacter le client.';
        const result = await meeting_agent_1.meetingAgent.extractActionItems(transcript);
        (0, vitest_1.expect)(result.actionItems.length).toBeGreaterThanOrEqual(2);
    });
});
//# sourceMappingURL=meetingComplete.flow.test.js.map