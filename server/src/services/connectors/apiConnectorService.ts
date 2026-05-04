/**
 * API Connector Service
 * Connects any REST API and indexes the data into the knowledge base.
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbedding } from '../rag/embeddingService';
import { firestoreVectorStore } from '../rag/firestoreVectorStore';
import { encrypt, decrypt } from '../../config/encryption';
import { logger } from '../../utils/logger';

export type AuthType = 'api_key' | 'bearer' | 'basic' | 'none';

export interface EndpointConfig {
  name: string;
  path: string;
  params?: Record<string, string>;
  dataPath?: string;       // Dot-notation path to the data array (e.g. "data.results")
  descriptionTemplate: string;
  maxRecords?: number;
  pagination?: {
    type: 'offset' | 'page' | 'cursor';
    paramName: string;
    pageSize: number;
  };
}

export interface APIConnectorConfig {
  companyId: string;
  name: string;
  baseUrl: string;
  authType: AuthType;
  credentials: string;    // stored encrypted
  endpoints: EndpointConfig[];
  syncSchedule: 'manual' | 'hourly' | 'daily';
}

export interface APISyncResult {
  endpointsProcessed: number;
  totalRecords: number;
  chunksCreated: number;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function buildAuthHeaders(authType: AuthType, credentials: string): Record<string, string> {
  const decrypted = credentials ? decrypt(credentials) : '';
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

function recordToText(record: Record<string, unknown>, endpoint: EndpointConfig): string {
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

async function fetchAllPages(
  baseUrl: string,
  endpoint: EndpointConfig,
  headers: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const allRecords: Record<string, unknown>[] = [];
  const maxRecords = endpoint.maxRecords ?? 5000;
  let page = 0;
  let cursor: string | undefined;

  while (allRecords.length < maxRecords) {
    const url = new URL(endpoint.path, baseUrl);

    if (endpoint.params) {
      for (const [k, v] of Object.entries(endpoint.params)) {
        url.searchParams.set(k, v);
      }
    }

    if (endpoint.pagination) {
      const { type, paramName, pageSize } = endpoint.pagination;
      url.searchParams.set(paramName, String(
        type === 'offset' ? allRecords.length :
        type === 'page'   ? page :
        cursor ?? '0'
      ));
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('per_page', String(pageSize));
    }

    const response = await fetch(url.toString(), { headers: { ...headers, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`API ${endpoint.path} returned ${response.status}`);

    const json: unknown = await response.json();
    const data = endpoint.dataPath ? getNestedValue(json, endpoint.dataPath) : json;
    const records = Array.isArray(data) ? data as Record<string, unknown>[] : [json as Record<string, unknown>];

    if (records.length === 0) break;

    allRecords.push(...records);
    page++;

    // Stop if no pagination configured or last page
    if (!endpoint.pagination || records.length < (endpoint.pagination.pageSize ?? 100)) break;

    // Handle cursor pagination
    if (endpoint.pagination.type === 'cursor') {
      const nextCursor = getNestedValue(json, 'next_cursor') ?? getNestedValue(json, 'cursor');
      if (!nextCursor) break;
      cursor = String(nextCursor);
    }
  }

  return allRecords.slice(0, maxRecords);
}

// ── Service ───────────────────────────────────────────────────────────────────

export class APIConnectorService {

  async testConnection(config: Omit<APIConnectorConfig, 'endpoints' | 'syncSchedule'>): Promise<{ ok: boolean; error?: string }> {
    try {
      const headers = buildAuthHeaders(config.authType, config.credentials);
      const response = await fetch(config.baseUrl, { headers, method: 'HEAD' });
      return { ok: response.ok || response.status === 405 }; // 405 = method not allowed but reachable
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async syncAPI(config: APIConnectorConfig): Promise<APISyncResult> {
    const db = getFirestore();
    const headers = buildAuthHeaders(config.authType, config.credentials);
    let totalRecords = 0;
    let chunksCreated = 0;

    logger.info(`[APIConnector] Syncing API "${config.name}" for company ${config.companyId}`);

    for (const endpoint of config.endpoints) {
      try {
        const records = await fetchAllPages(config.baseUrl, endpoint, headers);

        for (let i = 0; i < records.length; i++) {
          const record = records[i]!;
          const text = recordToText(record, endpoint);
          const docId = `api_${config.name}_${endpoint.name}_${i}`;

          const embedding = await generateEmbedding(text);
          await firestoreVectorStore.upsertChunks(config.companyId, [{
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

        logger.info(`[APIConnector] Endpoint ${endpoint.name}: ${records.length} records indexed`);
      } catch (err) {
        logger.warn(`[APIConnector] Failed endpoint ${endpoint.name}`, { error: err });
      }
    }

    await db.collection(`companies/${config.companyId}/connectors`).doc(`api_${config.name}`).update({
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncRecords: totalRecords,
    });

    return { endpointsProcessed: config.endpoints.length, totalRecords, chunksCreated };
  }

  async saveConfig(config: APIConnectorConfig): Promise<void> {
    const db = getFirestore();
    const encrypted = {
      ...config,
      credentials: config.credentials ? encrypt(config.credentials) : '',
    };
    await db.collection(`companies/${config.companyId}/connectors`).doc(`api_${config.name}`).set({
      type: 'api',
      ...encrypted,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async getConfigs(companyId: string): Promise<APIConnectorConfig[]> {
    const db = getFirestore();
    const snapshot = await db
      .collection(`companies/${companyId}/connectors`)
      .where('type', '==', 'api')
      .get();
    return snapshot.docs.map((d) => d.data() as APIConnectorConfig);
  }
}

export const apiConnectorService = new APIConnectorService();
