/**
 * Support Agent PRO — Gemini Flash
 * Mission : Resolution rapide, satisfaction client, zero ticket oublie.
 *
 * Capabilities:
 *   1. Tickets — create, update, assign, escalate, merge, close
 *   2. SLA — track response time, resolution time, breach detection
 *   3. Knowledge Base — search, suggest AI answer
 *   4. Auto-assign — round-robin or skill-based
 *   5. Canned Responses — templates for fast replies
 *   6. Analytics — volume, CSAT, resolution time, categories
 *   7. Client History — all tickets from same client
 *   8. Notifications — new ticket, escalation, SLA breach
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ── Constants ────────────────────────────────────────────────────────────────

const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_client', 'escalated', 'resolved', 'closed'] as const;
type TicketStatus = typeof TICKET_STATUSES[number];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const CATEGORIES = ['general', 'technique', 'facturation', 'compte', 'produit', 'bug', 'feature_request'] as const;
const CHANNELS = ['chat', 'email', 'phone', 'web', 'whatsapp'] as const;

// SLA targets in minutes
const SLA_TARGETS: Record<string, { firstResponse: number; resolution: number }> = {
  urgent: { firstResponse: 15, resolution: 120 },
  high:   { firstResponse: 60, resolution: 480 },
  normal: { firstResponse: 240, resolution: 1440 },
  low:    { firstResponse: 480, resolution: 2880 },
};

/**
 * Resolve a ticket reference (UUID OR human ticketNumber like SUP-2026-0004) to the Firestore doc ID.
 * Returns null if not found.
 */
async function resolveTicketDocId(companyId: string, ref: string): Promise<string | null> {
  const db = getFirestore();
  const direct = await db.collection(`companies/${companyId}/supportTickets`).doc(ref).get().catch(() => null);
  if (direct?.exists) return direct.id;
  const byNum = await db.collection(`companies/${companyId}/supportTickets`).where('ticketNumber', '==', ref).limit(1).get().catch(() => null);
  if (byNum && !byNum.empty) return byNum.docs[0].id;
  const byId = await db.collection(`companies/${companyId}/supportTickets`).where('id', '==', ref).limit(1).get().catch(() => null);
  if (byId && !byId.empty) return byId.docs[0].id;
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. TICKETS — Create · Update · Assign · Escalate · Close
// ══════════════════════════════════════════════════════════════════════════════

export const createTicketTool = ai.defineTool(
  {
    name: 'sup_createTicket',
    description: 'Create a customer support ticket with SLA tracking.',
    inputSchema: z.object({
      companyId: z.string(),
      customerName: z.string(),
      customerEmail: z.string().optional(),
      customerPhone: z.string().optional(),
      subject: z.string(),
      description: z.string(),
      priority: z.enum(PRIORITIES).optional().default('normal'),
      category: z.enum(CATEGORIES).optional().default('general'),
      channel: z.enum(CHANNELS).optional().default('chat'),
    }),
    outputSchema: z.object({ ticketId: z.string(), ticketNumber: z.string(), message: z.string() }),
  },
  async ({ companyId, customerName, customerEmail, customerPhone, subject, description, priority, category, channel }) => {
    const db = getFirestore();
    const ticketId = generateId();
    const countSnap = await db.collection(`companies/${companyId}/supportTickets`).count().get();
    const count = countSnap.data().count + 1;
    const ticketNumber = `SUP-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const prio = priority ?? 'normal';
    const sla = SLA_TARGETS[prio];
    const now = new Date();

    await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).set({
      id: ticketId, ticketNumber, customerName,
      customerEmail: customerEmail ?? null, customerPhone: customerPhone ?? null,
      subject, description, priority: prio, category: category ?? 'general',
      channel: channel ?? 'chat', status: 'open' as TicketStatus,
      tags: [], messages: [], assignedTo: null,
      // SLA
      slaFirstResponse: sla.firstResponse,
      slaResolution: sla.resolution,
      slaFirstResponseDeadline: new Date(now.getTime() + sla.firstResponse * 60000),
      slaResolutionDeadline: new Date(now.getTime() + sla.resolution * 60000),
      slaFirstResponseMet: null, slaResolutionMet: null,
      firstResponseAt: null, resolvedAt: null,
      // Meta
      satisfaction: null, createdBy: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('[Support] Ticket created', { companyId, ticketId, ticketNumber, priority: prio });
    return { ticketId, ticketNumber, message: `Ticket ${ticketNumber} cree pour ${customerName} (priorite: ${prio}).` };
  }
);

export const getTicketsTool = ai.defineTool(
  {
    name: 'sup_getTickets',
    description: 'List support tickets filtered by status, priority, or assignee.',
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum([...TICKET_STATUSES, 'all']).optional().default('all'),
      priority: z.string().optional(),
      assignedTo: z.string().optional(),
      limit: z.number().optional().default(30),
    }),
    outputSchema: z.object({
      tickets: z.array(z.object({
        id: z.string(), ticketNumber: z.string(), customerName: z.string(),
        subject: z.string(), status: z.string(), priority: z.string(),
        category: z.string(), assignedTo: z.string().optional(), createdAt: z.string(),
        slaBreached: z.boolean(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, status, priority, assignedTo, limit }) => {
    const db = getFirestore();
    let query = db.collection(`companies/${companyId}/supportTickets`) as FirebaseFirestore.Query;
    if (status !== 'all') query = query.where('status', '==', status);
    if (priority) query = query.where('priority', '==', priority);
    if (assignedTo) query = query.where('assignedTo', '==', assignedTo);
    const snap = await query.limit(limit ?? 30).get();
    const now = new Date();

    const tickets = snap.docs.map(d => {
      const data = d.data();
      const resDeadline = data['slaResolutionDeadline']?.toDate?.() ?? null;
      const resolved = data['status'] === 'resolved' || data['status'] === 'closed';
      const slaBreached = !resolved && resDeadline && resDeadline < now;
      return {
        id: d.id, ticketNumber: (data['ticketNumber'] as string) ?? '',
        customerName: (data['customerName'] as string) ?? '', subject: (data['subject'] as string) ?? '',
        status: (data['status'] as string) ?? 'open', priority: (data['priority'] as string) ?? 'normal',
        category: (data['category'] as string) ?? 'general',
        assignedTo: (data['assignedTo'] as string) ?? undefined,
        createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
        slaBreached: !!slaBreached,
      };
    });
    return { tickets, total: tickets.length };
  }
);

export const updateTicketTool = ai.defineTool(
  {
    name: 'sup_updateTicket',
    description: 'Update ticket status, priority, category, or assignment.',
    inputSchema: z.object({
      companyId: z.string(),
      ticketId: z.string(),
      status: z.enum(TICKET_STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      category: z.enum(CATEGORIES).optional(),
      assignedTo: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, ticketId, status, priority, category, assignedTo, tags }) => {
    const db = getFirestore();
    const docId = await resolveTicketDocId(companyId, ticketId);
    if (!docId) return { success: false, message: `Ticket ${ticketId} introuvable.` };
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (status) {
      updates['status'] = status;
      if (status === 'resolved') updates['resolvedAt'] = FieldValue.serverTimestamp();
    }
    if (priority) updates['priority'] = priority;
    if (category) updates['category'] = category;
    if (assignedTo) { updates['assignedTo'] = assignedTo; if (!status) updates['status'] = 'assigned'; }
    if (tags) updates['tags'] = tags;
    await db.collection(`companies/${companyId}/supportTickets`).doc(docId).update(updates);
    return { success: true, message: `Ticket ${ticketId} mis à jour.` };
  }
);

export const escalateTicketTool = ai.defineTool(
  {
    name: 'sup_escalateTicket',
    description: 'Escalate a ticket to human agent, manager, or technical team. Accepts either the UUID or the ticketNumber (SUP-YYYY-XXXX).',
    inputSchema: z.object({
      companyId: z.string(), ticketId: z.string().describe('UUID or ticketNumber like SUP-2026-0004'),
      reason: z.string(),
      escalateTo: z.enum(['human_agent', 'manager', 'technical_team']).default('human_agent'),
    }),
    outputSchema: z.object({ escalated: z.boolean(), message: z.string() }),
  },
  async ({ companyId, ticketId, reason, escalateTo }) => {
    const db = getFirestore();
    const docId = await resolveTicketDocId(companyId, ticketId);
    if (!docId) return { escalated: false, message: `Ticket ${ticketId} introuvable. Vérifie le numéro.` };
    await db.collection(`companies/${companyId}/supportTickets`).doc(docId).update({
      status: 'escalated', escalatedTo: escalateTo, escalationReason: reason,
      escalatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { escalated: true, message: `Ticket ${ticketId} escaladé vers ${escalateTo}. Raison: ${reason}` };
  }
);

export const addMessageTool = ai.defineTool(
  {
    name: 'sup_addMessage',
    description: 'Add a message/reply to a ticket conversation.',
    inputSchema: z.object({
      companyId: z.string(), ticketId: z.string(),
      content: z.string(), role: z.enum(['client', 'agent', 'ai', 'system']).optional().default('agent'),
      authorName: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, ticketId, content, role, authorName }) => {
    const db = getFirestore();
    const ref = db.collection(`companies/${companyId}/supportTickets`).doc(ticketId);
    const msg = { id: generateId(), content, role: role ?? 'agent', authorName: authorName ?? '', createdAt: new Date().toISOString() };
    const updates: Record<string, unknown> = {
      messages: FieldValue.arrayUnion(msg), updatedAt: FieldValue.serverTimestamp(),
    };
    // Track first response for SLA
    if (role === 'agent' || role === 'ai') {
      const doc = await ref.get();
      const data = doc.data();
      if (!data?.['firstResponseAt']) {
        updates['firstResponseAt'] = FieldValue.serverTimestamp();
        const deadline = data?.['slaFirstResponseDeadline']?.toDate?.();
        updates['slaFirstResponseMet'] = deadline ? new Date() <= deadline : null;
      }
      if (data?.['status'] === 'open') updates['status'] = 'in_progress';
    }
    await ref.update(updates);
    return { success: true, message: 'Message ajoute.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. KNOWLEDGE BASE — Search · AI Suggest
// ══════════════════════════════════════════════════════════════════════════════

export const searchKBTool = ai.defineTool(
  {
    name: 'sup_searchKB',
    description: 'Search knowledge base articles for an answer.',
    inputSchema: z.object({ companyId: z.string(), query: z.string() }),
    outputSchema: z.object({
      articles: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), category: z.string() })),
      found: z.boolean(),
    }),
  },
  async ({ companyId, query }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(50).get();
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const articles = snap.docs
      .map(d => {
        const data = d.data();
        const title = (data['title'] as string) ?? '';
        const content = (data['content'] as string) ?? '';
        const combined = `${title} ${content}`.toLowerCase();
        const score = keywords.filter(kw => combined.includes(kw)).length;
        return { id: d.id, title, content, category: (data['category'] as string) ?? 'general', score };
      })
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _, ...rest }) => rest);
    return { articles, found: articles.length > 0 };
  }
);

export const suggestAIResponseTool = ai.defineTool(
  {
    name: 'sup_suggestAIResponse',
    description: 'Generate an AI-suggested response for a ticket based on KB and context.',
    inputSchema: z.object({
      companyId: z.string(), ticketId: z.string(), language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({ suggestion: z.string(), sources: z.array(z.string()), confidence: z.number() }),
  },
  async ({ companyId, ticketId, language }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).get();
    const data = doc.data();
    if (!data) return { suggestion: '', sources: [], confidence: 0 };

    const subject = (data['subject'] as string) ?? '';
    const description = (data['description'] as string) ?? '';
    const query = `${subject} ${description}`;

    // Search KB
    const kbSnap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(30).get();
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const relevant = kbSnap.docs
      .map(d => ({ title: (d.data()['title'] as string) ?? '', content: (d.data()['content'] as string) ?? '' }))
      .filter(a => keywords.some(kw => `${a.title} ${a.content}`.toLowerCase().includes(kw)))
      .slice(0, 3);

    if (relevant.length === 0) {
      return { suggestion: 'Aucun article pertinent trouve dans la base de connaissances. Reponse manuelle recommandee.', sources: [], confidence: 20 };
    }

    const kbContext = relevant.map(a => `## ${a.title}\n${a.content}`).join('\n\n');
    const lang = language?.startsWith('en') ? 'en' : 'fr';

    const result = await ai.generate({
      model: GEMINI_FLASH,
      system: `You are a support agent. Generate a helpful, empathetic response to the customer's issue using the knowledge base articles provided. Be concise. Reply in ${lang === 'fr' ? 'French' : 'English'}.`,
      prompt: `Customer issue: ${subject}\n${description}\n\nKnowledge base:\n${kbContext}`,
      config: { temperature: 0.3 },
    });

    return {
      suggestion: result.text,
      sources: relevant.map(a => a.title),
      confidence: Math.min(90, 40 + relevant.length * 20),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. AUTO-ASSIGN · CANNED RESPONSES · CLIENT HISTORY
// ══════════════════════════════════════════════════════════════════════════════

export const autoAssignTool = ai.defineTool(
  {
    name: 'sup_autoAssign',
    description: 'Auto-assign a ticket to the next available agent (round-robin).',
    inputSchema: z.object({ companyId: z.string(), ticketId: z.string() }),
    outputSchema: z.object({ assignedTo: z.string(), assignedName: z.string(), message: z.string() }),
  },
  async ({ companyId, ticketId }) => {
    const db = getFirestore();
    // Get agents (admin + manager)
    const agentsSnap = await db.collection('users')
      .where('companyId', '==', companyId)
      .where('role', 'in', ['admin', 'manager']).limit(20).get();
    if (agentsSnap.empty) return { assignedTo: '', assignedName: '', message: 'Aucun agent disponible.' };

    // Count open tickets per agent for round-robin
    const agents = agentsSnap.docs.map(d => ({
      uid: d.id, name: (d.data()['displayName'] as string) ?? (d.data()['email'] as string) ?? d.id,
    }));

    // Simple round-robin: pick agent with fewest open tickets
    const counts = await Promise.all(agents.map(async a => {
      const snap = await db.collection(`companies/${companyId}/supportTickets`)
        .where('assignedTo', '==', a.uid)
        .where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
      return { ...a, count: snap.size };
    }));
    counts.sort((a, b) => a.count - b.count);
    const best = counts[0];

    await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).update({
      assignedTo: best.uid, assignedToName: best.name, status: 'assigned', updatedAt: FieldValue.serverTimestamp(),
    });

    return { assignedTo: best.uid, assignedName: best.name, message: `Ticket assigne a ${best.name}.` };
  }
);

export const getCannedResponsesTool = ai.defineTool(
  {
    name: 'sup_getCannedResponses',
    description: 'Get pre-written response templates.',
    inputSchema: z.object({ companyId: z.string(), category: z.string().optional() }),
    outputSchema: z.object({ templates: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), category: z.string() })) }),
  },
  async ({ companyId, category }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/cannedResponses`) as FirebaseFirestore.Query;
    if (category) q = q.where('category', '==', category);
    const snap = await q.limit(50).get();
    const templates = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, title: (data['title'] as string) ?? '', content: (data['content'] as string) ?? '', category: (data['category'] as string) ?? 'general' };
    });
    return { templates };
  }
);

export const getClientHistoryTool = ai.defineTool(
  {
    name: 'sup_getClientHistory',
    description: 'Get all tickets from the same customer (by email or name).',
    inputSchema: z.object({ companyId: z.string(), customerEmail: z.string().optional(), customerName: z.string().optional() }),
    outputSchema: z.object({
      tickets: z.array(z.object({ id: z.string(), ticketNumber: z.string(), subject: z.string(), status: z.string(), createdAt: z.string() })),
      totalTickets: z.number(), avgSatisfaction: z.number(),
    }),
  },
  async ({ companyId, customerEmail, customerName }) => {
    const db = getFirestore();
    let query = db.collection(`companies/${companyId}/supportTickets`) as FirebaseFirestore.Query;
    if (customerEmail) query = query.where('customerEmail', '==', customerEmail);
    else if (customerName) query = query.where('customerName', '==', customerName);
    else return { tickets: [], totalTickets: 0, avgSatisfaction: 0 };
    const snap = await query.limit(50).get();
    const tickets = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ticketNumber: (data['ticketNumber'] as string) ?? '',
        subject: (data['subject'] as string) ?? '', status: (data['status'] as string) ?? '',
        createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
        satisfaction: (data['satisfaction'] as number) ?? null,
      };
    });
    const rated = tickets.filter(t => (t as unknown as { satisfaction: number | null }).satisfaction !== null);
    const avg = rated.length > 0 ? rated.reduce((s, t) => s + ((t as unknown as { satisfaction: number }).satisfaction ?? 0), 0) / rated.length : 0;
    return {
      tickets: tickets.map(({ satisfaction: _, ...rest }) => rest),
      totalTickets: tickets.length, avgSatisfaction: Math.round(avg * 10) / 10,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const getStatsTool = ai.defineTool(
  {
    name: 'sup_getStats',
    description: 'Get comprehensive support statistics and KPIs.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      total: z.number(), open: z.number(), inProgress: z.number(), escalated: z.number(),
      resolved: z.number(), closed: z.number(), waitingClient: z.number(),
      avgSatisfaction: z.number(), avgFirstResponseMin: z.number(), avgResolutionMin: z.number(),
      slaBreachCount: z.number(), highPriority: z.number(),
      byCategory: z.array(z.object({ category: z.string(), count: z.number() })),
      byPriority: z.array(z.object({ priority: z.string(), count: z.number() })),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).limit(500).get();
    const now = new Date();
    const tickets = snap.docs.map(d => d.data());

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalSatisfaction = 0, satisfactionCount = 0;
    let totalFirstResponse = 0, firstResponseCount = 0;
    let totalResolution = 0, resolutionCount = 0;
    let slaBreachCount = 0;

    for (const t of tickets) {
      const status = (t['status'] as string) ?? 'open';
      const cat = (t['category'] as string) ?? 'general';
      const prio = (t['priority'] as string) ?? 'normal';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      byPriority[prio] = (byPriority[prio] ?? 0) + 1;

      if (t['satisfaction'] != null) { totalSatisfaction += t['satisfaction'] as number; satisfactionCount++; }

      const createdAt = t['createdAt']?.toDate?.();
      const firstResp = t['firstResponseAt']?.toDate?.();
      const resolvedAt = t['resolvedAt']?.toDate?.();
      if (createdAt && firstResp) { totalFirstResponse += (firstResp.getTime() - createdAt.getTime()) / 60000; firstResponseCount++; }
      if (createdAt && resolvedAt) { totalResolution += (resolvedAt.getTime() - createdAt.getTime()) / 60000; resolutionCount++; }

      const resDeadline = t['slaResolutionDeadline']?.toDate?.();
      if (resDeadline && status !== 'resolved' && status !== 'closed' && resDeadline < now) slaBreachCount++;
    }

    return {
      total: tickets.length,
      open: byStatus['open'] ?? 0, inProgress: byStatus['in_progress'] ?? 0,
      escalated: byStatus['escalated'] ?? 0, resolved: byStatus['resolved'] ?? 0,
      closed: byStatus['closed'] ?? 0, waitingClient: byStatus['waiting_client'] ?? 0,
      avgSatisfaction: satisfactionCount > 0 ? Math.round((totalSatisfaction / satisfactionCount) * 10) / 10 : 0,
      avgFirstResponseMin: firstResponseCount > 0 ? Math.round(totalFirstResponse / firstResponseCount) : 0,
      avgResolutionMin: resolutionCount > 0 ? Math.round(totalResolution / resolutionCount) : 0,
      slaBreachCount,
      highPriority: (byPriority['high'] ?? 0) + (byPriority['urgent'] ?? 0),
      byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS + FLOW
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PRO: AGENT PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════

export const agentPerformanceTool = ai.defineTool(
  {
    name: 'sup_getAgentPerformance',
    description: 'Get support agent performance — tickets per agent, avg response time, CSAT per agent, leaderboard.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      agents: z.array(z.object({ userId: z.string(), name: z.string(), ticketsClosed: z.number(), ticketsOpen: z.number(), avgResponseMin: z.number(), avgResolutionMin: z.number(), avgCSAT: z.number(), slaBreach: z.number() })),
      topPerformer: z.string(), avgTeamCSAT: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [ticketsSnap, usersSnap] = await Promise.all([
      db.collection(`companies/${companyId}/supportTickets`).limit(500).get(),
      db.collection('users').where('companyId', '==', companyId).limit(50).get(),
    ]);
    const tickets = ticketsSnap.docs.map(d => d.data());
    const agentMap = new Map<string, { name: string; closed: number; open: number; responseTimes: number[]; resolutionTimes: number[]; csats: number[]; breaches: number }>();

    usersSnap.docs.forEach(d => {
      const u = d.data();
      if (['admin', 'manager', 'employee'].includes((u['role'] as string) ?? '')) {
        agentMap.set(d.id, { name: (u['displayName'] as string) ?? (u['email'] as string) ?? '', closed: 0, open: 0, responseTimes: [], resolutionTimes: [], csats: [], breaches: 0 });
      }
    });

    tickets.forEach(t => {
      const assignee = (t['assignedTo'] as string) ?? '';
      if (!agentMap.has(assignee)) return;
      const a = agentMap.get(assignee)!;
      if (['resolved', 'closed'].includes((t['status'] as string) ?? '')) a.closed++;
      else a.open++;
      if (t['firstResponseAt'] && t['createdAt']) {
        const rt = ((t['firstResponseAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0) - ((t['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0);
        if (rt > 0) a.responseTimes.push(rt / 60000);
      }
      if (t['resolvedAt'] && t['createdAt']) {
        const rt = ((t['resolvedAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0) - ((t['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0);
        if (rt > 0) a.resolutionTimes.push(rt / 60000);
      }
      if (t['satisfaction']) a.csats.push(t['satisfaction'] as number);
      if (t['slaFirstResponseMet'] === false || t['slaResolutionMet'] === false) a.breaches++;
    });

    const agents = Array.from(agentMap.entries()).filter(([, a]) => a.closed + a.open > 0).map(([userId, a]) => ({
      userId, name: a.name, ticketsClosed: a.closed, ticketsOpen: a.open,
      avgResponseMin: a.responseTimes.length > 0 ? Math.round(a.responseTimes.reduce((s, v) => s + v, 0) / a.responseTimes.length) : 0,
      avgResolutionMin: a.resolutionTimes.length > 0 ? Math.round(a.resolutionTimes.reduce((s, v) => s + v, 0) / a.resolutionTimes.length) : 0,
      avgCSAT: a.csats.length > 0 ? Math.round(a.csats.reduce((s, v) => s + v, 0) / a.csats.length * 10) / 10 : 0,
      slaBreach: a.breaches,
    })).sort((a, b) => b.ticketsClosed - a.ticketsClosed);

    const allCsats = tickets.filter(t => t['satisfaction']).map(t => t['satisfaction'] as number);
    return { agents, topPerformer: agents[0]?.name ?? '', avgTeamCSAT: allCsats.length > 0 ? Math.round(allCsats.reduce((s, v) => s + v, 0) / allCsats.length * 10) / 10 : 0 };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: SLA DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

export const slaDashboardTool = ai.defineTool(
  {
    name: 'sup_getSLADashboard',
    description: 'SLA dashboard — breaches in real-time, trends, at-risk tickets.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalBreaches: z.number(), atRiskTickets: z.number(), breachRate: z.number(),
      breachesByPriority: z.array(z.object({ priority: z.string(), count: z.number() })),
      atRisk: z.array(z.object({ ticketNumber: z.string(), subject: z.string(), priority: z.string(), minutesLeft: z.number() })),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).where('status', 'in', ['open', 'assigned', 'in_progress', 'waiting_client']).limit(200).get();
    const now = Date.now();
    const breachesByPri: Record<string, number> = {};
    const atRisk: { ticketNumber: string; subject: string; priority: string; minutesLeft: number }[] = [];
    let breaches = 0;

    snap.docs.forEach(d => {
      const t = d.data();
      const resDl = (t['slaResolutionDeadline'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const pri = (t['priority'] as string) ?? 'normal';
      if (resDl && resDl < now) { breaches++; breachesByPri[pri] = (breachesByPri[pri] ?? 0) + 1; }
      else if (resDl) {
        const minutesLeft = Math.round((resDl - now) / 60000);
        if (minutesLeft < 60) {
          atRisk.push({ ticketNumber: (t['ticketNumber'] as string) ?? d.id, subject: (t['subject'] as string) ?? '', priority: pri, minutesLeft });
        }
      }
    });

    atRisk.sort((a, b) => a.minutesLeft - b.minutesLeft);
    return {
      totalBreaches: breaches, atRiskTickets: atRisk.length,
      breachRate: snap.size > 0 ? Math.round(breaches / snap.size * 100) : 0,
      breachesByPriority: Object.entries(breachesByPri).map(([p, c]) => ({ priority: p, count: c })),
      atRisk: atRisk.slice(0, 10),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: NPS SURVEY
// ══════════════════════════════════════════════════════════════════════════════

export const npsSurveyTool = ai.defineTool(
  {
    name: 'sup_sendNPSSurvey',
    description: 'Send NPS survey after ticket resolution, or get NPS analytics.',
    inputSchema: z.object({ companyId: z.string(), action: z.enum(['send', 'analytics']), ticketId: z.string().optional(), score: z.number().optional(), comment: z.string().optional() }),
    outputSchema: z.object({ npsScore: z.number().optional(), promoters: z.number().optional(), passives: z.number().optional(), detractors: z.number().optional(), totalResponses: z.number().optional(), message: z.string() }),
  },
  async ({ companyId, action, ticketId, score, comment }) => {
    const db = getFirestore();
    if (action === 'send' && ticketId && score != null) {
      await db.collection(`companies/${companyId}/npsResponses`).doc(generateId()).set({ ticketId, score, comment: comment ?? '', createdAt: FieldValue.serverTimestamp() });
      return { message: 'Merci pour votre retour !' };
    }
    if (action === 'analytics') {
      const snap = await db.collection(`companies/${companyId}/npsResponses`).limit(500).get();
      const scores = snap.docs.map(d => (d.data()['score'] as number) ?? 0);
      const promoters = scores.filter(s => s >= 9).length;
      const detractors = scores.filter(s => s <= 6).length;
      const passives = scores.length - promoters - detractors;
      const nps = scores.length > 0 ? Math.round((promoters - detractors) / scores.length * 100) : 0;
      return { npsScore: nps, promoters, passives, detractors, totalResponses: scores.length, message: `NPS: ${nps}` };
    }
    return { message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: SENTIMENT DETECTION
// ══════════════════════════════════════════════════════════════════════════════

export const sentimentDetectionTool = ai.defineTool(
  {
    name: 'sup_detectSentiment',
    description: 'Detect customer sentiment/frustration from ticket messages — auto-prioritize if frustrated.',
    inputSchema: z.object({ companyId: z.string(), ticketId: z.string(), message: z.string() }),
    outputSchema: z.object({ sentiment: z.string(), frustrationLevel: z.number(), shouldEscalate: z.boolean(), reason: z.string() }),
  },
  async ({ companyId, ticketId, message }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Analyze this customer support message for sentiment and frustration level.
Message: "${message}"
Return JSON ONLY: {"sentiment":"positive|neutral|frustrated|angry","frustrationLevel":0-100,"shouldEscalate":false,"reason":"why"}`,
      config: { temperature: 0.1 },
    });
    try {
      const result = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      // Auto-escalate if very frustrated
      if (result.frustrationLevel > 70 || result.sentiment === 'angry') {
        const db = getFirestore();
        await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).update({ priority: 'urgent', sentimentAlert: true, sentimentScore: result.frustrationLevel });
        const { createNotification } = await import('../services/notificationService');
        createNotification({ companyId, type: 'system', title: 'Client frustre detecte', message: `Ticket ${ticketId}: frustration ${result.frustrationLevel}%. ${result.reason}`, actionUrl: '/support', icon: 'AlertTriangle', severity: 'warning' }).catch(() => {});
      }
      return result;
    } catch {
      return { sentiment: 'neutral', frustrationLevel: 0, shouldEscalate: false, reason: 'Analyse indisponible' };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: SUPPORT AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════

export const supportAutomationTool = ai.defineTool(
  {
    name: 'sup_runAutomation',
    description: 'Support automation: security ticket → Security agent, bug → IT, billing → Accounting.',
    inputSchema: z.object({ companyId: z.string(), type: z.enum(['route_security', 'route_it', 'route_billing', 'sla_alerts']) }),
    outputSchema: z.object({ actions: z.array(z.string()), message: z.string() }),
  },
  async ({ companyId, type }) => {
    const db = getFirestore();
    const actions: string[] = [];

    if (type === 'route_security') {
      const snap = await db.collection(`companies/${companyId}/supportTickets`).where('category', '==', 'security').where('status', 'in', ['open', 'assigned']).limit(20).get();
      for (const doc of snap.docs) {
        await db.collection(`companies/${companyId}/securityIncidents`).doc(generateId()).set({
          id: generateId(), type: 'other', description: `Depuis ticket support: ${doc.data()['subject'] ?? ''}`, priority: 'P3_medium', status: 'detected', source: 'support_ticket', supportTicketId: doc.id, createdAt: new Date(),
        });
        actions.push(`Incident securite cree depuis ticket ${doc.data()['ticketNumber'] ?? doc.id}`);
      }
    }
    if (type === 'route_it') {
      const snap = await db.collection(`companies/${companyId}/supportTickets`).where('category', 'in', ['technique', 'bug']).where('status', 'in', ['open', 'assigned']).limit(20).get();
      for (const doc of snap.docs) {
        await db.collection(`companies/${companyId}/itTickets`).doc(generateId()).set({
          id: generateId(), title: `[SUPPORT] ${doc.data()['subject'] ?? ''}`, description: doc.data()['description'] ?? '', category: 'bug', priority: 'medium', status: 'open', source: 'support_ticket', supportTicketId: doc.id, createdAt: new Date(),
        });
        actions.push(`Ticket IT cree depuis ${doc.data()['ticketNumber'] ?? doc.id}`);
      }
    }
    if (type === 'route_billing') {
      const snap = await db.collection(`companies/${companyId}/supportTickets`).where('category', '==', 'facturation').where('status', 'in', ['open', 'assigned']).limit(20).get();
      if (snap.size > 0) {
        const { createNotification } = await import('../services/notificationService');
        createNotification({ companyId, type: 'system', title: `${snap.size} tickets facturation en attente`, message: 'Tickets support lies a la facturation necessitent l\'attention de la comptabilite.', actionUrl: '/finance', icon: 'DollarSign', severity: 'warning' }).catch(() => {});
        actions.push(`Notification comptabilite: ${snap.size} tickets facturation`);
      }
    }
    if (type === 'sla_alerts') {
      const snap = await db.collection(`companies/${companyId}/supportTickets`).where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
      const now = Date.now();
      let alertCount = 0;
      for (const doc of snap.docs) {
        const t = doc.data();
        const dl = (t['slaResolutionDeadline'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        if (dl && dl < now && !t['slaBreachNotified']) {
          await doc.ref.update({ slaBreachNotified: true });
          alertCount++;
        }
      }
      if (alertCount > 0) {
        const { createNotification } = await import('../services/notificationService');
        createNotification({ companyId, type: 'system', title: `${alertCount} SLA breach(es)`, message: `${alertCount} tickets ont depasse leur deadline SLA.`, actionUrl: '/support', icon: 'Clock', severity: 'error' }).catch(() => {});
        actions.push(`${alertCount} alertes SLA envoyees`);
      }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action necessaire.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: SMART PRIORITY (SLA + sentiment + client value)
// ══════════════════════════════════════════════════════════════════════════════

export const smartPriorityTool = ai.defineTool(
  {
    name: 'sup_smartPriority',
    description: 'Auto-prioritize a ticket using SLA urgency + customer sentiment + client value.',
    inputSchema: z.object({ companyId: z.string(), ticketId: z.string() }),
    outputSchema: z.object({ ticketId: z.string(), newPriority: z.string(), score: z.number(), factors: z.array(z.object({ factor: z.string(), value: z.number(), weight: z.number() })), message: z.string() }),
  },
  async ({ companyId, ticketId }) => {
    const db = getFirestore();
    const docId = await resolveTicketDocId(companyId, ticketId);
    if (!docId) return { ticketId, newPriority: 'normal', score: 50, factors: [], message: `Ticket ${ticketId} introuvable` };
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(docId).get();
    const t = doc.data()!;
    const now = Date.now();

    // Factor 1: SLA urgency (how close to deadline)
    const resDl = (t['slaResolutionDeadline'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
    const slaMinLeft = resDl ? Math.max(0, (resDl - now) / 60000) : 999;
    const slaScore = slaMinLeft < 30 ? 100 : slaMinLeft < 60 ? 80 : slaMinLeft < 240 ? 50 : 20;

    // Factor 2: Sentiment
    const sentimentScore = (t['sentimentScore'] as number) ?? 0;

    // Factor 3: Client value (repeat customer = higher value)
    const email = (t['customerEmail'] as string) ?? '';
    let clientValue = 30;
    if (email) {
      const histSnap = await db.collection(`companies/${companyId}/supportTickets`).where('customerEmail', '==', email).limit(20).get();
      clientValue = Math.min(100, histSnap.size * 15);
    }

    // Weighted score
    const totalScore = Math.round(slaScore * 0.4 + sentimentScore * 0.35 + clientValue * 0.25);
    const newPriority = totalScore >= 80 ? 'urgent' : totalScore >= 60 ? 'high' : totalScore >= 40 ? 'normal' : 'low';

    await doc.ref.update({ priority: newPriority, smartPriorityScore: totalScore, smartPriorityAt: new Date() });

    return {
      ticketId, newPriority, score: totalScore,
      factors: [
        { factor: 'SLA urgence', value: slaScore, weight: 40 },
        { factor: 'Sentiment client', value: sentimentScore, weight: 35 },
        { factor: 'Valeur client', value: clientValue, weight: 25 },
      ],
      message: `Priorite mise a jour: ${newPriority} (score ${totalScore})`,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: TICKET TIMELINE (full audit trail)
// ══════════════════════════════════════════════════════════════════════════════

export const ticketTimelineTool = ai.defineTool(
  {
    name: 'sup_getTicketTimeline',
    description: 'Get complete ticket timeline — messages, sentiment changes, automations, agent changes.',
    inputSchema: z.object({ companyId: z.string(), ticketId: z.string() }),
    outputSchema: z.object({
      ticketId: z.string(), ticketNumber: z.string(),
      events: z.array(z.object({ type: z.string(), timestamp: z.string(), actor: z.string(), details: z.string() })),
      cloneContactId: z.string().optional(),
    }),
  },
  async ({ companyId, ticketId }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).get();
    if (!doc.exists) return { ticketId, ticketNumber: '', events: [] };
    const t = doc.data()!;
    const events: { type: string; timestamp: string; actor: string; details: string }[] = [];

    // Creation
    const created = (t['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '';
    events.push({ type: 'created', timestamp: created, actor: (t['createdBy'] as string) ?? 'system', details: `Ticket cree: ${t['subject'] ?? ''}` });

    // Messages
    const messages = (t['messages'] as { content: string; role: string; authorName?: string; createdAt?: string | { toDate?: () => Date } }[]) ?? [];
    messages.forEach(m => {
      const ts = typeof m.createdAt === 'string' ? m.createdAt : (m.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '';
      events.push({ type: `message_${m.role}`, timestamp: ts, actor: m.authorName ?? m.role, details: (m.content ?? '').slice(0, 200) });
    });

    // Assignment
    if (t['assignedTo']) events.push({ type: 'assigned', timestamp: (t['updatedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '', actor: 'system', details: `Assigne a ${t['assignedToName'] ?? t['assignedTo']}` });

    // Escalation
    if (t['escalatedTo']) events.push({ type: 'escalated', timestamp: (t['escalatedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '', actor: 'system', details: `Escalade vers ${t['escalatedTo']}: ${t['escalationReason'] ?? ''}` });

    // Sentiment alert
    if (t['sentimentAlert']) events.push({ type: 'sentiment_alert', timestamp: '', actor: 'ai', details: `Frustration detectee: ${t['sentimentScore'] ?? ''}%` });

    // Smart priority
    if (t['smartPriorityScore']) events.push({ type: 'smart_priority', timestamp: (t['smartPriorityAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '', actor: 'ai', details: `Priorite auto: ${t['priority']} (score ${t['smartPriorityScore']})` });

    // Resolution
    if (t['resolvedAt']) events.push({ type: 'resolved', timestamp: (t['resolvedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '', actor: 'system', details: 'Ticket resolu' });

    // CSAT
    if (t['satisfaction']) events.push({ type: 'csat', timestamp: '', actor: 'client', details: `Satisfaction: ${t['satisfaction']}/5` });

    // Sort chronologically
    events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

    // Link to clone contact if exists
    const cloneContactId = (t['contactId'] as string) ?? (t['cloneContactId'] as string) ?? undefined;

    return { ticketId, ticketNumber: (t['ticketNumber'] as string) ?? '', events, cloneContactId };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: PREDICTIVE SUPPORT (anticipate before ticket)
// ══════════════════════════════════════════════════════════════════════════════

export const predictiveSupportTool = ai.defineTool(
  {
    name: 'sup_predictiveSupport',
    description: 'Predict at-risk customers — frequent tickets, negative sentiment, unresolved issues — and suggest proactive outreach.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      atRiskCustomers: z.array(z.object({ email: z.string(), name: z.string(), ticketCount: z.number(), avgSatisfaction: z.number(), lastIssue: z.string(), riskScore: z.number(), suggestedAction: z.string() })),
      message: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).limit(500).get();
    const tickets = snap.docs.map(d => d.data());

    // Group by customer
    const customers = new Map<string, { name: string; tickets: number; csats: number[]; lastSubject: string; sentimentAlerts: number; unresolvedCount: number }>();
    tickets.forEach(t => {
      const email = (t['customerEmail'] as string) ?? '';
      if (!email) return;
      if (!customers.has(email)) customers.set(email, { name: (t['customerName'] as string) ?? email, tickets: 0, csats: [], lastSubject: '', sentimentAlerts: 0, unresolvedCount: 0 });
      const c = customers.get(email)!;
      c.tickets++;
      if (t['satisfaction']) c.csats.push(t['satisfaction'] as number);
      c.lastSubject = (t['subject'] as string) ?? c.lastSubject;
      if (t['sentimentAlert']) c.sentimentAlerts++;
      if (!['resolved', 'closed'].includes((t['status'] as string) ?? '')) c.unresolvedCount++;
    });

    const atRisk = Array.from(customers.entries()).map(([email, c]) => {
      const avgCsat = c.csats.length > 0 ? c.csats.reduce((s, v) => s + v, 0) / c.csats.length : 3;
      const riskScore = Math.min(100, Math.round(
        (c.tickets > 5 ? 30 : c.tickets > 3 ? 15 : 0) +
        (avgCsat < 3 ? 30 : avgCsat < 4 ? 10 : 0) +
        (c.sentimentAlerts > 0 ? 25 : 0) +
        (c.unresolvedCount > 0 ? 15 : 0)
      ));
      const action = riskScore >= 60 ? 'Appeler le client proactivement' : riskScore >= 40 ? 'Envoyer un email de suivi' : 'Monitorer';
      return { email, name: c.name, ticketCount: c.tickets, avgSatisfaction: Math.round(avgCsat * 10) / 10, lastIssue: c.lastSubject, riskScore, suggestedAction: action };
    }).filter(c => c.riskScore >= 30).sort((a, b) => b.riskScore - a.riskScore).slice(0, 15);

    return { atRiskCustomers: atRisk, message: `${atRisk.length} client(s) a risque detecte(s).` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: AUTO-RESOLUTION (solve known issues without ticket)
// ══════════════════════════════════════════════════════════════════════════════

export const autoResolveTool = ai.defineTool(
  {
    name: 'sup_autoResolve',
    description: 'Try to auto-resolve a customer issue using KB + past solutions. Returns solution or suggests ticket creation.',
    inputSchema: z.object({ companyId: z.string(), issue: z.string(), customerEmail: z.string().optional() }),
    outputSchema: z.object({ resolved: z.boolean(), solution: z.string(), confidence: z.number(), source: z.string(), suggestTicket: z.boolean() }),
  },
  async ({ companyId, issue, customerEmail }) => {
    const db = getFirestore();

    // 1. Search KB for matching articles
    const kbSnap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(50).get();
    const kbArticles = kbSnap.docs.map(d => ({ title: (d.data()['title'] as string) ?? '', content: (d.data()['content'] as string) ?? '' }));

    // 2. Search past resolved tickets for similar issues
    const ticketSnap = await db.collection(`companies/${companyId}/supportTickets`).where('status', 'in', ['resolved', 'closed']).limit(100).get();
    const pastSolutions = ticketSnap.docs.map(d => {
      const t = d.data();
      const msgs = (t['messages'] as { role: string; content: string }[]) ?? [];
      const agentReply = msgs.find(m => m.role === 'agent' || m.role === 'ai');
      return { subject: (t['subject'] as string) ?? '', solution: agentReply?.content ?? '' };
    }).filter(s => s.solution);

    // 3. Use AI to match and generate solution
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `A customer has this issue: "${issue}"

Knowledge base articles (${kbArticles.length}):
${kbArticles.slice(0, 10).map(a => `- ${a.title}: ${a.content.slice(0, 150)}`).join('\n')}

Past resolved tickets (${pastSolutions.length}):
${pastSolutions.slice(0, 10).map(s => `- ${s.subject}: ${s.solution.slice(0, 150)}`).join('\n')}

Can you resolve this issue? Return JSON ONLY:
{"resolved":true/false,"solution":"step-by-step solution in French","confidence":0-100,"source":"kb|past_ticket|ai_generated","suggestTicket":false}
If you cannot resolve with high confidence, set resolved=false and suggestTicket=true.`,
      config: { temperature: 0.2 },
    });

    try {
      const result = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));

      // Log auto-resolution attempt
      await db.collection(`companies/${companyId}/autoResolutions`).doc(generateId()).set({
        issue, customerEmail: customerEmail ?? '', resolved: result.resolved,
        confidence: result.confidence, source: result.source,
        timestamp: FieldValue.serverTimestamp(),
      });

      return result;
    } catch {
      return { resolved: false, solution: '', confidence: 0, source: 'error', suggestTicket: true };
    }
  }
);

// Cross-domain — find team member to assign a ticket to (reuses HR directory)
export const findTeamMemberTool = ai.defineTool(
  {
    name: 'sup_findTeamMember',
    description: "Cherche un membre de l'équipe par nom (prénom, nom de famille, ou complet) dans toutes les sources (employees, users, members). Insensible à la casse. À utiliser AVANT sup_updateTicket pour assigner un ticket à quelqu'un.",
    inputSchema: z.object({ companyId: z.string(), name: z.string() }),
    outputSchema: z.object({
      found: z.boolean(),
      matches: z.array(z.object({
        id: z.string(), displayName: z.string(),
        email: z.string().optional(), role: z.string().optional(),
      })),
      message: z.string(),
    }),
  },
  async ({ companyId, name }) => {
    const db = getFirestore();
    const q = name.toLowerCase().trim();
    const [empSnap, userSnap, memSnap] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).limit(200).get().catch(() => null),
      db.collection('users').where('companyId', '==', companyId).limit(200).get().catch(() => null),
      db.collection(`companies/${companyId}/members`).limit(200).get().catch(() => null),
    ]);
    const seen = new Set<string>();
    const matches: Array<{ id: string; displayName: string; email?: string; role?: string }> = [];
    const push = (id: string, d: Record<string, unknown>) => {
      const dn = ((d['displayName'] ?? d['name'] ?? d['email']) as string | undefined) ?? '';
      if (!dn) return;
      const email = (d['email'] as string | undefined) ?? '';
      const key = email || `id:${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const hay = `${dn} ${email}`.toLowerCase();
      if (!q || hay.includes(q)) {
        matches.push({ id, displayName: dn, email, role: d['role'] as string | undefined });
      }
    };
    empSnap?.docs.forEach(d => push(d.id, d.data()));
    userSnap?.docs.forEach(d => push(d.id, d.data()));
    memSnap?.docs.forEach(d => push(d.id, d.data()));
    return {
      found: matches.length > 0,
      matches: matches.slice(0, 10),
      message: matches.length === 0
        ? `Aucun membre trouvé pour "${name}".`
        : `${matches.length} membre(s) : ${matches.slice(0, 3).map(m => m.displayName).join(', ')}`,
    };
  }
);

const ALL_TOOLS = [
  createTicketTool, getTicketsTool, updateTicketTool, escalateTicketTool, addMessageTool,
  searchKBTool, suggestAIResponseTool,
  autoAssignTool, findTeamMemberTool, getCannedResponsesTool, getClientHistoryTool,
  getStatsTool,
  // PRO
  agentPerformanceTool, slaDashboardTool, npsSurveyTool, sentimentDetectionTool, supportAutomationTool,
  smartPriorityTool, ticketTimelineTool, predictiveSupportTool, autoResolveTool,
];

const INPUT = z.object({
  request:   z.string(),
  companyId: z.string(),
  userId:    z.string().optional(),
  language:  z.string().optional().default('auto'),
  history:   z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  response:   z.string(),
  ticketId:   z.string().optional(),
  escalated:  z.boolean(),
  resolved:   z.boolean(),
});

export const supportAgentFlow = ai.defineFlow(
  { name: 'supportAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    try {
      logger.info(`[SupportAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
      const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

      // Date anchor — for SLA, ticket aging, deadlines
      const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
      })();

      const executors = new Map<string, (i: unknown) => Promise<unknown>>();
      for (const tool of ALL_TOOLS) {
        const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
        if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)({ ...(i as Record<string, unknown>), companyId }));
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
        system: `Tu es l'Agent Support Client PRO de l'entreprise — assistant tickets / SLA / résolution.
CompanyID: ${companyId}.

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les SLA et tickets en retard, calcule à partir de cette heure exacte.

## 🧠 MÉMOIRE CONVERSATIONNELLE — TICKETS RÉFÉRENCÉS
Tu as l'historique des messages. RÈGLE D'OR : conserve TOUJOURS le DERNIER ticket mentionné dans ta mémoire active.

Quand l'utilisateur dit :
• "ce ticket" / "celui-là" / "le #1" → utilise le ticket de TA DERNIÈRE liste/réponse
• "Escalade ce ticket" → appelle sup_escalateTicket(ticketId=<dernier ticket>) — n'invente PAS de "difficulté technique"
• "Assigne ce ticket à [Nom]" → 1) cherche [Nom] dans l'équipe via sup_findTeamMember, 2) appelle sup_updateTicket(ticketId=<dernier ticket>, assignedTo=<nom_complet>)
• "Smart priority pour SUP-XXXX" littéralement = utilise le DERNIER ticket réel, pas "SUP-XXXX" comme valeur littérale

Ne JAMAIS recommencer un "Bonjour, je suis l'agent support..." si le contexte est clair.
Ne JAMAIS dire "difficulté technique pour accéder au système" si tu as les tools — APPELLE les tools.

## TON RÔLE
Tu résous les problèmes clients rapidement et professionnellement.

CAPACITÉS :
1. TICKETS : créer, mettre à jour, assigner, escalader, fermer (sup_createTicket, sup_updateTicket, sup_listTickets, sup_assignTicket, sup_escalateTicket)
2. SLA : suivre les délais, alerter sur les dépassements (sup_getSLADashboard, sup_smartPriority)
3. TIMELINE : voir l'historique d'un ticket et les actions passées (sup_getTicketTimeline)
4. KB : chercher dans la base de connaissances AVANT de créer un ticket (sup_searchKB)
5. AI SUGGESTIONS : générer des réponses adaptées (sup_suggestAIResponse)
6. AUTO-ASSIGN : router le ticket vers le bon agent (sup_autoAssign, sup_runAutomation)
7. ANALYTICS : stats support, NPS, sentiment (sup_getStats, sup_sendNPSSurvey)
8. RÉSOLUTION AUTO : tenter une résolution automatique avant escalade (sup_autoResolve)

RÈGLES :
- TOUJOURS chercher dans la KB avant de créer un ticket
- Empathique, solution-orientée, professionnel
- Si tu ne peux pas résoudre, escalade avec une raison claire
- Surveille les SLA — flag les dépassements proactivement
- Format ticket : SUP-2026-XXXX
- IDs complets dans les réponses (pas de "abc..." tronqué)
- Pour les actions concrètes, utilise les vrais tools — ne fabrique pas de résultats
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
            const inp = { ...(input as Record<string, unknown>), companyId };
            const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
            return { name, ref, output };
          })
        );
        response = await ai.generate({
          model: GEMINI_FLASH,
          messages: [
            ...response.messages,
            { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
          ],
          tools: ALL_TOOLS,
          config: { temperature: 0.3 },
        });
      }

      const text = response.text;
      const ticketMatch = text.match(/SUP-\d{4}-\d{4}/);
      const escalated = /escalat/i.test(text);
      const resolved = /resolv|resolu|fixed|solved|ferme|clos/i.test(text);

      return { response: text, ticketId: ticketMatch?.[0], escalated, resolved };
    } catch (err) {
      logger.error('[SupportAgent] Flow error:', err);
      return { response: 'Erreur dans l\'agent support. Veuillez reessayer.', escalated: false, resolved: false };
    }
  }
);

export const supportAgentTool = ai.defineTool(
  {
    name: 'callSupportAgent',
    description: 'Support PRO: tickets SLA, AI suggestions, auto-assign, escalation, agent performance, SLA dashboard, NPS surveys, sentiment detection, cross-agent routing (security/IT/billing).',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  async (input) => {
    try { return await supportAgentFlow(input); }
    catch (err) { logger.error('[callSupportAgent] Error:', err); return { response: 'Erreur agent support.', escalated: false, resolved: false }; }
  }
);
