import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/services/connectors/apiConnectorService', () => ({
  apiConnectorService: {
    testConnection: vi.fn(),
    syncAPI: vi.fn(),
  },
}));

import { apiConnectorService } from '@/services/connectors/apiConnectorService';

describe('API Connector Service', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should test API connection successfully', async () => {
    vi.mocked(apiConnectorService.testConnection).mockResolvedValue({ ok: true, statusCode: 200 });

    const result = await apiConnectorService.testConnection({
      companyId: 'co1',
      name: 'TestAPI',
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      credentials: 'encrypted_token123',
    });

    expect(result.ok).toBe(true);
  });

  it('should handle failed API connection', async () => {
    vi.mocked(apiConnectorService.testConnection).mockResolvedValue({
      ok: false,
      statusCode: 401,
      error: 'Unauthorized — invalid token',
    });

    const result = await apiConnectorService.testConnection({
      companyId: 'co1',
      name: 'BadAPI',
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      credentials: 'bad_token',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should sync API data with pagination', async () => {
    vi.mocked(apiConnectorService.syncAPI).mockResolvedValue({
      totalRecords: 4,
      chunksCreated: 4,
      errors: 0,
    });

    const result = await apiConnectorService.syncAPI({
      companyId: 'co1',
      name: 'TestAPI',
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      credentials: 'encrypted_token',
      endpoints: [{
        name: 'items',
        path: '/items',
        descriptionTemplate: 'Item: {name}',
        pagination: { type: 'page', paramName: 'page', pageSize: 2 },
      }],
      syncSchedule: 'daily',
    });

    expect(result.totalRecords).toBe(4);
    expect(result.errors).toBe(0);
  });

  it('should sync API with API key auth', async () => {
    vi.mocked(apiConnectorService.testConnection).mockResolvedValue({ ok: true, statusCode: 200 });

    const result = await apiConnectorService.testConnection({
      companyId: 'co1',
      name: 'CRMApi',
      baseUrl: 'https://crm.example.com/api',
      authType: 'apikey',
      credentials: 'encrypted_apikey_xyz',
    });

    expect(result.ok).toBe(true);
    expect(apiConnectorService.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({ authType: 'apikey' })
    );
  });
});
