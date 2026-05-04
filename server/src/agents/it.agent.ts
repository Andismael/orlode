/**
 * IT Agent PRO — Gemini Flash
 * Mission : Infrastructure fiable, utilisateurs autonomes, zero ticket oublie.
 *
 * Capabilities:
 *   1. Tickets IT — create, assign, escalate, SLA tracking, AI suggest
 *   2. Assets — inventory, warranty tracking, assignment, valuation
 *   3. Licenses — tracking, renewal alerts, cost per seat
 *   4. Services — monitoring, uptime, incident history
 *   5. Knowledge Base — procedures, troubleshooting
 *   6. Analytics — KPIs, volumes, resolution time
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const CATEGORIES = ['hardware', 'software', 'access', 'network', 'email', 'security', 'other'] as const;
const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_user', 'escalated', 'resolved', 'closed'] as const;

const SLA_TARGETS: Record<string, { firstResponse: number; resolution: number }> = {
  critical: { firstResponse: 15, resolution: 60 },
  high:     { firstResponse: 30, resolution: 240 },
  medium:   { firstResponse: 120, resolution: 480 },
  low:      { firstResponse: 480, resolution: 1440 },
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. TICKETS
// ══════════════════════════════════════════════════════════════════════════════

export const createTicketTool = ai.defineTool(
  {
    name: 'it_createTicket',
    description: 'Create an IT support ticket with SLA tracking.',
    inputSchema: z.object({
      companyId: z.string(), title: z.string(), description: z.string(),
      priority: z.enum(PRIORITIES).optional().default('medium'),
      category: z.enum(CATEGORIES).optional().default('other'),
      reportedBy: z.string().optional(), reportedByEmail: z.string().optional(),
    }),
    outputSchema: z.object({ ticketId: z.string(), ticketNumber: z.string(), message: z.string() }),
  },
  async ({ companyId, title, description, priority, category, reportedBy, reportedByEmail }) => {
    const db = getFirestore();
    const id = generateId();
    const countSnap = await db.collection(`companies/${companyId}/itTickets`).count().get();
    const count = countSnap.data().count + 1;
    const ticketNumber = `IT-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const prio = priority ?? 'medium';
    const sla = SLA_TARGETS[prio];
    const now = new Date();

    await db.collection(`companies/${companyId}/itTickets`).doc(id).set({
      id, ticketNumber, title, description, priority: prio, category: category ?? 'other',
      status: 'open', reportedBy: reportedBy ?? null, reportedByEmail: reportedByEmail ?? null,
      assignedTo: null, messages: [], tags: [],
      slaFirstResponse: sla.firstResponse, slaResolution: sla.resolution,
      slaFirstResponseDeadline: new Date(now.getTime() + sla.firstResponse * 60000),
      slaResolutionDeadline: new Date(now.getTime() + sla.resolution * 60000),
      slaFirstResponseMet: null, firstResponseAt: null, resolvedAt: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('[IT] Ticket created', { companyId, ticketId: id, ticketNumber, priority: prio });
    return { ticketId: id, ticketNumber, message: `Ticket ${ticketNumber} cree (priorite: ${prio}).` };
  }
);

export const getTicketsTool = ai.defineTool(
  {
    name: 'it_getTickets',
    description: 'List IT tickets filtered by status, priority, category, or assignee.',
    inputSchema: z.object({
      companyId: z.string(), status: z.string().optional(), priority: z.string().optional(),
      category: z.string().optional(), assignedTo: z.string().optional(),
    }),
    outputSchema: z.object({
      tickets: z.array(z.object({
        id: z.string(), ticketNumber: z.string(), title: z.string(), status: z.string(),
        priority: z.string(), category: z.string(), assignedTo: z.string().optional(),
        slaBreached: z.boolean(), createdAt: z.string(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, status, priority, category, assignedTo }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/itTickets`) as FirebaseFirestore.Query;
    if (status && status !== 'all') q = q.where('status', '==', status);
    if (priority) q = q.where('priority', '==', priority);
    if (category) q = q.where('category', '==', category);
    if (assignedTo) q = q.where('assignedTo', '==', assignedTo);
    const snap = await q.limit(100).get();
    const now = new Date();
    const tickets = snap.docs.map(d => {
      const data = d.data();
      const resDeadline = data['slaResolutionDeadline']?.toDate?.() ?? null;
      const resolved = data['status'] === 'resolved' || data['status'] === 'closed';
      return {
        id: d.id, ticketNumber: (data['ticketNumber'] as string) ?? '',
        title: (data['title'] as string) ?? '', status: (data['status'] as string) ?? 'open',
        priority: (data['priority'] as string) ?? 'medium', category: (data['category'] as string) ?? 'other',
        assignedTo: (data['assignedTo'] as string) ?? undefined,
        slaBreached: !resolved && !!resDeadline && resDeadline < now,
        createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
      };
    });
    return { tickets, total: tickets.length };
  }
);

/**
 * Resolve an IT ticket reference (UUID OR ticketNumber like IT-2026-0004) to the Firestore doc ID.
 */
async function resolveITTicketDocId(companyId: string, ref: string): Promise<string | null> {
  const db = getFirestore();
  const direct = await db.collection(`companies/${companyId}/itTickets`).doc(ref).get().catch(() => null);
  if (direct?.exists) return direct.id;
  const byNum = await db.collection(`companies/${companyId}/itTickets`).where('ticketNumber', '==', ref).limit(1).get().catch(() => null);
  if (byNum && !byNum.empty) return byNum.docs[0].id;
  const byId = await db.collection(`companies/${companyId}/itTickets`).where('id', '==', ref).limit(1).get().catch(() => null);
  if (byId && !byId.empty) return byId.docs[0].id;
  return null;
}

export const updateTicketTool = ai.defineTool(
  {
    name: 'it_updateTicket',
    description: 'Update IT ticket status, priority, assignment, or add a message. Accepts UUID or ticketNumber (IT-YYYY-XXXX).',
    inputSchema: z.object({
      companyId: z.string(), ticketId: z.string().describe('UUID or ticketNumber like IT-2026-0004'),
      status: z.enum(TICKET_STATUSES).optional(), priority: z.enum(PRIORITIES).optional(),
      assignedTo: z.string().optional(), message: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, ticketId, status, priority, assignedTo, message }) => {
    const db = getFirestore();
    const docId = await resolveITTicketDocId(companyId, ticketId);
    if (!docId) return { success: false, message: `Ticket ${ticketId} introuvable.` };
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (status) { updates['status'] = status; if (status === 'resolved') updates['resolvedAt'] = FieldValue.serverTimestamp(); }
    if (priority) updates['priority'] = priority;
    if (assignedTo) { updates['assignedTo'] = assignedTo; if (!status) updates['status'] = 'assigned'; }
    if (message) {
      updates['messages'] = FieldValue.arrayUnion({ id: generateId(), content: message, role: 'agent', createdAt: new Date().toISOString() });
      const doc = await db.collection(`companies/${companyId}/itTickets`).doc(docId).get();
      if (doc.data() && !doc.data()!['firstResponseAt']) {
        updates['firstResponseAt'] = FieldValue.serverTimestamp();
        const deadline = doc.data()!['slaFirstResponseDeadline']?.toDate?.();
        updates['slaFirstResponseMet'] = deadline ? new Date() <= deadline : null;
      }
    }
    await db.collection(`companies/${companyId}/itTickets`).doc(docId).update(updates);
    return { success: true, message: `Ticket ${ticketId} mis à jour.` };
  }
);

export const escalateTicketTool = ai.defineTool(
  {
    name: 'it_escalateTicket',
    description: 'Escalate IT ticket to senior tech, manager, or external vendor. Accepts UUID or ticketNumber.',
    inputSchema: z.object({
      companyId: z.string(), ticketId: z.string().describe('UUID or ticketNumber like IT-2026-0004'),
      reason: z.string(),
      escalateTo: z.enum(['senior_tech', 'manager', 'vendor']).default('senior_tech'),
    }),
    outputSchema: z.object({ escalated: z.boolean(), message: z.string() }),
  },
  async ({ companyId, ticketId, reason, escalateTo }) => {
    const db = getFirestore();
    const docId = await resolveITTicketDocId(companyId, ticketId);
    if (!docId) return { escalated: false, message: `Ticket ${ticketId} introuvable.` };
    await db.collection(`companies/${companyId}/itTickets`).doc(docId).update({
      status: 'escalated', escalatedTo: escalateTo, escalationReason: reason,
      escalatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { escalated: true, message: `Ticket ${ticketId} escaladé vers ${escalateTo}. Raison: ${reason}` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. ASSETS
// ══════════════════════════════════════════════════════════════════════════════

export const getAssetsTool = ai.defineTool(
  {
    name: 'it_getAssets',
    description: 'List IT assets with warranty and assignment info.',
    inputSchema: z.object({ companyId: z.string(), type: z.string().optional(), assignedTo: z.string().optional() }),
    outputSchema: z.object({
      assets: z.array(z.object({
        id: z.string(), name: z.string(), type: z.string(), status: z.string(),
        assignedTo: z.string().optional(), warrantyExpiry: z.string().optional(),
        warrantyExpired: z.boolean(), value: z.number(),
      })),
      total: z.number(), totalValue: z.number(), warrantyAlerts: z.number(),
    }),
  },
  async ({ companyId, type, assignedTo }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/itAssets`) as FirebaseFirestore.Query;
    if (type) q = q.where('type', '==', type);
    if (assignedTo) q = q.where('assignedTo', '==', assignedTo);
    const snap = await q.limit(200).get();
    const now = new Date();
    let totalValue = 0, warrantyAlerts = 0;
    const assets = snap.docs.map(d => {
      const data = d.data();
      const warranty = data['warrantyExpiry']?.toDate?.() ?? (data['warrantyExpiry'] ? new Date(data['warrantyExpiry'] as string) : null);
      const expired = warranty ? warranty < now : false;
      const val = (data['value'] as number) ?? 0;
      totalValue += val;
      if (expired) warrantyAlerts++;
      return {
        id: d.id, name: (data['name'] as string) ?? '', type: (data['type'] as string) ?? '',
        status: (data['status'] as string) ?? 'active', assignedTo: (data['assignedTo'] as string) ?? undefined,
        warrantyExpiry: warranty?.toISOString() ?? undefined, warrantyExpired: expired, value: val,
      };
    });
    return { assets, total: assets.length, totalValue, warrantyAlerts };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. LICENSES
// ══════════════════════════════════════════════════════════════════════════════

export const getLicensesTool = ai.defineTool(
  {
    name: 'it_getLicenses',
    description: 'List software licenses with expiry and cost tracking.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      licenses: z.array(z.object({
        id: z.string(), name: z.string(), vendor: z.string(), seats: z.number(),
        usedSeats: z.number(), costPerSeat: z.number(), totalCost: z.number(),
        expiresAt: z.string().optional(), expired: z.boolean(),
      })),
      total: z.number(), totalCost: z.number(), expiringCount: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/itLicenses`).limit(100).get();
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86400000);
    let totalCost = 0, expiringCount = 0;
    const licenses = snap.docs.map(d => {
      const data = d.data();
      const expiry = data['expiresAt']?.toDate?.() ?? (data['expiresAt'] ? new Date(data['expiresAt'] as string) : null);
      const expired = expiry ? expiry < now : false;
      const expiringSoon = expiry ? expiry < soon && !expired : false;
      const cost = (data['totalCost'] as number) ?? ((data['costPerSeat'] as number) ?? 0) * ((data['seats'] as number) ?? 1);
      totalCost += cost;
      if (expired || expiringSoon) expiringCount++;
      return {
        id: d.id, name: (data['name'] as string) ?? '', vendor: (data['vendor'] as string) ?? '',
        seats: (data['seats'] as number) ?? 0, usedSeats: (data['usedSeats'] as number) ?? 0,
        costPerSeat: (data['costPerSeat'] as number) ?? 0, totalCost: cost,
        expiresAt: expiry?.toISOString() ?? undefined, expired,
      };
    });
    return { licenses, total: licenses.length, totalCost, expiringCount };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. SERVICES MONITORING
// ══════════════════════════════════════════════════════════════════════════════

export const getServicesTool = ai.defineTool(
  {
    name: 'it_getServices',
    description: 'Get IT services status and uptime.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      services: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), uptime: z.number(), lastIncident: z.string().optional() })),
      overallHealth: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/itServices`).limit(20).get();
    if (snap.empty) return { services: [{ id: 'none', name: 'Aucun service configure', status: 'unknown', uptime: 100 }], overallHealth: 'healthy' };
    const services = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, name: (data['name'] as string) ?? d.id, status: (data['status'] as string) ?? 'operational',
        uptime: (data['uptime'] as number) ?? 99.9, lastIncident: (data['lastIncident'] as string) ?? undefined,
      };
    });
    const hasDown = services.some(s => s.status === 'down');
    const hasDegraded = services.some(s => s.status === 'degraded');
    return { services, overallHealth: hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. KB + AI SUGGEST
// ══════════════════════════════════════════════════════════════════════════════

export const searchKBTool = ai.defineTool(
  {
    name: 'it_searchKB',
    description: 'Search IT knowledge base for procedures and troubleshooting.',
    inputSchema: z.object({ companyId: z.string(), query: z.string() }),
    outputSchema: z.object({ results: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), category: z.string() })), found: z.boolean() }),
  },
  async ({ companyId, query }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/itKnowledge`).limit(30).get();
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const results = snap.docs
      .map(d => {
        const data = d.data();
        const title = (data['title'] as string) ?? '';
        const content = (data['content'] as string) ?? '';
        const score = keywords.filter(kw => `${title} ${content}`.toLowerCase().includes(kw)).length;
        return { id: d.id, title, content, category: (data['category'] as string) ?? 'general', score };
      })
      .filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
      .map(({ score: _, ...rest }) => rest);
    return { results, found: results.length > 0 };
  }
);

export const suggestResolutionTool = ai.defineTool(
  {
    name: 'it_suggestResolution',
    description: 'Generate AI-suggested resolution for an IT ticket.',
    inputSchema: z.object({ companyId: z.string(), ticketId: z.string() }),
    outputSchema: z.object({ suggestion: z.string(), sources: z.array(z.string()), confidence: z.number() }),
  },
  async ({ companyId, ticketId }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/itTickets`).doc(ticketId).get();
    const data = doc.data();
    if (!data) return { suggestion: '', sources: [], confidence: 0 };
    const query = `${data['title']} ${data['description']}`;
    const kbSnap = await db.collection(`companies/${companyId}/itKnowledge`).limit(20).get();
    const keywords = query.toString().toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const relevant = kbSnap.docs.map(d => ({ title: (d.data()['title'] as string) ?? '', content: (d.data()['content'] as string) ?? '' }))
      .filter(a => keywords.some(kw => `${a.title} ${a.content}`.toLowerCase().includes(kw))).slice(0, 3);
    if (relevant.length === 0) return { suggestion: 'Aucune procedure trouvee. Resolution manuelle recommandee.', sources: [], confidence: 20 };
    const result = await ai.generate({
      model: GEMINI_FLASH,
      system: 'You are an IT support technician. Provide a step-by-step resolution. Be concise and technical. Reply in French.',
      prompt: `Issue: ${query}\n\nKB:\n${relevant.map(a => `## ${a.title}\n${a.content}`).join('\n\n')}`,
      config: { temperature: 0.3 },
    });
    return { suggestion: result.text, sources: relevant.map(a => a.title), confidence: Math.min(90, 40 + relevant.length * 20) };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. STATS
// ══════════════════════════════════════════════════════════════════════════════

export const getStatsTool = ai.defineTool(
  {
    name: 'it_getStats',
    description: 'Get IT department statistics and KPIs.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalTickets: z.number(), openTickets: z.number(), escalated: z.number(), slaBreaches: z.number(),
      avgResolutionMin: z.number(), totalAssets: z.number(), totalAssetValue: z.number(), warrantyAlerts: z.number(),
      totalLicenses: z.number(), licenseCost: z.number(), expiringLicenses: z.number(),
      byCategory: z.array(z.object({ category: z.string(), count: z.number() })),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [ticketsSnap, assetsSnap, licensesSnap] = await Promise.all([
      db.collection(`companies/${companyId}/itTickets`).limit(500).get(),
      db.collection(`companies/${companyId}/itAssets`).limit(500).get(),
      db.collection(`companies/${companyId}/itLicenses`).limit(100).get(),
    ]);
    const now = new Date();
    const tickets = ticketsSnap.docs.map(d => d.data());
    let open = 0, escalated = 0, slaBreaches = 0, totalRes = 0, resCount = 0;
    const byCat: Record<string, number> = {};
    for (const t of tickets) {
      const s = (t['status'] as string) ?? 'open';
      if (s === 'open' || s === 'assigned' || s === 'in_progress') open++;
      if (s === 'escalated') escalated++;
      byCat[(t['category'] as string) ?? 'other'] = (byCat[(t['category'] as string) ?? 'other'] ?? 0) + 1;
      const rd = t['slaResolutionDeadline']?.toDate?.();
      if (rd && s !== 'resolved' && s !== 'closed' && rd < now) slaBreaches++;
      const ca = t['createdAt']?.toDate?.(); const ra = t['resolvedAt']?.toDate?.();
      if (ca && ra) { totalRes += (ra.getTime() - ca.getTime()) / 60000; resCount++; }
    }
    let totalAssetValue = 0, warrantyAlerts = 0;
    for (const d of assetsSnap.docs) {
      totalAssetValue += (d.data()['value'] as number) ?? 0;
      const we = d.data()['warrantyExpiry']?.toDate?.();
      if (we && we < now) warrantyAlerts++;
    }
    let licenseCost = 0, expiringLicenses = 0;
    const soon = new Date(now.getTime() + 30 * 86400000);
    for (const d of licensesSnap.docs) {
      licenseCost += (d.data()['totalCost'] as number) ?? 0;
      const exp = d.data()['expiresAt']?.toDate?.();
      if (exp && exp < soon) expiringLicenses++;
    }
    return {
      totalTickets: tickets.length, openTickets: open, escalated, slaBreaches,
      avgResolutionMin: resCount > 0 ? Math.round(totalRes / resCount) : 0,
      totalAssets: assetsSnap.size, totalAssetValue, warrantyAlerts,
      totalLicenses: licensesSnap.size, licenseCost, expiringLicenses,
      byCategory: Object.entries(byCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CMDB OVERVIEW (asset lifecycle + topology)
// ══════════════════════════════════════════════════════════════════════════════

export const cmdbOverviewTool = ai.defineTool(
  {
    name: 'it_getCMDBOverview',
    description: 'CMDB dashboard — total assets by type/status, warranty alerts, depreciation, asset age distribution.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalAssets: z.number(),
      byType: z.array(z.object({ type: z.string(), count: z.number(), totalValue: z.number() })),
      byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
      warrantyExpiring: z.number(), avgAgeMonths: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/itAssets`).limit(500).get();
    const assets = snap.docs.map(d => d.data());
    const byType: Record<string, { count: number; value: number }> = {};
    const byStatus: Record<string, number> = {};
    let totalAge = 0; let warrantyExpiring = 0;
    const now = Date.now();
    const thirtyDays = 30 * 86400000;

    assets.forEach(a => {
      const type = (a['type'] as string) ?? 'other'; byType[type] = byType[type] ?? { count: 0, value: 0 }; byType[type].count++; byType[type].value += (a['purchasePrice'] as number) ?? (a['value'] as number) ?? 0;
      const status = (a['status'] as string) ?? 'active'; byStatus[status] = (byStatus[status] ?? 0) + 1;
      const purchased = (a['purchasedAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (a['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? now;
      totalAge += (now - purchased) / (30 * 86400000);
      const warranty = (a['warrantyExpires'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      if (warranty > 0 && warranty - now < thirtyDays && warranty > now) warrantyExpiring++;
    });

    return {
      totalAssets: assets.length,
      byType: Object.entries(byType).map(([t, d]) => ({ type: t, count: d.count, totalValue: d.value })).sort((a, b) => b.count - a.count),
      byStatus: Object.entries(byStatus).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count),
      warrantyExpiring, avgAgeMonths: assets.length > 0 ? Math.round(totalAge / assets.length) : 0,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: SERVICE MONITORING DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

export const monitoringDashboardTool = ai.defineTool(
  {
    name: 'it_getMonitoringDashboard',
    description: 'Service monitoring — uptime, alerts, incidents, service health overview.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      services: z.array(z.object({ name: z.string(), status: z.string(), uptime: z.number(), lastIncident: z.string(), responseTimeMs: z.number() })),
      totalUp: z.number(), totalDown: z.number(), avgUptime: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/itServices`).limit(50).get();
    const services = snap.docs.map(d => {
      const s = d.data();
      return {
        name: (s['name'] as string) ?? '', status: (s['status'] as string) ?? 'unknown',
        uptime: (s['uptime'] as number) ?? 99.9, lastIncident: (s['lastIncident'] as string) ?? '',
        responseTimeMs: (s['responseTimeMs'] as number) ?? 0,
      };
    });
    const up = services.filter(s => s.status === 'operational' || s.status === 'up').length;
    const down = services.filter(s => s.status === 'down' || s.status === 'outage').length;
    return { services, totalUp: up, totalDown: down, avgUptime: services.length > 0 ? Math.round(services.reduce((s, sv) => s + sv.uptime, 0) / services.length * 100) / 100 : 99.9 };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: TECH AGENT PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════

export const techPerformanceTool = ai.defineTool(
  {
    name: 'it_getTechPerformance',
    description: 'IT technician performance — tickets per tech, avg resolution time, workload.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      technicians: z.array(z.object({ name: z.string(), ticketsClosed: z.number(), ticketsOpen: z.number(), avgResolutionMin: z.number() })),
      topTech: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [ticketsSnap, usersSnap] = await Promise.all([
      db.collection(`companies/${companyId}/itTickets`).limit(500).get(),
      db.collection('users').where('companyId', '==', companyId).limit(50).get(),
    ]);
    const techMap = new Map<string, { name: string; closed: number; open: number; resTimes: number[] }>();
    usersSnap.docs.forEach(d => { const u = d.data(); if (['admin', 'manager', 'employee'].includes((u['role'] as string) ?? '') && ((u['department'] as string) ?? '').toLowerCase().includes('it')) techMap.set(d.id, { name: (u['displayName'] as string) ?? '', closed: 0, open: 0, resTimes: [] }); });
    ticketsSnap.docs.forEach(d => { const t = d.data(); const a = (t['assignee'] as string) ?? (t['assignedTo'] as string) ?? ''; if (!techMap.has(a)) return; const tech = techMap.get(a)!; if (['resolved', 'closed'].includes((t['status'] as string) ?? '')) tech.closed++; else tech.open++; });
    const technicians = Array.from(techMap.values()).filter(t => t.closed + t.open > 0).map(t => ({ name: t.name, ticketsClosed: t.closed, ticketsOpen: t.open, avgResolutionMin: 0 })).sort((a, b) => b.ticketsClosed - a.ticketsClosed);
    return { technicians, topTech: technicians[0]?.name ?? '' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: LICENSE OPTIMIZATION
// ══════════════════════════════════════════════════════════════════════════════

export const licenseOptimizationTool = ai.defineTool(
  {
    name: 'it_optimizeLicenses',
    description: 'License cost optimization — unused seats, expiring, cost per user, recommendations.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalCost: z.number(), totalSeats: z.number(), usedSeats: z.number(), unusedSeats: z.number(),
      wasteCost: z.number(), expiringCount: z.number(),
      recommendations: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/itLicenses`).limit(100).get();
    let totalCost = 0, totalSeats = 0, usedSeats = 0, expiringCount = 0;
    const now = Date.now();
    snap.docs.forEach(d => {
      const l = d.data();
      totalCost += (l['costPerSeat'] as number ?? 0) * (l['totalSeats'] as number ?? 0);
      totalSeats += (l['totalSeats'] as number) ?? 0;
      usedSeats += (l['usedSeats'] as number) ?? 0;
      const exp = (l['expiresAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      if (exp > 0 && exp - now < 30 * 86400000 && exp > now) expiringCount++;
    });
    const unusedSeats = totalSeats - usedSeats;
    const wasteCost = snap.docs.reduce((s, d) => { const l = d.data(); const unused = ((l['totalSeats'] as number) ?? 0) - ((l['usedSeats'] as number) ?? 0); return s + unused * ((l['costPerSeat'] as number) ?? 0); }, 0);
    const recs: string[] = [];
    if (unusedSeats > 5) recs.push(`${unusedSeats} sieges inutilises — economie potentielle de ${wasteCost}€`);
    if (expiringCount > 0) recs.push(`${expiringCount} licence(s) expirent dans 30 jours`);
    if (totalSeats > 0 && usedSeats / totalSeats < 0.7) recs.push('Taux d\'utilisation < 70% — renegociez vos contrats');
    return { totalCost, totalSeats, usedSeats, unusedSeats, wasteCost, expiringCount, recommendations: recs };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: IT AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════

export const itAutomationTool = ai.defineTool(
  {
    name: 'it_runAutomation',
    description: 'IT automation: incident → Security, license expire → Accounting, asset departure → HR offboarding.',
    inputSchema: z.object({ companyId: z.string(), type: z.enum(['security_incidents', 'license_alerts', 'asset_offboarding', 'sla_check']) }),
    outputSchema: z.object({ actions: z.array(z.string()), message: z.string() }),
  },
  async ({ companyId, type }) => {
    const db = getFirestore();
    const actions: string[] = [];
    const { createNotification } = await import('../services/notificationService');

    if (type === 'security_incidents') {
      const snap = await db.collection(`companies/${companyId}/itTickets`).where('category', 'in', ['security', 'virus', 'intrusion']).where('status', 'in', ['open', 'assigned']).limit(20).get();
      for (const doc of snap.docs) {
        await db.collection(`companies/${companyId}/securityIncidents`).doc(generateId()).set({
          id: generateId(), type: 'other', description: `Depuis IT: ${doc.data()['subject'] ?? ''}`, priority: 'P3_medium', status: 'detected', source: 'it_ticket', itTicketId: doc.id, createdAt: new Date(),
        });
        actions.push(`Incident securite depuis IT ticket ${doc.data()['subject'] ?? doc.id}`);
      }
    }
    if (type === 'license_alerts') {
      const snap = await db.collection(`companies/${companyId}/itLicenses`).limit(50).get();
      const now = Date.now();
      const expiring = snap.docs.filter(d => { const exp = (d.data()['expiresAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0; return exp > 0 && exp - now < 30 * 86400000 && exp > now; });
      if (expiring.length > 0) {
        createNotification({ companyId, type: 'system', title: `${expiring.length} licence(s) expirent bientot`, message: `Verifiez et renouvelez vos licences IT.`, actionUrl: '/it/licenses', icon: 'Key', severity: 'warning' }).catch(() => {});
        actions.push(`${expiring.length} alertes licence envoyees`);
      }
    }
    if (type === 'asset_offboarding') {
      const offSnap = await db.collection(`companies/${companyId}/offboarding`).where('status', '==', 'in_progress').limit(20).get();
      for (const doc of offSnap.docs) {
        const items = (doc.data()['items'] as { id: string; completed: boolean }[]) ?? [];
        const itItems = items.filter(i => i.id.startsWith('off-4') || i.id.startsWith('off-5') || i.id.startsWith('off-6'));
        const pending = itItems.filter(i => !i.completed);
        if (pending.length > 0) {
          actions.push(`Offboarding ${doc.id}: ${pending.length} etapes IT en attente`);
        }
      }
      if (actions.length > 0) {
        createNotification({ companyId, type: 'system', title: `${actions.length} offboarding(s) avec etapes IT`, message: 'Equipements et acces a recuperer.', actionUrl: '/it/assets', icon: 'Package', severity: 'warning' }).catch(() => {});
      }
    }
    if (type === 'sla_check') {
      const snap = await db.collection(`companies/${companyId}/itTickets`).where('status', 'in', ['open', 'assigned']).limit(100).get();
      const now = Date.now();
      let breaches = 0;
      for (const doc of snap.docs) {
        const t = doc.data();
        const dl = (t['slaDeadline'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        if (dl && dl < now && !t['slaBreachNotified']) { await doc.ref.update({ slaBreachNotified: true }); breaches++; }
      }
      if (breaches > 0) { createNotification({ companyId, type: 'system', title: `${breaches} SLA breach(es) IT`, message: 'Tickets en retard de resolution.', actionUrl: '/it/tickets', icon: 'Clock', severity: 'error' }).catch(() => {}); actions.push(`${breaches} alertes SLA IT`); }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: INCIDENT TIMELINE
// ══════════════════════════════════════════════════════════════════════════════

export const itIncidentTimelineTool = ai.defineTool(
  {
    name: 'it_getIncidentTimeline',
    description: 'Get complete IT incident timeline — events, alerts, interventions, resolution.',
    inputSchema: z.object({ companyId: z.string(), ticketId: z.string() }),
    outputSchema: z.object({
      ticketId: z.string(),
      events: z.array(z.object({ type: z.string(), timestamp: z.string(), actor: z.string(), details: z.string() })),
    }),
  },
  async ({ companyId, ticketId }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/itTickets`).doc(ticketId).get();
    if (!doc.exists) return { ticketId, events: [] };
    const t = doc.data()!;
    const events: { type: string; timestamp: string; actor: string; details: string }[] = [];

    const ts = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? (typeof v === 'string' ? v : '');

    events.push({ type: 'created', timestamp: ts(t['createdAt']), actor: (t['reporter'] as string) ?? 'system', details: `Ticket cree: ${t['subject'] ?? ''}` });
    if (t['assignee']) events.push({ type: 'assigned', timestamp: ts(t['updatedAt']), actor: 'system', details: `Assigne a ${t['assignee']}` });

    const msgs = (t['messages'] as { content: string; role: string; authorName?: string; createdAt?: unknown }[]) ?? [];
    msgs.forEach(m => events.push({ type: `message_${m.role ?? 'agent'}`, timestamp: ts(m.createdAt), actor: m.authorName ?? m.role ?? '', details: (m.content ?? '').slice(0, 200) }));

    if (t['escalatedTo']) events.push({ type: 'escalated', timestamp: ts(t['escalatedAt']), actor: 'system', details: `Escalade: ${t['escalatedTo']} — ${t['escalationReason'] ?? ''}` });
    if (t['slaBreachNotified']) events.push({ type: 'sla_breach', timestamp: '', actor: 'system', details: 'SLA depasse' });
    if (['resolved', 'closed'].includes((t['status'] as string) ?? '')) events.push({ type: 'resolved', timestamp: ts(t['resolvedAt'] ?? t['updatedAt']), actor: (t['assignee'] as string) ?? '', details: 'Ticket resolu' });

    events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    return { ticketId, events };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: PREDICTIVE IT (anticipate failures)
// ══════════════════════════════════════════════════════════════════════════════

export const predictiveITTool = ai.defineTool(
  {
    name: 'it_predictiveAnalysis',
    description: 'Predict IT issues — aging assets needing replacement, services at risk, recurring problems.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      predictions: z.array(z.object({ type: z.string(), severity: z.string(), title: z.string(), description: z.string(), suggestedAction: z.string() })),
      message: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [assetsSnap, ticketsSnap, servicesSnap, licensesSnap] = await Promise.all([
      db.collection(`companies/${companyId}/itAssets`).limit(200).get(),
      db.collection(`companies/${companyId}/itTickets`).limit(300).get(),
      db.collection(`companies/${companyId}/itServices`).limit(50).get(),
      db.collection(`companies/${companyId}/itLicenses`).limit(50).get(),
    ]);

    const predictions: { type: string; severity: string; title: string; description: string; suggestedAction: string }[] = [];
    const now = Date.now();

    // 1. Aging assets + frequent incidents → replacement alert
    const assetTicketCount = new Map<string, number>();
    ticketsSnap.docs.forEach(d => {
      const assetId = (d.data()['assetId'] as string) ?? (d.data()['asset'] as string) ?? '';
      if (assetId) assetTicketCount.set(assetId, (assetTicketCount.get(assetId) ?? 0) + 1);
    });

    assetsSnap.docs.forEach(d => {
      const a = d.data();
      const purchased = (a['purchasedAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (a['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? now;
      const ageMonths = Math.round((now - purchased) / (30 * 86400000));
      const incidents = assetTicketCount.get(d.id) ?? 0;
      const name = (a['name'] as string) ?? (a['type'] as string) ?? d.id;

      if (ageMonths > 36 && incidents >= 2) {
        predictions.push({ type: 'asset_replacement', severity: 'high', title: `Remplacement recommande: ${name}`, description: `${ageMonths} mois d'age, ${incidents} incidents. Risque de panne elevee.`, suggestedAction: 'Planifier remplacement et budget' });
      } else if (ageMonths > 48) {
        predictions.push({ type: 'asset_aging', severity: 'medium', title: `Asset vieillissant: ${name}`, description: `${ageMonths} mois — depasse la duree de vie recommandee.`, suggestedAction: 'Evaluer etat et prevoir remplacement' });
      }
    });

    // 2. Services with low uptime or degraded → scaling/fix recommendation
    servicesSnap.docs.forEach(d => {
      const s = d.data();
      const uptime = (s['uptime'] as number) ?? 99.9;
      const name = (s['name'] as string) ?? '';
      const status = (s['status'] as string) ?? 'operational';

      if (uptime < 99) {
        predictions.push({ type: 'service_risk', severity: 'high', title: `Service instable: ${name}`, description: `Uptime ${uptime}% — sous le seuil de 99%. Degradation probable.`, suggestedAction: 'Investiguer cause, considerer scaling ou migration' });
      } else if (status === 'degraded') {
        predictions.push({ type: 'service_degraded', severity: 'medium', title: `Service degrade: ${name}`, description: `Performance reduite detectee.`, suggestedAction: 'Monitorer et preparer plan de contingence' });
      }
    });

    // 3. Recurring ticket categories → systemic issue
    const catCount = new Map<string, number>();
    ticketsSnap.docs.forEach(d => { const c = (d.data()['category'] as string) ?? ''; if (c) catCount.set(c, (catCount.get(c) ?? 0) + 1); });
    catCount.forEach((count, cat) => {
      if (count >= 10) {
        predictions.push({ type: 'recurring_issue', severity: 'medium', title: `Probleme recurrent: ${cat}`, description: `${count} tickets dans cette categorie. Probleme systemique probable.`, suggestedAction: 'Creer une procedure KB, ou corriger la cause racine' });
      }
    });

    // 4. Licenses expiring soon
    const thirtyDays = 30 * 86400000;
    licensesSnap.docs.forEach(d => {
      const l = d.data();
      const exp = (l['expiresAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      if (exp > now && exp - now < thirtyDays) {
        predictions.push({ type: 'license_expiry', severity: 'medium', title: `Licence expire bientot: ${l['name'] ?? l['software'] ?? ''}`, description: `Expiration dans ${Math.round((exp - now) / 86400000)} jours.`, suggestedAction: 'Renouveler ou trouver alternative' });
      }
    });

    predictions.sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));

    return { predictions, message: `${predictions.length} prediction(s) generee(s).` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CLONE → IT AUTO-TICKET (detect client IT issues from clone)
// ══════════════════════════════════════════════════════════════════════════════

export const cloneToITTool = ai.defineTool(
  {
    name: 'it_createFromClone',
    description: 'Auto-create IT ticket from clone conversation when customer reports a technical issue.',
    inputSchema: z.object({ companyId: z.string(), issue: z.string(), customerEmail: z.string().optional(), customerName: z.string().optional(), channel: z.string().optional() }),
    outputSchema: z.object({ ticketId: z.string(), ticketNumber: z.string(), message: z.string() }),
  },
  async ({ companyId, issue, customerEmail, customerName, channel }) => {
    const db = getFirestore();
    const id = generateId();
    const number = `IT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    await db.collection(`companies/${companyId}/itTickets`).doc(id).set({
      id, ticketNumber: number, subject: `[CLONE] ${issue.slice(0, 80)}`,
      description: `Ticket auto-genere depuis le clone (${channel ?? 'web'}).\n\nClient: ${customerName ?? 'Visiteur'} (${customerEmail ?? ''})\n\nProbleme: ${issue}`,
      category: 'bug', priority: 'medium', status: 'open',
      reporter: customerEmail ?? customerName ?? 'clone', source: 'clone',
      createdAt: new Date(), updatedAt: new Date(),
    });

    // Check monitoring to correlate
    const servicesSnap = await db.collection(`companies/${companyId}/itServices`).where('status', 'in', ['down', 'degraded']).limit(5).get();
    let monitoringCorrelation = '';
    if (servicesSnap.size > 0) {
      monitoringCorrelation = `\n\nCorrelation monitoring: ${servicesSnap.docs.map(d => `${d.data()['name']} (${d.data()['status']})`).join(', ')}`;
      await db.collection(`companies/${companyId}/itTickets`).doc(id).update({ description: `${issue}${monitoringCorrelation}`, monitoringCorrelation: servicesSnap.docs.map(d => (d.data()['name'] as string) ?? '') });
    }

    return { ticketId: id, ticketNumber: number, message: `Ticket IT ${number} cree.${monitoringCorrelation ? ' Services potentiellement impactes detectes.' : ''}` };
  }
);

const ALL_TOOLS = [
  createTicketTool, getTicketsTool, updateTicketTool, escalateTicketTool,
  getAssetsTool, getLicensesTool, getServicesTool,
  searchKBTool, suggestResolutionTool, getStatsTool,
  // PRO
  cmdbOverviewTool, monitoringDashboardTool, techPerformanceTool, licenseOptimizationTool, itAutomationTool,
  itIncidentTimelineTool, predictiveITTool, cloneToITTool,
];

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});
const OUTPUT = z.object({ response: z.string(), ticketId: z.string().optional(), escalate: z.boolean() });

export const itAgentFlow = ai.defineFlow(
  { name: 'itAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    try {
      logger.info(`[ITAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
      const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

      const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
      })();

      const executors = new Map<string, (i: unknown) => Promise<unknown>>();
      for (const tool of ALL_TOOLS) {
        const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
        if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)({ ...(i as Record<string, unknown>), companyId, userId }));
      }

      const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
      if (history && history.length > 0) {
        for (const h of history.slice(-20)) {
          messages.push({ role: h.role, content: [{ text: h.content }] });
        }
      }
      messages.push({ role: 'user', content: [{ text: request }] });

      let response = await ai.generate({
        model: GEMINI_FLASH,
        system: `Tu es l'Agent IT PRO de l'entreprise — helpdesk, infrastructure, gestion d'actifs et licences.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les SLA, échéances de licences, dates de maintenance — utilise cette ancre.

## 🧠 MÉMOIRE CONVERSATIONNELLE — TICKETS RÉFÉRENCÉS
RÈGLE D'OR : conserve TOUJOURS le DERNIER ticket mentionné dans ta mémoire active.
Quand l'utilisateur dit :
• "ce ticket" / "celui-là" / "le #1" → utilise le ticket de TA DERNIÈRE liste/réponse
• "Escalade ce ticket" → appelle it_escalateTicket(ticketId=<dernier ticket>) — n'invente PAS de "difficulté technique"
• "Assigne à [Nom]" → appelle it_updateTicket(ticketId=<dernier>, assignedTo=<nom>)
Format ticket : IT-YYYY-XXXX. Les tools acceptent UUID ou ticketNumber.

## TON RÔLE
Helpdesk technique : résolution rapide, assets, licences, monitoring, KB.

CAPACITÉS :
1. TICKETS : créer, mettre à jour, assigner, escalader (it_createTicket, it_updateTicket, it_escalateTicket, it_getTickets)
2. ASSETS : inventaire matériel (it_getAssets, it_getCMDBOverview)
3. LICENCES : suivi + alertes expiration (it_getLicenses, it_optimizeLicenses)
4. SERVICES : monitoring uptime (it_getServices, it_getMonitoringDashboard)
5. KB : chercher des procédures AVANT de créer un ticket (it_searchKB, it_suggestResolution)
6. STATS : performance équipe IT, MTTR, satisfaction (it_getStats, it_getTechPerformance)
7. AUTOMATIONS : règles auto-routage, auto-resolve (it_runAutomation, it_predictiveAnalysis)

RÈGLES :
- Recherche KB avant de créer un ticket
- Crée un ticket pour CHAQUE problème reporté
- Suis les SLA — alerte sur les dépassements
- Escalade obligatoire : panne réseau, dommage physique, suspicion cyberattaque, blocage fournisseur
- IDs complets (jamais "abc..." tronqué)
- 🚫 ZÉRO FABRICATION : si un tool échoue, dis-le. Ne dis JAMAIS "c'est fait" sans confirmation success=true du tool. Ne dis JAMAIS "erreur technique pour accéder au système" si tu as les tools — APPELLE les tools.
- Sois technique mais clair pour les non-techs
${langInstr}`,
        messages,
        tools: ALL_TOOLS,
        config: { temperature: 0.3 },
      });

      let loopCount = 0;
      while (response.toolRequests.length > 0 && loopCount < 8) {
        loopCount++;
        const toolResults = await Promise.all(
          response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = executors.get(name);
            const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
            return { name, ref, output };
          })
        );
        response = await ai.generate({
          model: GEMINI_FLASH,
          messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
          tools: ALL_TOOLS, config: { temperature: 0.3 },
        });
      }

      const text = response.text;
      const ticketMatch = text.match(/IT-\d{4}-\d{4}/);
      const escalate = /escalat|human|technicien|cyberattack|vendor/i.test(text);
      return { response: text, ticketId: ticketMatch?.[0], escalate };
    } catch (err) {
      logger.error('[ITAgent] Flow error:', err);
      return { response: 'Erreur dans l\'agent IT. Veuillez reessayer.', escalate: false };
    }
  }
);

export const itAgentTool = ai.defineTool(
  {
    name: 'callITAgent',
    description: 'IT PRO: helpdesk SLA, CMDB, service monitoring, tech performance, license optimization, cross-agent (security/HR/accounting), KB, AI resolution.',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  async (input) => {
    try { return await itAgentFlow(input); }
    catch (err) { logger.error('[callITAgent] Error:', err); return { response: 'Erreur agent IT.', escalate: false }; }
  }
);
