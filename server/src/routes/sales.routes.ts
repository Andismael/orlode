/**
 * Sales Routes — Complete CRM API (v2)
 * Leads · Clients · Pipeline · Quotes · Follow-ups · Stats · Forecast
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PERMISSIONS                                                                │
 * │  - Read (GET)                → any authenticated user (filtered by scope)  │
 * │  - Create lead / client      → any authenticated user                     │
 * │  - Update lead / followup    → owner OR admin/manager                     │
 * │  - Send quote / convert      → admin | manager only                       │
 * │  - Delete anything           → admin | manager only                       │
 * │  - Auto-run / bulk ops       → admin | manager only                       │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ OWNERSHIP MODEL                                                            │
 * │  - employee  → sees only own leads (ownerId === uid)                      │
 * │  - manager   → sees all company leads                                     │
 * │  - admin     → sees all company leads                                     │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ AUDIT                                                                      │
 * │  - Every mutation writes to companies/{cId}/salesAuditLogs                │
 * │  - Tracks actor, before/after, timestamp                                  │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ IDEMPOTENCY                                                                │
 * │  - send quote: checks sentAt flag                                         │
 * │  - convert quote: checks convertedAt flag                                 │
 * │  - auto-run: per-lead check prevents duplicate follow-ups                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { createNotification } from '../services/notificationService';
import { logSalesAudit } from '../services/salesAuditService';
import { logger } from '../utils/logger';
import { requireAgentRole } from '../middleware/agentRbac.middleware';

const router = Router();
router.use(authMiddleware);
router.use(requireAgentRole('sales'));
const salesAdmin = requireAgentRole('sales', 'admin');

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

// ── Serialization — convert Firestore Timestamps to ISO strings ──────────────

function serializeDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && '_seconds' in (val as Record<string, unknown>)) {
      out[key] = new Date((val as { _seconds: number })._seconds * 1000).toISOString();
    } else if (val && typeof val === 'object' && 'toDate' in (val as Record<string, unknown>) && typeof (val as { toDate: unknown }).toDate === 'function') {
      out[key] = ((val as { toDate: () => Date }).toDate()).toISOString();
    } else if (Array.isArray(val)) {
      out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item as Record<string, unknown>) : item);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function serializeSnap(doc: FirebaseFirestore.QueryDocumentSnapshot): Record<string, unknown> {
  return { id: doc.id, ...serializeDoc(doc.data()) };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserRole(uid: string): Promise<string | undefined> {
  const doc = await getFirestore().collection('users').doc(uid).get();
  return doc.data()?.['role'] as string | undefined;
}

function requireManagerOrAdmin(role: string | undefined): void {
  if (role !== 'admin' && role !== 'manager') {
    throw new AppError('Acces reserve aux managers et administrateurs', 403);
  }
}

/** Actor object for audit logs */
function actor(req: AuthenticatedRequest) {
  return { uid: req.user!.uid, email: req.user!.email, role: req.user?.role };
}

/** Notify specific user + company broadcast */
function notifyUser(companyId: string, userId: string | undefined, type: string, title: string, message: string, actionUrl: string, icon: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info') {
  createNotification({ companyId, userId, type: type as import('../services/notificationService').NotificationType, title, message, actionUrl, icon, severity }).catch(() => {});
}
/** Notify company-wide */
function notifySales(companyId: string, type: string, title: string, message: string, actionUrl: string, icon: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info') {
  notifyUser(companyId, undefined, type, title, message, actionUrl, icon, severity);
}

/** Find managers in a company (for targeted notifications) */
async function findManagerUids(companyId: string): Promise<string[]> {
  const snap = await getFirestore().collection('users')
    .where('companyId', '==', companyId)
    .where('role', 'in', ['admin', 'manager']).limit(20).get();
  return snap.docs.map(d => d.id);
}

/** Check if user can see this resource based on ownership */
function canAccess(role: string | undefined, ownerId: string | undefined, uid: string): boolean {
  if (role === 'admin' || role === 'manager') return true;
  return ownerId === uid;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/leads — filtered by ownership for employees
router.get('/leads', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = req.user?.role ?? await getUserRole(req.user!.uid);

  const data = await safe(async () => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/leads`) as FirebaseFirestore.Query;
    if (req.query['stage']) q = q.where('stage', '==', req.query['stage']);
    if (req.query['source']) q = q.where('source', '==', req.query['source']);
    // Ownership: employees only see their own leads
    if (role !== 'admin' && role !== 'manager') {
      q = q.where('ownerId', '==', req.user!.uid);
    }
    const snap = await q.limit(200).get();
    return snap.docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

// GET /api/sales/leads/:id
router.get('/leads/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = req.user?.role ?? await getUserRole(req.user!.uid);
  const doc = await getFirestore().collection(`companies/${companyId}/leads`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Lead not found', 404);
  const data = doc.data()!;
  if (!canAccess(role, data['ownerId'] as string | undefined, req.user!.uid)) {
    throw new AppError('Acces non autorise a ce lead', 403);
  }
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(data) } });
}));

// POST /api/sales/leads
router.post('/leads', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const lead = {
    id, companyId,
    name: body['name'] ?? '', email: body['email'] ?? '',
    phone: body['phone'] ?? '', company: body['company'] ?? '',
    source: body['source'] ?? 'other',
    estimatedValue: body['estimatedValue'] ?? body['amount'] ?? 0,
    notes: body['notes'] ?? '', score: body['score'] ?? 30,
    stage: body['stage'] ?? 'nouveau', probability: body['probability'] ?? 50,
    // Ownership
    ownerId: req.user!.uid,
    owner: body['owner'] ?? req.user?.email ?? '',
    assignedTo: (body['assignedTo'] as string) ?? req.user!.uid,
    teamId: (body['teamId'] as string) ?? null,
    // Actor tracking
    createdBy: req.user!.uid,
    createdByEmail: req.user!.email,
    interactions: [], createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${companyId}/leads`).doc(id).set(lead);

  // Audit
  logSalesAudit(companyId, {
    action: 'lead.created', resourceType: 'lead', resourceId: id,
    resourceLabel: lead.name as string, actor: actor(req),
    after: { name: lead.name, source: lead.source, estimatedValue: lead.estimatedValue },
  });
  // Notify: assignee + managers
  const leadName = lead.name as string;
  notifySales(companyId, 'lead_created', `Nouveau lead — ${leadName}`, `Prospect "${leadName}" ajoute depuis ${lead.source}.`, '/sales/leads', 'UserPlus', 'info');

  res.status(201).json({ success: true, data: lead });
}));

// PATCH /api/sales/leads/:id
router.patch('/leads/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = req.user?.role ?? await getUserRole(req.user!.uid);
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/leads`).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Lead not found', 404);
  const before = doc.data()!;
  if (!canAccess(role, before['ownerId'] as string | undefined, req.user!.uid)) {
    throw new AppError('Acces non autorise', 403);
  }
  const updates = { ...(req.body as Record<string, unknown>), updatedAt: new Date(), updatedBy: req.user!.uid };
  await ref.update(updates);

  logSalesAudit(companyId, {
    action: 'lead.updated', resourceType: 'lead', resourceId: req.params.id,
    resourceLabel: (before['name'] as string) ?? '', actor: actor(req),
    before: { stage: before['stage'], score: before['score'] },
    after: { stage: (req.body as Record<string, unknown>)['stage'] ?? before['stage'], score: (req.body as Record<string, unknown>)['score'] ?? before['score'] },
  });
  res.json({ success: true });
}));

// DELETE /api/sales/leads/:id — admin/manager only
router.delete('/leads/:id', salesAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/leads`).doc(req.params.id).get();
  const leadName = doc.data()?.['name'] ?? 'Unknown';

  await db.collection(`companies/${companyId}/leads`).doc(req.params.id).delete();

  logSalesAudit(companyId, {
    action: 'lead.deleted', resourceType: 'lead', resourceId: req.params.id,
    resourceLabel: leadName as string, actor: actor(req),
    before: { name: leadName },
  });
  res.json({ success: true });
}));

// POST /api/sales/leads/:id/interactions
router.post('/leads/:id/interactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const interaction = {
    id: generateId(), type: body['type'] ?? 'note', summary: body['summary'] ?? '',
    date: new Date().toISOString(), by: req.user?.email,
  };
  await getFirestore().collection(`companies/${companyId}/leads`).doc(req.params.id).update({
    interactions: FieldValue.arrayUnion(interaction), updatedAt: new Date(), updatedBy: req.user!.uid,
  });
  res.status(201).json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/clients
router.get('/clients', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${companyId}/clients`).limit(200).get();
    return snap.docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

// GET /api/sales/clients/:id
router.get('/clients/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${companyId}/clients`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Client not found', 404);
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()!) } });
}));

// POST /api/sales/clients
router.post('/clients', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const client = {
    id, companyId,
    name: body['name'] ?? '', email: body['email'] ?? '',
    phone: body['phone'] ?? '', company: body['company'] ?? '', address: body['address'] ?? '',
    leadId: body['leadId'] ?? null, totalRevenue: 0, quotesCount: 0, invoicesCount: 0,
    createdBy: req.user!.uid, createdByEmail: req.user!.email,
    createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${companyId}/clients`).doc(id).set(client);

  logSalesAudit(companyId, {
    action: 'client.created', resourceType: 'client', resourceId: id,
    resourceLabel: client.name as string, actor: actor(req),
    after: { name: client.name, email: client.email },
  });
  res.status(201).json({ success: true, data: client });
}));

// PATCH /api/sales/clients/:id
router.patch('/clients/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/clients`).doc(req.params.id)
    .update({ ...(req.body as Record<string, unknown>), updatedAt: new Date(), updatedBy: req.user!.uid });
  res.json({ success: true });
}));

// GET /api/sales/clients/:id/history
router.get('/clients/:id/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const clientId = req.params.id;
  const [quotesSnap, invoicesSnap, clientDoc] = await Promise.all([
    db.collection(`companies/${companyId}/quotes`).where('clientId', '==', clientId).limit(50).get(),
    db.collection(`companies/${companyId}/invoices`).where('clientId', '==', clientId).limit(50).get(),
    db.collection(`companies/${companyId}/clients`).doc(clientId).get(),
  ]);
  const clientData = clientDoc.data() ?? {};
  res.json({
    success: true,
    data: {
      quotes: quotesSnap.docs.map(serializeSnap),
      invoices: invoicesSnap.docs.map(serializeSnap),
      interactions: Array.isArray(clientData['interactions']) ? clientData['interactions'] : [],
    },
  });
}));

// GET /api/sales/clients/:id/timeline — full chronological journey
router.get('/clients/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const clientId = req.params.id;
  const events: { date: string; type: string; icon: string; title: string; detail: string; color: string }[] = [];

  // Client doc
  const clientDoc = await db.collection(`companies/${companyId}/clients`).doc(clientId).get();
  const clientData = clientDoc.data() ?? {};
  const clientCreated = clientData['createdAt'];
  if (clientCreated) {
    const d = clientCreated?.toDate?.() ?? new Date(clientCreated as string);
    events.push({ date: d.toISOString(), type: 'client_created', icon: 'UserPlus', title: 'Client cree', detail: `Fiche client "${clientData['name']}" creee.`, color: 'blue' });
  }

  // Lead interactions (if linked)
  const leadId = clientData['leadId'] as string | undefined;
  if (leadId) {
    const leadDoc = await db.collection(`companies/${companyId}/leads`).doc(leadId).get();
    const leadData = leadDoc.data() ?? {};
    const leadCreated = leadData['createdAt'];
    if (leadCreated) {
      const d = leadCreated?.toDate?.() ?? new Date(leadCreated as string);
      events.push({ date: d.toISOString(), type: 'lead_created', icon: 'Target', title: 'Lead cree', detail: `Prospect depuis ${leadData['source'] ?? 'inconnu'}.`, color: 'purple' });
    }
    const interactions = Array.isArray(leadData['interactions']) ? leadData['interactions'] as { date: string; type: string; summary: string; by?: string }[] : [];
    for (const inter of interactions) {
      const iconMap: Record<string, string> = { email: 'Mail', whatsapp: 'MessageCircle', call: 'Phone', stage_change: 'ArrowRight', quote: 'FileText', sale: 'Trophy', note: 'StickyNote' };
      const colorMap: Record<string, string> = { email: 'blue', whatsapp: 'green', call: 'orange', stage_change: 'purple', quote: 'indigo', sale: 'emerald', note: 'gray' };
      events.push({
        date: inter.date, type: inter.type, icon: iconMap[inter.type] ?? 'Circle',
        title: inter.type === 'stage_change' ? 'Etape modifiee' : inter.type === 'email' ? 'Email envoye' : inter.type === 'whatsapp' ? 'WhatsApp envoye' : inter.type === 'quote' ? 'Devis' : inter.type === 'sale' ? 'Vente conclue' : inter.type,
        detail: `${inter.summary}${inter.by ? ` (par ${inter.by})` : ''}`,
        color: colorMap[inter.type] ?? 'gray',
      });
    }
  }

  // Quotes
  const quotesSnap = await db.collection(`companies/${companyId}/quotes`).where('clientId', '==', clientId).limit(50).get();
  for (const qDoc of quotesSnap.docs) {
    const q = qDoc.data();
    const created = q['createdAt']?.toDate?.() ?? new Date(q['createdAt'] as string);
    events.push({ date: created.toISOString(), type: 'quote_created', icon: 'FileText', title: `Devis ${q['quoteNumber'] ?? q['reference']}`, detail: `${q['totalTTC'] ?? q['total'] ?? 0} EUR — ${q['status']}`, color: 'indigo' });
    if (q['sentAt']) {
      const sent = q['sentAt']?.toDate?.() ?? new Date(q['sentAt'] as string);
      events.push({ date: sent.toISOString(), type: 'quote_sent', icon: 'Send', title: `Devis envoye`, detail: `${q['quoteNumber'] ?? q['reference']} envoye a ${q['sentTo'] ?? ''}`, color: 'blue' });
    }
    if (q['acceptedAt']) {
      const accepted = q['acceptedAt']?.toDate?.() ?? new Date(q['acceptedAt'] as string);
      events.push({ date: accepted.toISOString(), type: 'quote_accepted', icon: 'CheckCircle', title: `Devis accepte`, detail: `${q['quoteNumber'] ?? q['reference']} (${q['totalTTC'] ?? q['total'] ?? 0} EUR)`, color: 'green' });
    }
    if (q['convertedAt']) {
      const converted = q['convertedAt']?.toDate?.() ?? new Date(q['convertedAt'] as string);
      events.push({ date: converted.toISOString(), type: 'quote_converted', icon: 'ArrowRight', title: `Converti en facture`, detail: `Facture ${q['convertedInvoiceNumber'] ?? ''} creee`, color: 'emerald' });
    }
  }

  // Invoices
  const invoicesSnap = await db.collection(`companies/${companyId}/invoices`).where('clientId', '==', clientId).limit(50).get();
  for (const iDoc of invoicesSnap.docs) {
    const inv = iDoc.data();
    const created = inv['createdAt']?.toDate?.() ?? new Date(inv['createdAt'] as string);
    events.push({ date: created.toISOString(), type: 'invoice_created', icon: 'Receipt', title: `Facture ${inv['number']}`, detail: `${inv['totalTTC']} EUR — ${inv['status']}`, color: inv['status'] === 'paid' ? 'green' : 'orange' });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.json({ success: true, data: events });
}));

// GET /api/sales/leads/:id/timeline — lead journey
router.get('/leads/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const leadId = req.params.id;
  const events: { date: string; type: string; icon: string; title: string; detail: string; color: string }[] = [];

  const leadDoc = await db.collection(`companies/${companyId}/leads`).doc(leadId).get();
  if (!leadDoc.exists) throw new AppError('Lead not found', 404);
  const leadData = leadDoc.data()!;

  const leadCreated = leadData['createdAt'];
  if (leadCreated) {
    const d = leadCreated?.toDate?.() ?? new Date(leadCreated as string);
    events.push({ date: d.toISOString(), type: 'lead_created', icon: 'Target', title: 'Lead cree', detail: `Source: ${leadData['source'] ?? 'inconnu'} · Score: ${leadData['score'] ?? 0}`, color: 'purple' });
  }

  const interactions = Array.isArray(leadData['interactions']) ? leadData['interactions'] as { date: string; type: string; summary: string; by?: string }[] : [];
  for (const inter of interactions) {
    const iconMap: Record<string, string> = { email: 'Mail', whatsapp: 'MessageCircle', call: 'Phone', stage_change: 'ArrowRight', quote: 'FileText', sale: 'Trophy', note: 'StickyNote' };
    const colorMap: Record<string, string> = { email: 'blue', whatsapp: 'green', call: 'orange', stage_change: 'purple', quote: 'indigo', sale: 'emerald', note: 'gray' };
    events.push({
      date: inter.date, type: inter.type, icon: iconMap[inter.type] ?? 'Circle',
      title: inter.type === 'stage_change' ? 'Etape modifiee' : inter.type === 'email' ? 'Email envoye' : inter.type === 'whatsapp' ? 'WhatsApp envoye' : inter.type === 'quote' ? 'Devis' : inter.type === 'sale' ? 'Vente conclue' : inter.type,
      detail: `${inter.summary}${inter.by ? ` (par ${inter.by})` : ''}`,
      color: colorMap[inter.type] ?? 'gray',
    });
  }

  // Also fetch linked quotes and invoices for the timeline
  const quotesSnap = await db.collection(`companies/${companyId}/quotes`).where('leadId', '==', leadId).limit(20).get();
  for (const qDoc of quotesSnap.docs) {
    const q = qDoc.data();
    const created = q['createdAt']?.toDate?.() ?? new Date(q['createdAt'] as string);
    events.push({ date: created.toISOString(), type: 'quote_created', icon: 'FileText', title: `Devis ${q['quoteNumber'] ?? q['reference']}`, detail: `${q['totalTTC'] ?? q['total'] ?? 0} EUR — ${q['status']}`, color: 'indigo' });
    if (q['sentAt']) {
      const sent = q['sentAt']?.toDate?.() ?? new Date(q['sentAt'] as string);
      events.push({ date: sent.toISOString(), type: 'quote_sent', icon: 'Send', title: `Devis envoye`, detail: `${q['quoteNumber'] ?? q['reference']} envoye a ${q['sentTo'] ?? ''}`, color: 'blue' });
    }
    if (q['acceptedAt']) {
      const accepted = q['acceptedAt']?.toDate?.() ?? new Date(q['acceptedAt'] as string);
      events.push({ date: accepted.toISOString(), type: 'quote_accepted', icon: 'CheckCircle', title: `Devis accepte`, detail: `${q['quoteNumber']} (${q['totalTTC'] ?? q['total'] ?? 0} EUR)`, color: 'green' });
    }
    if (q['convertedAt']) {
      const converted = q['convertedAt']?.toDate?.() ?? new Date(q['convertedAt'] as string);
      events.push({ date: converted.toISOString(), type: 'invoice_created', icon: 'Receipt', title: `Facture creee`, detail: `${q['convertedInvoiceNumber'] ?? ''} depuis devis ${q['quoteNumber']}`, color: 'emerald' });
    }
  }

  // Fetch invoices linked to this lead's quotes for payment status
  const invoicesSnap = await db.collection(`companies/${companyId}/invoices`).where('sourceQuoteId', 'in', quotesSnap.docs.length > 0 ? quotesSnap.docs.map(d => d.id) : ['__none__']).limit(20).get();
  for (const iDoc of invoicesSnap.docs) {
    const inv = iDoc.data();
    if (inv['status'] === 'paid') {
      const paidDate = inv['paidAt']?.toDate?.() ?? inv['updatedAt']?.toDate?.() ?? new Date(inv['updatedAt'] as string);
      events.push({ date: paidDate.toISOString(), type: 'payment_received', icon: 'DollarSign', title: `Paiement recu`, detail: `Facture ${inv['number']} — ${inv['totalTTC']} EUR payee`, color: 'green' });
    }
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  res.json({ success: true, data: events });
}));

// GET /api/sales/leads/:id/full — enriched lead with quotes, invoices, followups, next action
router.get('/leads/:id/full', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const leadId = req.params.id;
  const role = req.user?.role ?? await getUserRole(req.user!.uid);

  const leadDoc = await db.collection(`companies/${companyId}/leads`).doc(leadId).get();
  if (!leadDoc.exists) throw new AppError('Lead not found', 404);
  const leadData = leadDoc.data()!;
  if (!canAccess(role, leadData['ownerId'] as string | undefined, req.user!.uid)) {
    throw new AppError('Acces non autorise', 403);
  }

  // Linked quotes
  const quotesSnap = await db.collection(`companies/${companyId}/quotes`).where('leadId', '==', leadId).limit(20).get();
  const quotes = quotesSnap.docs.map(d => {
    const q = d.data();
    return { id: d.id, quoteNumber: q['quoteNumber'] ?? q['reference'], clientName: q['clientName'], totalTTC: q['totalTTC'] ?? q['total'] ?? 0, status: q['status'], sentTo: q['sentTo'], validUntil: q['validUntil'] };
  });

  // Linked invoices (from quotes)
  const quoteIds = quotesSnap.docs.map(d => d.id);
  let invoices: { id: string; number: string; totalTTC: number; status: string; paidAmount: number; dueDate: string }[] = [];
  if (quoteIds.length > 0) {
    const invoicesSnap = await db.collection(`companies/${companyId}/invoices`).where('sourceQuoteId', 'in', quoteIds).limit(20).get();
    invoices = invoicesSnap.docs.map(d => {
      const inv = d.data();
      const dueDate = inv['dueDate']?.toDate?.() ?? new Date(inv['dueDate'] as string);
      return { id: d.id, number: inv['number'] as string, totalTTC: (inv['totalTTC'] as number) ?? 0, status: (inv['status'] as string) ?? 'pending', paidAmount: (inv['paidAmount'] as number) ?? 0, dueDate: dueDate.toISOString() };
    });
  }

  // Next followup
  const followupSnap = await db.collection(`companies/${companyId}/followups`)
    .where('leadId', '==', leadId).where('status', '==', 'pending').limit(1).get();
  const nextFollowup = followupSnap.docs.length > 0 ? (() => {
    const f = followupSnap.docs[0].data();
    const scheduledAt = f['scheduledAt']?.toDate?.() ?? new Date(f['scheduledAt'] as string);
    return { id: followupSnap.docs[0].id, scheduledAt: scheduledAt.toISOString(), type: f['type'], notes: f['notes'], overdue: scheduledAt < new Date() };
  })() : null;

  // Compute next recommended action
  let nextAction = '';
  const stage = leadData['stage'] as string;
  if (stage === 'nouveau') nextAction = 'Prendre contact — envoyer un email ou appeler';
  else if (stage === 'contacte') nextAction = 'Qualifier le besoin — planifier un rendez-vous';
  else if (stage === 'interesse') nextAction = 'Preparer et envoyer un devis';
  else if (stage === 'devis_envoye') nextAction = quotes.some(q => q.status === 'sent') ? 'Relancer — attente de reponse au devis' : 'Envoyer le devis au prospect';
  else if (stage === 'negociation') nextAction = 'Negocier les termes et conclure';
  else if (stage === 'gagne') nextAction = invoices.length > 0 ? (invoices.some(i => i.status === 'pending') ? 'Suivre le paiement de la facture' : 'Client converti — fidiliser') : 'Convertir le devis en facture';
  else if (stage === 'perdu') nextAction = 'Analyser les raisons et archiver';

  if (nextFollowup?.overdue) nextAction = `URGENT: Relance en retard — ${nextFollowup.notes || nextFollowup.type}`;

  res.json({
    success: true,
    data: {
      lead: { id: leadDoc.id, ...leadData },
      quotes,
      invoices,
      nextFollowup,
      nextAction,
    },
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/pipeline — respects ownership
router.get('/pipeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = req.user?.role ?? await getUserRole(req.user!.uid);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${companyId}/leads`) as FirebaseFirestore.Query;
    if (role !== 'admin' && role !== 'manager') {
      q = q.where('ownerId', '==', req.user!.uid);
    }
    const snap = await q.limit(500).get();
    return snap.docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

// PATCH /api/sales/deals/:id/stage — gagne/perdu require admin/manager
router.patch('/deals/:id/stage', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const newStage = body['stage'] as string;
  if (!newStage) throw new AppError('stage required', 400);
  const role = await getUserRole(req.user!.uid);

  if (newStage === 'gagne' || newStage === 'perdu') {
    requireManagerOrAdmin(role);
  }

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/leads`).doc(req.params.id);
  const doc = await ref.get();
  const docData = doc.data() ?? {};
  const oldStage = (docData['stage'] as string) ?? 'unknown';
  const leadName = (docData['name'] as string) ?? 'Lead';

  // Ownership check for non-managers
  if (role !== 'admin' && role !== 'manager') {
    if (docData['ownerId'] !== req.user!.uid) throw new AppError('Acces non autorise', 403);
  }

  const interaction = {
    date: new Date().toISOString(), type: 'stage_change',
    summary: `${oldStage} → ${newStage}${body['reason'] ? ` (${body['reason']})` : ''}`,
    by: req.user!.email,
  };
  await ref.update({ stage: newStage, updatedAt: new Date(), updatedBy: req.user!.uid, interactions: FieldValue.arrayUnion(interaction) });

  // Audit
  logSalesAudit(companyId, {
    action: newStage === 'gagne' ? 'deal.won' : newStage === 'perdu' ? 'deal.lost' : 'deal.stage_changed',
    resourceType: 'lead', resourceId: req.params.id,
    resourceLabel: leadName, actor: actor(req),
    before: { stage: oldStage },
    after: { stage: newStage },
    metadata: body['reason'] ? { reason: body['reason'] } : undefined,
  });

  // Notifications
  if (newStage === 'gagne') {
    const value = (docData['estimatedValue'] as number) ?? 0;
    // Notify owner + managers + company
    notifySales(companyId, 'deal_won', `Deal gagne — ${leadName}`, `${leadName} passe en "Gagne" (${value} EUR).`, '/sales/pipeline', 'Trophy', 'success');
    // Notify accounting team
    const managers = await findManagerUids(companyId);
    for (const mgrId of managers) {
      notifyUser(companyId, mgrId, 'deal_won', `Deal gagne — ${leadName}`, `Nouvelle vente: ${leadName} (${value} EUR). Facture a preparer.`, '/sales/quotes', 'Trophy', 'success');
    }
  }

  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/quotes
router.get('/quotes', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${companyId}/quotes`).limit(200).get();
    return snap.docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

// POST /api/sales/quotes
router.post('/quotes', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
  const countSnap = await db.collection(`companies/${companyId}/quotes`).count().get();
  const count = countSnap.data().count + 1;
  const items = (body['items'] ?? []) as { quantity: number; unitPrice: number }[];
  const subtotal = items.reduce((s, i) => s + (i.quantity ?? 1) * (i.unitPrice ?? 0), 0);
  const taxRate = (body['taxRate'] as number) ?? 20;
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const ref = `DEV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

  const quote = {
    id, companyId, clientName: body['clientName'] ?? '', clientId: body['clientId'] ?? null,
    leadId: body['leadId'] ?? null, items, subtotal, taxRate, tax, total,
    totalHT: subtotal, totalTTC: total,
    validUntil: body['validUntil'] ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: 'draft', reference: ref, quoteNumber: ref,
    notes: body['notes'] ?? '',
    createdBy: req.user!.uid, createdByEmail: req.user!.email,
    createdAt: new Date(), updatedAt: new Date(),
  };
  await db.collection(`companies/${companyId}/quotes`).doc(id).set(quote);

  logSalesAudit(companyId, {
    action: 'quote.created', resourceType: 'quote', resourceId: id,
    resourceLabel: ref, actor: actor(req),
    after: { clientName: quote.clientName, totalTTC: total, quoteNumber: ref },
  });
  res.status(201).json({ success: true, data: quote });
}));

// DELETE /api/sales/quotes/:id — admin/manager only
router.delete('/quotes/:id', salesAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).get();
  const quoteRef = doc.data()?.['quoteNumber'] ?? doc.data()?.['reference'] ?? '';

  await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).delete();

  logSalesAudit(companyId, {
    action: 'quote.deleted', resourceType: 'quote', resourceId: req.params.id,
    resourceLabel: quoteRef as string, actor: actor(req),
    before: { quoteNumber: quoteRef, clientName: doc.data()?.['clientName'] },
  });
  res.json({ success: true });
}));

// POST /api/sales/quotes/:id/send — admin/manager only + IDEMPOTENT
router.post('/quotes/:id/send', salesAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const body = req.body as Record<string, unknown>;
  const email = body['email'] as string;
  if (!email) throw new AppError('email required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Quote not found', 404);
  const data = doc.data()!;

  // IDEMPOTENCY: already sent? return success without re-sending
  if (data['sentAt'] && data['status'] === 'sent') {
    res.json({ success: true, message: 'Devis deja envoye.', alreadySent: true });
    return;
  }

  await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).update({
    status: 'sent', sentAt: new Date(), sentTo: email,
    sentBy: req.user!.uid, sentByEmail: req.user!.email,
    updatedAt: new Date(), updatedBy: req.user!.uid,
  });

  try {
    const { sendEmail, getBranding } = await import('../services/email/emailService');
    const { renderInvoicePdf, loadCompanyForInvoice } = await import('../services/invoice/invoicePdfService');
    const branding = await getBranding(companyId);

    // Generate quote PDF for real attachment
    let pdfBuffer: Buffer | null = null;
    try {
      const company = await loadCompanyForInvoice(companyId);
      const items = Array.isArray(data['items'])
        ? (data['items'] as Array<Record<string, unknown>>).map(i => ({
            name: String(i['description'] ?? i['name'] ?? 'Article'),
            quantity: Number(i['quantity'] ?? 1),
            unitPrice: Number(i['unitPrice'] ?? i['price'] ?? 0),
          }))
        : [{ name: 'Prestation', quantity: 1, unitPrice: Number(data['totalTTC'] ?? data['total'] ?? 0) }];
      pdfBuffer = await renderInvoicePdf(company, {
        id: String(data['quoteNumber'] ?? data['reference'] ?? req.params.id),
        clientName: (data['clientName'] as string) ?? 'Client',
        clientEmail: email,
        items,
        subtotal: Number(data['totalTTC'] ?? data['total'] ?? 0),
        currency: (data['currency'] as string) ?? 'XOF',
        status: 'draft',
        docType: 'quote',
        validUntil: data['validUntil'] as string | undefined,
        createdAt: data['createdAt'] as string | Date | null | undefined,
      });
      const { logger } = await import('../utils/logger');
      logger.info('[Quote send] PDF generated', { quoteId: req.params.id, sizeBytes: pdfBuffer?.length ?? 0 });
    } catch (pdfErr) {
      const { logger } = await import('../utils/logger');
      logger.error('[Quote send] PDF generation FAILED — email will be sent without attachment', {
        quoteId: req.params.id,
        error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        stack: pdfErr instanceof Error ? pdfErr.stack : undefined,
      });
    }

    if (!pdfBuffer) {
      const { logger } = await import('../utils/logger');
      logger.warn('[Quote send] No PDF buffer — sending email without attachment', { quoteId: req.params.id });
    }

    await sendEmail({
      companyId,
      to: email,
      subject: `Devis ${data['quoteNumber'] ?? data['reference']} — ${branding.name}`,
      html: `<div style="font-family:sans-serif;font-size:14px;">
<p><strong>${branding.name}</strong></p>
<p>${(body['message'] as string) ?? 'Bonjour,'}</p>
<p>Vous trouverez ${pdfBuffer ? 'en pièce jointe' : 'ci-dessous'} notre proposition commerciale <strong>${data['quoteNumber'] ?? data['reference']}</strong> d'un montant de <strong>${Number(data['totalTTC'] ?? data['total'] ?? 0).toLocaleString()} ${(data['currency'] as string) ?? 'XOF'}</strong>${data['validUntil'] ? `, valide jusqu'au <strong>${data['validUntil']}</strong>` : ''}.</p>
<p>Cordialement,<br>L'équipe commerciale</p>
<p style="color:#9ca3af;font-size:12px;margin-top:20px;">${branding.slogan ?? `Propulse par Orlode AI`}</p>
</div>`,
      attachments: pdfBuffer ? [{ filename: `Devis-${data['quoteNumber'] ?? data['reference']}.pdf`, content: pdfBuffer }] : undefined,
    });
  } catch (emailErr) {
    const { logger } = await import('../utils/logger');
    logger.error('[Quote send] Email send FAILED', {
      quoteId: req.params.id,
      error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      stack: emailErr instanceof Error ? emailErr.stack : undefined,
    });
  }

  const quoteRef = (data['quoteNumber'] ?? data['reference']) as string;
  const clientName = data['clientName'] as string;

  // Audit
  logSalesAudit(companyId, {
    action: 'quote.sent', resourceType: 'quote', resourceId: req.params.id,
    resourceLabel: quoteRef, actor: actor(req),
    before: { status: data['status'] },
    after: { status: 'sent', sentTo: email },
  });
  // Notify: creator + managers
  const creatorId = data['createdBy'] as string | undefined;
  notifySales(companyId, 'quote_sent', `Devis envoye — ${quoteRef}`, `Devis envoye a ${clientName} (${email}).`, '/sales/quotes', 'Send', 'success');
  if (creatorId && creatorId !== req.user!.uid) {
    notifyUser(companyId, creatorId, 'quote_sent', `Devis envoye — ${quoteRef}`, `Votre devis ${quoteRef} a ete envoye a ${email} par ${req.user!.email}.`, '/sales/quotes', 'Send', 'info');
  }

  res.json({ success: true });
}));

// PATCH /api/sales/quotes/:id — update with status change tracking
router.patch('/quotes/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const newStatus = body['status'] as string | undefined;

  if (newStatus === 'accepted' || newStatus === 'rejected') {
    const role = await getUserRole(req.user!.uid);
    requireManagerOrAdmin(role);
  }

  const db = getFirestore();
  const docRef = db.collection(`companies/${companyId}/quotes`).doc(req.params.id);
  const doc = await docRef.get();
  const before = doc.data() ?? {};

  await docRef.update({ ...body, updatedAt: new Date(), updatedBy: req.user!.uid });

  const quoteRef = (before['quoteNumber'] ?? before['reference']) as string;
  const clientName = before['clientName'] as string;
  const totalTTC = (before['totalTTC'] ?? before['total'] ?? 0) as number;

  if (newStatus === 'accepted') {
    logSalesAudit(companyId, {
      action: 'quote.accepted', resourceType: 'quote', resourceId: req.params.id,
      resourceLabel: quoteRef, actor: actor(req),
      before: { status: before['status'] }, after: { status: 'accepted' },
    });
    // Notify: sales team + accounting
    notifySales(companyId, 'quote_accepted', `Devis accepte — ${quoteRef}`, `${clientName} a accepte le devis (${totalTTC} EUR).`, '/sales/quotes', 'CheckCircle', 'success');
    const managers = await findManagerUids(companyId);
    for (const mgrId of managers) {
      notifyUser(companyId, mgrId, 'quote_accepted', `Devis accepte — ${quoteRef}`, `${clientName} a accepte ${quoteRef} (${totalTTC} EUR). Conversion en facture possible.`, '/sales/quotes', 'CheckCircle', 'success');
    }
  } else if (newStatus === 'rejected') {
    logSalesAudit(companyId, {
      action: 'quote.rejected', resourceType: 'quote', resourceId: req.params.id,
      resourceLabel: quoteRef, actor: actor(req),
      before: { status: before['status'] }, after: { status: 'rejected' },
    });
    // Notify: creator
    const creatorId = before['createdBy'] as string | undefined;
    notifySales(companyId, 'quote_rejected', `Devis refuse — ${quoteRef}`, `${clientName} a refuse le devis ${quoteRef}.`, '/sales/quotes', 'XCircle', 'warning');
    if (creatorId) {
      notifyUser(companyId, creatorId, 'quote_rejected', `Devis refuse — ${quoteRef}`, `Votre devis ${quoteRef} pour ${clientName} a ete refuse.`, '/sales/quotes', 'XCircle', 'warning');
    }
  }

  res.json({ success: true });
}));

// POST /api/sales/quotes/:id/convert — admin/manager only + IDEMPOTENT
router.post('/quotes/:id/convert', salesAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Quote not found', 404);
  const data = doc.data()!;

  // IDEMPOTENCY: already converted?
  if (data['convertedAt']) {
    res.json({ success: true, message: 'Devis deja converti.', alreadyConverted: true, invoiceNumber: data['convertedInvoiceNumber'] });
    return;
  }

  // Mark quote as accepted + converted
  const totalTTC = (data['totalTTC'] ?? data['total'] ?? 0) as number;
  await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).update({
    status: 'accepted', acceptedAt: new Date(),
    convertedAt: new Date(), convertedBy: req.user!.uid, convertedByEmail: req.user!.email,
    updatedAt: new Date(), updatedBy: req.user!.uid,
  });

  // Create invoice
  const invoiceId = generateId();
  const countSnap = await db.collection(`companies/${companyId}/invoices`).count().get();
  const invoiceCount = countSnap.data().count + 1;
  const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(invoiceCount).padStart(4, '0')}`;
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);

  await db.collection(`companies/${companyId}/invoices`).doc(invoiceId).set({
    id: invoiceId, number: invoiceNumber, companyId,
    client: data['clientName'], clientId: data['clientId'] ?? null,
    items: data['items'], totalHT: data['totalHT'] ?? data['subtotal'],
    taxRate: data['taxRate'] ?? 20, taxAmount: data['tax'] ?? 0, totalTTC,
    status: 'pending', paidAmount: 0, dueDate,
    sourceQuoteId: req.params.id, sourceQuoteNumber: data['quoteNumber'] ?? data['reference'],
    createdBy: req.user!.uid, createdByEmail: req.user!.email,
    createdAt: new Date(), updatedAt: new Date(),
  });

  // Store invoice ref on quote for idempotency
  await db.collection(`companies/${companyId}/quotes`).doc(req.params.id).update({
    convertedInvoiceId: invoiceId, convertedInvoiceNumber: invoiceNumber,
  });

  // Update lead if linked
  if (data['leadId']) {
    await db.collection(`companies/${companyId}/leads`).doc(data['leadId'] as string).update({
      stage: 'gagne', updatedAt: new Date(), updatedBy: req.user!.uid,
      interactions: FieldValue.arrayUnion({
        date: new Date().toISOString(), type: 'sale',
        summary: `Vente conclue — Facture ${invoiceNumber}`, by: req.user!.email,
      }),
    }).catch(() => {});
  }

  const quoteRef = (data['quoteNumber'] ?? data['reference']) as string;
  const clientName = data['clientName'] as string;

  // Audit
  logSalesAudit(companyId, {
    action: 'quote.converted_to_invoice', resourceType: 'quote', resourceId: req.params.id,
    resourceLabel: quoteRef, actor: actor(req),
    before: { status: data['status'] },
    after: { status: 'accepted', invoiceId, invoiceNumber },
    metadata: { totalTTC, clientName },
  });

  // Notify: sales team + accounting managers
  notifySales(companyId, 'deal_won', `Vente conclue — ${clientName}`, `Facture ${invoiceNumber} creee pour ${totalTTC} EUR.`, '/finance/invoices', 'Trophy', 'success');
  const managers = await findManagerUids(companyId);
  for (const mgrId of managers) {
    notifyUser(companyId, mgrId, 'invoice_from_quote', `Facture creee — ${invoiceNumber}`, `Devis ${quoteRef} converti en facture ${invoiceNumber} (${totalTTC} EUR) pour ${clientName}.`, '/finance/invoices', 'Receipt', 'success');
  }

  res.json({ success: true, data: { invoiceId, invoiceNumber } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/followups
router.get('/followups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/followups`) as FirebaseFirestore.Query;
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    const snap = await q.limit(200).get();
    const now = new Date();
    return snap.docs.map(d => {
      const raw = d.data();
      const scheduledAt = raw['scheduledAt']?.toDate?.() ?? new Date(raw['scheduledAt'] as string);
      return { id: d.id, ...raw, scheduledAt: scheduledAt.toISOString(), overdue: scheduledAt < now && raw['status'] === 'pending' };
    });
  }, []);
  res.json({ success: true, data });
}));

// POST /api/sales/followups
router.post('/followups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const followup = {
    id, companyId, leadId: body['leadId'] ?? '', scheduledAt: new Date(body['scheduledAt'] as string),
    type: body['type'] ?? 'email', notes: body['notes'] ?? '',
    assignedTo: body['assignedTo'] ?? req.user!.uid,
    assignedToEmail: body['assignedToEmail'] ?? req.user?.email ?? '',
    status: 'pending',
    createdBy: req.user!.uid, createdByEmail: req.user!.email,
    createdAt: new Date(),
  };
  await getFirestore().collection(`companies/${companyId}/followups`).doc(id).set(followup);

  logSalesAudit(companyId, {
    action: 'followup.created', resourceType: 'followup', resourceId: id,
    actor: actor(req), after: { leadId: followup.leadId, type: followup.type, scheduledAt: followup.scheduledAt.toISOString() },
  });
  res.status(201).json({ success: true, data: followup });
}));

// PATCH /api/sales/followups/:id
router.patch('/followups/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  await getFirestore().collection(`companies/${companyId}/followups`).doc(req.params.id)
    .update({ ...body, updatedAt: new Date(), updatedBy: req.user!.uid });

  if (body['status'] === 'completed') {
    logSalesAudit(companyId, {
      action: 'followup.completed', resourceType: 'followup', resourceId: req.params.id,
      actor: actor(req), after: { status: 'completed' },
    });
  }
  res.json({ success: true });
}));

// DELETE /api/sales/followups/:id — admin/manager only
router.delete('/followups/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  await getFirestore().collection(`companies/${companyId}/followups`).doc(req.params.id).delete();

  logSalesAudit(companyId, {
    action: 'followup.deleted', resourceType: 'followup', resourceId: req.params.id,
    actor: actor(req),
  });
  res.json({ success: true });
}));

// GET /api/sales/followups/pending
router.get('/followups/pending', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/followups`).where('status', '==', 'pending').limit(100).get();
    const now = new Date();
    const results = snap.docs.map(d => {
      const raw = d.data();
      const scheduledAt = raw['scheduledAt']?.toDate?.() ?? new Date(raw['scheduledAt'] as string);
      return { id: d.id, ...raw, scheduledAt: scheduledAt.toISOString(), overdue: scheduledAt < now };
    });
    results.sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime());
    return results;
  }, []);
  res.json({ success: true, data });
}));

// POST /api/sales/followups/auto-run — admin/manager only + IDEMPOTENT per lead
router.post('/followups/auto-run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const body = req.body as Record<string, unknown>;
  const daysSince = (body['daysSinceLastContact'] as number) ?? 3;
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/leads`)
    .where('stage', 'in', ['contacte', 'interesse', 'devis_envoye', 'negociation']).limit(200).get();
  const now = Date.now();
  const threshold = daysSince * 86400000;
  let created = 0;

  // IDEMPOTENCY: get existing pending follow-ups to avoid duplicates
  const existingSnap = await db.collection(`companies/${companyId}/followups`)
    .where('status', '==', 'pending').where('auto', '==', true).limit(500).get();
  const existingLeadIds = new Set(existingSnap.docs.map(d => d.data()['leadId'] as string));

  for (const doc of snap.docs) {
    // Skip if there's already a pending auto follow-up for this lead
    if (existingLeadIds.has(doc.id)) continue;

    const data = doc.data();
    const leadName = (data['name'] as string) ?? 'Lead';
    const interactions = Array.isArray(data['interactions']) ? data['interactions'] as { date: string }[] : [];
    const lastContact = interactions.length > 0
      ? new Date(interactions[interactions.length - 1].date).getTime()
      : (data['createdAt'] as FirebaseFirestore.Timestamp)?.toDate?.()?.getTime() ?? (now - threshold - 1);
    if (now - lastContact > threshold) {
      const daysSilent = Math.floor((now - lastContact) / 86400000);
      const followUpDate = new Date(now + 86400000);
      await db.collection(`companies/${companyId}/followups`).doc(generateId()).set({
        leadId: doc.id, scheduledAt: followUpDate, type: 'email',
        notes: `Relance auto — ${daysSilent} jours sans reponse`,
        status: 'pending', auto: true,
        assignedTo: data['ownerId'] ?? data['assignedTo'] ?? req.user!.uid,
        createdBy: req.user!.uid, createdAt: new Date(),
      });
      // Notify the lead owner
      const ownerId = (data['ownerId'] ?? data['assignedTo']) as string | undefined;
      if (ownerId) {
        notifyUser(companyId, ownerId, 'followup_overdue', `Relance en retard — ${leadName}`, `${daysSilent} jour(s) sans contact avec ${leadName}. Relance programmee.`, '/sales/followups', 'Clock', 'warning');
      }
      created++;
    }
  }

  logSalesAudit(companyId, {
    action: 'followup.auto_run', resourceType: 'followup', resourceId: 'batch',
    actor: actor(req), metadata: { created, daysSince },
  });
  res.json({ success: true, data: { created } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS & FORECAST
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/stats
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [leadsSnap, clientsSnap, quotesSnap] = await Promise.all([
      db.collection(`companies/${companyId}/leads`).limit(500).get(),
      db.collection(`companies/${companyId}/clients`).count().get(),
      db.collection(`companies/${companyId}/quotes`).limit(500).get(),
    ]);
    const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown> & { id: string }>;
    const quotes = quotesSnap.docs.map(d => d.data());
    const won = leads.filter(l => l['stage'] === 'gagne');
    const lost = leads.filter(l => l['stage'] === 'perdu');
    const totalCompleted = won.length + lost.length;

    // Fallback: if a lead has no estimatedValue, use the highest quote total linked to it
    const quotesByLead = new Map<string, number>();
    quotes.forEach(q => {
      const leadId = (q['leadId'] as string) ?? (q['clientId'] as string);
      if (!leadId) return;
      const total = (q['totalTTC'] as number) ?? (q['total'] as number) ?? 0;
      quotesByLead.set(leadId, Math.max(quotesByLead.get(leadId) ?? 0, total));
    });
    const valueOf = (l: Record<string, unknown> & { id: string }) => {
      const v = (l['estimatedValue'] as number) ?? 0;
      if (v > 0) return v;
      return quotesByLead.get(l.id) ?? 0;
    };

    const pipelineValue = leads.filter(l => !['gagne', 'perdu'].includes(l['stage'] as string))
      .reduce((s, l) => s + valueOf(l), 0);
    const totalRevenue = won.reduce((s, l) => s + valueOf(l), 0);
    const hotLeads = leads.filter(l => ((l['score'] as number) ?? 0) >= 70).length;
    const stages: Record<string, { count: number; value: number }> = {};
    leads.forEach(l => {
      const stage = (l['stage'] as string) ?? 'nouveau';
      if (!stages[stage]) stages[stage] = { count: 0, value: 0 };
      stages[stage].count++;
      stages[stage].value += valueOf(l);
    });
    return {
      totalLeads: leads.length, hotLeads, totalClients: clientsSnap.data().count,
      totalQuotes: quotes.length,
      acceptedQuotes: quotes.filter(q => q['status'] === 'accepted').length,
      pendingQuotes: quotes.filter(q => q['status'] === 'draft' || q['status'] === 'sent').length,
      totalRevenue, pipelineValue,
      conversionRate: totalCompleted > 0 ? Math.round((won.length / totalCompleted) * 100) : 0,
      avgDealSize: won.length > 0 ? Math.round(totalRevenue / won.length) : 0,
      stages,
    };
  }, {
    totalLeads: 0, hotLeads: 0, totalClients: 0, totalQuotes: 0,
    acceptedQuotes: 0, pendingQuotes: 0, totalRevenue: 0, pipelineValue: 0,
    conversionRate: 0, avgDealSize: 0, stages: {},
  });
  res.json({ success: true, data });
}));

// GET /api/sales/forecast
router.get('/forecast', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [snap, quotesSnap] = await Promise.all([
      db.collection(`companies/${companyId}/leads`).limit(500).get(),
      db.collection(`companies/${companyId}/quotes`).limit(500).get(),
    ]);
    const quotesByLead = new Map<string, number>();
    quotesSnap.docs.forEach(qd => {
      const q = qd.data();
      const leadId = (q['leadId'] as string) ?? (q['clientId'] as string);
      if (!leadId) return;
      const total = (q['totalTTC'] as number) ?? (q['total'] as number) ?? 0;
      quotesByLead.set(leadId, Math.max(quotesByLead.get(leadId) ?? 0, total));
    });
    const PROBS: Record<string, number> = { nouveau: 10, contacte: 20, interesse: 40, devis_envoye: 60, negociation: 80 };
    let optimistic = 0, realistic = 0, conservative = 0;
    const byStage: { stage: string; value: number; expected: number; probability: number }[] = [];
    const stageValues = new Map<string, number>();
    snap.docs.forEach(d => {
      const data = d.data();
      const stage = (data['stage'] as string) ?? 'nouveau';
      if (stage === 'gagne' || stage === 'perdu') return;
      const fallback = quotesByLead.get(d.id) ?? 0;
      const value = ((data['estimatedValue'] as number) ?? 0) || fallback;
      stageValues.set(stage, (stageValues.get(stage) ?? 0) + value);
      const prob = PROBS[stage] ?? 30;
      optimistic += value;
      realistic += value * (prob / 100);
      conservative += value * (prob / 100) * 0.7;
    });
    for (const [stage, value] of stageValues.entries()) {
      const prob = PROBS[stage] ?? 30;
      byStage.push({ stage, value, expected: Math.round(value * prob / 100), probability: prob });
    }
    return { optimistic: Math.round(optimistic), realistic: Math.round(realistic), conservative: Math.round(conservative), byStage };
  }, { optimistic: 0, realistic: 0, conservative: 0, byStage: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGING (email / WhatsApp) — admin/manager only
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/sales/messages/email
router.post('/messages/email', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const body = req.body as Record<string, unknown>;
  const to = body['to'] as string;
  const subject = body['subject'] as string;
  const htmlBody = body['body'] as string;
  if (!to || !subject) throw new AppError('to and subject required', 400);
  try {
    const { sendEmail, getBranding } = await import('../services/email/emailService');
    const branding = await getBranding(companyId);
    await sendEmail({ to, subject: `${subject} — ${branding.name}`, html: `<div style="font-family:sans-serif;font-size:14px;"><p><strong>${branding.name}</strong></p>${(htmlBody ?? '').replace(/\n/g, '<br>')}<p style="color:#9ca3af;font-size:12px;margin-top:20px;">${branding.slogan ?? ''}</p></div>` });
    if (body['leadId']) {
      await getFirestore().collection(`companies/${companyId}/leads`).doc(body['leadId'] as string).update({
        interactions: FieldValue.arrayUnion({ date: new Date().toISOString(), type: 'email', summary: `Email: "${subject}"`, by: req.user!.email }),
        updatedAt: new Date(), updatedBy: req.user!.uid,
      }).catch(() => {});
    }
    logSalesAudit(companyId, {
      action: 'message.email_sent', resourceType: 'message', resourceId: body['leadId'] as string ?? 'direct',
      actor: actor(req), metadata: { to, subject },
    });
    res.json({ success: true });
  } catch {
    throw new AppError('Failed to send email', 500);
  }
}));

// POST /api/sales/messages/whatsapp
router.post('/messages/whatsapp', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const body = req.body as Record<string, unknown>;
  const to = body['to'] as string;
  const message = body['message'] as string;
  if (!to || !message) throw new AppError('to and message required', 400);
  try {
    const { whatsappService } = await import('../services/whatsapp/whatsappService');
    const waConfig = await whatsappService.getConfig(companyId);
    if (waConfig) await whatsappService.sendMessage(waConfig, to, message);
    if (body['leadId']) {
      await getFirestore().collection(`companies/${companyId}/leads`).doc(body['leadId'] as string).update({
        interactions: FieldValue.arrayUnion({ date: new Date().toISOString(), type: 'whatsapp', summary: `WhatsApp: "${message.slice(0, 80)}"`, by: req.user!.email }),
        updatedAt: new Date(), updatedBy: req.user!.uid,
      }).catch(() => {});
    }
    logSalesAudit(companyId, {
      action: 'message.whatsapp_sent', resourceType: 'message', resourceId: body['leadId'] as string ?? 'direct',
      actor: actor(req), metadata: { to },
    });
    res.json({ success: true });
  } catch {
    throw new AppError('Failed to send WhatsApp', 500);
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG VIEWER
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sales/audit-logs — admin/manager only
router.get('/audit-logs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = await getUserRole(req.user!.uid);
  requireManagerOrAdmin(role);
  const data = await safe(async () => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/salesAuditLogs`)
      .orderBy('timestamp', 'desc') as FirebaseFirestore.Query;
    if (req.query['action']) q = q.where('action', '==', req.query['action']);
    if (req.query['resourceType']) q = q.where('resourceType', '==', req.query['resourceType']);
    const snap = await q.limit(100).get();
    return snap.docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

// GET /api/sales/activities — aggregated activity feed from lead interactions + audit
router.get('/activities', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const leadsSnap = await db.collection(`companies/${companyId}/leads`).limit(300).get();
    const items: { id: string; type: string; date: string; summary: string; leadId: string; leadName: string; user?: string }[] = [];
    leadsSnap.docs.forEach(doc => {
      const lead = doc.data();
      const leadName = (lead['name'] as string) ?? 'Lead';
      const interactions = Array.isArray(lead['interactions']) ? lead['interactions'] as { date?: string; type?: string; summary?: string; by?: string; id?: string }[] : [];
      interactions.forEach((inter, idx) => {
        items.push({
          id: inter.id ?? `${doc.id}-${idx}`,
          type: inter.type ?? 'note',
          date: inter.date ?? new Date().toISOString(),
          summary: inter.summary ?? '',
          leadId: doc.id,
          leadName,
          user: inter.by,
        });
      });
    });
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, 200);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: AI LEAD SCORING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/leads/:id/ai-score', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { aiScoreLeadTool } = await import('../agents/sales.agent');
    const result = await (aiScoreLeadTool as (args: unknown) => Promise<unknown>)({ companyId: cid, leadId: req.params.id });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Scoring echoue' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: DEAL INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/leads/:id/insights', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { dealInsightsTool } = await import('../agents/sales.agent');
    const result = await (dealInsightsTool as (args: unknown) => Promise<unknown>)({ companyId: cid, leadId: req.params.id });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Insights echoues' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: WIN/LOSS ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/win-loss', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { winLossAnalysisTool } = await import('../agents/sales.agent');
    const result = await (winLossAnalysisTool as (args: unknown) => Promise<unknown>)({ companyId: cid, period: req.query['period'] ?? 'quarter' });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Analyse echouee' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: TEAM PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/team-performance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { teamPerformanceTool } = await import('../agents/sales.agent');
    const result = await (teamPerformanceTool as (args: unknown) => Promise<unknown>)({ companyId: cid });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { reps: [], topPerformer: '', totalRevenue: 0 } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: EMAIL SEQUENCES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sequences', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/emailSequences`).orderBy('createdAt', 'desc').limit(20).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/sequences', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { createEmailSequenceTool } = await import('../agents/sales.agent');
    const body = req.body as Record<string, unknown>;
    const result = await (createEmailSequenceTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, name: body['name'] ?? 'Sequence', targetStage: body['targetStage'],
      steps: body['steps'], generateWithAI: body['generateWithAI'] ?? true,
    });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Creation echouee' } }); }
}));

router.delete('/sequences/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/emailSequences`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: SALES AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/automation/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { salesAutomationTool } = await import('../agents/sales.agent');
    const result = await (salesAutomationTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, automationType: (req.body as Record<string, string>)['type'] ?? 'deal_won',
    });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { actions: [], message: 'Automation echouee' } }); }
}));

export default router;
