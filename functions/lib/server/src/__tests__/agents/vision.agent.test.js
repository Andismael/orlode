"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/vision.agent', () => ({
    visionAgent: {
        process: vitest_1.vi.fn(async ({ action, imageBuffer, companyId }) => {
            if (action === 'detect_faces') {
                return { facesDetected: 2, faces: [{ boundingBox: [10, 10, 100, 100] }, { boundingBox: [200, 10, 100, 100] }] };
            }
            if (action === 'recognize') {
                const mockMatch = imageBuffer && imageBuffer.toString().includes('known');
                return mockMatch
                    ? { recognized: true, person: { name: 'Jean Dupont', title: 'Manager', confidence: 0.94 } }
                    : { recognized: false, person: null, confidence: 0 };
            }
            if (action === 'identify_unknown') {
                return { recognized: false, person: null, suggestion: 'Visiteur non enregistré' };
            }
            return {};
        }),
    },
}));
const vision_agent_1 = require("@/agents/vision.agent");
(0, vitest_1.describe)('Vision Agent', () => {
    (0, vitest_1.beforeEach)(() => { (0, setup_1.clearMockFirestore)(); vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should detect faces in an image', async () => {
        const result = await vision_agent_1.visionAgent.process({
            action: 'detect_faces',
            imageBuffer: Buffer.from('fake-image-data'),
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.facesDetected).toBeGreaterThan(0);
        (0, vitest_1.expect)(Array.isArray(result.faces)).toBe(true);
    });
    (0, vitest_1.it)('should recognize a known person', async () => {
        const result = await vision_agent_1.visionAgent.process({
            action: 'recognize',
            imageBuffer: Buffer.from('known-person-image'),
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.recognized).toBe(true);
        (0, vitest_1.expect)(result.person).toBeDefined();
        (0, vitest_1.expect)(result.person.name).toBeDefined();
        (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0.8);
    });
    (0, vitest_1.it)('should return "unknown" for unregistered faces', async () => {
        const result = await vision_agent_1.visionAgent.process({
            action: 'identify_unknown',
            imageBuffer: Buffer.from('unknown-person-image'),
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.recognized).toBe(false);
        (0, vitest_1.expect)(result.person).toBeNull();
    });
});
//# sourceMappingURL=vision.agent.test.js.map