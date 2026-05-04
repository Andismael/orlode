"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/marketing.agent', () => ({
    marketingAgent: {
        process: vitest_1.vi.fn(async ({ action, topic, platform, month, postId, companyId }) => {
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
const marketing_agent_1 = require("@/agents/marketing.agent");
(0, vitest_1.describe)('Marketing Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should generate a social media post', async () => {
        const result = await marketing_agent_1.marketingAgent.process({
            action: 'generate_post',
            topic: 'Lancement de notre nouveau produit',
            platform: 'linkedin',
        });
        (0, vitest_1.expect)(result.content).toBeDefined();
        (0, vitest_1.expect)(result.content.length).toBeGreaterThan(20);
        (0, vitest_1.expect)(result.hashtags).toBeDefined();
    });
    (0, vitest_1.it)('should create a content calendar', async () => {
        const result = await marketing_agent_1.marketingAgent.process({
            action: 'create_calendar',
            month: '2024-02',
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.calendar).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.calendar)).toBe(true);
        (0, vitest_1.expect)(result.calendar.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should analyze post performance', async () => {
        const result = await marketing_agent_1.marketingAgent.process({
            action: 'analyze_performance',
            postId: 'post-123',
        });
        (0, vitest_1.expect)(result.metrics).toBeDefined();
        (0, vitest_1.expect)(result.metrics.impressions).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.engagementRate).toBeDefined();
        (0, vitest_1.expect)(result.recommendations).toBeDefined();
    });
});
//# sourceMappingURL=marketing.agent.test.js.map