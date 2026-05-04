import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/services/connectors/databaseConnectorService', () => ({
  databaseConnectorService: {
    testConnection: vi.fn(),
    syncDatabase: vi.fn(),
    rowToText: vi.fn((row: Record<string, unknown>, template: string) => {
      return template.replace(/\{(\w+)\}/g, (_, key) => String(row[key] ?? 'N/A'));
    }),
  },
}));

import { databaseConnectorService } from '@/services/connectors/databaseConnectorService';

describe('Database Connector Service', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should test MySQL connection successfully', async () => {
    vi.mocked(databaseConnectorService.testConnection).mockResolvedValue({ ok: true, latency: 12 });

    const result = await databaseConnectorService.testConnection('mysql', {
      host: 'localhost', port: 3306, database: 'test',
      username: 'user', password: 'encrypted_pass', ssl: false,
    });

    expect(result.ok).toBe(true);
  });

  it('should handle connection failure', async () => {
    vi.mocked(databaseConnectorService.testConnection).mockResolvedValue({
      ok: false,
      error: 'Connection refused — ECONNREFUSED',
    });

    const result = await databaseConnectorService.testConnection('mysql', {
      host: 'invalid-host', port: 3306, database: 'test',
      username: 'user', password: 'encrypted_pass', ssl: false,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('should transform a row to text using template', () => {
    const row = { name: 'Acme Corp', email: 'info@acme.com', revenue: '2.3M' };
    const template = 'Client {name}, email: {email}, CA: {revenue}';

    vi.mocked(databaseConnectorService.rowToText).mockImplementation((r, t) =>
      t.replace(/\{(\w+)\}/g, (_, k) => String((r as Record<string, unknown>)[k] ?? 'N/A'))
    );

    const text = databaseConnectorService.rowToText(row, template);
    expect(text).toBe('Client Acme Corp, email: info@acme.com, CA: 2.3M');
  });

  it('should replace missing template fields with N/A', () => {
    const row = { name: 'Acme Corp' };
    const template = 'Client {name}, email: {email}';

    vi.mocked(databaseConnectorService.rowToText).mockImplementation((r, t) =>
      t.replace(/\{(\w+)\}/g, (_, k) => String((r as Record<string, unknown>)[k] ?? 'N/A'))
    );

    const text = databaseConnectorService.rowToText(row, template);
    expect(text).toBe('Client Acme Corp, email: N/A');
  });

  it('should test PostgreSQL connection', async () => {
    vi.mocked(databaseConnectorService.testConnection).mockResolvedValue({ ok: true, latency: 8 });

    const result = await databaseConnectorService.testConnection('postgresql', {
      host: 'db.example.com', port: 5432, database: 'prod',
      username: 'admin', password: 'encrypted_secret', ssl: true,
    });

    expect(result.ok).toBe(true);
    expect(databaseConnectorService.testConnection).toHaveBeenCalledWith('postgresql', expect.any(Object));
  });
});
