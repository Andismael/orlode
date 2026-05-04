"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSalesAudit = logSalesAudit;
exports.buildDiff = buildDiff;
/**
 * Sales Audit Service — Compliance-grade audit trail for commercial actions
 *
 * Unlike the generic auditLog middleware (method+path), this service captures:
 *   - WHO performed the action (uid, email, role)
 *   - WHAT changed (before/after values)
 *   - WHEN it happened (server timestamp)
 *   - WHY context (action type, resource reference)
 *
 * Stored in: companies/{companyId}/salesAuditLogs
 * Non-blocking (fire-and-forget).
 */
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
/**
 * Write a sales audit log entry. Fire-and-forget — never blocks.
 */
function logSalesAudit(companyId, entry) {
    const id = (0, helpers_1.generateId)();
    const doc = {
        id,
        ...entry,
        companyId,
        timestamp: firestore_1.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString(),
    };
    // Fire and forget
    (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/salesAuditLogs`)
        .doc(id)
        .set(doc)
        .catch(err => logger_1.logger.error('[SalesAudit] Write failed', { error: err }));
}
/**
 * Helper: build a diff object showing only changed fields between before and after.
 */
function buildDiff(before, after, fields) {
    const b = {};
    const a = {};
    let hasChange = false;
    for (const field of fields) {
        const bVal = before[field];
        const aVal = after[field];
        if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
            b[field] = bVal;
            a[field] = aVal;
            hasChange = true;
        }
    }
    return hasChange ? { before: b, after: a } : null;
}
//# sourceMappingURL=salesAuditService.js.map