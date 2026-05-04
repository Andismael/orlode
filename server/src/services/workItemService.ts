/**
 * Work Item Service
 * Every agent action creates a work item for the activity feed
 * Work items are the bridge between "agent did something" and "user sees the result"
 */
import { getFirestore } from '../config/firebase.config';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export type WorkItemType =
  | 'appointment_created'
  | 'client_added'
  | 'quote_created'
  | 'stock_updated'
  | 'alert_sent'
  | 'report_generated'
  | 'diagnostic_completed'
  | 'email_sent'
  | 'security_check'
  | 'analysis_completed';

export interface WorkItem {
  id: string;
  companyId: string;
  type: WorkItemType;
  agentId?: string;
  agentName?: string;
  agentIcon?: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  status: 'completed' | 'pending' | 'failed';
  createdAt: Date;
}

export async function createWorkItem(input: Omit<WorkItem, 'id' | 'createdAt'>): Promise<string> {
  const db = getFirestore();
  const id = generateId();

  try {
    await db.collection(`companies/${input.companyId}/workItems`).doc(id).set({
      ...input,
      id,
      createdAt: new Date(),
    });
    logger.info(`[WorkItem] Created: ${input.type} — ${input.title}`);
  } catch (err) {
    logger.error('[WorkItem] Failed to create', { error: err });
  }

  return id;
}
