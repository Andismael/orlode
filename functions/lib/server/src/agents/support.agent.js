"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportAgentTool = exports.supportAgentFlow = exports.findTeamMemberTool = exports.autoResolveTool = exports.predictiveSupportTool = exports.ticketTimelineTool = exports.smartPriorityTool = exports.supportAutomationTool = exports.sentimentDetectionTool = exports.npsSurveyTool = exports.slaDashboardTool = exports.agentPerformanceTool = exports.getStatsTool = exports.getClientHistoryTool = exports.getCannedResponsesTool = exports.autoAssignTool = exports.suggestAIResponseTool = exports.searchKBTool = exports.addMessageTool = exports.escalateTicketTool = exports.updateTicketTool = exports.getTicketsTool = exports.createTicketTool = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// ── Constants ────────────────────────────────────────────────────────────────
const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_client', 'escalated', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const CATEGORIES = ['general', 'technique', 'facturation', 'compte', 'produit', 'bug', 'feature_request'];
const CHANNELS = ['chat', 'email', 'phone', 'web', 'whatsapp'];
// SLA targets in minutes
const SLA_TARGETS = {
    urgent: { firstResponse: 15, resolution: 120 },
    high: { firstResponse: 60, resolution: 480 },
    normal: { firstResponse: 240, resolution: 1440 },
    low: { firstResponse: 480, resolution: 2880 },
};
/**
 * Resolve a ticket reference (UUID OR human ticketNumber like SUP-2026-0004) to the Firestore doc ID.
 * Returns null if not found.
 */
async function resolveTicketDocId(companyId, ref) {
    const db = (0, firebase_config_1.getFirestore)();
    const direct = await db.collection(`companies/${companyId}/supportTickets`).doc(ref).get().catch(() => null);
    if (direct?.exists)
        return direct.id;
    const byNum = await db.collection(`companies/${companyId}/supportTickets`).where('ticketNumber', '==', ref).limit(1).get().catch(() => null);
    if (byNum && !byNum.empty)
        return byNum.docs[0].id;
    const byId = await db.collection(`companies/${companyId}/supportTickets`).where('id', '==', ref).limit(1).get().catch(() => null);
    if (byId && !byId.empty)
        return byId.docs[0].id;
    return null;
}
// ══════════════════════════════════════════════════════════════════════════════
// 1. TICKETS — Create · Update · Assign · Escalate · Close
// ══════════════════════════════════════════════════════════════════════════════
exports.createTicketTool = genkit_config_1.ai.defineTool({
    name: 'sup_createTicket',
    description: 'Create a customer support ticket with SLA tracking.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        customerName: zod_1.z.string(),
        customerEmail: zod_1.z.string().optional(),
        customerPhone: zod_1.z.string().optional(),
        subject: zod_1.z.string(),
        description: zod_1.z.string(),
        priority: zod_1.z.enum(PRIORITIES).optional().default('normal'),
        category: zod_1.z.enum(CATEGORIES).optional().default('general'),
        channel: zod_1.z.enum(CHANNELS).optional().default('chat'),
    }),
    outputSchema: zod_1.z.object({ ticketId: zod_1.z.string(), ticketNumber: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, customerName, customerEmail, customerPhone, subject, description, priority, category, channel }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const ticketId = (0, helpers_1.generateId)();
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
        channel: channel ?? 'chat', status: 'open',
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
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info('[Support] Ticket created', { companyId, ticketId, ticketNumber, priority: prio });
    return { ticketId, ticketNumber, message: `Ticket ${ticketNumber} cree pour ${customerName} (priorite: ${prio}).` };
});
exports.getTicketsTool = genkit_config_1.ai.defineTool({
    name: 'sup_getTickets',
    description: 'List support tickets filtered by status, priority, or assignee.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        status: zod_1.z.enum([...TICKET_STATUSES, 'all']).optional().default('all'),
        priority: zod_1.z.string().optional(),
        assignedTo: zod_1.z.string().optional(),
        limit: zod_1.z.number().optional().default(30),
    }),
    outputSchema: zod_1.z.object({
        tickets: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), ticketNumber: zod_1.z.string(), customerName: zod_1.z.string(),
            subject: zod_1.z.string(), status: zod_1.z.string(), priority: zod_1.z.string(),
            category: zod_1.z.string(), assignedTo: zod_1.z.string().optional(), createdAt: zod_1.z.string(),
            slaBreached: zod_1.z.boolean(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, status, priority, assignedTo, limit }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection(`companies/${companyId}/supportTickets`);
    if (status !== 'all')
        query = query.where('status', '==', status);
    if (priority)
        query = query.where('priority', '==', priority);
    if (assignedTo)
        query = query.where('assignedTo', '==', assignedTo);
    const snap = await query.limit(limit ?? 30).get();
    const now = new Date();
    const tickets = snap.docs.map(d => {
        const data = d.data();
        const resDeadline = data['slaResolutionDeadline']?.toDate?.() ?? null;
        const resolved = data['status'] === 'resolved' || data['status'] === 'closed';
        const slaBreached = !resolved && resDeadline && resDeadline < now;
        return {
            id: d.id, ticketNumber: data['ticketNumber'] ?? '',
            customerName: data['customerName'] ?? '', subject: data['subject'] ?? '',
            status: data['status'] ?? 'open', priority: data['priority'] ?? 'normal',
            category: data['category'] ?? 'general',
            assignedTo: data['assignedTo'] ?? undefined,
            createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
            slaBreached: !!slaBreached,
        };
    });
    return { tickets, total: tickets.length };
});
exports.updateTicketTool = genkit_config_1.ai.defineTool({
    name: 'sup_updateTicket',
    description: 'Update ticket status, priority, category, or assignment.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        ticketId: zod_1.z.string(),
        status: zod_1.z.enum(TICKET_STATUSES).optional(),
        priority: zod_1.z.enum(PRIORITIES).optional(),
        category: zod_1.z.enum(CATEGORIES).optional(),
        assignedTo: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, ticketId, status, priority, category, assignedTo, tags }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveTicketDocId(companyId, ticketId);
    if (!docId)
        return { success: false, message: `Ticket ${ticketId} introuvable.` };
    const updates = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (status) {
        updates['status'] = status;
        if (status === 'resolved')
            updates['resolvedAt'] = firestore_1.FieldValue.serverTimestamp();
    }
    if (priority)
        updates['priority'] = priority;
    if (category)
        updates['category'] = category;
    if (assignedTo) {
        updates['assignedTo'] = assignedTo;
        if (!status)
            updates['status'] = 'assigned';
    }
    if (tags)
        updates['tags'] = tags;
    await db.collection(`companies/${companyId}/supportTickets`).doc(docId).update(updates);
    return { success: true, message: `Ticket ${ticketId} mis à jour.` };
});
exports.escalateTicketTool = genkit_config_1.ai.defineTool({
    name: 'sup_escalateTicket',
    description: 'Escalate a ticket to human agent, manager, or technical team. Accepts either the UUID or the ticketNumber (SUP-YYYY-XXXX).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), ticketId: zod_1.z.string().describe('UUID or ticketNumber like SUP-2026-0004'),
        reason: zod_1.z.string(),
        escalateTo: zod_1.z.enum(['human_agent', 'manager', 'technical_team']).default('human_agent'),
    }),
    outputSchema: zod_1.z.object({ escalated: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, ticketId, reason, escalateTo }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveTicketDocId(companyId, ticketId);
    if (!docId)
        return { escalated: false, message: `Ticket ${ticketId} introuvable. Vérifie le numéro.` };
    await db.collection(`companies/${companyId}/supportTickets`).doc(docId).update({
        status: 'escalated', escalatedTo: escalateTo, escalationReason: reason,
        escalatedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { escalated: true, message: `Ticket ${ticketId} escaladé vers ${escalateTo}. Raison: ${reason}` };
});
exports.addMessageTool = genkit_config_1.ai.defineTool({
    name: 'sup_addMessage',
    description: 'Add a message/reply to a ticket conversation.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), ticketId: zod_1.z.string(),
        content: zod_1.z.string(), role: zod_1.z.enum(['client', 'agent', 'ai', 'system']).optional().default('agent'),
        authorName: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, ticketId, content, role, authorName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/supportTickets`).doc(ticketId);
    const msg = { id: (0, helpers_1.generateId)(), content, role: role ?? 'agent', authorName: authorName ?? '', createdAt: new Date().toISOString() };
    const updates = {
        messages: firestore_1.FieldValue.arrayUnion(msg), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    // Track first response for SLA
    if (role === 'agent' || role === 'ai') {
        const doc = await ref.get();
        const data = doc.data();
        if (!data?.['firstResponseAt']) {
            updates['firstResponseAt'] = firestore_1.FieldValue.serverTimestamp();
            const deadline = data?.['slaFirstResponseDeadline']?.toDate?.();
            updates['slaFirstResponseMet'] = deadline ? new Date() <= deadline : null;
        }
        if (data?.['status'] === 'open')
            updates['status'] = 'in_progress';
    }
    await ref.update(updates);
    return { success: true, message: 'Message ajoute.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. KNOWLEDGE BASE — Search · AI Suggest
// ══════════════════════════════════════════════════════════════════════════════
exports.searchKBTool = genkit_config_1.ai.defineTool({
    name: 'sup_searchKB',
    description: 'Search knowledge base articles for an answer.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), query: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        articles: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), content: zod_1.z.string(), category: zod_1.z.string() })),
        found: zod_1.z.boolean(),
    }),
}, async ({ companyId, query }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(50).get();
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const articles = snap.docs
        .map(d => {
        const data = d.data();
        const title = data['title'] ?? '';
        const content = data['content'] ?? '';
        const combined = `${title} ${content}`.toLowerCase();
        const score = keywords.filter(kw => combined.includes(kw)).length;
        return { id: d.id, title, content, category: data['category'] ?? 'general', score };
    })
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ score: _, ...rest }) => rest);
    return { articles, found: articles.length > 0 };
});
exports.suggestAIResponseTool = genkit_config_1.ai.defineTool({
    name: 'sup_suggestAIResponse',
    description: 'Generate an AI-suggested response for a ticket based on KB and context.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), ticketId: zod_1.z.string(), language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({ suggestion: zod_1.z.string(), sources: zod_1.z.array(zod_1.z.string()), confidence: zod_1.z.number() }),
}, async ({ companyId, ticketId, language }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).get();
    const data = doc.data();
    if (!data)
        return { suggestion: '', sources: [], confidence: 0 };
    const subject = data['subject'] ?? '';
    const description = data['description'] ?? '';
    const query = `${subject} ${description}`;
    // Search KB
    const kbSnap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(30).get();
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const relevant = kbSnap.docs
        .map(d => ({ title: d.data()['title'] ?? '', content: d.data()['content'] ?? '' }))
        .filter(a => keywords.some(kw => `${a.title} ${a.content}`.toLowerCase().includes(kw)))
        .slice(0, 3);
    if (relevant.length === 0) {
        return { suggestion: 'Aucun article pertinent trouve dans la base de connaissances. Reponse manuelle recommandee.', sources: [], confidence: 20 };
    }
    const kbContext = relevant.map(a => `## ${a.title}\n${a.content}`).join('\n\n');
    const lang = language?.startsWith('en') ? 'en' : 'fr';
    const result = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `You are a support agent. Generate a helpful, empathetic response to the customer's issue using the knowledge base articles provided. Be concise. Reply in ${lang === 'fr' ? 'French' : 'English'}.`,
        prompt: `Customer issue: ${subject}\n${description}\n\nKnowledge base:\n${kbContext}`,
        config: { temperature: 0.3 },
    });
    return {
        suggestion: result.text,
        sources: relevant.map(a => a.title),
        confidence: Math.min(90, 40 + relevant.length * 20),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. AUTO-ASSIGN · CANNED RESPONSES · CLIENT HISTORY
// ══════════════════════════════════════════════════════════════════════════════
exports.autoAssignTool = genkit_config_1.ai.defineTool({
    name: 'sup_autoAssign',
    description: 'Auto-assign a ticket to the next available agent (round-robin).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), ticketId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ assignedTo: zod_1.z.string(), assignedName: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, ticketId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Get agents (admin + manager)
    const agentsSnap = await db.collection('users')
        .where('companyId', '==', companyId)
        .where('role', 'in', ['admin', 'manager']).limit(20).get();
    if (agentsSnap.empty)
        return { assignedTo: '', assignedName: '', message: 'Aucun agent disponible.' };
    // Count open tickets per agent for round-robin
    const agents = agentsSnap.docs.map(d => ({
        uid: d.id, name: d.data()['displayName'] ?? d.data()['email'] ?? d.id,
    }));
    // Simple round-robin: pick agent with fewest open tickets
    const counts = await Promise.all(agents.map(async (a) => {
        const snap = await db.collection(`companies/${companyId}/supportTickets`)
            .where('assignedTo', '==', a.uid)
            .where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
        return { ...a, count: snap.size };
    }));
    counts.sort((a, b) => a.count - b.count);
    const best = counts[0];
    await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).update({
        assignedTo: best.uid, assignedToName: best.name, status: 'assigned', updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { assignedTo: best.uid, assignedName: best.name, message: `Ticket assigne a ${best.name}.` };
});
exports.getCannedResponsesTool = genkit_config_1.ai.defineTool({
    name: 'sup_getCannedResponses',
    description: 'Get pre-written response templates.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), category: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ templates: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), content: zod_1.z.string(), category: zod_1.z.string() })) }),
}, async ({ companyId, category }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/cannedResponses`);
    if (category)
        q = q.where('category', '==', category);
    const snap = await q.limit(50).get();
    const templates = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data['title'] ?? '', content: data['content'] ?? '', category: data['category'] ?? 'general' };
    });
    return { templates };
});
exports.getClientHistoryTool = genkit_config_1.ai.defineTool({
    name: 'sup_getClientHistory',
    description: 'Get all tickets from the same customer (by email or name).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), customerEmail: zod_1.z.string().optional(), customerName: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        tickets: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), ticketNumber: zod_1.z.string(), subject: zod_1.z.string(), status: zod_1.z.string(), createdAt: zod_1.z.string() })),
        totalTickets: zod_1.z.number(), avgSatisfaction: zod_1.z.number(),
    }),
}, async ({ companyId, customerEmail, customerName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection(`companies/${companyId}/supportTickets`);
    if (customerEmail)
        query = query.where('customerEmail', '==', customerEmail);
    else if (customerName)
        query = query.where('customerName', '==', customerName);
    else
        return { tickets: [], totalTickets: 0, avgSatisfaction: 0 };
    const snap = await query.limit(50).get();
    const tickets = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, ticketNumber: data['ticketNumber'] ?? '',
            subject: data['subject'] ?? '', status: data['status'] ?? '',
            createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
            satisfaction: data['satisfaction'] ?? null,
        };
    });
    const rated = tickets.filter(t => t.satisfaction !== null);
    const avg = rated.length > 0 ? rated.reduce((s, t) => s + (t.satisfaction ?? 0), 0) / rated.length : 0;
    return {
        tickets: tickets.map(({ satisfaction: _, ...rest }) => rest),
        totalTickets: tickets.length, avgSatisfaction: Math.round(avg * 10) / 10,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.getStatsTool = genkit_config_1.ai.defineTool({
    name: 'sup_getStats',
    description: 'Get comprehensive support statistics and KPIs.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        total: zod_1.z.number(), open: zod_1.z.number(), inProgress: zod_1.z.number(), escalated: zod_1.z.number(),
        resolved: zod_1.z.number(), closed: zod_1.z.number(), waitingClient: zod_1.z.number(),
        avgSatisfaction: zod_1.z.number(), avgFirstResponseMin: zod_1.z.number(), avgResolutionMin: zod_1.z.number(),
        slaBreachCount: zod_1.z.number(), highPriority: zod_1.z.number(),
        byCategory: zod_1.z.array(zod_1.z.object({ category: zod_1.z.string(), count: zod_1.z.number() })),
        byPriority: zod_1.z.array(zod_1.z.object({ priority: zod_1.z.string(), count: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).limit(500).get();
    const now = new Date();
    const tickets = snap.docs.map(d => d.data());
    const byStatus = {};
    const byCategory = {};
    const byPriority = {};
    let totalSatisfaction = 0, satisfactionCount = 0;
    let totalFirstResponse = 0, firstResponseCount = 0;
    let totalResolution = 0, resolutionCount = 0;
    let slaBreachCount = 0;
    for (const t of tickets) {
        const status = t['status'] ?? 'open';
        const cat = t['category'] ?? 'general';
        const prio = t['priority'] ?? 'normal';
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
        byPriority[prio] = (byPriority[prio] ?? 0) + 1;
        if (t['satisfaction'] != null) {
            totalSatisfaction += t['satisfaction'];
            satisfactionCount++;
        }
        const createdAt = t['createdAt']?.toDate?.();
        const firstResp = t['firstResponseAt']?.toDate?.();
        const resolvedAt = t['resolvedAt']?.toDate?.();
        if (createdAt && firstResp) {
            totalFirstResponse += (firstResp.getTime() - createdAt.getTime()) / 60000;
            firstResponseCount++;
        }
        if (createdAt && resolvedAt) {
            totalResolution += (resolvedAt.getTime() - createdAt.getTime()) / 60000;
            resolutionCount++;
        }
        const resDeadline = t['slaResolutionDeadline']?.toDate?.();
        if (resDeadline && status !== 'resolved' && status !== 'closed' && resDeadline < now)
            slaBreachCount++;
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
});
// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS + FLOW
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: AGENT PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════
exports.agentPerformanceTool = genkit_config_1.ai.defineTool({
    name: 'sup_getAgentPerformance',
    description: 'Get support agent performance — tickets per agent, avg response time, CSAT per agent, leaderboard.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        agents: zod_1.z.array(zod_1.z.object({ userId: zod_1.z.string(), name: zod_1.z.string(), ticketsClosed: zod_1.z.number(), ticketsOpen: zod_1.z.number(), avgResponseMin: zod_1.z.number(), avgResolutionMin: zod_1.z.number(), avgCSAT: zod_1.z.number(), slaBreach: zod_1.z.number() })),
        topPerformer: zod_1.z.string(), avgTeamCSAT: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [ticketsSnap, usersSnap] = await Promise.all([
        db.collection(`companies/${companyId}/supportTickets`).limit(500).get(),
        db.collection('users').where('companyId', '==', companyId).limit(50).get(),
    ]);
    const tickets = ticketsSnap.docs.map(d => d.data());
    const agentMap = new Map();
    usersSnap.docs.forEach(d => {
        const u = d.data();
        if (['admin', 'manager', 'employee'].includes(u['role'] ?? '')) {
            agentMap.set(d.id, { name: u['displayName'] ?? u['email'] ?? '', closed: 0, open: 0, responseTimes: [], resolutionTimes: [], csats: [], breaches: 0 });
        }
    });
    tickets.forEach(t => {
        const assignee = t['assignedTo'] ?? '';
        if (!agentMap.has(assignee))
            return;
        const a = agentMap.get(assignee);
        if (['resolved', 'closed'].includes(t['status'] ?? ''))
            a.closed++;
        else
            a.open++;
        if (t['firstResponseAt'] && t['createdAt']) {
            const rt = (t['firstResponseAt']?.toDate?.()?.getTime() ?? 0) - (t['createdAt']?.toDate?.()?.getTime() ?? 0);
            if (rt > 0)
                a.responseTimes.push(rt / 60000);
        }
        if (t['resolvedAt'] && t['createdAt']) {
            const rt = (t['resolvedAt']?.toDate?.()?.getTime() ?? 0) - (t['createdAt']?.toDate?.()?.getTime() ?? 0);
            if (rt > 0)
                a.resolutionTimes.push(rt / 60000);
        }
        if (t['satisfaction'])
            a.csats.push(t['satisfaction']);
        if (t['slaFirstResponseMet'] === false || t['slaResolutionMet'] === false)
            a.breaches++;
    });
    const agents = Array.from(agentMap.entries()).filter(([, a]) => a.closed + a.open > 0).map(([userId, a]) => ({
        userId, name: a.name, ticketsClosed: a.closed, ticketsOpen: a.open,
        avgResponseMin: a.responseTimes.length > 0 ? Math.round(a.responseTimes.reduce((s, v) => s + v, 0) / a.responseTimes.length) : 0,
        avgResolutionMin: a.resolutionTimes.length > 0 ? Math.round(a.resolutionTimes.reduce((s, v) => s + v, 0) / a.resolutionTimes.length) : 0,
        avgCSAT: a.csats.length > 0 ? Math.round(a.csats.reduce((s, v) => s + v, 0) / a.csats.length * 10) / 10 : 0,
        slaBreach: a.breaches,
    })).sort((a, b) => b.ticketsClosed - a.ticketsClosed);
    const allCsats = tickets.filter(t => t['satisfaction']).map(t => t['satisfaction']);
    return { agents, topPerformer: agents[0]?.name ?? '', avgTeamCSAT: allCsats.length > 0 ? Math.round(allCsats.reduce((s, v) => s + v, 0) / allCsats.length * 10) / 10 : 0 };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SLA DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
exports.slaDashboardTool = genkit_config_1.ai.defineTool({
    name: 'sup_getSLADashboard',
    description: 'SLA dashboard — breaches in real-time, trends, at-risk tickets.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalBreaches: zod_1.z.number(), atRiskTickets: zod_1.z.number(), breachRate: zod_1.z.number(),
        breachesByPriority: zod_1.z.array(zod_1.z.object({ priority: zod_1.z.string(), count: zod_1.z.number() })),
        atRisk: zod_1.z.array(zod_1.z.object({ ticketNumber: zod_1.z.string(), subject: zod_1.z.string(), priority: zod_1.z.string(), minutesLeft: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).where('status', 'in', ['open', 'assigned', 'in_progress', 'waiting_client']).limit(200).get();
    const now = Date.now();
    const breachesByPri = {};
    const atRisk = [];
    let breaches = 0;
    snap.docs.forEach(d => {
        const t = d.data();
        const resDl = t['slaResolutionDeadline']?.toDate?.()?.getTime() ?? 0;
        const pri = t['priority'] ?? 'normal';
        if (resDl && resDl < now) {
            breaches++;
            breachesByPri[pri] = (breachesByPri[pri] ?? 0) + 1;
        }
        else if (resDl) {
            const minutesLeft = Math.round((resDl - now) / 60000);
            if (minutesLeft < 60) {
                atRisk.push({ ticketNumber: t['ticketNumber'] ?? d.id, subject: t['subject'] ?? '', priority: pri, minutesLeft });
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
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: NPS SURVEY
// ══════════════════════════════════════════════════════════════════════════════
exports.npsSurveyTool = genkit_config_1.ai.defineTool({
    name: 'sup_sendNPSSurvey',
    description: 'Send NPS survey after ticket resolution, or get NPS analytics.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), action: zod_1.z.enum(['send', 'analytics']), ticketId: zod_1.z.string().optional(), score: zod_1.z.number().optional(), comment: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ npsScore: zod_1.z.number().optional(), promoters: zod_1.z.number().optional(), passives: zod_1.z.number().optional(), detractors: zod_1.z.number().optional(), totalResponses: zod_1.z.number().optional(), message: zod_1.z.string() }),
}, async ({ companyId, action, ticketId, score, comment }) => {
    const db = (0, firebase_config_1.getFirestore)();
    if (action === 'send' && ticketId && score != null) {
        await db.collection(`companies/${companyId}/npsResponses`).doc((0, helpers_1.generateId)()).set({ ticketId, score, comment: comment ?? '', createdAt: firestore_1.FieldValue.serverTimestamp() });
        return { message: 'Merci pour votre retour !' };
    }
    if (action === 'analytics') {
        const snap = await db.collection(`companies/${companyId}/npsResponses`).limit(500).get();
        const scores = snap.docs.map(d => d.data()['score'] ?? 0);
        const promoters = scores.filter(s => s >= 9).length;
        const detractors = scores.filter(s => s <= 6).length;
        const passives = scores.length - promoters - detractors;
        const nps = scores.length > 0 ? Math.round((promoters - detractors) / scores.length * 100) : 0;
        return { npsScore: nps, promoters, passives, detractors, totalResponses: scores.length, message: `NPS: ${nps}` };
    }
    return { message: 'Action non reconnue.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SENTIMENT DETECTION
// ══════════════════════════════════════════════════════════════════════════════
exports.sentimentDetectionTool = genkit_config_1.ai.defineTool({
    name: 'sup_detectSentiment',
    description: 'Detect customer sentiment/frustration from ticket messages — auto-prioritize if frustrated.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), ticketId: zod_1.z.string(), message: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ sentiment: zod_1.z.string(), frustrationLevel: zod_1.z.number(), shouldEscalate: zod_1.z.boolean(), reason: zod_1.z.string() }),
}, async ({ companyId, ticketId, message }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze this customer support message for sentiment and frustration level.
Message: "${message}"
Return JSON ONLY: {"sentiment":"positive|neutral|frustrated|angry","frustrationLevel":0-100,"shouldEscalate":false,"reason":"why"}`,
        config: { temperature: 0.1 },
    });
    try {
        const result = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        // Auto-escalate if very frustrated
        if (result.frustrationLevel > 70 || result.sentiment === 'angry') {
            const db = (0, firebase_config_1.getFirestore)();
            await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).update({ priority: 'urgent', sentimentAlert: true, sentimentScore: result.frustrationLevel });
            const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
            createNotification({ companyId, type: 'system', title: 'Client frustre detecte', message: `Ticket ${ticketId}: frustration ${result.frustrationLevel}%. ${result.reason}`, actionUrl: '/support', icon: 'AlertTriangle', severity: 'warning' }).catch(() => { });
        }
        return result;
    }
    catch {
        return { sentiment: 'neutral', frustrationLevel: 0, shouldEscalate: false, reason: 'Analyse indisponible' };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SUPPORT AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════
exports.supportAutomationTool = genkit_config_1.ai.defineTool({
    name: 'sup_runAutomation',
    description: 'Support automation: security ticket → Security agent, bug → IT, billing → Accounting.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), type: zod_1.z.enum(['route_security', 'route_it', 'route_billing', 'sla_alerts']) }),
    outputSchema: zod_1.z.object({ actions: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, type }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const actions = [];
    if (type === 'route_security') {
        const snap = await db.collection(`companies/${companyId}/supportTickets`).where('category', '==', 'security').where('status', 'in', ['open', 'assigned']).limit(20).get();
        for (const doc of snap.docs) {
            await db.collection(`companies/${companyId}/securityIncidents`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), type: 'other', description: `Depuis ticket support: ${doc.data()['subject'] ?? ''}`, priority: 'P3_medium', status: 'detected', source: 'support_ticket', supportTicketId: doc.id, createdAt: new Date(),
            });
            actions.push(`Incident securite cree depuis ticket ${doc.data()['ticketNumber'] ?? doc.id}`);
        }
    }
    if (type === 'route_it') {
        const snap = await db.collection(`companies/${companyId}/supportTickets`).where('category', 'in', ['technique', 'bug']).where('status', 'in', ['open', 'assigned']).limit(20).get();
        for (const doc of snap.docs) {
            await db.collection(`companies/${companyId}/itTickets`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), title: `[SUPPORT] ${doc.data()['subject'] ?? ''}`, description: doc.data()['description'] ?? '', category: 'bug', priority: 'medium', status: 'open', source: 'support_ticket', supportTicketId: doc.id, createdAt: new Date(),
            });
            actions.push(`Ticket IT cree depuis ${doc.data()['ticketNumber'] ?? doc.id}`);
        }
    }
    if (type === 'route_billing') {
        const snap = await db.collection(`companies/${companyId}/supportTickets`).where('category', '==', 'facturation').where('status', 'in', ['open', 'assigned']).limit(20).get();
        if (snap.size > 0) {
            const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
            createNotification({ companyId, type: 'system', title: `${snap.size} tickets facturation en attente`, message: 'Tickets support lies a la facturation necessitent l\'attention de la comptabilite.', actionUrl: '/finance', icon: 'DollarSign', severity: 'warning' }).catch(() => { });
            actions.push(`Notification comptabilite: ${snap.size} tickets facturation`);
        }
    }
    if (type === 'sla_alerts') {
        const snap = await db.collection(`companies/${companyId}/supportTickets`).where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
        const now = Date.now();
        let alertCount = 0;
        for (const doc of snap.docs) {
            const t = doc.data();
            const dl = t['slaResolutionDeadline']?.toDate?.()?.getTime() ?? 0;
            if (dl && dl < now && !t['slaBreachNotified']) {
                await doc.ref.update({ slaBreachNotified: true });
                alertCount++;
            }
        }
        if (alertCount > 0) {
            const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
            createNotification({ companyId, type: 'system', title: `${alertCount} SLA breach(es)`, message: `${alertCount} tickets ont depasse leur deadline SLA.`, actionUrl: '/support', icon: 'Clock', severity: 'error' }).catch(() => { });
            actions.push(`${alertCount} alertes SLA envoyees`);
        }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action necessaire.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SMART PRIORITY (SLA + sentiment + client value)
// ══════════════════════════════════════════════════════════════════════════════
exports.smartPriorityTool = genkit_config_1.ai.defineTool({
    name: 'sup_smartPriority',
    description: 'Auto-prioritize a ticket using SLA urgency + customer sentiment + client value.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), ticketId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ ticketId: zod_1.z.string(), newPriority: zod_1.z.string(), score: zod_1.z.number(), factors: zod_1.z.array(zod_1.z.object({ factor: zod_1.z.string(), value: zod_1.z.number(), weight: zod_1.z.number() })), message: zod_1.z.string() }),
}, async ({ companyId, ticketId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveTicketDocId(companyId, ticketId);
    if (!docId)
        return { ticketId, newPriority: 'normal', score: 50, factors: [], message: `Ticket ${ticketId} introuvable` };
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(docId).get();
    const t = doc.data();
    const now = Date.now();
    // Factor 1: SLA urgency (how close to deadline)
    const resDl = t['slaResolutionDeadline']?.toDate?.()?.getTime() ?? 0;
    const slaMinLeft = resDl ? Math.max(0, (resDl - now) / 60000) : 999;
    const slaScore = slaMinLeft < 30 ? 100 : slaMinLeft < 60 ? 80 : slaMinLeft < 240 ? 50 : 20;
    // Factor 2: Sentiment
    const sentimentScore = t['sentimentScore'] ?? 0;
    // Factor 3: Client value (repeat customer = higher value)
    const email = t['customerEmail'] ?? '';
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
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: TICKET TIMELINE (full audit trail)
// ══════════════════════════════════════════════════════════════════════════════
exports.ticketTimelineTool = genkit_config_1.ai.defineTool({
    name: 'sup_getTicketTimeline',
    description: 'Get complete ticket timeline — messages, sentiment changes, automations, agent changes.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), ticketId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        ticketId: zod_1.z.string(), ticketNumber: zod_1.z.string(),
        events: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), timestamp: zod_1.z.string(), actor: zod_1.z.string(), details: zod_1.z.string() })),
        cloneContactId: zod_1.z.string().optional(),
    }),
}, async ({ companyId, ticketId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(ticketId).get();
    if (!doc.exists)
        return { ticketId, ticketNumber: '', events: [] };
    const t = doc.data();
    const events = [];
    // Creation
    const created = t['createdAt']?.toDate?.()?.toISOString() ?? '';
    events.push({ type: 'created', timestamp: created, actor: t['createdBy'] ?? 'system', details: `Ticket cree: ${t['subject'] ?? ''}` });
    // Messages
    const messages = t['messages'] ?? [];
    messages.forEach(m => {
        const ts = typeof m.createdAt === 'string' ? m.createdAt : m.createdAt?.toDate?.()?.toISOString() ?? '';
        events.push({ type: `message_${m.role}`, timestamp: ts, actor: m.authorName ?? m.role, details: (m.content ?? '').slice(0, 200) });
    });
    // Assignment
    if (t['assignedTo'])
        events.push({ type: 'assigned', timestamp: t['updatedAt']?.toDate?.()?.toISOString() ?? '', actor: 'system', details: `Assigne a ${t['assignedToName'] ?? t['assignedTo']}` });
    // Escalation
    if (t['escalatedTo'])
        events.push({ type: 'escalated', timestamp: t['escalatedAt']?.toDate?.()?.toISOString() ?? '', actor: 'system', details: `Escalade vers ${t['escalatedTo']}: ${t['escalationReason'] ?? ''}` });
    // Sentiment alert
    if (t['sentimentAlert'])
        events.push({ type: 'sentiment_alert', timestamp: '', actor: 'ai', details: `Frustration detectee: ${t['sentimentScore'] ?? ''}%` });
    // Smart priority
    if (t['smartPriorityScore'])
        events.push({ type: 'smart_priority', timestamp: t['smartPriorityAt']?.toDate?.()?.toISOString() ?? '', actor: 'ai', details: `Priorite auto: ${t['priority']} (score ${t['smartPriorityScore']})` });
    // Resolution
    if (t['resolvedAt'])
        events.push({ type: 'resolved', timestamp: t['resolvedAt']?.toDate?.()?.toISOString() ?? '', actor: 'system', details: 'Ticket resolu' });
    // CSAT
    if (t['satisfaction'])
        events.push({ type: 'csat', timestamp: '', actor: 'client', details: `Satisfaction: ${t['satisfaction']}/5` });
    // Sort chronologically
    events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    // Link to clone contact if exists
    const cloneContactId = t['contactId'] ?? t['cloneContactId'] ?? undefined;
    return { ticketId, ticketNumber: t['ticketNumber'] ?? '', events, cloneContactId };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: PREDICTIVE SUPPORT (anticipate before ticket)
// ══════════════════════════════════════════════════════════════════════════════
exports.predictiveSupportTool = genkit_config_1.ai.defineTool({
    name: 'sup_predictiveSupport',
    description: 'Predict at-risk customers — frequent tickets, negative sentiment, unresolved issues — and suggest proactive outreach.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        atRiskCustomers: zod_1.z.array(zod_1.z.object({ email: zod_1.z.string(), name: zod_1.z.string(), ticketCount: zod_1.z.number(), avgSatisfaction: zod_1.z.number(), lastIssue: zod_1.z.string(), riskScore: zod_1.z.number(), suggestedAction: zod_1.z.string() })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/supportTickets`).limit(500).get();
    const tickets = snap.docs.map(d => d.data());
    // Group by customer
    const customers = new Map();
    tickets.forEach(t => {
        const email = t['customerEmail'] ?? '';
        if (!email)
            return;
        if (!customers.has(email))
            customers.set(email, { name: t['customerName'] ?? email, tickets: 0, csats: [], lastSubject: '', sentimentAlerts: 0, unresolvedCount: 0 });
        const c = customers.get(email);
        c.tickets++;
        if (t['satisfaction'])
            c.csats.push(t['satisfaction']);
        c.lastSubject = t['subject'] ?? c.lastSubject;
        if (t['sentimentAlert'])
            c.sentimentAlerts++;
        if (!['resolved', 'closed'].includes(t['status'] ?? ''))
            c.unresolvedCount++;
    });
    const atRisk = Array.from(customers.entries()).map(([email, c]) => {
        const avgCsat = c.csats.length > 0 ? c.csats.reduce((s, v) => s + v, 0) / c.csats.length : 3;
        const riskScore = Math.min(100, Math.round((c.tickets > 5 ? 30 : c.tickets > 3 ? 15 : 0) +
            (avgCsat < 3 ? 30 : avgCsat < 4 ? 10 : 0) +
            (c.sentimentAlerts > 0 ? 25 : 0) +
            (c.unresolvedCount > 0 ? 15 : 0)));
        const action = riskScore >= 60 ? 'Appeler le client proactivement' : riskScore >= 40 ? 'Envoyer un email de suivi' : 'Monitorer';
        return { email, name: c.name, ticketCount: c.tickets, avgSatisfaction: Math.round(avgCsat * 10) / 10, lastIssue: c.lastSubject, riskScore, suggestedAction: action };
    }).filter(c => c.riskScore >= 30).sort((a, b) => b.riskScore - a.riskScore).slice(0, 15);
    return { atRiskCustomers: atRisk, message: `${atRisk.length} client(s) a risque detecte(s).` };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: AUTO-RESOLUTION (solve known issues without ticket)
// ══════════════════════════════════════════════════════════════════════════════
exports.autoResolveTool = genkit_config_1.ai.defineTool({
    name: 'sup_autoResolve',
    description: 'Try to auto-resolve a customer issue using KB + past solutions. Returns solution or suggests ticket creation.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), issue: zod_1.z.string(), customerEmail: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ resolved: zod_1.z.boolean(), solution: zod_1.z.string(), confidence: zod_1.z.number(), source: zod_1.z.string(), suggestTicket: zod_1.z.boolean() }),
}, async ({ companyId, issue, customerEmail }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // 1. Search KB for matching articles
    const kbSnap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(50).get();
    const kbArticles = kbSnap.docs.map(d => ({ title: d.data()['title'] ?? '', content: d.data()['content'] ?? '' }));
    // 2. Search past resolved tickets for similar issues
    const ticketSnap = await db.collection(`companies/${companyId}/supportTickets`).where('status', 'in', ['resolved', 'closed']).limit(100).get();
    const pastSolutions = ticketSnap.docs.map(d => {
        const t = d.data();
        const msgs = t['messages'] ?? [];
        const agentReply = msgs.find(m => m.role === 'agent' || m.role === 'ai');
        return { subject: t['subject'] ?? '', solution: agentReply?.content ?? '' };
    }).filter(s => s.solution);
    // 3. Use AI to match and generate solution
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
        await db.collection(`companies/${companyId}/autoResolutions`).doc((0, helpers_1.generateId)()).set({
            issue, customerEmail: customerEmail ?? '', resolved: result.resolved,
            confidence: result.confidence, source: result.source,
            timestamp: firestore_1.FieldValue.serverTimestamp(),
        });
        return result;
    }
    catch {
        return { resolved: false, solution: '', confidence: 0, source: 'error', suggestTicket: true };
    }
});
// Cross-domain — find team member to assign a ticket to (reuses HR directory)
exports.findTeamMemberTool = genkit_config_1.ai.defineTool({
    name: 'sup_findTeamMember',
    description: "Cherche un membre de l'équipe par nom (prénom, nom de famille, ou complet) dans toutes les sources (employees, users, members). Insensible à la casse. À utiliser AVANT sup_updateTicket pour assigner un ticket à quelqu'un.",
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), name: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        matches: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), displayName: zod_1.z.string(),
            email: zod_1.z.string().optional(), role: zod_1.z.string().optional(),
        })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, name }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const q = name.toLowerCase().trim();
    const [empSnap, userSnap, memSnap] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).limit(200).get().catch(() => null),
        db.collection('users').where('companyId', '==', companyId).limit(200).get().catch(() => null),
        db.collection(`companies/${companyId}/members`).limit(200).get().catch(() => null),
    ]);
    const seen = new Set();
    const matches = [];
    const push = (id, d) => {
        const dn = (d['displayName'] ?? d['name'] ?? d['email']) ?? '';
        if (!dn)
            return;
        const email = d['email'] ?? '';
        const key = email || `id:${id}`;
        if (seen.has(key))
            return;
        seen.add(key);
        const hay = `${dn} ${email}`.toLowerCase();
        if (!q || hay.includes(q)) {
            matches.push({ id, displayName: dn, email, role: d['role'] });
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
});
const ALL_TOOLS = [
    exports.createTicketTool, exports.getTicketsTool, exports.updateTicketTool, exports.escalateTicketTool, exports.addMessageTool,
    exports.searchKBTool, exports.suggestAIResponseTool,
    exports.autoAssignTool, exports.findTeamMemberTool, exports.getCannedResponsesTool, exports.getClientHistoryTool,
    exports.getStatsTool,
    // PRO
    exports.agentPerformanceTool, exports.slaDashboardTool, exports.npsSurveyTool, exports.sentimentDetectionTool, exports.supportAutomationTool,
    exports.smartPriorityTool, exports.ticketTimelineTool, exports.predictiveSupportTool, exports.autoResolveTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    ticketId: zod_1.z.string().optional(),
    escalated: zod_1.z.boolean(),
    resolved: zod_1.z.boolean(),
});
exports.supportAgentFlow = genkit_config_1.ai.defineFlow({ name: 'supportAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, language, history }) => {
    try {
        logger_1.logger.info(`[SupportAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
        const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
        // Date anchor — for SLA, ticket aging, deadlines
        const dateAnchors = (() => {
            const now = new Date();
            const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
        })();
        const executors = new Map();
        for (const tool of ALL_TOOLS) {
            const name = tool.__action?.name ?? '';
            if (name)
                executors.set(name, (i) => tool({ ...i, companyId }));
        }
        const messages = [];
        if (history && history.length > 0) {
            for (const h of history.slice(-20)) {
                messages.push({ role: h.role, content: [{ text: h.content }] });
            }
        }
        messages.push({ role: 'user', content: [{ text: request }] });
        let response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
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
            const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
                const { name, input, ref } = p.toolRequest;
                const exec = executors.get(name);
                const inp = { ...input, companyId };
                const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
                return { name, ref, output };
            }));
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [
                    ...response.messages,
                    { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
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
    }
    catch (err) {
        logger_1.logger.error('[SupportAgent] Flow error:', err);
        return { response: 'Erreur dans l\'agent support. Veuillez reessayer.', escalated: false, resolved: false };
    }
});
exports.supportAgentTool = genkit_config_1.ai.defineTool({
    name: 'callSupportAgent',
    description: 'Support PRO: tickets SLA, AI suggestions, auto-assign, escalation, agent performance, SLA dashboard, NPS surveys, sentiment detection, cross-agent routing (security/IT/billing).',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async (input) => {
    try {
        return await (0, exports.supportAgentFlow)(input);
    }
    catch (err) {
        logger_1.logger.error('[callSupportAgent] Error:', err);
        return { response: 'Erreur agent support.', escalated: false, resolved: false };
    }
});
//# sourceMappingURL=support.agent.js.map