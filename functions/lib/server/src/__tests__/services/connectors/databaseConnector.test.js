"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/services/connectors/databaseConnectorService', () => ({
    databaseConnectorService: {
        testConnection: vitest_1.vi.fn(),
        syncDatabase: vitest_1.vi.fn(),
        rowToText: vitest_1.vi.fn((row, template) => {
            return template.replace(/\{(\w+)\}/g, (_, key) => String(row[key] ?? 'N/A'));
        }),
    },
}));
const databaseConnectorService_1 = require("@/services/connectors/databaseConnectorService");
(0, vitest_1.describe)('Database Connector Service', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should test MySQL connection successfully', async () => {
        vitest_1.vi.mocked(databaseConnectorService_1.databaseConnectorService.testConnection).mockResolvedValue({ ok: true, latency: 12 });
        const result = await databaseConnectorService_1.databaseConnectorService.testConnection('mysql', {
            host: 'localhost', port: 3306, database: 'test',
            username: 'user', password: 'encrypted_pass', ssl: false,
        });
        (0, vitest_1.expect)(result.ok).toBe(true);
    });
    (0, vitest_1.it)('should handle connection failure', async () => {
        vitest_1.vi.mocked(databaseConnectorService_1.databaseConnectorService.testConnection).mockResolvedValue({
            ok: false,
            error: 'Connection refused — ECONNREFUSED',
        });
        const result = await databaseConnectorService_1.databaseConnectorService.testConnection('mysql', {
            host: 'invalid-host', port: 3306, database: 'test',
            username: 'user', password: 'encrypted_pass', ssl: false,
        });
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('Connection refused');
    });
    (0, vitest_1.it)('should transform a row to text using template', () => {
        const row = { name: 'Acme Corp', email: 'info@acme.com', revenue: '2.3M' };
        const template = 'Client {name}, email: {email}, CA: {revenue}';
        vitest_1.vi.mocked(databaseConnectorService_1.databaseConnectorService.rowToText).mockImplementation((r, t) => t.replace(/\{(\w+)\}/g, (_, k) => String(r[k] ?? 'N/A')));
        const text = databaseConnectorService_1.databaseConnectorService.rowToText(row, template);
        (0, vitest_1.expect)(text).toBe('Client Acme Corp, email: info@acme.com, CA: 2.3M');
    });
    (0, vitest_1.it)('should replace missing template fields with N/A', () => {
        const row = { name: 'Acme Corp' };
        const template = 'Client {name}, email: {email}';
        vitest_1.vi.mocked(databaseConnectorService_1.databaseConnectorService.rowToText).mockImplementation((r, t) => t.replace(/\{(\w+)\}/g, (_, k) => String(r[k] ?? 'N/A')));
        const text = databaseConnectorService_1.databaseConnectorService.rowToText(row, template);
        (0, vitest_1.expect)(text).toBe('Client Acme Corp, email: N/A');
    });
    (0, vitest_1.it)('should test PostgreSQL connection', async () => {
        vitest_1.vi.mocked(databaseConnectorService_1.databaseConnectorService.testConnection).mockResolvedValue({ ok: true, latency: 8 });
        const result = await databaseConnectorService_1.databaseConnectorService.testConnection('postgresql', {
            host: 'db.example.com', port: 5432, database: 'prod',
            username: 'admin', password: 'encrypted_secret', ssl: true,
        });
        (0, vitest_1.expect)(result.ok).toBe(true);
        (0, vitest_1.expect)(databaseConnectorService_1.databaseConnectorService.testConnection).toHaveBeenCalledWith('postgresql', vitest_1.expect.any(Object));
    });
});
//# sourceMappingURL=databaseConnector.test.js.map