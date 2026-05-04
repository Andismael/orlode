"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/services/connectors/apiConnectorService', () => ({
    apiConnectorService: {
        testConnection: vitest_1.vi.fn(),
        syncAPI: vitest_1.vi.fn(),
    },
}));
const apiConnectorService_1 = require("@/services/connectors/apiConnectorService");
(0, vitest_1.describe)('API Connector Service', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should test API connection successfully', async () => {
        vitest_1.vi.mocked(apiConnectorService_1.apiConnectorService.testConnection).mockResolvedValue({ ok: true, statusCode: 200 });
        const result = await apiConnectorService_1.apiConnectorService.testConnection({
            companyId: 'co1',
            name: 'TestAPI',
            baseUrl: 'https://api.example.com',
            authType: 'bearer',
            credentials: 'encrypted_token123',
        });
        (0, vitest_1.expect)(result.ok).toBe(true);
    });
    (0, vitest_1.it)('should handle failed API connection', async () => {
        vitest_1.vi.mocked(apiConnectorService_1.apiConnectorService.testConnection).mockResolvedValue({
            ok: false,
            statusCode: 401,
            error: 'Unauthorized — invalid token',
        });
        const result = await apiConnectorService_1.apiConnectorService.testConnection({
            companyId: 'co1',
            name: 'BadAPI',
            baseUrl: 'https://api.example.com',
            authType: 'bearer',
            credentials: 'bad_token',
        });
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.error).toBeDefined();
    });
    (0, vitest_1.it)('should sync API data with pagination', async () => {
        vitest_1.vi.mocked(apiConnectorService_1.apiConnectorService.syncAPI).mockResolvedValue({
            totalRecords: 4,
            chunksCreated: 4,
            errors: 0,
        });
        const result = await apiConnectorService_1.apiConnectorService.syncAPI({
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
        (0, vitest_1.expect)(result.totalRecords).toBe(4);
        (0, vitest_1.expect)(result.errors).toBe(0);
    });
    (0, vitest_1.it)('should sync API with API key auth', async () => {
        vitest_1.vi.mocked(apiConnectorService_1.apiConnectorService.testConnection).mockResolvedValue({ ok: true, statusCode: 200 });
        const result = await apiConnectorService_1.apiConnectorService.testConnection({
            companyId: 'co1',
            name: 'CRMApi',
            baseUrl: 'https://crm.example.com/api',
            authType: 'apikey',
            credentials: 'encrypted_apikey_xyz',
        });
        (0, vitest_1.expect)(result.ok).toBe(true);
        (0, vitest_1.expect)(apiConnectorService_1.apiConnectorService.testConnection).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ authType: 'apikey' }));
    });
});
//# sourceMappingURL=apiConnector.test.js.map