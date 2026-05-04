/**
 * Audit Log Middleware
 * Logs every sensitive API action to Firestore `auditLogs` collection.
 * Required for RGPD/GDPR compliance and enterprise security.
 */
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
  id?:         string;
  companyId:   string;
  userId:      string;
  userEmail:   string;
  action:      string;          // e.g. 'document.upload', 'conversation.delete'
  resource:    string;          // e.g. 'documents', 'conversations'
  resourceId?: string;
  method:      string;          // GET | POST | DELETE etc.
  path:        string;
  ipAddress:   string;
  userAgent:   string;
  status?:     number;          // HTTP response status
  details?:    Record<string, unknown>;
  timestamp:   FirebaseFirestore.FieldValue;
}

// Actions to audit (method + path pattern → action label)
const AUDIT_RULES: { pattern: RegExp; method: string; action: string; resource: string }[] = [
  // Documents
  { pattern: /\/api\/data\/documents$/,      method: 'POST',   action: 'document.upload',   resource: 'documents' },
  { pattern: /\/api\/data\/documents\/\w+$/, method: 'DELETE', action: 'document.delete',   resource: 'documents' },
  { pattern: /\/api\/data\/documents$/,      method: 'GET',    action: 'document.list',     resource: 'documents' },
  // Conversations
  { pattern: /\/api\/chat\/conversations$/,       method: 'POST',   action: 'conversation.create', resource: 'conversations' },
  { pattern: /\/api\/chat\/conversations\/\w+$/,  method: 'DELETE', action: 'conversation.delete', resource: 'conversations' },
  // Agent / AI
  { pattern: /\/api\/agent\/conversations\/\w+\/messages$/, method: 'POST', action: 'agent.message', resource: 'agent' },
  // Auth
  { pattern: /\/api\/auth\/register$/,  method: 'POST', action: 'auth.register',  resource: 'auth' },
  // GDPR
  { pattern: /\/api\/gdpr\/export$/,    method: 'GET',  action: 'gdpr.export',    resource: 'gdpr' },
  { pattern: /\/api\/gdpr\/delete$/,    method: 'DELETE', action: 'gdpr.delete',  resource: 'gdpr' },
  // API Keys
  { pattern: /\/api\/apikeys$/,         method: 'POST',   action: 'apikey.create', resource: 'apikeys' },
  { pattern: /\/api\/apikeys\/\w+$/,    method: 'DELETE', action: 'apikey.revoke', resource: 'apikeys' },
  // Faces
  { pattern: /\/api\/faces$/,           method: 'POST',   action: 'face.register', resource: 'faces' },
  { pattern: /\/api\/faces\/\w+$/,      method: 'DELETE', action: 'face.delete',   resource: 'faces' },
  // Settings
  { pattern: /\/api\/auth\/company\/settings$/, method: 'PATCH', action: 'settings.update', resource: 'settings' },
];

function matchAuditRule(method: string, path: string) {
  return AUDIT_RULES.find((r) => r.method === method && r.pattern.test(path));
}

/**
 * Async fire-and-forget audit logger. Never blocks the request.
 */
async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection('auditLogs').add(entry);
  } catch (err) {
    logger.error('[AuditLog] Failed to write audit log', { error: err });
  }
}

/**
 * Express middleware — attaches to all protected routes.
 * Fires after the response is sent (non-blocking).
 */
export function auditLogMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const rule = matchAuditRule(req.method, req.path);

  if (!rule || !req.user) {
    next();
    return;
  }

  // Capture response status after it's sent
  const originalEnd = res.end.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.end = function (...args: any[]) {
    const result = originalEnd(...args);

    // Extract resourceId from URL path (last segment if it looks like an ID)
    const pathParts = req.path.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const resourceId = /^[a-zA-Z0-9_-]{8,}$/.test(lastPart) ? lastPart : undefined;

    setImmediate(() => {
      writeAuditLog({
        companyId:  req.user?.companyId ?? 'unknown',
        userId:     req.user?.uid ?? 'unknown',
        userEmail:  req.user?.email ?? 'unknown',
        action:     rule.action,
        resource:   rule.resource,
        resourceId,
        method:     req.method,
        path:       req.path,
        ipAddress:  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown',
        userAgent:  req.headers['user-agent'] ?? 'unknown',
        status:     res.statusCode,
        details:    rule.resource === 'documents' ? { fileName: (req.body as Record<string, unknown>)?.['fileName'] as string } : undefined,
        timestamp:  FieldValue.serverTimestamp(),
      });
    });

    return result;
  };

  next();
}
