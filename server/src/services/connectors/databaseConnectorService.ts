/**
 * Database Connector Service
 * Supports MySQL, PostgreSQL, MongoDB, SQL Server.
 * Database drivers are dynamically required — install only what you need.
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../../utils/helpers';
import { generateEmbedding } from '../rag/embeddingService';
import { firestoreVectorStore } from '../rag/firestoreVectorStore';
import { encrypt, decrypt } from '../../config/encryption';
import { logger } from '../../utils/logger';

export type DbType = 'mysql' | 'postgresql' | 'mongodb' | 'mssql';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;    // stored encrypted
  ssl: boolean;
}

export interface TableConfig {
  tableName: string;
  columns: string[];
  primaryKey: string;
  descriptionTemplate?: string;
  filterQuery?: string;
  maxRows?: number;
}

export interface DatabaseConnectorConfig {
  companyId: string;
  name: string;
  type: DbType;
  connection: DatabaseConnectionConfig;
  tables: TableConfig[];
  syncSchedule: 'manual' | 'hourly' | 'daily' | 'weekly';
}

export interface SchemaTable {
  name: string;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
}

export interface SyncResult {
  tablesProcessed: number;
  rowsIndexed: number;
  chunksCreated: number;
  durationMs: number;
}

// ── Dynamic driver helpers ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireDriver(pkg: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(pkg);
  } catch {
    throw new Error(`Package "${pkg}" is not installed. Run: npm install ${pkg}`);
  }
}

// ── Row → natural text ────────────────────────────────────────────────────────

function rowToText(row: Record<string, unknown>, config: TableConfig): string {
  if (config.descriptionTemplate) {
    let text = config.descriptionTemplate;
    for (const [key, value] of Object.entries(row)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? 'N/A'));
    }
    return text;
  }
  const parts = config.columns
    .filter((c) => row[c] != null)
    .map((c) => `${c}: ${row[c]}`);
  return `[${config.tableName}] ${parts.join(' | ')}`;
}

// ── Database adapters ─────────────────────────────────────────────────────────

async function mysqlConnect(conn: DatabaseConnectionConfig) {
  const mysql = requireDriver('mysql2/promise');
  return mysql.createConnection({
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.username,
    password: decrypt(conn.password),
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
  });
}

async function mysqlDiscover(client: unknown, database: string): Promise<SchemaTable[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tableRows] = await (client as any).query(
    'SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [database]
  );
  const tables: SchemaTable[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of tableRows as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [colRows] = await (client as any).query(
      'SELECT COLUMN_NAME as name, DATA_TYPE as type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [database, row.TABLE_NAME]
    );
    tables.push({ name: row.TABLE_NAME, columns: colRows, rowCount: row.TABLE_ROWS ?? 0 });
  }
  return tables;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mysqlFetchRows(client: any, table: TableConfig): Promise<Record<string, unknown>[]> {
  const cols = table.columns.join(', ');
  const where = table.filterQuery ? `WHERE ${table.filterQuery}` : '';
  const limit = table.maxRows ? `LIMIT ${table.maxRows}` : 'LIMIT 10000';
  const [rows] = await client.query(`SELECT ${cols} FROM \`${table.tableName}\` ${where} ${limit}`);
  return rows as Record<string, unknown>[];
}

async function pgConnect(conn: DatabaseConnectionConfig) {
  const { Client } = requireDriver('pg');
  const client = new Client({
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.username,
    password: decrypt(conn.password),
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pgDiscover(client: any): Promise<SchemaTable[]> {
  const { rows: tableRows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  const tables: SchemaTable[] = [];
  for (const t of tableRows) {
    const { rows: colRows } = await client.query(
      `SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_name=$1`,
      [t.table_name]
    );
    const { rows: countRows } = await client.query(`SELECT COUNT(*) as cnt FROM "${t.table_name}"`);
    tables.push({ name: t.table_name, columns: colRows, rowCount: parseInt(countRows[0].cnt, 10) });
  }
  return tables;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pgFetchRows(client: any, table: TableConfig): Promise<Record<string, unknown>[]> {
  const cols = table.columns.map((c) => `"${c}"`).join(', ');
  const where = table.filterQuery ? `WHERE ${table.filterQuery}` : '';
  const limit = table.maxRows ?? 10000;
  const { rows } = await client.query(`SELECT ${cols} FROM "${table.tableName}" ${where} LIMIT $1`, [limit]);
  return rows;
}

async function mongoConnect(conn: DatabaseConnectionConfig) {
  const { MongoClient } = requireDriver('mongodb');
  const uri = `mongodb://${conn.username}:${encodeURIComponent(decrypt(conn.password))}@${conn.host}:${conn.port}/${conn.database}?${conn.ssl ? 'ssl=true&' : ''}authSource=admin`;
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mongoDiscover(client: any, dbName: string): Promise<SchemaTable[]> {
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  const tables: SchemaTable[] = [];
  for (const col of collections) {
    const sample = await db.collection(col.name).findOne({});
    const columns = sample ? Object.keys(sample).map((k) => ({ name: k, type: 'mixed' })) : [];
    const rowCount = await db.collection(col.name).estimatedDocumentCount();
    tables.push({ name: col.name, columns, rowCount });
  }
  return tables;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mongoFetchRows(client: any, dbName: string, table: TableConfig): Promise<Record<string, unknown>[]> {
  const db = client.db(dbName);
  const projection: Record<string, 1> = {};
  for (const c of table.columns) projection[c] = 1;
  const limit = table.maxRows ?? 10000;
  return db.collection(table.tableName).find({}, { projection }).limit(limit).toArray();
}

// ── Main Service ──────────────────────────────────────────────────────────────

export class DatabaseConnectorService {

  async testConnection(type: DbType, conn: DatabaseConnectionConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let client: any;
      switch (type) {
        case 'mysql': client = await mysqlConnect(conn); await client.end(); break;
        case 'postgresql': client = await pgConnect(conn); await client.end(); break;
        case 'mongodb': client = await mongoConnect(conn); await client.close(); break;
        default: throw new Error(`Unsupported type: ${type}`);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async discoverSchema(type: DbType, conn: DatabaseConnectionConfig): Promise<SchemaTable[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;
    try {
      switch (type) {
        case 'mysql':
          client = await mysqlConnect(conn);
          const mysqlTables = await mysqlDiscover(client, conn.database);
          await client.end();
          return mysqlTables;
        case 'postgresql':
          client = await pgConnect(conn);
          const pgTables = await pgDiscover(client);
          await client.end();
          return pgTables;
        case 'mongodb':
          client = await mongoConnect(conn);
          const mongoTables = await mongoDiscover(client, conn.database);
          await client.close();
          return mongoTables;
        default:
          throw new Error(`Unsupported type: ${type}`);
      }
    } catch (err) {
      if (client) {
        try { type === 'mongodb' ? await client.close() : await client.end(); } catch { /* ignore */ }
      }
      throw err;
    }
  }

  async syncDatabase(config: DatabaseConnectorConfig): Promise<SyncResult> {
    const start = Date.now();
    const db = getFirestore();
    let rowsIndexed = 0;
    let chunksCreated = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;

    try {
      switch (config.type) {
        case 'mysql': client = await mysqlConnect(config.connection); break;
        case 'postgresql': client = await pgConnect(config.connection); break;
        case 'mongodb': client = await mongoConnect(config.connection); break;
        default: throw new Error(`Unsupported type: ${config.type}`);
      }

      for (const table of config.tables) {
        let rows: Record<string, unknown>[];
        switch (config.type) {
          case 'mysql': rows = await mysqlFetchRows(client, table); break;
          case 'postgresql': rows = await pgFetchRows(client, table); break;
          case 'mongodb': rows = await mongoFetchRows(client, config.connection.database, table); break;
          default: rows = [];
        }

        for (const row of rows) {
          const text = rowToText(row, table);
          const pk = String(row[table.primaryKey] ?? generateId());
          const docId = `db_${config.name}_${table.tableName}_${pk}`;

          const embedding = await generateEmbedding(text);
          await firestoreVectorStore.upsertChunks(config.companyId, [{
            id: docId,
            data: {
              documentId: `connector_db_${config.name}`,
              documentName: `${config.name} / ${table.tableName}`,
              content: text,
              chunkIndex: rowsIndexed,
              metadata: {
                category: 'database',
                confidentiality: 'internal',
                language: 'auto',
                tokenCount: text.split(/\s+/).length,
              },
            },
            embedding,
          }]);

          rowsIndexed++;
          chunksCreated++;
        }

        logger.info(`[DBConnector] Synced table ${table.tableName}: ${rows.length} rows`);
      }

      // Save last sync timestamp
      await db.collection(`companies/${config.companyId}/connectors`).doc(`db_${config.name}`).update({
        lastSyncAt: FieldValue.serverTimestamp(),
        lastSyncRows: rowsIndexed,
      });

    } finally {
      if (client) {
        try { config.type === 'mongodb' ? await client.close() : await client.end(); } catch { /* ignore */ }
      }
    }

    return {
      tablesProcessed: config.tables.length,
      rowsIndexed,
      chunksCreated,
      durationMs: Date.now() - start,
    };
  }

  async saveConfig(config: DatabaseConnectorConfig): Promise<void> {
    const db = getFirestore();
    const encrypted = {
      ...config,
      connection: {
        ...config.connection,
        password: encrypt(config.connection.password),
      },
    };
    await db.collection(`companies/${config.companyId}/connectors`).doc(`db_${config.name}`).set({
      ...encrypted,
      connectorType: 'database',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export const databaseConnectorService = new DatabaseConnectorService();
