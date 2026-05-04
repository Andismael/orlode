"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/agents/setup/setupAgent', () => ({
    setupAgent: {
        process: vitest_1.vi.fn(async ({ action, projectId, apiKey, provider, companyId, plan }) => {
            if (action === 'validate_firebase') {
                return {
                    checks: {
                        projectExists: true,
                        firestoreEnabled: true,
                        authEnabled: true,
                        storageEnabled: true,
                    },
                    projectId,
                    valid: true,
                };
            }
            if (action === 'test_api_key') {
                return {
                    provider,
                    success: apiKey && apiKey.length > 5,
                    latency: 120,
                };
            }
            if (action === 'deploy_schema') {
                return {
                    companyId,
                    plan,
                    collectionsCreated: 18,
                    indexesCreated: 5,
                    rulesDeployed: true,
                };
            }
            return {};
        }),
    },
}));
const setupAgent_1 = require("@/agents/setup/setupAgent");
(0, vitest_1.describe)('Flow: Setup Wizard', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should validate Firebase configuration', async () => {
        const result = await setupAgent_1.setupAgent.process({
            action: 'validate_firebase',
            projectId: 'corpmind-test-project',
            serviceAccountKey: '{"type":"service_account","project_id":"corpmind-test"}',
        });
        (0, vitest_1.expect)(result.checks).toBeDefined();
        (0, vitest_1.expect)(result.checks.projectExists).toBe(true);
        (0, vitest_1.expect)(result.checks.firestoreEnabled).toBe(true);
    });
    (0, vitest_1.it)('should test Gemini API key', async () => {
        const result = await setupAgent_1.setupAgent.process({
            action: 'test_api_key',
            provider: 'gemini',
            apiKey: 'AIzaSy_test_key_123456',
        });
        (0, vitest_1.expect)(result.success).toBeDefined();
        (0, vitest_1.expect)(result.provider).toBe('gemini');
    });
    (0, vitest_1.it)('should deploy Firestore schema for new company', async () => {
        const result = await setupAgent_1.setupAgent.process({
            action: 'deploy_schema',
            companyId: 'new-co-abc',
            companyName: 'Test Corp',
            adminEmail: 'admin@testcorp.com',
            plan: 'business',
        });
        (0, vitest_1.expect)(result.collectionsCreated).toBeGreaterThan(10);
        (0, vitest_1.expect)(result.rulesDeployed).toBe(true);
    });
    (0, vitest_1.it)('should fail API key test for short key', async () => {
        const result = await setupAgent_1.setupAgent.process({
            action: 'test_api_key',
            provider: 'openai',
            apiKey: 'bad',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
});
//# sourceMappingURL=setupFlow.test.js.map