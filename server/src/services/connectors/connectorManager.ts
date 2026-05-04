/**
 * Connector Manager
 * Lists all connectors for a company and provides stats.
 */
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';

export interface ConnectorRecord {
  id: string;
  type: 'web' | 'database' | 'api' | 'ecommerce' | 'video' | 'audio';
  name: string;
  status: 'active' | 'error' | 'syncing';
  lastSyncAt?: string;
  lastSyncChunks?: number;
  lastSyncRows?: number;
  schedule?: string;
  // Type-specific fields
  siteUrl?: string;
  dbType?: string;
  platform?: string;
}

export interface ConnectorStats {
  totalConnectors: number;
  totalChunks: number;
  connectors: ConnectorRecord[];
}

export class ConnectorManager {

  async getStats(companyId: string): Promise<ConnectorStats> {
    const db = getFirestore();

    const [connectorsSnap, chunksSnap] = await Promise.all([
      db.collection(`companies/${companyId}/connectors`).get(),
      db.collection(`companies/${companyId}/vectorChunks`).count().get(),
    ]);

    const connectors: ConnectorRecord[] = connectorsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data['type'] as ConnectorRecord['type'],
        name: data['name'] ?? doc.id,
        status: data['status'] ?? 'active',
        lastSyncAt: data['lastSyncAt']?.toDate?.()?.toISOString(),
        lastSyncChunks: data['lastSyncChunks'],
        lastSyncRows: data['lastSyncRows'],
        schedule: data['schedule'] ?? data['syncSchedule'],
        siteUrl: data['siteUrl'],
        dbType: data['dbType'],
        platform: data['platform'],
      };
    });

    return {
      totalConnectors: connectors.length,
      totalChunks: chunksSnap.data().count,
      connectors,
    };
  }

  async deleteConnector(companyId: string, connectorId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(`companies/${companyId}/connectors`).doc(connectorId).delete();
    logger.info(`[ConnectorManager] Deleted connector ${connectorId} for company ${companyId}`);
  }

  async updateStatus(companyId: string, connectorId: string, status: ConnectorRecord['status']): Promise<void> {
    const db = getFirestore();
    await db.collection(`companies/${companyId}/connectors`).doc(connectorId).update({ status });
  }
}

export const connectorManager = new ConnectorManager();
