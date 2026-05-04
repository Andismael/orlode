"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/training.agent', () => ({
    trainingAgent: {
        process: vitest_1.vi.fn(async ({ action, content, userId, role, moduleId }) => {
            if (action === 'generate_quiz' && content) {
                return {
                    quizId: `QUIZ-${Date.now()}`,
                    questions: [
                        { text: 'Question 1', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'Explication A' },
                        { text: 'Question 2', options: ['A', 'B', 'C', 'D'], correct: 2 },
                    ],
                    fromContent: content.slice(0, 50),
                };
            }
            if (action === 'track_progress' && userId && moduleId) {
                return { userId, moduleId, completed: true, score: 85, badge: 'completed' };
            }
            if (action === 'recommend_courses' && role) {
                return {
                    courses: [
                        { id: 'c1', title: `Formation ${role} niveau 1`, relevanceScore: 0.92 },
                        { id: 'c2', title: 'Compliance & Sécurité', relevanceScore: 0.85 },
                    ],
                    role,
                };
            }
            return {};
        }),
    },
}));
const training_agent_1 = require("@/agents/training.agent");
(0, vitest_1.describe)('Training Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should generate a quiz from content', async () => {
        const result = await training_agent_1.trainingAgent.process({
            action: 'generate_quiz',
            content: 'Les bonnes pratiques de sécurité informatique incluent: MFA, mots de passe forts, etc.',
        });
        (0, vitest_1.expect)(result.quizId).toBeDefined();
        (0, vitest_1.expect)(result.questions).toBeDefined();
        (0, vitest_1.expect)(result.questions.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.questions[0].options).toHaveLength(4);
    });
    (0, vitest_1.it)('should track learning progress', async () => {
        const result = await training_agent_1.trainingAgent.process({
            action: 'track_progress',
            userId: 'user1',
            moduleId: 'module-cybersec',
        });
        (0, vitest_1.expect)(result.completed).toBe(true);
        (0, vitest_1.expect)(result.score).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.score).toBeLessThanOrEqual(100);
    });
    (0, vitest_1.it)('should recommend courses based on role', async () => {
        const result = await training_agent_1.trainingAgent.process({ action: 'recommend_courses', role: 'manager' });
        (0, vitest_1.expect)(result.courses).toBeDefined();
        (0, vitest_1.expect)(result.courses.length).toBeGreaterThan(0);
        result.courses.forEach((c) => {
            (0, vitest_1.expect)(c.relevanceScore).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=training.agent.test.js.map