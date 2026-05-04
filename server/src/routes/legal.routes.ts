/**
 * Legal Routes PRO — Contracts · Cases · Deadlines · Compliance · Clauses · Stats
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { createNotification } from '../services/notificationService';

const router = Router();
router.use(authMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

// Contract permission check
type ContractRole = 'owner' | 'editor' | 'approver' | 'signer' | 'viewer';
function hasContractAccess(permissions: Record<string, unknown> | undefined, uid: string, role: string | undefined, requiredRole: ContractRole): boolean {
  // Admin/manager bypass
  if (role === 'admin' || role === 'manager') return true;
  if (!permissions) return true; // Legacy contracts without permissions
  if (permissions['owner'] === uid) return true;
  const roleMap: Record<ContractRole, string[]> = {
    owner: [], viewer: ['viewers', 'editors', 'approvers', 'signers'],
    editor: ['editors'], approver: ['approvers'], signer: ['signers'],
  };
  const fields = roleMap[requiredRole] ?? [];
  return fields.some(f => Array.isArray(permissions[f]) && (permissions[f] as string[]).includes(uid));
}

async function getUserRole(uid: string): Promise<string | undefined> {
  const doc = await getFirestore().collection('users').doc(uid).get();
  return doc.data()?.['role'] as string | undefined;
}
function serializeDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && '_seconds' in (val as Record<string, unknown>)) out[key] = new Date((val as { _seconds: number })._seconds * 1000).toISOString();
    else if (val && typeof val === 'object' && 'toDate' in (val as Record<string, unknown>) && typeof (val as { toDate: unknown }).toDate === 'function') out[key] = ((val as { toDate: () => Date }).toDate()).toISOString();
    else if (Array.isArray(val)) out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item as Record<string, unknown>) : item);
    else out[key] = val;
  }
  return out;
}
function ss(doc: FirebaseFirestore.QueryDocumentSnapshot) { return { id: doc.id, ...serializeDoc(doc.data()) }; }

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/contracts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/legalContracts`) as FirebaseFirestore.Query;
    if (req.query['status'] && req.query['status'] !== 'all') q = q.where('status', '==', req.query['status']);
    if (req.query['type']) q = q.where('type', '==', req.query['type']);
    return (await q.limit(200).get()).docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.get('/contracts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()!) } });
}));

router.post('/contracts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore(); const id = generateId();
  const countSnap = await db.collection(`companies/${cid}/legalContracts`).count().get();
  const num = `CTR-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
  const contract = {
    id, contractNumber: num, type: body['type'] ?? 'other', title: body['title'] ?? '',
    partyA: body['partyA'] ?? '', partyB: body['partyB'] ?? '', content: body['content'] ?? '',
    status: 'draft', duration: body['duration'] ?? null, expiryDate: body['expiryDate'] ?? null,
    value: body['value'] ?? 0, caseId: body['caseId'] ?? null,
    // Permissions (ACL per contract)
    permissions: {
      owner: req.user!.uid,
      editors: Array.isArray(body['editors']) ? body['editors'] : [req.user!.uid],
      approvers: Array.isArray(body['approvers']) ? body['approvers'] : [],
      signers: Array.isArray(body['signers']) ? body['signers'] : [],
      viewers: Array.isArray(body['viewers']) ? body['viewers'] : [],
    },
    // Business links (cross-module)
    linkedDealId: body['linkedDealId'] ?? null,       // Sales deal
    linkedInvoiceId: body['linkedInvoiceId'] ?? null,  // Accounting invoice
    linkedTicketId: body['linkedTicketId'] ?? null,     // Support ticket
    linkedCaseId: body['linkedCaseId'] ?? body['caseId'] ?? null,  // Legal case
    timeline: [{ date: new Date().toISOString(), action: 'created', by: req.user!.email, detail: `Contrat ${num} cree` }],
    createdBy: req.user!.uid, createdByEmail: req.user!.email, createdAt: new Date(), updatedAt: new Date(),
  };
  await db.collection(`companies/${cid}/legalContracts`).doc(id).set(contract);
  res.status(201).json({ success: true, data: contract });
}));

router.patch('/contracts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const role = req.user?.role ?? await getUserRole(req.user!.uid);
  if (!hasContractAccess(doc.data()!['permissions'] as Record<string, unknown>, req.user!.uid, role, 'editor')) {
    throw new AppError('Acces non autorise — role editor requis', 403);
  }
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date(), updatedBy: req.user!.uid };
  // Append to timeline if status changes
  if (body['status'] && body['status'] !== doc.data()!['status']) {
    const timeline = Array.isArray(doc.data()!['timeline']) ? [...doc.data()!['timeline'] as unknown[]] : [];
    timeline.push({ date: new Date().toISOString(), action: body['status'] as string, by: req.user!.email, detail: `Statut → ${body['status']}` });
    updates['timeline'] = timeline;
  }
  await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).update(updates);
  res.json({ success: true });
}));

router.delete('/contracts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/legalContracts`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// AI analyze
router.post('/contracts/:id/analyze', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const content = (doc.data()!['content'] as string) ?? '';
  const type = (doc.data()!['type'] as string) ?? 'other';
  const { ai, GEMINI_FLASH } = await import('../config/genkit.config');
  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: `Analyze this ${type} contract. Extract risks, obligations, key terms. Return JSON: {"summary":"...","riskScore":0-100,"risks":[{"clause":"...","risk":"...","severity":"low|medium|high"}],"obligations":["..."],"recommendation":"..."} ONLY.
Contract: ${content.slice(0, 6000)}`,
    config: { temperature: 0.1 },
  });
  try { res.json({ success: true, data: JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')) }); }
  catch { res.json({ success: true, data: { summary: text.slice(0, 300), riskScore: 50, risks: [], obligations: [], recommendation: 'Revue manuelle.' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CASES (Dossiers)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/cases', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/legalCases`) as FirebaseFirestore.Query;
    if (req.query['status'] && req.query['status'] !== 'all') q = q.where('status', '==', req.query['status']);
    return (await q.limit(100).get()).docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.post('/cases', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const db = getFirestore(); const id = generateId();
  const countSnap = await db.collection(`companies/${cid}/legalCases`).count().get();
  const num = `DOS-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
  const c = { id, caseNumber: num, title: body['title'] ?? '', description: body['description'] ?? '', type: body['type'] ?? 'other', priority: body['priority'] ?? 'medium', client: body['client'] ?? null, status: 'open', contractIds: [], notes: [], createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date() };
  await db.collection(`companies/${cid}/legalCases`).doc(id).set(c);
  res.status(201).json({ success: true, data: c });
}));

router.patch('/cases/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/legalCases`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/cases/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/legalCases`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// DEADLINES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/deadlines', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/legalDeadlines`).limit(200).get();
    const now = new Date();
    return snap.docs.map(d => {
      const raw = d.data();
      const due = raw['dueDate']?.toDate?.() ?? new Date(raw['dueDate'] as string);
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
      return { id: d.id, ...serializeDoc(raw), daysLeft, priority: daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'high' : 'medium' };
    }).sort((a, b) => (a as { daysLeft: number }).daysLeft - (b as { daysLeft: number }).daysLeft);
  }, []);
  res.json({ success: true, data });
}));

router.post('/deadlines', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const id = generateId();
  const dl = { id, title: body['title'] ?? '', dueDate: new Date(body['dueDate'] as string), type: body['type'] ?? 'other', description: body['description'] ?? '', caseId: body['caseId'] ?? null, notified: false, createdBy: req.user!.uid, createdAt: new Date() };
  await getFirestore().collection(`companies/${cid}/legalDeadlines`).doc(id).set(dl);
  res.status(201).json({ success: true, data: dl });
}));

router.delete('/deadlines/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/legalDeadlines`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// SLA check for deadlines — send notifications
router.post('/deadline-check', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore(); const now = new Date(); const soon = new Date(now.getTime() + 7 * 86400000);
  const snap = await db.collection(`companies/${cid}/legalDeadlines`).limit(200).get();
  let notified = 0;
  for (const doc of snap.docs) {
    const data = doc.data(); const due = data['dueDate']?.toDate?.();
    if (due && due > now && due < soon && !data['notified']) {
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
      createNotification({ companyId: cid, type: 'system', title: `Echeance juridique — ${data['title']}`, message: `${daysLeft} jour(s) restant(s) pour "${data['title']}".`, actionUrl: '/legal/deadlines', icon: 'Scale', severity: daysLeft <= 3 ? 'error' : 'warning' }).catch(() => {});
      await doc.ref.update({ notified: true }); notified++;
    }
  }
  res.json({ success: true, data: { notified } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/compliance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const areas = ['gdpr', 'labor_law', 'corporate', 'tax'];
    const results = await Promise.all(areas.map(async a => {
      const doc = await getFirestore().collection(`companies/${cid}/legalCompliance`).doc(a).get();
      const d = doc.data() ?? {};
      return { area: a, score: (d['score'] as number) ?? 50, status: (d['status'] as string) ?? 'needs_review', issues: (d['issues'] as string[]) ?? [], actions: (d['actions'] as string[]) ?? [] };
    }));
    const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    return { areas: results, averageScore: avg };
  }, { areas: [], averageScore: 50 });
  res.json({ success: true, data });
}));

router.patch('/compliance/:area', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/legalCompliance`).doc(req.params.area).set({ ...(req.body as Record<string, unknown>), updatedAt: new Date() }, { merge: true });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUSES LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/clauses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${cid}/legalClauses`).limit(100).get()).docs.map(ss), []);
  res.json({ success: true, data });
}));

router.post('/clauses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const id = generateId();
  const clause = { id, title: body['title'] ?? '', content: body['content'] ?? '', category: body['category'] ?? 'general', createdBy: req.user!.uid, createdAt: new Date() };
  await getFirestore().collection(`companies/${cid}/legalClauses`).doc(id).set(clause);
  res.status(201).json({ success: true, data: clause });
}));

router.delete('/clauses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/legalClauses`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore(); const now = new Date(); const soon = new Date(now.getTime() + 30 * 86400000);
    const [cSnap, csSnap, dSnap, compDoc] = await Promise.all([
      db.collection(`companies/${cid}/legalContracts`).limit(500).get(),
      db.collection(`companies/${cid}/legalCases`).limit(100).get(),
      db.collection(`companies/${cid}/legalDeadlines`).limit(200).get(),
      db.collection(`companies/${cid}/legalCompliance`).doc('all').get(),
    ]);
    const contracts = cSnap.docs.map(d => d.data());
    const active = contracts.filter(c => c['status'] === 'active' || c['status'] === 'signed').length;
    const expiring = contracts.filter(c => { const e = c['expiryDate']?.toDate?.(); return e && e > now && e < soon; }).length;
    const cases = csSnap.docs.map(d => d.data());
    const deadlines = dSnap.docs.map(d => { const due = d.data()['dueDate']?.toDate?.() ?? now; return Math.ceil((due.getTime() - now.getTime()) / 86400000); });
    return {
      totalContracts: contracts.length, activeContracts: active, expiringSoon: expiring,
      totalCases: cases.length, openCases: cases.filter(c => c['status'] === 'open').length,
      totalDeadlines: deadlines.length, urgentDeadlines: deadlines.filter(d => d >= 0 && d <= 7).length, overdueDeadlines: deadlines.filter(d => d < 0).length,
      complianceScore: (compDoc.data()?.['score'] as number) ?? 55,
    };
  }, { totalContracts: 0, activeContracts: 0, expiringSoon: 0, totalCases: 0, openCases: 0, totalDeadlines: 0, urgentDeadlines: 0, overdueDeadlines: 0, complianceScore: 55 });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/contracts/:id/send-for-signature', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const data = doc.data()!;
  await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).update({
    status: 'sent', sentForSignatureAt: new Date(), sentTo: body['email'] ?? data['partyB'],
    updatedAt: new Date(), updatedBy: req.user!.uid,
    timeline: [...(Array.isArray(data['timeline']) ? data['timeline'] as unknown[] : []),
      { date: new Date().toISOString(), action: 'sent_for_signature', by: req.user!.email, detail: `Envoye a ${body['email'] ?? data['partyB']}` }],
  });
  // Send email if possible
  try {
    const email = (body['email'] as string) ?? (data['partyB'] as string);
    if (email?.includes('@')) {
      const { sendEmail, getBranding } = await import('../services/email/emailService');
      const b = await getBranding(cid);
      await sendEmail({ to: email, subject: `Contrat a signer — ${data['contractNumber'] ?? data['title']}`, html: `<div style="font-family:sans-serif"><p><strong>${b.name}</strong></p><p>Un contrat est en attente de votre signature.</p><p><strong>${data['contractNumber']}</strong> — ${data['title'] ?? data['type']}</p></div>` });
    }
  } catch {}
  createNotification({ companyId: cid, type: 'system', title: `Contrat envoye pour signature`, message: `${data['contractNumber']} envoye a ${body['email'] ?? data['partyB']}.`, actionUrl: '/legal', icon: 'Send', severity: 'info' }).catch(() => {});
  res.json({ success: true });
}));

router.post('/contracts/:id/mark-signed', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const data = doc.data()!;
  await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).update({
    status: 'signed', signedAt: new Date(), updatedAt: new Date(), updatedBy: req.user!.uid,
    timeline: [...(Array.isArray(data['timeline']) ? data['timeline'] as unknown[] : []),
      { date: new Date().toISOString(), action: 'signed', by: req.user!.email, detail: 'Contrat signe' }],
  });
  createNotification({ companyId: cid, type: 'system', title: `Contrat signe — ${data['contractNumber']}`, message: `Le contrat ${data['contractNumber']} a ete signe.`, actionUrl: '/legal', icon: 'CheckCircle', severity: 'success' }).catch(() => {});
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/contracts/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const data = doc.data()!;
  const events: { date: string; action: string; icon: string; detail: string; color: string }[] = [];

  // Created
  const created = data['createdAt']?.toDate?.() ?? new Date(data['createdAt'] as string);
  events.push({ date: created.toISOString(), action: 'Contrat cree', icon: 'FileText', detail: `${data['contractNumber']} — ${data['type']} — ${data['partyA']} / ${data['partyB']}`, color: 'blue' });

  // Timeline entries stored on the contract
  if (Array.isArray(data['timeline'])) {
    for (const t of data['timeline'] as { date: string; action: string; by?: string; detail?: string }[]) {
      const actionMap: Record<string, { label: string; icon: string; color: string }> = {
        analyzed: { label: 'Analyse IA', icon: 'Sparkles', color: 'purple' },
        modified: { label: 'Modifie', icon: 'Edit', color: 'gray' },
        sent_for_review: { label: 'Envoye pour validation', icon: 'Eye', color: 'orange' },
        approved: { label: 'Approuve', icon: 'CheckCircle', color: 'green' },
        sent_for_signature: { label: 'Envoye pour signature', icon: 'Send', color: 'indigo' },
        signed: { label: 'Signe', icon: 'CheckCircle', color: 'emerald' },
        expired: { label: 'Expire', icon: 'Clock', color: 'red' },
        terminated: { label: 'Resilie', icon: 'XCircle', color: 'red' },
      };
      const info = actionMap[t.action] ?? { label: t.action, icon: 'Circle', color: 'gray' };
      events.push({ date: t.date, action: info.label, icon: info.icon, detail: `${t.detail ?? ''}${t.by ? ` (par ${t.by})` : ''}`, color: info.color });
    }
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  res.json({ success: true, data: events });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// RISK ALERTS + NOTIFICATION CRON
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/risk-check', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400000);
  const in24h = new Date(now.getTime() + 86400000);
  let notified = 0;

  // 1. Deadline notifications (7j, 24h, overdue)
  const dlSnap = await db.collection(`companies/${cid}/legalDeadlines`).limit(200).get();
  for (const doc of dlSnap.docs) {
    const d = doc.data(); const due = d['dueDate']?.toDate?.();
    if (!due) continue;
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);

    if (daysLeft < 0 && !d['overdueNotified']) {
      createNotification({ companyId: cid, type: 'system', title: `Echeance DEPASSEE — ${d['title']}`, message: `"${d['title']}" est en retard de ${Math.abs(daysLeft)} jour(s).`, actionUrl: '/legal', icon: 'AlertTriangle', severity: 'error' }).catch(() => {});
      await doc.ref.update({ overdueNotified: true }); notified++;
    } else if (daysLeft >= 0 && daysLeft <= 1 && !d['notify24h']) {
      createNotification({ companyId: cid, type: 'system', title: `Echeance DEMAIN — ${d['title']}`, message: `"${d['title']}" expire demain.`, actionUrl: '/legal', icon: 'Clock', severity: 'error' }).catch(() => {});
      await doc.ref.update({ notify24h: true }); notified++;
    } else if (daysLeft > 1 && daysLeft <= 7 && !d['notify7d']) {
      createNotification({ companyId: cid, type: 'system', title: `Echeance dans ${daysLeft}j — ${d['title']}`, message: `"${d['title']}" expire dans ${daysLeft} jours.`, actionUrl: '/legal', icon: 'Clock', severity: 'warning' }).catch(() => {});
      await doc.ref.update({ notify7d: true }); notified++;
    }
  }

  // 2. Contract expiring notifications
  const ctrSnap = await db.collection(`companies/${cid}/legalContracts`).limit(500).get();
  for (const doc of ctrSnap.docs) {
    const d = doc.data(); const exp = d['expiryDate']?.toDate?.();
    if (!exp) continue;
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 30 && !d['expiryNotified']) {
      createNotification({ companyId: cid, type: 'system', title: `Contrat expire bientot — ${d['contractNumber']}`, message: `${d['contractNumber']} (${d['partyB']}) expire dans ${daysLeft} jours.`, actionUrl: '/legal', icon: 'FileText', severity: daysLeft <= 7 ? 'error' : 'warning' }).catch(() => {});
      await doc.ref.update({ expiryNotified: true }); notified++;
    }
  }

  // 3. Compliance low score alert
  const areas = ['gdpr', 'labor_law', 'corporate', 'tax'];
  for (const area of areas) {
    const compDoc = await db.collection(`companies/${cid}/legalCompliance`).doc(area).get();
    const score = (compDoc.data()?.['score'] as number) ?? 100;
    if (score < 50 && !compDoc.data()?.['lowScoreNotified']) {
      createNotification({ companyId: cid, type: 'system', title: `Conformite faible — ${area}`, message: `Score de conformite ${area}: ${score}%. Action requise.`, actionUrl: '/legal', icon: 'Shield', severity: 'error' }).catch(() => {});
      await db.collection(`companies/${cid}/legalCompliance`).doc(area).set({ lowScoreNotified: true }, { merge: true }); notified++;
    }
  }

  res.json({ success: true, data: { notified } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT TEMPLATES (pre-built)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/templates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/contractTemplates`).limit(50).get();
    if (snap.empty) {
      // Return default templates
      return [
        { id: 'tpl_nda', title: 'NDA — Accord de confidentialite', type: 'nda', description: 'Protege les informations echangees entre deux parties.' },
        { id: 'tpl_service', title: 'Contrat de service', type: 'service', description: 'Definit les termes d\'une prestation de service.' },
        { id: 'tpl_freelance', title: 'Contrat freelance', type: 'freelance', description: 'Mission ponctuelle avec un independant.' },
        { id: 'tpl_employment', title: 'Contrat de travail', type: 'employment', description: 'CDI/CDD pour un salarie.' },
        { id: 'tpl_supplier', title: 'Contrat fournisseur', type: 'supplier', description: 'Accord cadre avec un fournisseur.' },
      ];
    }
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT PERMISSIONS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// PATCH /api/legal/contracts/:id/permissions — owner/admin only
router.patch('/contracts/:id/permissions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const data = doc.data()!;
  const perms = data['permissions'] as Record<string, unknown> ?? {};
  const role = req.user?.role ?? await getUserRole(req.user!.uid);
  if (perms['owner'] !== req.user!.uid && role !== 'admin' && role !== 'manager') {
    throw new AppError('Seul le proprietaire ou un admin peut modifier les permissions', 403);
  }
  const body = req.body as Record<string, unknown>;
  const newPerms = {
    owner: perms['owner'] ?? req.user!.uid,
    editors: Array.isArray(body['editors']) ? body['editors'] : perms['editors'] ?? [],
    approvers: Array.isArray(body['approvers']) ? body['approvers'] : perms['approvers'] ?? [],
    signers: Array.isArray(body['signers']) ? body['signers'] : perms['signers'] ?? [],
    viewers: Array.isArray(body['viewers']) ? body['viewers'] : perms['viewers'] ?? [],
  };
  await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).update({ permissions: newPerms, updatedAt: new Date() });
  res.json({ success: true, data: newPerms });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS LINKS — Contract ↔ Sales/Accounting/Support
// ═══════════════════════════════════════════════════════════════════════════════

// PATCH /api/legal/contracts/:id/link — link contract to a business entity
router.patch('/contracts/:id/link', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body['dealId']) updates['linkedDealId'] = body['dealId'];
  if (body['invoiceId']) updates['linkedInvoiceId'] = body['invoiceId'];
  if (body['ticketId']) updates['linkedTicketId'] = body['ticketId'];
  if (body['caseId']) updates['linkedCaseId'] = body['caseId'];
  await getFirestore().collection(`companies/${cid}/legalContracts`).doc(req.params.id).update(updates);
  res.json({ success: true });
}));

// GET /api/legal/contracts/:id/links — get all linked business entities
router.get('/contracts/:id/links', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/legalContracts`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Contract not found', 404);
  const data = doc.data()!;

  const links: { type: string; id: string; label: string; status: string; url: string }[] = [];

  // Sales deal
  if (data['linkedDealId']) {
    const deal = await db.collection(`companies/${cid}/leads`).doc(data['linkedDealId'] as string).get().catch(() => null);
    if (deal?.exists) {
      const d = deal.data()!;
      links.push({ type: 'deal', id: deal.id, label: `${d['name']} — ${d['estimatedValue'] ?? 0} EUR`, status: (d['stage'] as string) ?? '', url: `/sales/leads/${deal.id}` });
    }
  }
  // Accounting invoice
  if (data['linkedInvoiceId']) {
    const inv = await db.collection(`companies/${cid}/invoices`).doc(data['linkedInvoiceId'] as string).get().catch(() => null);
    if (inv?.exists) {
      const d = inv.data()!;
      links.push({ type: 'invoice', id: inv.id, label: `${d['number']} — ${d['totalTTC'] ?? 0} EUR`, status: (d['status'] as string) ?? '', url: `/finance/invoices` });
    }
  }
  // Support ticket
  if (data['linkedTicketId']) {
    const tk = await db.collection(`companies/${cid}/supportTickets`).doc(data['linkedTicketId'] as string).get().catch(() => null);
    if (tk?.exists) {
      const d = tk.data()!;
      links.push({ type: 'ticket', id: tk.id, label: `${d['ticketNumber']} — ${d['title'] ?? d['subject'] ?? ''}`, status: (d['status'] as string) ?? '', url: `/support/${tk.id}` });
    }
  }
  // Legal case
  if (data['linkedCaseId']) {
    const cs = await db.collection(`companies/${cid}/legalCases`).doc(data['linkedCaseId'] as string).get().catch(() => null);
    if (cs?.exists) {
      const d = cs.data()!;
      links.push({ type: 'case', id: cs.id, label: `${d['caseNumber']} — ${d['title'] ?? ''}`, status: (d['status'] as string) ?? '', url: `/legal` });
    }
  }

  res.json({ success: true, data: links });
}));

// PRO routes
router.post('/contracts/:id/risk-score', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { contractRiskScoringTool } = await import('../agents/legal.agent');
  res.json({ success: true, data: await (contractRiskScoringTool as (a: unknown) => Promise<unknown>)({ companyId: cid, contractId: req.params.id }) });
}));

router.get('/cases/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { caseTimelineTool } = await import('../agents/legal.agent');
  res.json({ success: true, data: await (caseTimelineTool as (a: unknown) => Promise<unknown>)({ companyId: cid, caseId: req.params.id }) });
}));

router.get('/templates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { contractTemplatesTool } = await import('../agents/legal.agent');
  res.json({ success: true, data: await (contractTemplatesTool as (a: unknown) => Promise<unknown>)({ companyId: cid, action: 'list' }) });
}));

router.post('/templates/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { contractTemplatesTool } = await import('../agents/legal.agent');
  res.json({ success: true, data: await (contractTemplatesTool as (a: unknown) => Promise<unknown>)({ companyId: cid, action: 'generate', templateType: (req.body as Record<string, string>)['type'] ?? 'nda' }) });
}));

router.post('/automation/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { legalAutomationTool } = await import('../agents/legal.agent');
  res.json({ success: true, data: await (legalAutomationTool as (a: unknown) => Promise<unknown>)({ companyId: cid, type: (req.body as Record<string, string>)['type'] ?? 'deadline_alerts' }) });
}));

export default router;
