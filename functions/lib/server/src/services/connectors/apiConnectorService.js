"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiConnectorService = exports.APIConnectorService = void 0;
/**
 * API Connector Service
 * Connects any REST API and indexes the data into the knowledge base.
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const embeddingService_1 = require("../rag/embeddingService");
const firestoreVectorStore_1 = require("../rag/firestoreVectorStore");
const encryption_1 = require("../../config/encryption");
const logger_1 = require("../../utils/logger");
// ── Utilities ─────────────────────────────────────────────────────────────────
function getNestedValue(obj, path) {
    if (!path)
        return obj;
    return path.split('.').reduce((acc, key) => {
        if (acc && typeof acc === 'object' && key in acc) {
            return acc[key];
        }
        return undefined;
    }, obj);
}
function buildAuthHeaders(authType, credentials) {
    const decrypted = credentials ? (0, encryption_1.decrypt)(credentials) : '';
    switch (authType) {
        case 'api_key':
            return { 'X-API-Key': decrypted };
        case 'bearer':
            return { Authorization: `Bearer ${decrypted}` };
        case 'basic': {
            const encoded = Buffer.from(decrypted).toString('base64');
            return { Authorization: `Basic ${encoded}` };
        }
        default:
            return {};
    }
}
function recordToText(record, endpoint) {
    if (endpoint.descriptionTemplate) {
        let text = endpoint.descriptionTemplate;
        for (const [key, value] of Object.entries(record)) {
            text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? 'N/A'));
        }
        return text;
    }
    return JSON.stringify(record);
}
// ── Fetching with pagination ──────────────────────────────────────────────────
async function fetchAllPages(baseUrl, endpoint, headers) {
    const allRecords = [];
    const maxRecords = endpoint.maxRecords ?? 5000;
    let page = 0;
    let cursor;
    while (allRecords.length < maxRecords) {
        const url = new URL(endpoint.path, baseUrl);
        if (endpoint.params) {
            for (const [k, v] of Object.entries(endpoint.params)) {
                url.searchParams.set(k, v);
            }
        }
        if (endpoint.pagination) {
            const { type, paramName, pageSize } = endpoint.pagination;
            url.searchParams.set(paramName, String(type === 'offset' ? allRecords.length :
                type === 'page' ? page :
                    cursor ?? '0'));
            url.searchParams.set('limit', String(pageSize));
            url.searchParams.set('per_page', String(pageSize));
        }
        const response = await fetch(url.toString(), { headers: { ...headers, 'Content-Type': 'application/json' } });
        if (!response.ok)
            throw new Error(`API ${endpoint.path} returned ${response.status}`);
        const json = await response.json();
        const data = endpoint.dataPath ? getNestedValue(json, endpoint.dataPath) : json;
        const records = Array.isArray(data) ? data : [json];
        if (records.length === 0)
            break;
        allRecords.push(...records);
        page++;
        // Stop if no pagination configured or last page
        if (!endpoint.pagination || records.length < (endpoint.pagination.pageSize ?? 100))
            break;
        // Handle cursor pagination
        if (endpoint.pagination.type === 'cursor') {
            const nextCursor = getNestedValue(json, 'next_cursor') ?? getNestedValue(json, 'cursor');
            if (!nextCursor)
                break;
            cursor = String(nextCursor);
        }
    }
    return allRecords.slice(0, maxRecords);
}
// ── Service ───────────────────────────────────────────────────────────────────
class APIConnectorService {
    async testConnection(config) {
        try {
            const headers = buildAuthHeaders(config.authType, config.credentials);
            const response = await fetch(config.baseUrl, { headers, method: 'HEAD' });
            return { ok: response.ok || response.status === 405 }; // 405 = method not allowed but reachable
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    }
    async syncAPI(config) {
        const db = (0, firebase_config_1.getFirestore)();
        const headers = buildAuthHeaders(config.authType, config.credentials);
        let totalRecords = 0;
        let chunksCreated = 0;
        logger_1.logger.info(`[APIConnector] Syncing API "${config.name}" for company ${config.companyId}`);
        for (const endpoint of config.endpoints) {
            try {
                const records = await fetchAllPages(config.baseUrl, endpoint, headers);
                for (let i = 0; i < records.length; i++) {
                    const record = records[i];
                    const text = recordToText(record, endpoint);
                    const docId = `api_${config.name}_${endpoint.name}_${i}`;
                    const embedding = await (0, embeddingService_1.generateEmbedding)(text);
                    await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(config.companyId, [{
                            id: docId,
                            data: {
                                documentId: `connector_api_${config.name}`,
                                documentName: `${config.name} / ${endpoint.name}`,
                                content: text,
                                chunkIndex: i,
                                metadata: {
                                    category: 'api',
                                    confidentiality: 'internal',
                                    language: 'auto',
                                    tokenCount: text.split(/\s+/).length,
                                },
                            },
                            embedding,
                        }]);
                    totalRecords++;
                    chunksCreated++;
                }
                logger_1.logger.info(`[APIConnector] Endpoint ${endpoint.name}: ${records.length} records indexed`);
            }
            catch (err) {
                logger_1.logger.warn(`[APIConnector] Failed endpoint ${endpoint.name}`, { error: err });
            }
        }
        await db.collection(`companies/${config.companyId}/connectors`).doc(`api_${config.name}`).update({
            lastSyncAt: firestore_1.FieldValue.serverTimestamp(),
            lastSyncRecords: totalRecords,
        });
        return { endpointsProcessed: config.endpoints.length, totalRecords, chunksCreated };
    }
    async saveConfig(config) {
        const db = (0, firebase_config_1.getFirestore)();
        const encrypted = {
            ...config,
            credentials: config.credentials ? (0, encryption_1.encrypt)(config.credentials) : '',
        };
        await db.collection(`companies/${config.companyId}/connectors`).doc(`api_${config.name}`).set({
            type: 'api',
            ...encrypted,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async getConfigs(companyId) {
        const db = (0, firebase_config_1.getFirestore)();
        const snapshot = await db
            .collection(`companies/${companyId}/connectors`)
            .where('type', '==', 'api')
            .get();
        return snapshot.docs.map((d) => d.data());
    }
}
exports.APIConnectorService = APIConnectorService;
exports.apiConnectorService = new APIConnectorService();
//# sourceMappingURL=apiConnectorService.js.map