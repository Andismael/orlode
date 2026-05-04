/**
 * IT Routes PRO — Tickets SLA · Assets · Licenses · Services · Stats · KB
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
router.use(authMiddleware);
router.use(requireAgentRole('it'));

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
function serializeSnap(doc: FirebaseFirestore.QueryDocumentSnapshot) { return { id: doc.id, ...serializeDoc(doc.data()) }; }

const SLA: Record<string, { fr: number; res: number }> = { critical: { fr: 15, res: 60 }, high: { fr: 30, res: 240 }, medium: { fr: 120, res: 480 }, low: { fr: 480, res: 1440 } };

// ═══════════════════════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/itTickets`) as FirebaseFirestore.Query;
    if (req.query['status'] && req.query['status'] !== 'all') q = q.where('status', '==', req.query['status']);
    if (req.query['priority']) q = q.where('priority', '==', req.query['priority']);
    if (req.query['category']) q = q.where('category', '==', req.query['category']);
    return (await q.limit(200).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.get('/tickets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/itTickets`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Ticket not found', 404);
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()!) } });
}));

router.post('/tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
  const countSnap = await db.collection(`companies/${cid}/itTickets`).count().get();
  const num = `IT-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
  const prio = (body['priority'] as string) ?? 'medium';
  const sla = SLA[prio] ?? SLA['medium'];
  const now = new Date();
  const ticket = {
    id, ticketNumber: num, title: body['title'] ?? body['subject'] ?? '', description: body['description'] ?? '',
    priority: prio, category: body['category'] ?? 'other', status: 'open',
    reportedBy: body['reportedBy'] ?? req.user!.email, assignedTo: body['assignedTo'] ?? null,
    messages: [], tags: [],
    slaFirstResponse: sla.fr, slaResolution: sla.res,
    slaFirstResponseDeadline: new Date(now.getTime() + sla.fr * 60000),
    slaResolutionDeadline: new Date(now.getTime() + sla.res * 60000),
    slaFirstResponseMet: null, firstResponseAt: null, resolvedAt: null,
    createdBy: req.user!.uid, createdAt: now, updatedAt: now,
  };
  await db.collection(`companies/${cid}/itTickets`).doc(id).set(ticket);
  createNotification({ companyId: cid, type: 'system', title: `Ticket IT — ${num}`, message: `${ticket.reportedBy}: ${ticket.title}`, actionUrl: `/it/tickets`, icon: 'Monitor', severity: prio === 'critical' ? 'error' : prio === 'high' ? 'warning' : 'info' }).catch(() => {});
  res.status(201).json({ success: true, data: ticket });
}));

router.patch('/tickets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date(), updatedBy: req.user!.uid };
  if (body['status'] === 'resolved') updates['resolvedAt'] = new Date();
  await getFirestore().collection(`companies/${cid}/itTickets`).doc(req.params.id).update(updates);
  res.json({ success: true });
}));

router.delete('/tickets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itTickets`).doc(req.params.id).delete();
  res.json({ success: true });
}));

router.post('/tickets/:id/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const content = body['content'] as string; if (!content) throw new AppError('content required', 400);
  const role = (body['role'] as string) ?? 'agent';
  const db = getFirestore();
  const ref = db.collection(`companies/${cid}/itTickets`).doc(req.params.id);
  const msg = { id: generateId(), content, role, authorId: req.user!.uid, authorName: req.user!.email, createdAt: new Date().toISOString() };
  const updates: Record<string, unknown> = { messages: FieldValue.arrayUnion(msg), updatedAt: new Date() };
  if (role === 'agent' || role === 'ai') {
    const doc = await ref.get(); const d = doc.data();
    if (d && !d['firstResponseAt']) { updates['firstResponseAt'] = new Date(); const dl = d['slaFirstResponseDeadline']?.toDate?.(); updates['slaFirstResponseMet'] = dl ? new Date() <= dl : null; }
    if (d?.['status'] === 'open') updates['status'] = 'in_progress';
  }
  await ref.update(updates);
  res.status(201).json({ success: true, data: msg });
}));

router.post('/tickets/:id/suggest', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/itTickets`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Ticket not found', 404);
  const d = doc.data()!;
  const query = `${d['title'] ?? ''} ${d['description'] ?? ''}`;
  const kbSnap = await db.collection(`companies/${cid}/itKnowledge`).limit(20).get();
  const kw = query.toString().toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const rel = kbSnap.docs.map(d2 => ({ title: (d2.data()['title'] as string) ?? '', content: (d2.data()['content'] as string) ?? '' }))
    .filter(a => kw.some(k => `${a.title} ${a.content}`.toLowerCase().includes(k))).slice(0, 3);
  if (rel.length === 0) { res.json({ success: true, data: { suggestion: 'Aucune procedure trouvee. Resolution manuelle recommandee.', sources: [], confidence: 20 } }); return; }
  const { ai, GEMINI_FLASH } = await import('../config/genkit.config');
  const result = await ai.generate({ model: GEMINI_FLASH, system: 'IT support tech. Step-by-step resolution. Concise. French.', prompt: `Issue: ${query}\n\nKB:\n${rel.map(a => `## ${a.title}\n${a.content}`).join('\n\n')}`, config: { temperature: 0.3 } });
  res.json({ success: true, data: { suggestion: result.text, sources: rel.map(a => a.title), confidence: Math.min(90, 40 + rel.length * 20) } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/assets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/itAssets`) as FirebaseFirestore.Query;
    if (req.query['type']) q = q.where('type', '==', req.query['type']);
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    return (await q.limit(200).get()).docs.map(serializeSnap);
  }, []);
  res.json({ success: true, data });
}));

router.post('/assets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const asset = {
    id, companyId: cid, name: body['name'] ?? '', type: body['type'] ?? 'hardware',
    serialNumber: body['serialNumber'] ?? '', brand: body['brand'] ?? '', model: body['model'] ?? '',
    status: body['status'] ?? 'stock', assignedTo: body['assignedTo'] ?? null, location: body['location'] ?? '',
    value: body['value'] ?? 0, purchaseDate: body['purchaseDate'] ?? null,
    warrantyExpiry: body['warrantyExpiry'] ?? null,
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/itAssets`).doc(id).set(asset);
  res.status(201).json({ success: true, data: asset });
}));

router.patch('/assets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itAssets`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/assets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itAssets`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// LICENSES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/licenses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${cid}/itLicenses`).limit(200).get()).docs.map(serializeSnap), []);
  res.json({ success: true, data });
}));

router.post('/licenses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const license = {
    id, companyId: cid, name: body['name'] ?? '', vendor: body['vendor'] ?? '',
    seats: body['seats'] ?? 1, usedSeats: body['usedSeats'] ?? 0,
    costPerSeat: body['costPerSeat'] ?? 0, totalCost: body['totalCost'] ?? 0,
    expiresAt: body['expiresAt'] ?? null, key: body['key'] ?? '',
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/itLicenses`).doc(id).set(license);
  res.status(201).json({ success: true, data: license });
}));

router.patch('/licenses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itLicenses`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/licenses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itLicenses`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/services', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${cid}/itServices`).limit(50).get()).docs.map(serializeSnap), []);
  res.json({ success: true, data });
}));

router.post('/services', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const svc = { id, companyId: cid, name: body['name'] ?? '', url: body['url'] ?? '', status: body['status'] ?? 'operational', uptime: body['uptime'] ?? 99.9, createdAt: new Date() };
  await getFirestore().collection(`companies/${cid}/itServices`).doc(id).set(svc);
  res.status(201).json({ success: true, data: svc });
}));

router.patch('/services/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itServices`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// IT KB
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/kb', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${cid}/itKnowledge`).limit(200).get()).docs.map(serializeSnap), []);
  res.json({ success: true, data });
}));

router.post('/kb', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const article = { id, companyId: cid, title: body['title'] ?? '', content: body['content'] ?? '', category: body['category'] ?? 'general', createdBy: req.user!.uid, createdAt: new Date() };
  await getFirestore().collection(`companies/${cid}/itKnowledge`).doc(id).set(article);
  res.status(201).json({ success: true, data: article });
}));

router.delete('/kb/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/itKnowledge`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS / DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [tSnap, aSnap, lSnap, sSnap] = await Promise.all([
      db.collection(`companies/${cid}/itTickets`).limit(500).get(),
      db.collection(`companies/${cid}/itAssets`).limit(500).get(),
      db.collection(`companies/${cid}/itLicenses`).limit(100).get(),
      db.collection(`companies/${cid}/itServices`).limit(50).get(),
    ]);
    const now = new Date(); const soon = new Date(now.getTime() + 30 * 86400000);
    const tickets = tSnap.docs.map(d => d.data());
    let open = 0, esc = 0, slaBreach = 0, tRes = 0, nRes = 0;
    const byCat: Record<string, number> = {};
    for (const t of tickets) {
      const s = (t['status'] as string) ?? 'open';
      if (['open', 'assigned', 'in_progress'].includes(s)) open++;
      if (s === 'escalated') esc++;
      byCat[(t['category'] as string) ?? 'other'] = (byCat[(t['category'] as string) ?? 'other'] ?? 0) + 1;
      const rd = t['slaResolutionDeadline']?.toDate?.(); if (rd && s !== 'resolved' && s !== 'closed' && rd < now) slaBreach++;
      const ca = t['createdAt']?.toDate?.(); const ra = t['resolvedAt']?.toDate?.();
      if (ca && ra) { tRes += (ra.getTime() - ca.getTime()) / 60000; nRes++; }
    }
    let assetVal = 0, warAlert = 0;
    for (const d of aSnap.docs) { assetVal += (d.data()['value'] as number) ?? 0; const we = d.data()['warrantyExpiry']?.toDate?.(); if (we && we < now) warAlert++; }
    let licCost = 0, expLic = 0;
    for (const d of lSnap.docs) { licCost += (d.data()['totalCost'] as number) ?? 0; const e = d.data()['expiresAt']?.toDate?.(); if (e && e < soon) expLic++; }
    const svcDown = sSnap.docs.filter(d => d.data()['status'] === 'down').length;
    return {
      totalTickets: tickets.length, openTickets: open, escalated: esc, slaBreaches: slaBreach,
      avgResolutionMin: nRes > 0 ? Math.round(tRes / nRes) : 0,
      totalAssets: aSnap.size, assetValue: assetVal, warrantyAlerts: warAlert,
      totalLicenses: lSnap.size, licenseCost: licCost, expiringLicenses: expLic,
      totalServices: sSnap.size, servicesDown: svcDown,
      byCategory: Object.entries(byCat).map(([k, v]) => ({ category: k, count: v })).sort((a, b) => b.count - a.count),
    };
  }, { totalTickets: 0, openTickets: 0, escalated: 0, slaBreaches: 0, avgResolutionMin: 0, totalAssets: 0, assetValue: 0, warrantyAlerts: 0, totalLicenses: 0, licenseCost: 0, expiringLicenses: 0, totalServices: 0, servicesDown: 0, byCategory: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-ASSIGN
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/tickets/:id/auto-assign', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const agentsSnap = await db.collection('users').where('companyId', '==', cid).where('role', 'in', ['admin', 'manager']).limit(20).get();
  if (agentsSnap.empty) { res.json({ success: true, data: { assignedTo: null, message: 'Aucun technicien disponible.' } }); return; }
  const agents = agentsSnap.docs.map(d => ({ uid: d.id, name: (d.data()['displayName'] as string) ?? (d.data()['email'] as string) ?? d.id }));
  const counts = await Promise.all(agents.map(async a => {
    const s = await db.collection(`companies/${cid}/itTickets`).where('assignedTo', '==', a.uid).where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
    return { ...a, count: s.size };
  }));
  counts.sort((a, b) => a.count - b.count);
  const best = counts[0];
  await db.collection(`companies/${cid}/itTickets`).doc(req.params.id).update({ assignedTo: best.uid, assignedToName: best.name, status: 'assigned', updatedAt: new Date() });
  // Notify assigned tech
  createNotification({ companyId: cid, userId: best.uid, type: 'system', title: 'Ticket IT assigne', message: `Un ticket vous a ete assigne.`, actionUrl: `/it/tickets`, icon: 'UserCheck', severity: 'info' }).catch(() => {});
  res.json({ success: true, data: { assignedTo: best.uid, assignedName: best.name } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY — Asset history + Employee IT history
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/it/assets/:id/history — all tickets related to this asset
router.get('/assets/:id/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const assetDoc = await db.collection(`companies/${cid}/itAssets`).doc(req.params.id).get();
  if (!assetDoc.exists) throw new AppError('Asset not found', 404);
  const assetData = assetDoc.data()!;
  const assetName = (assetData['name'] as string) ?? '';
  const serialNumber = (assetData['serialNumber'] as string) ?? '';

  // Find tickets mentioning this asset (by name or serial)
  const snap = await db.collection(`companies/${cid}/itTickets`).limit(500).get();
  const related = snap.docs.filter(d => {
    const data = d.data();
    const text = `${data['title'] ?? ''} ${data['description'] ?? ''}`.toLowerCase();
    return (assetName && text.includes(assetName.toLowerCase())) || (serialNumber && text.includes(serialNumber.toLowerCase()));
  }).map(serializeSnap);

  res.json({ success: true, data: { asset: { id: assetDoc.id, ...serializeDoc(assetData) }, tickets: related, total: related.length } });
}));

// GET /api/it/employee/:email/history — all IT tickets for an employee
router.get('/employee/:email/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const email = decodeURIComponent(req.params.email);
  const [ticketsSnap, assetsSnap] = await Promise.all([
    db.collection(`companies/${cid}/itTickets`).where('reportedBy', '==', email).limit(50).get(),
    db.collection(`companies/${cid}/itAssets`).where('assignedTo', '==', email).limit(20).get(),
  ]);
  res.json({
    success: true,
    data: {
      tickets: ticketsSnap.docs.map(serializeSnap),
      assets: assetsSnap.docs.map(serializeSnap),
      totalTickets: ticketsSnap.size,
      totalAssets: assetsSnap.size,
    },
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SLA CHECK — cron endpoint to detect breaches and send notifications
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/sla-check', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const now = new Date();
  const snap = await db.collection(`companies/${cid}/itTickets`)
    .where('status', 'in', ['open', 'assigned', 'in_progress']).limit(200).get();

  let breachCount = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const resDeadline = data['slaResolutionDeadline']?.toDate?.();
    const frDeadline = data['slaFirstResponseDeadline']?.toDate?.();
    const alreadyNotified = data['slaBreachNotified'] as boolean;
    const ticketNum = (data['ticketNumber'] as string) ?? doc.id.slice(0, 8);

    // Resolution SLA breach
    if (resDeadline && resDeadline < now && !alreadyNotified) {
      createNotification({
        companyId: cid, type: 'system', title: `SLA depasse — ${ticketNum}`,
        message: `Le ticket ${ticketNum} a depasse son SLA de resolution (${data['priority']}).`,
        actionUrl: `/it/tickets`, icon: 'Flame', severity: 'error',
      }).catch(() => {});
      // Notify assigned tech
      if (data['assignedTo']) {
        createNotification({
          companyId: cid, userId: data['assignedTo'] as string, type: 'system',
          title: `SLA depasse — ${ticketNum}`, message: `Votre ticket ${ticketNum} a depasse le SLA.`,
          actionUrl: `/it/tickets`, icon: 'Flame', severity: 'error',
        }).catch(() => {});
      }
      await doc.ref.update({ slaBreachNotified: true });
      breachCount++;
    }

    // First response SLA warning (5 min before deadline)
    if (frDeadline && !data['firstResponseAt']) {
      const warnTime = new Date(frDeadline.getTime() - 5 * 60000);
      if (now > warnTime && now < frDeadline && !data['slaFRWarningNotified']) {
        createNotification({
          companyId: cid, userId: data['assignedTo'] as string ?? undefined, type: 'system',
          title: `SLA 1ere reponse bientot — ${ticketNum}`,
          message: `Repondez au ticket ${ticketNum} avant ${frDeadline.toLocaleTimeString('fr-FR')}.`,
          actionUrl: `/it/tickets`, icon: 'Clock', severity: 'warning',
        }).catch(() => {});
        await doc.ref.update({ slaFRWarningNotified: true });
      }
    }
  }

  // Check expiring licenses
  const soon = new Date(now.getTime() + 7 * 86400000);
  const licSnap = await db.collection(`companies/${cid}/itLicenses`).limit(100).get();
  for (const doc of licSnap.docs) {
    const data = doc.data();
    const exp = data['expiresAt']?.toDate?.();
    if (exp && exp > now && exp < soon && !data['expiryNotified']) {
      createNotification({
        companyId: cid, type: 'system', title: `Licence expire bientot — ${data['name']}`,
        message: `La licence ${data['name']} (${data['vendor']}) expire le ${exp.toLocaleDateString('fr-FR')}.`,
        actionUrl: `/it/licenses`, icon: 'Key', severity: 'warning',
      }).catch(() => {});
      await doc.ref.update({ expiryNotified: true });
    }
  }

  // Check expired warranties
  const assetSnap = await db.collection(`companies/${cid}/itAssets`).limit(200).get();
  for (const doc of assetSnap.docs) {
    const data = doc.data();
    const we = data['warrantyExpiry']?.toDate?.();
    if (we && we < now && !data['warrantyExpiredNotified']) {
      createNotification({
        companyId: cid, type: 'system', title: `Garantie expiree — ${data['name']}`,
        message: `La garantie de ${data['name']} (${data['brand']} ${data['model']}) a expire.`,
        actionUrl: `/it/assets`, icon: 'Shield', severity: 'warning',
      }).catch(() => {});
      await doc.ref.update({ warrantyExpiredNotified: true });
    }
  }

  // Check services down
  const svcSnap = await db.collection(`companies/${cid}/itServices`).limit(50).get();
  for (const doc of svcSnap.docs) {
    const data = doc.data();
    if (data['status'] === 'down' && !data['downNotified']) {
      createNotification({
        companyId: cid, type: 'security_alert', title: `Service DOWN — ${data['name']}`,
        message: `Le service ${data['name']} est hors ligne.`,
        actionUrl: `/it`, icon: 'Monitor', severity: 'error',
      }).catch(() => {});
      await doc.ref.update({ downNotified: true });
    }
  }

  res.json({ success: true, data: { slaBreaches: breachCount } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: CMDB, MONITORING, TECH PERFORMANCE, LICENSE OPTIM, AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/cmdb', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { cmdbOverviewTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (cmdbOverviewTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/monitoring', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { monitoringDashboardTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (monitoringDashboardTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/tech-performance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { techPerformanceTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (techPerformanceTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/license-optimization', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { licenseOptimizationTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (licenseOptimizationTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.post('/automation/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { itAutomationTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (itAutomationTool as (a: unknown) => Promise<unknown>)({ companyId: cid, type: (req.body as Record<string, string>)['type'] ?? 'sla_check' }) });
}));

router.get('/tickets/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { itIncidentTimelineTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (itIncidentTimelineTool as (a: unknown) => Promise<unknown>)({ companyId: cid, ticketId: req.params.id }) });
}));

router.get('/predictive', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { predictiveITTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (predictiveITTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.post('/from-clone', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { cloneToITTool } = await import('../agents/it.agent');
  res.json({ success: true, data: await (cloneToITTool as (a: unknown) => Promise<unknown>)({ companyId: cid, ...(req.body as Record<string, unknown>) }) });
}));

export default router;
