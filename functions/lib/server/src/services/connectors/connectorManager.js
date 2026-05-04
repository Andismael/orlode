"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorManager = exports.ConnectorManager = void 0;
/**
 * Connector Manager
 * Lists all connectors for a company and provides stats.
 */
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
class ConnectorManager {
    async getStats(companyId) {
        const db = (0, firebase_config_1.getFirestore)();
        const [connectorsSnap, chunksSnap] = await Promise.all([
            db.collection(`companies/${companyId}/connectors`).get(),
            db.collection(`companies/${companyId}/vectorChunks`).count().get(),
        ]);
        const connectors = connectorsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data['type'],
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
    async deleteConnector(companyId, connectorId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${companyId}/connectors`).doc(connectorId).delete();
        logger_1.logger.info(`[ConnectorManager] Deleted connector ${connectorId} for company ${companyId}`);
    }
    async updateStatus(companyId, connectorId, status) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${companyId}/connectors`).doc(connectorId).update({ status });
    }
}
exports.ConnectorManager = ConnectorManager;
exports.connectorManager = new ConnectorManager();
//# sourceMappingURL=connectorManager.js.map