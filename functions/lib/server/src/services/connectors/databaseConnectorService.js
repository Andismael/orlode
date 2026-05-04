"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConnectorService = exports.DatabaseConnectorService = void 0;
/**
 * Database Connector Service
 * Supports MySQL, PostgreSQL, MongoDB, SQL Server.
 * Database drivers are dynamically required — install only what you need.
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../../utils/helpers");
const embeddingService_1 = require("../rag/embeddingService");
const firestoreVectorStore_1 = require("../rag/firestoreVectorStore");
const encryption_1 = require("../../config/encryption");
const logger_1 = require("../../utils/logger");
// ── Dynamic driver helpers ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireDriver(pkg) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(pkg);
    }
    catch {
        throw new Error(`Package "${pkg}" is not installed. Run: npm install ${pkg}`);
    }
}
// ── Row → natural text ────────────────────────────────────────────────────────
function rowToText(row, config) {
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
async function mysqlConnect(conn) {
    const mysql = requireDriver('mysql2/promise');
    return mysql.createConnection({
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.username,
        password: (0, encryption_1.decrypt)(conn.password),
        ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
    });
}
async function mysqlDiscover(client, database) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tableRows] = await client.query('SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [database]);
    const tables = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of tableRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [colRows] = await client.query('SELECT COLUMN_NAME as name, DATA_TYPE as type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [database, row.TABLE_NAME]);
        tables.push({ name: row.TABLE_NAME, columns: colRows, rowCount: row.TABLE_ROWS ?? 0 });
    }
    return tables;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mysqlFetchRows(client, table) {
    const cols = table.columns.join(', ');
    const where = table.filterQuery ? `WHERE ${table.filterQuery}` : '';
    const limit = table.maxRows ? `LIMIT ${table.maxRows}` : 'LIMIT 10000';
    const [rows] = await client.query(`SELECT ${cols} FROM \`${table.tableName}\` ${where} ${limit}`);
    return rows;
}
async function pgConnect(conn) {
    const { Client } = requireDriver('pg');
    const client = new Client({
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.username,
        password: (0, encryption_1.decrypt)(conn.password),
        ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
    });
    await client.connect();
    return client;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pgDiscover(client) {
    const { rows: tableRows } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
    const tables = [];
    for (const t of tableRows) {
        const { rows: colRows } = await client.query(`SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_name=$1`, [t.table_name]);
        const { rows: countRows } = await client.query(`SELECT COUNT(*) as cnt FROM "${t.table_name}"`);
        tables.push({ name: t.table_name, columns: colRows, rowCount: parseInt(countRows[0].cnt, 10) });
    }
    return tables;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pgFetchRows(client, table) {
    const cols = table.columns.map((c) => `"${c}"`).join(', ');
    const where = table.filterQuery ? `WHERE ${table.filterQuery}` : '';
    const limit = table.maxRows ?? 10000;
    const { rows } = await client.query(`SELECT ${cols} FROM "${table.tableName}" ${where} LIMIT $1`, [limit]);
    return rows;
}
async function mongoConnect(conn) {
    const { MongoClient } = requireDriver('mongodb');
    const uri = `mongodb://${conn.username}:${encodeURIComponent((0, encryption_1.decrypt)(conn.password))}@${conn.host}:${conn.port}/${conn.database}?${conn.ssl ? 'ssl=true&' : ''}authSource=admin`;
    const client = new MongoClient(uri);
    await client.connect();
    return client;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mongoDiscover(client, dbName) {
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const tables = [];
    for (const col of collections) {
        const sample = await db.collection(col.name).findOne({});
        const columns = sample ? Object.keys(sample).map((k) => ({ name: k, type: 'mixed' })) : [];
        const rowCount = await db.collection(col.name).estimatedDocumentCount();
        tables.push({ name: col.name, columns, rowCount });
    }
    return tables;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mongoFetchRows(client, dbName, table) {
    const db = client.db(dbName);
    const projection = {};
    for (const c of table.columns)
        projection[c] = 1;
    const limit = table.maxRows ?? 10000;
    return db.collection(table.tableName).find({}, { projection }).limit(limit).toArray();
}
// ── Main Service ──────────────────────────────────────────────────────────────
class DatabaseConnectorService {
    async testConnection(type, conn) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let client;
            switch (type) {
                case 'mysql':
                    client = await mysqlConnect(conn);
                    await client.end();
                    break;
                case 'postgresql':
                    client = await pgConnect(conn);
                    await client.end();
                    break;
                case 'mongodb':
                    client = await mongoConnect(conn);
                    await client.close();
                    break;
                default: throw new Error(`Unsupported type: ${type}`);
            }
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    }
    async discoverSchema(type, conn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let client;
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
        }
        catch (err) {
            if (client) {
                try {
                    type === 'mongodb' ? await client.close() : await client.end();
                }
                catch { /* ignore */ }
            }
            throw err;
        }
    }
    async syncDatabase(config) {
        const start = Date.now();
        const db = (0, firebase_config_1.getFirestore)();
        let rowsIndexed = 0;
        let chunksCreated = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let client;
        try {
            switch (config.type) {
                case 'mysql':
                    client = await mysqlConnect(config.connection);
                    break;
                case 'postgresql':
                    client = await pgConnect(config.connection);
                    break;
                case 'mongodb':
                    client = await mongoConnect(config.connection);
                    break;
                default: throw new Error(`Unsupported type: ${config.type}`);
            }
            for (const table of config.tables) {
                let rows;
                switch (config.type) {
                    case 'mysql':
                        rows = await mysqlFetchRows(client, table);
                        break;
                    case 'postgresql':
                        rows = await pgFetchRows(client, table);
                        break;
                    case 'mongodb':
                        rows = await mongoFetchRows(client, config.connection.database, table);
                        break;
                    default: rows = [];
                }
                for (const row of rows) {
                    const text = rowToText(row, table);
                    const pk = String(row[table.primaryKey] ?? (0, helpers_1.generateId)());
                    const docId = `db_${config.name}_${table.tableName}_${pk}`;
                    const embedding = await (0, embeddingService_1.generateEmbedding)(text);
                    await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(config.companyId, [{
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
                logger_1.logger.info(`[DBConnector] Synced table ${table.tableName}: ${rows.length} rows`);
            }
            // Save last sync timestamp
            await db.collection(`companies/${config.companyId}/connectors`).doc(`db_${config.name}`).update({
                lastSyncAt: firestore_1.FieldValue.serverTimestamp(),
                lastSyncRows: rowsIndexed,
            });
        }
        finally {
            if (client) {
                try {
                    config.type === 'mongodb' ? await client.close() : await client.end();
                }
                catch { /* ignore */ }
            }
        }
        return {
            tablesProcessed: config.tables.length,
            rowsIndexed,
            chunksCreated,
            durationMs: Date.now() - start,
        };
    }
    async saveConfig(config) {
        const db = (0, firebase_config_1.getFirestore)();
        const encrypted = {
            ...config,
            connection: {
                ...config.connection,
                password: (0, encryption_1.encrypt)(config.connection.password),
            },
        };
        await db.collection(`companies/${config.companyId}/connectors`).doc(`db_${config.name}`).set({
            ...encrypted,
            connectorType: 'database',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
}
exports.DatabaseConnectorService = DatabaseConnectorService;
exports.databaseConnectorService = new DatabaseConnectorService();
//# sourceMappingURL=databaseConnectorService.js.map