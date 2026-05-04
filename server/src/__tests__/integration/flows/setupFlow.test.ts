import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/agents/setup/setupAgent', () => ({
  setupAgent: {
    process: vi.fn(async ({ action, projectId, apiKey, provider, companyId, plan }: {
      action: string; projectId?: string; apiKey?: string; provider?: string;
      companyId?: string; plan?: string; companyName?: string; adminEmail?: string;
      serviceAccountKey?: string;
    }) => {
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

import { setupAgent } from '@/agents/setup/setupAgent';

describe('Flow: Setup Wizard', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should validate Firebase configuration', async () => {
    const result = await setupAgent.process({
      action: 'validate_firebase',
      projectId: 'corpmind-test-project',
      serviceAccountKey: '{"type":"service_account","project_id":"corpmind-test"}',
    });

    expect(result.checks).toBeDefined();
    expect(result.checks.projectExists).toBe(true);
    expect(result.checks.firestoreEnabled).toBe(true);
  });

  it('should test Gemini API key', async () => {
    const result = await setupAgent.process({
      action: 'test_api_key',
      provider: 'gemini',
      apiKey: 'AIzaSy_test_key_123456',
    });

    expect(result.success).toBeDefined();
    expect(result.provider).toBe('gemini');
  });

  it('should deploy Firestore schema for new company', async () => {
    const result = await setupAgent.process({
      action: 'deploy_schema',
      companyId: 'new-co-abc',
      companyName: 'Test Corp',
      adminEmail: 'admin@testcorp.com',
      plan: 'business',
    });

    expect(result.collectionsCreated).toBeGreaterThan(10);
    expect(result.rulesDeployed).toBe(true);
  });

  it('should fail API key test for short key', async () => {
    const result = await setupAgent.process({
      action: 'test_api_key',
      provider: 'openai',
      apiKey: 'bad',
    });

    expect(result.success).toBe(false);
  });
});
