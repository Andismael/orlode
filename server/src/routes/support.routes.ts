/**
 * Support Routes PRO — Complete Customer Support API
 * Tickets · KB · Canned Responses · Stats · Analytics · SLA · Notifications
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
import { requireAgentRole } from '../middleware/agentRbac.middleware';

const router = Router();

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

function serializeDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && '_seconds' in (val as Record<string, unknown>)) {
      out[key] = new Date((val as { _seconds: number })._seconds * 1000).toISOString();
    } else if (val && typeof val === 'object' && 'toDate' in (val as Record<string, unknown>) && typeof (val as { toDate: unknown }).toDate === 'function') {
      out[key] = ((val as { toDate: () => Date }).toDate()).toISOString();
    } else if (Array.isArray(val)) {
      out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item as Record<string, unknown>) : item);
    } else { out[key] = val; }
  }
  return out;
}
function serializeSnap(doc: FirebaseFirestore.QueryDocumentSnapshot): Record<string, unknown> {
  return { id: doc.id, ...serializeDoc(doc.data()) };
}

const SLA_TARGETS: Record<string, { firstResponse: number; resolution: number }> = {
  urgent: { firstResponse: 15, resolution: 120 },
  high:   { firstResponse: 60, resolution: 480 },
  normal: { firstResponse: 240, resolution: 1440 },
  low:    { firstResponse: 480, resolution: 2880 },
};

// ── Public widget (no auth) ──────────────────────────────────────────────────

router.post('/widget/chat', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { message, companyId } = req.body as Record<string, unknown>;
  if (!message || !companyId) throw new AppError('message and companyId required', 400);
  try {
    const { supportAgentFlow } = await import('../agents/support.agent');
    const result = await supportAgentFlow({ request: message as string, companyId: companyId as string, language: 'fr' });
    res.json({ success: true, data: { reply: result.response, ticketId: result.ticketId } });
  } catch {
    res.json({ success: true, data: { reply: 'Merci pour votre message. Notre equipe vous repondra rapidement.' } });
  }
}));

// ── Protected routes ─────────────────────────────────────────────────────────
router.use(authMiddleware);
router.use(requireAgentRole('support'));

// POST /api/support/chat — protected version of widget chat for the in-app agent panel
router.post('/chat', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { message } = req.body as Record<string, unknown>;
  if (!message || typeof message !== 'string') throw new AppError('message (string) required', 400);
  try {
    const { supportAgentFlow } = await import('../agents/support.agent');
    const result = await supportAgentFlow({ request: message, companyId, language: 'fr' });
    res.json({ success: true, data: { response: result.response, ticketId: result.ticketId } });
  } catch (err) {
    res.json({ success: true, data: { response: 'Désolé, l\'agent IA est temporairement indisponible. Réessaie dans un instant.' } });
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/supportTickets`) as FirebaseFirestore.Query;
    if (req.query['status'] && req.query['status'] !== 'all') q = q.where('status', '==', req.query['status']);
    if (req.query['priority']) q = q.where('priority', '==', req.query['priority']);
    if (req.query['category']) q = q.where('category', '==', req.query['category']);
    if (req.query['assignedTo']) q = q.where('assignedTo', '==', req.query['assignedTo']);
    const snap = await q.limit(200).get();
    return snap.docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.get('/tickets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${companyId}/supportTickets`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Ticket not found', 404);
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()!) } });
}));

router.post('/tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
  const countSnap = await db.collection(`companies/${companyId}/supportTickets`).count().get();
  const count = countSnap.data().count + 1;
  const ticketNumber = `SUP-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
  const prio = (body['priority'] as string) ?? 'normal';
  const sla = SLA_TARGETS[prio] ?? SLA_TARGETS['normal'];
  const now = new Date();

  const ticket = {
    id, ticketNumber, companyId,
    title: body['title'] ?? body['subject'] ?? '', description: body['description'] ?? '',
    customerName: body['clientName'] ?? body['customerName'] ?? '',
    customerEmail: body['clientEmail'] ?? body['customerEmail'] ?? null,
    priority: prio, category: body['category'] ?? 'general',
    channel: body['channel'] ?? 'web', status: 'open',
    tags: Array.isArray(body['tags']) ? body['tags'] : [],
    assignedTo: body['assignedTo'] ?? null, messages: [],
    slaFirstResponse: sla.firstResponse, slaResolution: sla.resolution,
    slaFirstResponseDeadline: new Date(now.getTime() + sla.firstResponse * 60000),
    slaResolutionDeadline: new Date(now.getTime() + sla.resolution * 60000),
    slaFirstResponseMet: null, slaResolutionMet: null,
    firstResponseAt: null, resolvedAt: null, satisfaction: null,
    createdBy: req.user!.uid, createdAt: now, updatedAt: now,
  };
  await db.collection(`companies/${companyId}/supportTickets`).doc(id).set(ticket);

  createNotification({
    companyId, type: 'system', title: `Nouveau ticket — ${ticketNumber}`,
    message: `${ticket.customerName}: ${(ticket.title as string) || (ticket.description as string).toString().slice(0, 80)}`,
    actionUrl: `/support/${id}`, icon: 'Ticket', severity: prio === 'urgent' ? 'error' : prio === 'high' ? 'warning' : 'info',
  }).catch(() => {});

  res.status(201).json({ success: true, data: ticket });
}));

router.patch('/tickets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date(), updatedBy: req.user!.uid };
  if (body['status'] === 'resolved') updates['resolvedAt'] = new Date();
  await getFirestore().collection(`companies/${companyId}/supportTickets`).doc(req.params.id).update(updates);
  if (body['status'] === 'escalated') {
    createNotification({ companyId, type: 'system', title: 'Ticket escalade', message: `Ticket escalade${body['escalationReason'] ? `: ${body['escalationReason']}` : ''}.`, actionUrl: `/support/${req.params.id}`, icon: 'AlertTriangle', severity: 'warning' }).catch(() => {});
  }
  res.json({ success: true });
}));

router.delete('/tickets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/supportTickets`).doc(req.params.id).delete();
  res.json({ success: true });
}));

router.post('/tickets/:id/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const content = body['content'] as string;
  if (!content) throw new AppError('content required', 400);
  const role = (body['role'] as string) ?? 'agent';
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id);
  const msg = { id: generateId(), content, role, authorId: req.user!.uid, authorName: req.user!.email, createdAt: new Date().toISOString() };
  const updates: Record<string, unknown> = { messages: FieldValue.arrayUnion(msg), updatedAt: new Date() };
  if (role === 'agent' || role === 'ai') {
    const doc = await ref.get();
    const data = doc.data();
    if (data && !data['firstResponseAt']) {
      updates['firstResponseAt'] = new Date();
      const deadline = data['slaFirstResponseDeadline']?.toDate?.();
      updates['slaFirstResponseMet'] = deadline ? new Date() <= deadline : null;
    }
    if (data?.['status'] === 'open') updates['status'] = 'in_progress';
  }
  await ref.update(updates);
  res.status(201).json({ success: true, data: msg });
}));

router.patch('/tickets/:id/satisfaction', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/supportTickets`).doc(req.params.id)
    .update({ satisfaction: (req.body as { score: number }).score, updatedAt: new Date() });
  res.json({ success: true });
}));

router.post('/tickets/:id/auto-assign', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const agentsSnap = await db.collection('users').where('companyId', '==', companyId).where('role', 'in', ['admin', 'manager']).limit(20).get();
  if (agentsSnap.empty) { res.json({ success: true, data: { assignedTo: null } }); return; }
  const agents = agentsSnap.docs.map(d => ({ uid: d.id, name: (d.data()['displayName'] as string) ?? (d.data()['email'] as string) ?? d.id }));
  const counts = await Promise.all(agents.map(async a => {
    const s = await db.collection(`companies/${companyId}/supportTickets`).where('assignedTo', '==', a.uid).where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
    return { ...a, count: s.size };
  }));
  counts.sort((a, b) => a.count - b.count);
  const best = counts[0];
  await db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id).update({ assignedTo: best.uid, assignedToName: best.name, status: 'assigned', updatedAt: new Date() });
  res.json({ success: true, data: { assignedTo: best.uid, assignedName: best.name } });
}));

router.post('/tickets/:id/suggest', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Ticket not found', 404);
  const data = doc.data()!;
  const query = `${data['title'] ?? data['subject'] ?? ''} ${data['description'] ?? ''}`;
  const kbSnap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(30).get();
  const keywords = query.toString().toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const relevant = kbSnap.docs.map(d => ({ title: (d.data()['title'] as string) ?? '', content: (d.data()['content'] as string) ?? '' }))
    .filter(a => keywords.some(kw => `${a.title} ${a.content}`.toLowerCase().includes(kw))).slice(0, 3);
  if (relevant.length === 0) { res.json({ success: true, data: { suggestion: 'Aucun article pertinent. Reponse manuelle recommandee.', sources: [], confidence: 20 } }); return; }
  const { ai, GEMINI_FLASH } = await import('../config/genkit.config');
  const result = await ai.generate({ model: GEMINI_FLASH, system: 'You are a support agent. Generate a helpful, empathetic response. Be concise. Reply in French.', prompt: `Issue: ${query}\n\nKB:\n${relevant.map(a => `## ${a.title}\n${a.content}`).join('\n\n')}`, config: { temperature: 0.3 } });
  res.json({ success: true, data: { suggestion: result.text, sources: relevant.map(a => a.title), confidence: Math.min(90, 40 + relevant.length * 20) } });
}));

router.get('/tickets/:id/client-history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Ticket not found', 404);
  const email = doc.data()!['customerEmail'] as string;
  if (!email) { res.json({ success: true, data: { tickets: [], total: 0 } }); return; }
  const snap = await db.collection(`companies/${companyId}/supportTickets`).where('customerEmail', '==', email).limit(50).get();
  res.json({ success: true, data: { tickets: snap.docs.filter(d => d.id !== req.params.id).map(serializeSnap), total: snap.size - 1 } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).limit(500).get();
    const now = new Date();
    const tickets = snap.docs.map(d => d.data());
    const byStatus: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    const byPrio: Record<string, number> = {};
    let tSat = 0, nSat = 0, tFR = 0, nFR = 0, tRes = 0, nRes = 0, slaBreach = 0;
    for (const t of tickets) {
      const s = (t['status'] as string) ?? 'open';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      byCat[(t['category'] as string) ?? 'general'] = (byCat[(t['category'] as string) ?? 'general'] ?? 0) + 1;
      byPrio[(t['priority'] as string) ?? 'normal'] = (byPrio[(t['priority'] as string) ?? 'normal'] ?? 0) + 1;
      if (t['satisfaction'] != null) { tSat += t['satisfaction'] as number; nSat++; }
      const ca = t['createdAt']?.toDate?.(); const fr = t['firstResponseAt']?.toDate?.(); const ra = t['resolvedAt']?.toDate?.();
      if (ca && fr) { tFR += (fr.getTime() - ca.getTime()) / 60000; nFR++; }
      if (ca && ra) { tRes += (ra.getTime() - ca.getTime()) / 60000; nRes++; }
      const rd = t['slaResolutionDeadline']?.toDate?.();
      if (rd && s !== 'resolved' && s !== 'closed' && rd < now) slaBreach++;
    }
    return {
      total: tickets.length, open: byStatus['open'] ?? 0, assigned: byStatus['assigned'] ?? 0,
      inProgress: byStatus['in_progress'] ?? 0, waitingClient: byStatus['waiting_client'] ?? 0,
      escalated: byStatus['escalated'] ?? 0, resolved: byStatus['resolved'] ?? 0, closed: byStatus['closed'] ?? 0,
      avgSatisfaction: nSat > 0 ? Math.round((tSat / nSat) * 10) / 10 : 0,
      avgFirstResponseMin: nFR > 0 ? Math.round(tFR / nFR) : 0,
      avgResolutionMin: nRes > 0 ? Math.round(tRes / nRes) : 0,
      slaBreachCount: slaBreach, highPriority: (byPrio['high'] ?? 0) + (byPrio['urgent'] ?? 0),
      byCategory: Object.entries(byCat).map(([k, v]) => ({ category: k, count: v })).sort((a, b) => b.count - a.count),
      byPriority: Object.entries(byPrio).map(([k, v]) => ({ priority: k, count: v })),
    };
  }, { total: 0, open: 0, assigned: 0, inProgress: 0, waitingClient: 0, escalated: 0, resolved: 0, closed: 0, avgSatisfaction: 0, avgFirstResponseMin: 0, avgResolutionMin: 0, slaBreachCount: 0, highPriority: 0, byCategory: [], byPriority: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/kb', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${companyId}/knowledgeBase`) as FirebaseFirestore.Query;
    if (req.query['category']) q = q.where('category', '==', req.query['category']);
    return (await q.limit(200).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.post('/kb', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const article = {
    id, companyId, title: body['title'] ?? '', content: body['content'] ?? '',
    category: body['category'] ?? 'general',
    tags: Array.isArray(body['tags']) ? body['tags'] : (typeof body['tags'] === 'string' ? (body['tags'] as string).split(',').map(t => t.trim()).filter(Boolean) : []),
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${companyId}/knowledgeBase`).doc(id).set(article);
  res.status(201).json({ success: true, data: article });
}));

router.patch('/kb/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/knowledgeBase`).doc(req.params.id)
    .update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/kb/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/knowledgeBase`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CANNED RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/canned', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${companyId}/cannedResponses`).limit(100).get()).docs.map(serializeSnap), []);
  res.json({ success: true, data });
}));

router.post('/canned', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const tmpl = { id, companyId, title: body['title'] ?? '', content: body['content'] ?? '', category: body['category'] ?? 'general', createdBy: req.user!.uid, createdAt: new Date() };
  await getFirestore().collection(`companies/${companyId}/cannedResponses`).doc(id).set(tmpl);
  res.status(201).json({ success: true, data: tmpl });
}));

router.delete('/canned/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/cannedResponses`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: AGENT PERFORMANCE, SLA DASHBOARD, NPS, SENTIMENT, AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/agent-performance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { agentPerformanceTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (agentPerformanceTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/sla-dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { slaDashboardTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (slaDashboardTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/nps', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { npsSurveyTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (npsSurveyTool as (a: unknown) => Promise<unknown>)({ companyId: cid, action: 'analytics' }) });
}));

router.post('/nps', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { npsSurveyTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (npsSurveyTool as (a: unknown) => Promise<unknown>)({ companyId: cid, action: 'send', ...(req.body as Record<string, unknown>) }) });
}));

router.post('/tickets/:id/sentiment', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { sentimentDetectionTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (sentimentDetectionTool as (a: unknown) => Promise<unknown>)({ companyId: cid, ticketId: req.params.id, message: (req.body as Record<string, string>)['message'] ?? '' }) });
}));

router.post('/tickets/:id/smart-priority', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { smartPriorityTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (smartPriorityTool as (a: unknown) => Promise<unknown>)({ companyId: cid, ticketId: req.params.id }) });
}));

router.get('/tickets/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { ticketTimelineTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (ticketTimelineTool as (a: unknown) => Promise<unknown>)({ companyId: cid, ticketId: req.params.id }) });
}));

router.post('/automation/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { supportAutomationTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (supportAutomationTool as (a: unknown) => Promise<unknown>)({ companyId: cid, type: (req.body as Record<string, string>)['type'] ?? 'sla_alerts' }) });
}));

// PRO: Predictive support
router.get('/predictive', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { predictiveSupportTool } = await import('../agents/support.agent');
  res.json({ success: true, data: await (predictiveSupportTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

// PRO: Auto-resolve (public — used by clone/widget)
router.post('/auto-resolve', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { autoResolveTool } = await import('../agents/support.agent');
  const body = req.body as Record<string, unknown>;
  res.json({ success: true, data: await (autoResolveTool as (a: unknown) => Promise<unknown>)({ companyId: cid, issue: body['issue'] ?? '', customerEmail: body['customerEmail'] }) });
}));

export default router;
