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
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export type SalesAuditAction =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'lead.stage_changed'
  | 'lead.scored'
  | 'client.created'
  | 'client.updated'
  | 'quote.created'
  | 'quote.updated'
  | 'quote.sent'
  | 'quote.accepted'
  | 'quote.rejected'
  | 'quote.deleted'
  | 'quote.converted_to_invoice'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'followup.created'
  | 'followup.completed'
  | 'followup.deleted'
  | 'followup.auto_run'
  | 'message.email_sent'
  | 'message.whatsapp_sent';

export interface SalesAuditEntry {
  action: SalesAuditAction;
  resourceType: 'lead' | 'client' | 'quote' | 'invoice' | 'followup' | 'message';
  resourceId: string;
  resourceLabel?: string;
  actor: {
    uid: string;
    email: string;
    role?: string;
  };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Write a sales audit log entry. Fire-and-forget — never blocks.
 */
export function logSalesAudit(companyId: string, entry: SalesAuditEntry): void {
  const id = generateId();
  const doc = {
    id,
    ...entry,
    companyId,
    timestamp: FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString(),
  };

  // Fire and forget
  getFirestore()
    .collection(`companies/${companyId}/salesAuditLogs`)
    .doc(id)
    .set(doc)
    .catch(err => logger.error('[SalesAudit] Write failed', { error: err }));
}

/**
 * Helper: build a diff object showing only changed fields between before and after.
 */
export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
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
