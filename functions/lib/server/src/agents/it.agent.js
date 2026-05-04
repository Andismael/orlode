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
exports.itAgentTool = exports.itAgentFlow = exports.cloneToITTool = exports.predictiveITTool = exports.itIncidentTimelineTool = exports.itAutomationTool = exports.licenseOptimizationTool = exports.techPerformanceTool = exports.monitoringDashboardTool = exports.cmdbOverviewTool = exports.getStatsTool = exports.suggestResolutionTool = exports.searchKBTool = exports.getServicesTool = exports.getLicensesTool = exports.getAssetsTool = exports.escalateTicketTool = exports.updateTicketTool = exports.getTicketsTool = exports.createTicketTool = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['hardware', 'software', 'access', 'network', 'email', 'security', 'other'];
const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_user', 'escalated', 'resolved', 'closed'];
const SLA_TARGETS = {
    critical: { firstResponse: 15, resolution: 60 },
    high: { firstResponse: 30, resolution: 240 },
    medium: { firstResponse: 120, resolution: 480 },
    low: { firstResponse: 480, resolution: 1440 },
};
// ══════════════════════════════════════════════════════════════════════════════
// 1. TICKETS
// ══════════════════════════════════════════════════════════════════════════════
exports.createTicketTool = genkit_config_1.ai.defineTool({
    name: 'it_createTicket',
    description: 'Create an IT support ticket with SLA tracking.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), description: zod_1.z.string(),
        priority: zod_1.z.enum(PRIORITIES).optional().default('medium'),
        category: zod_1.z.enum(CATEGORIES).optional().default('other'),
        reportedBy: zod_1.z.string().optional(), reportedByEmail: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ ticketId: zod_1.z.string(), ticketNumber: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, title, description, priority, category, reportedBy, reportedByEmail }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
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
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info('[IT] Ticket created', { companyId, ticketId: id, ticketNumber, priority: prio });
    return { ticketId: id, ticketNumber, message: `Ticket ${ticketNumber} cree (priorite: ${prio}).` };
});
exports.getTicketsTool = genkit_config_1.ai.defineTool({
    name: 'it_getTickets',
    description: 'List IT tickets filtered by status, priority, category, or assignee.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), status: zod_1.z.string().optional(), priority: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(), assignedTo: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        tickets: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), ticketNumber: zod_1.z.string(), title: zod_1.z.string(), status: zod_1.z.string(),
            priority: zod_1.z.string(), category: zod_1.z.string(), assignedTo: zod_1.z.string().optional(),
            slaBreached: zod_1.z.boolean(), createdAt: zod_1.z.string(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, status, priority, category, assignedTo }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/itTickets`);
    if (status && status !== 'all')
        q = q.where('status', '==', status);
    if (priority)
        q = q.where('priority', '==', priority);
    if (category)
        q = q.where('category', '==', category);
    if (assignedTo)
        q = q.where('assignedTo', '==', assignedTo);
    const snap = await q.limit(100).get();
    const now = new Date();
    const tickets = snap.docs.map(d => {
        const data = d.data();
        const resDeadline = data['slaResolutionDeadline']?.toDate?.() ?? null;
        const resolved = data['status'] === 'resolved' || data['status'] === 'closed';
        return {
            id: d.id, ticketNumber: data['ticketNumber'] ?? '',
            title: data['title'] ?? '', status: data['status'] ?? 'open',
            priority: data['priority'] ?? 'medium', category: data['category'] ?? 'other',
            assignedTo: data['assignedTo'] ?? undefined,
            slaBreached: !resolved && !!resDeadline && resDeadline < now,
            createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
        };
    });
    return { tickets, total: tickets.length };
});
/**
 * Resolve an IT ticket reference (UUID OR ticketNumber like IT-2026-0004) to the Firestore doc ID.
 */
async function resolveITTicketDocId(companyId, ref) {
    const db = (0, firebase_config_1.getFirestore)();
    const direct = await db.collection(`companies/${companyId}/itTickets`).doc(ref).get().catch(() => null);
    if (direct?.exists)
        return direct.id;
    const byNum = await db.collection(`companies/${companyId}/itTickets`).where('ticketNumber', '==', ref).limit(1).get().catch(() => null);
    if (byNum && !byNum.empty)
        return byNum.docs[0].id;
    const byId = await db.collection(`companies/${companyId}/itTickets`).where('id', '==', ref).limit(1).get().catch(() => null);
    if (byId && !byId.empty)
        return byId.docs[0].id;
    return null;
}
exports.updateTicketTool = genkit_config_1.ai.defineTool({
    name: 'it_updateTicket',
    description: 'Update IT ticket status, priority, assignment, or add a message. Accepts UUID or ticketNumber (IT-YYYY-XXXX).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), ticketId: zod_1.z.string().describe('UUID or ticketNumber like IT-2026-0004'),
        status: zod_1.z.enum(TICKET_STATUSES).optional(), priority: zod_1.z.enum(PRIORITIES).optional(),
        assignedTo: zod_1.z.string().optional(), message: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, ticketId, status, priority, assignedTo, message }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveITTicketDocId(companyId, ticketId);
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
    if (assignedTo) {
        updates['assignedTo'] = assignedTo;
        if (!status)
            updates['status'] = 'assigned';
    }
    if (message) {
        updates['messages'] = firestore_1.FieldValue.arrayUnion({ id: (0, helpers_1.generateId)(), content: message, role: 'agent', createdAt: new Date().toISOString() });
        const doc = await db.collection(`companies/${companyId}/itTickets`).doc(docId).get();
        if (doc.data() && !doc.data()['firstResponseAt']) {
            updates['firstResponseAt'] = firestore_1.FieldValue.serverTimestamp();
            const deadline = doc.data()['slaFirstResponseDeadline']?.toDate?.();
            updates['slaFirstResponseMet'] = deadline ? new Date() <= deadline : null;
        }
    }
    await db.collection(`companies/${companyId}/itTickets`).doc(docId).update(updates);
    return { success: true, message: `Ticket ${ticketId} mis à jour.` };
});
exports.escalateTicketTool = genkit_config_1.ai.defineTool({
    name: 'it_escalateTicket',
    description: 'Escalate IT ticket to senior tech, manager, or external vendor. Accepts UUID or ticketNumber.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), ticketId: zod_1.z.string().describe('UUID or ticketNumber like IT-2026-0004'),
        reason: zod_1.z.string(),
        escalateTo: zod_1.z.enum(['senior_tech', 'manager', 'vendor']).default('senior_tech'),
    }),
    outputSchema: zod_1.z.object({ escalated: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, ticketId, reason, escalateTo }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveITTicketDocId(companyId, ticketId);
    if (!docId)
        return { escalated: false, message: `Ticket ${ticketId} introuvable.` };
    await db.collection(`companies/${companyId}/itTickets`).doc(docId).update({
        status: 'escalated', escalatedTo: escalateTo, escalationReason: reason,
        escalatedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { escalated: true, message: `Ticket ${ticketId} escaladé vers ${escalateTo}. Raison: ${reason}` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. ASSETS
// ══════════════════════════════════════════════════════════════════════════════
exports.getAssetsTool = genkit_config_1.ai.defineTool({
    name: 'it_getAssets',
    description: 'List IT assets with warranty and assignment info.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), type: zod_1.z.string().optional(), assignedTo: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        assets: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), name: zod_1.z.string(), type: zod_1.z.string(), status: zod_1.z.string(),
            assignedTo: zod_1.z.string().optional(), warrantyExpiry: zod_1.z.string().optional(),
            warrantyExpired: zod_1.z.boolean(), value: zod_1.z.number(),
        })),
        total: zod_1.z.number(), totalValue: zod_1.z.number(), warrantyAlerts: zod_1.z.number(),
    }),
}, async ({ companyId, type, assignedTo }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/itAssets`);
    if (type)
        q = q.where('type', '==', type);
    if (assignedTo)
        q = q.where('assignedTo', '==', assignedTo);
    const snap = await q.limit(200).get();
    const now = new Date();
    let totalValue = 0, warrantyAlerts = 0;
    const assets = snap.docs.map(d => {
        const data = d.data();
        const warranty = data['warrantyExpiry']?.toDate?.() ?? (data['warrantyExpiry'] ? new Date(data['warrantyExpiry']) : null);
        const expired = warranty ? warranty < now : false;
        const val = data['value'] ?? 0;
        totalValue += val;
        if (expired)
            warrantyAlerts++;
        return {
            id: d.id, name: data['name'] ?? '', type: data['type'] ?? '',
            status: data['status'] ?? 'active', assignedTo: data['assignedTo'] ?? undefined,
            warrantyExpiry: warranty?.toISOString() ?? undefined, warrantyExpired: expired, value: val,
        };
    });
    return { assets, total: assets.length, totalValue, warrantyAlerts };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. LICENSES
// ══════════════════════════════════════════════════════════════════════════════
exports.getLicensesTool = genkit_config_1.ai.defineTool({
    name: 'it_getLicenses',
    description: 'List software licenses with expiry and cost tracking.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        licenses: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), name: zod_1.z.string(), vendor: zod_1.z.string(), seats: zod_1.z.number(),
            usedSeats: zod_1.z.number(), costPerSeat: zod_1.z.number(), totalCost: zod_1.z.number(),
            expiresAt: zod_1.z.string().optional(), expired: zod_1.z.boolean(),
        })),
        total: zod_1.z.number(), totalCost: zod_1.z.number(), expiringCount: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/itLicenses`).limit(100).get();
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86400000);
    let totalCost = 0, expiringCount = 0;
    const licenses = snap.docs.map(d => {
        const data = d.data();
        const expiry = data['expiresAt']?.toDate?.() ?? (data['expiresAt'] ? new Date(data['expiresAt']) : null);
        const expired = expiry ? expiry < now : false;
        const expiringSoon = expiry ? expiry < soon && !expired : false;
        const cost = data['totalCost'] ?? (data['costPerSeat'] ?? 0) * (data['seats'] ?? 1);
        totalCost += cost;
        if (expired || expiringSoon)
            expiringCount++;
        return {
            id: d.id, name: data['name'] ?? '', vendor: data['vendor'] ?? '',
            seats: data['seats'] ?? 0, usedSeats: data['usedSeats'] ?? 0,
            costPerSeat: data['costPerSeat'] ?? 0, totalCost: cost,
            expiresAt: expiry?.toISOString() ?? undefined, expired,
        };
    });
    return { licenses, total: licenses.length, totalCost, expiringCount };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. SERVICES MONITORING
// ══════════════════════════════════════════════════════════════════════════════
exports.getServicesTool = genkit_config_1.ai.defineTool({
    name: 'it_getServices',
    description: 'Get IT services status and uptime.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        services: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), status: zod_1.z.string(), uptime: zod_1.z.number(), lastIncident: zod_1.z.string().optional() })),
        overallHealth: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/itServices`).limit(20).get();
    if (snap.empty)
        return { services: [{ id: 'none', name: 'Aucun service configure', status: 'unknown', uptime: 100 }], overallHealth: 'healthy' };
    const services = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, name: data['name'] ?? d.id, status: data['status'] ?? 'operational',
            uptime: data['uptime'] ?? 99.9, lastIncident: data['lastIncident'] ?? undefined,
        };
    });
    const hasDown = services.some(s => s.status === 'down');
    const hasDegraded = services.some(s => s.status === 'degraded');
    return { services, overallHealth: hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy' };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. KB + AI SUGGEST
// ══════════════════════════════════════════════════════════════════════════════
exports.searchKBTool = genkit_config_1.ai.defineTool({
    name: 'it_searchKB',
    description: 'Search IT knowledge base for procedures and troubleshooting.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), query: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ results: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), content: zod_1.z.string(), category: zod_1.z.string() })), found: zod_1.z.boolean() }),
}, async ({ companyId, query }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/itKnowledge`).limit(30).get();
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const results = snap.docs
        .map(d => {
        const data = d.data();
        const title = data['title'] ?? '';
        const content = data['content'] ?? '';
        const score = keywords.filter(kw => `${title} ${content}`.toLowerCase().includes(kw)).length;
        return { id: d.id, title, content, category: data['category'] ?? 'general', score };
    })
        .filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
        .map(({ score: _, ...rest }) => rest);
    return { results, found: results.length > 0 };
});
exports.suggestResolutionTool = genkit_config_1.ai.defineTool({
    name: 'it_suggestResolution',
    description: 'Generate AI-suggested resolution for an IT ticket.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), ticketId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ suggestion: zod_1.z.string(), sources: zod_1.z.array(zod_1.z.string()), confidence: zod_1.z.number() }),
}, async ({ companyId, ticketId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/itTickets`).doc(ticketId).get();
    const data = doc.data();
    if (!data)
        return { suggestion: '', sources: [], confidence: 0 };
    const query = `${data['title']} ${data['description']}`;
    const kbSnap = await db.collection(`companies/${companyId}/itKnowledge`).limit(20).get();
    const keywords = query.toString().toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const relevant = kbSnap.docs.map(d => ({ title: d.data()['title'] ?? '', content: d.data()['content'] ?? '' }))
        .filter(a => keywords.some(kw => `${a.title} ${a.content}`.toLowerCase().includes(kw))).slice(0, 3);
    if (relevant.length === 0)
        return { suggestion: 'Aucune procedure trouvee. Resolution manuelle recommandee.', sources: [], confidence: 20 };
    const result = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: 'You are an IT support technician. Provide a step-by-step resolution. Be concise and technical. Reply in French.',
        prompt: `Issue: ${query}\n\nKB:\n${relevant.map(a => `## ${a.title}\n${a.content}`).join('\n\n')}`,
        config: { temperature: 0.3 },
    });
    return { suggestion: result.text, sources: relevant.map(a => a.title), confidence: Math.min(90, 40 + relevant.length * 20) };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. STATS
// ══════════════════════════════════════════════════════════════════════════════
exports.getStatsTool = genkit_config_1.ai.defineTool({
    name: 'it_getStats',
    description: 'Get IT department statistics and KPIs.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalTickets: zod_1.z.number(), openTickets: zod_1.z.number(), escalated: zod_1.z.number(), slaBreaches: zod_1.z.number(),
        avgResolutionMin: zod_1.z.number(), totalAssets: zod_1.z.number(), totalAssetValue: zod_1.z.number(), warrantyAlerts: zod_1.z.number(),
        totalLicenses: zod_1.z.number(), licenseCost: zod_1.z.number(), expiringLicenses: zod_1.z.number(),
        byCategory: zod_1.z.array(zod_1.z.object({ category: zod_1.z.string(), count: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [ticketsSnap, assetsSnap, licensesSnap] = await Promise.all([
        db.collection(`companies/${companyId}/itTickets`).limit(500).get(),
        db.collection(`companies/${companyId}/itAssets`).limit(500).get(),
        db.collection(`companies/${companyId}/itLicenses`).limit(100).get(),
    ]);
    const now = new Date();
    const tickets = ticketsSnap.docs.map(d => d.data());
    let open = 0, escalated = 0, slaBreaches = 0, totalRes = 0, resCount = 0;
    const byCat = {};
    for (const t of tickets) {
        const s = t['status'] ?? 'open';
        if (s === 'open' || s === 'assigned' || s === 'in_progress')
            open++;
        if (s === 'escalated')
            escalated++;
        byCat[t['category'] ?? 'other'] = (byCat[t['category'] ?? 'other'] ?? 0) + 1;
        const rd = t['slaResolutionDeadline']?.toDate?.();
        if (rd && s !== 'resolved' && s !== 'closed' && rd < now)
            slaBreaches++;
        const ca = t['createdAt']?.toDate?.();
        const ra = t['resolvedAt']?.toDate?.();
        if (ca && ra) {
            totalRes += (ra.getTime() - ca.getTime()) / 60000;
            resCount++;
        }
    }
    let totalAssetValue = 0, warrantyAlerts = 0;
    for (const d of assetsSnap.docs) {
        totalAssetValue += d.data()['value'] ?? 0;
        const we = d.data()['warrantyExpiry']?.toDate?.();
        if (we && we < now)
            warrantyAlerts++;
    }
    let licenseCost = 0, expiringLicenses = 0;
    const soon = new Date(now.getTime() + 30 * 86400000);
    for (const d of licensesSnap.docs) {
        licenseCost += d.data()['totalCost'] ?? 0;
        const exp = d.data()['expiresAt']?.toDate?.();
        if (exp && exp < soon)
            expiringLicenses++;
    }
    return {
        totalTickets: tickets.length, openTickets: open, escalated, slaBreaches,
        avgResolutionMin: resCount > 0 ? Math.round(totalRes / resCount) : 0,
        totalAssets: assetsSnap.size, totalAssetValue, warrantyAlerts,
        totalLicenses: licensesSnap.size, licenseCost, expiringLicenses,
        byCategory: Object.entries(byCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CMDB OVERVIEW (asset lifecycle + topology)
// ══════════════════════════════════════════════════════════════════════════════
exports.cmdbOverviewTool = genkit_config_1.ai.defineTool({
    name: 'it_getCMDBOverview',
    description: 'CMDB dashboard — total assets by type/status, warranty alerts, depreciation, asset age distribution.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalAssets: zod_1.z.number(),
        byType: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), count: zod_1.z.number(), totalValue: zod_1.z.number() })),
        byStatus: zod_1.z.array(zod_1.z.object({ status: zod_1.z.string(), count: zod_1.z.number() })),
        warrantyExpiring: zod_1.z.number(), avgAgeMonths: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/itAssets`).limit(500).get();
    const assets = snap.docs.map(d => d.data());
    const byType = {};
    const byStatus = {};
    let totalAge = 0;
    let warrantyExpiring = 0;
    const now = Date.now();
    const thirtyDays = 30 * 86400000;
    assets.forEach(a => {
        const type = a['type'] ?? 'other';
        byType[type] = byType[type] ?? { count: 0, value: 0 };
        byType[type].count++;
        byType[type].value += a['purchasePrice'] ?? a['value'] ?? 0;
        const status = a['status'] ?? 'active';
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        const purchased = a['purchasedAt']?.toDate?.()?.getTime() ?? a['createdAt']?.toDate?.()?.getTime() ?? now;
        totalAge += (now - purchased) / (30 * 86400000);
        const warranty = a['warrantyExpires']?.toDate?.()?.getTime() ?? 0;
        if (warranty > 0 && warranty - now < thirtyDays && warranty > now)
            warrantyExpiring++;
    });
    return {
        totalAssets: assets.length,
        byType: Object.entries(byType).map(([t, d]) => ({ type: t, count: d.count, totalValue: d.value })).sort((a, b) => b.count - a.count),
        byStatus: Object.entries(byStatus).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count),
        warrantyExpiring, avgAgeMonths: assets.length > 0 ? Math.round(totalAge / assets.length) : 0,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SERVICE MONITORING DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
exports.monitoringDashboardTool = genkit_config_1.ai.defineTool({
    name: 'it_getMonitoringDashboard',
    description: 'Service monitoring — uptime, alerts, incidents, service health overview.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        services: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), status: zod_1.z.string(), uptime: zod_1.z.number(), lastIncident: zod_1.z.string(), responseTimeMs: zod_1.z.number() })),
        totalUp: zod_1.z.number(), totalDown: zod_1.z.number(), avgUptime: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/itServices`).limit(50).get();
    const services = snap.docs.map(d => {
        const s = d.data();
        return {
            name: s['name'] ?? '', status: s['status'] ?? 'unknown',
            uptime: s['uptime'] ?? 99.9, lastIncident: s['lastIncident'] ?? '',
            responseTimeMs: s['responseTimeMs'] ?? 0,
        };
    });
    const up = services.filter(s => s.status === 'operational' || s.status === 'up').length;
    const down = services.filter(s => s.status === 'down' || s.status === 'outage').length;
    return { services, totalUp: up, totalDown: down, avgUptime: services.length > 0 ? Math.round(services.reduce((s, sv) => s + sv.uptime, 0) / services.length * 100) / 100 : 99.9 };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: TECH AGENT PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════
exports.techPerformanceTool = genkit_config_1.ai.defineTool({
    name: 'it_getTechPerformance',
    description: 'IT technician performance — tickets per tech, avg resolution time, workload.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        technicians: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), ticketsClosed: zod_1.z.number(), ticketsOpen: zod_1.z.number(), avgResolutionMin: zod_1.z.number() })),
        topTech: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [ticketsSnap, usersSnap] = await Promise.all([
        db.collection(`companies/${companyId}/itTickets`).limit(500).get(),
        db.collection('users').where('companyId', '==', companyId).limit(50).get(),
    ]);
    const techMap = new Map();
    usersSnap.docs.forEach(d => { const u = d.data(); if (['admin', 'manager', 'employee'].includes(u['role'] ?? '') && (u['department'] ?? '').toLowerCase().includes('it'))
        techMap.set(d.id, { name: u['displayName'] ?? '', closed: 0, open: 0, resTimes: [] }); });
    ticketsSnap.docs.forEach(d => { const t = d.data(); const a = t['assignee'] ?? t['assignedTo'] ?? ''; if (!techMap.has(a))
        return; const tech = techMap.get(a); if (['resolved', 'closed'].includes(t['status'] ?? ''))
        tech.closed++;
    else
        tech.open++; });
    const technicians = Array.from(techMap.values()).filter(t => t.closed + t.open > 0).map(t => ({ name: t.name, ticketsClosed: t.closed, ticketsOpen: t.open, avgResolutionMin: 0 })).sort((a, b) => b.ticketsClosed - a.ticketsClosed);
    return { technicians, topTech: technicians[0]?.name ?? '' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: LICENSE OPTIMIZATION
// ══════════════════════════════════════════════════════════════════════════════
exports.licenseOptimizationTool = genkit_config_1.ai.defineTool({
    name: 'it_optimizeLicenses',
    description: 'License cost optimization — unused seats, expiring, cost per user, recommendations.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalCost: zod_1.z.number(), totalSeats: zod_1.z.number(), usedSeats: zod_1.z.number(), unusedSeats: zod_1.z.number(),
        wasteCost: zod_1.z.number(), expiringCount: zod_1.z.number(),
        recommendations: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/itLicenses`).limit(100).get();
    let totalCost = 0, totalSeats = 0, usedSeats = 0, expiringCount = 0;
    const now = Date.now();
    snap.docs.forEach(d => {
        const l = d.data();
        totalCost += (l['costPerSeat'] ?? 0) * (l['totalSeats'] ?? 0);
        totalSeats += l['totalSeats'] ?? 0;
        usedSeats += l['usedSeats'] ?? 0;
        const exp = l['expiresAt']?.toDate?.()?.getTime() ?? 0;
        if (exp > 0 && exp - now < 30 * 86400000 && exp > now)
            expiringCount++;
    });
    const unusedSeats = totalSeats - usedSeats;
    const wasteCost = snap.docs.reduce((s, d) => { const l = d.data(); const unused = (l['totalSeats'] ?? 0) - (l['usedSeats'] ?? 0); return s + unused * (l['costPerSeat'] ?? 0); }, 0);
    const recs = [];
    if (unusedSeats > 5)
        recs.push(`${unusedSeats} sieges inutilises — economie potentielle de ${wasteCost}€`);
    if (expiringCount > 0)
        recs.push(`${expiringCount} licence(s) expirent dans 30 jours`);
    if (totalSeats > 0 && usedSeats / totalSeats < 0.7)
        recs.push('Taux d\'utilisation < 70% — renegociez vos contrats');
    return { totalCost, totalSeats, usedSeats, unusedSeats, wasteCost, expiringCount, recommendations: recs };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: IT AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════
exports.itAutomationTool = genkit_config_1.ai.defineTool({
    name: 'it_runAutomation',
    description: 'IT automation: incident → Security, license expire → Accounting, asset departure → HR offboarding.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), type: zod_1.z.enum(['security_incidents', 'license_alerts', 'asset_offboarding', 'sla_check']) }),
    outputSchema: zod_1.z.object({ actions: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, type }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const actions = [];
    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    if (type === 'security_incidents') {
        const snap = await db.collection(`companies/${companyId}/itTickets`).where('category', 'in', ['security', 'virus', 'intrusion']).where('status', 'in', ['open', 'assigned']).limit(20).get();
        for (const doc of snap.docs) {
            await db.collection(`companies/${companyId}/securityIncidents`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), type: 'other', description: `Depuis IT: ${doc.data()['subject'] ?? ''}`, priority: 'P3_medium', status: 'detected', source: 'it_ticket', itTicketId: doc.id, createdAt: new Date(),
            });
            actions.push(`Incident securite depuis IT ticket ${doc.data()['subject'] ?? doc.id}`);
        }
    }
    if (type === 'license_alerts') {
        const snap = await db.collection(`companies/${companyId}/itLicenses`).limit(50).get();
        const now = Date.now();
        const expiring = snap.docs.filter(d => { const exp = d.data()['expiresAt']?.toDate?.()?.getTime() ?? 0; return exp > 0 && exp - now < 30 * 86400000 && exp > now; });
        if (expiring.length > 0) {
            createNotification({ companyId, type: 'system', title: `${expiring.length} licence(s) expirent bientot`, message: `Verifiez et renouvelez vos licences IT.`, actionUrl: '/it/licenses', icon: 'Key', severity: 'warning' }).catch(() => { });
            actions.push(`${expiring.length} alertes licence envoyees`);
        }
    }
    if (type === 'asset_offboarding') {
        const offSnap = await db.collection(`companies/${companyId}/offboarding`).where('status', '==', 'in_progress').limit(20).get();
        for (const doc of offSnap.docs) {
            const items = doc.data()['items'] ?? [];
            const itItems = items.filter(i => i.id.startsWith('off-4') || i.id.startsWith('off-5') || i.id.startsWith('off-6'));
            const pending = itItems.filter(i => !i.completed);
            if (pending.length > 0) {
                actions.push(`Offboarding ${doc.id}: ${pending.length} etapes IT en attente`);
            }
        }
        if (actions.length > 0) {
            createNotification({ companyId, type: 'system', title: `${actions.length} offboarding(s) avec etapes IT`, message: 'Equipements et acces a recuperer.', actionUrl: '/it/assets', icon: 'Package', severity: 'warning' }).catch(() => { });
        }
    }
    if (type === 'sla_check') {
        const snap = await db.collection(`companies/${companyId}/itTickets`).where('status', 'in', ['open', 'assigned']).limit(100).get();
        const now = Date.now();
        let breaches = 0;
        for (const doc of snap.docs) {
            const t = doc.data();
            const dl = t['slaDeadline']?.toDate?.()?.getTime() ?? 0;
            if (dl && dl < now && !t['slaBreachNotified']) {
                await doc.ref.update({ slaBreachNotified: true });
                breaches++;
            }
        }
        if (breaches > 0) {
            createNotification({ companyId, type: 'system', title: `${breaches} SLA breach(es) IT`, message: 'Tickets en retard de resolution.', actionUrl: '/it/tickets', icon: 'Clock', severity: 'error' }).catch(() => { });
            actions.push(`${breaches} alertes SLA IT`);
        }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: INCIDENT TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
exports.itIncidentTimelineTool = genkit_config_1.ai.defineTool({
    name: 'it_getIncidentTimeline',
    description: 'Get complete IT incident timeline — events, alerts, interventions, resolution.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), ticketId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        ticketId: zod_1.z.string(),
        events: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), timestamp: zod_1.z.string(), actor: zod_1.z.string(), details: zod_1.z.string() })),
    }),
}, async ({ companyId, ticketId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/itTickets`).doc(ticketId).get();
    if (!doc.exists)
        return { ticketId, events: [] };
    const t = doc.data();
    const events = [];
    const ts = (v) => v?.toDate?.()?.toISOString() ?? (typeof v === 'string' ? v : '');
    events.push({ type: 'created', timestamp: ts(t['createdAt']), actor: t['reporter'] ?? 'system', details: `Ticket cree: ${t['subject'] ?? ''}` });
    if (t['assignee'])
        events.push({ type: 'assigned', timestamp: ts(t['updatedAt']), actor: 'system', details: `Assigne a ${t['assignee']}` });
    const msgs = t['messages'] ?? [];
    msgs.forEach(m => events.push({ type: `message_${m.role ?? 'agent'}`, timestamp: ts(m.createdAt), actor: m.authorName ?? m.role ?? '', details: (m.content ?? '').slice(0, 200) }));
    if (t['escalatedTo'])
        events.push({ type: 'escalated', timestamp: ts(t['escalatedAt']), actor: 'system', details: `Escalade: ${t['escalatedTo']} — ${t['escalationReason'] ?? ''}` });
    if (t['slaBreachNotified'])
        events.push({ type: 'sla_breach', timestamp: '', actor: 'system', details: 'SLA depasse' });
    if (['resolved', 'closed'].includes(t['status'] ?? ''))
        events.push({ type: 'resolved', timestamp: ts(t['resolvedAt'] ?? t['updatedAt']), actor: t['assignee'] ?? '', details: 'Ticket resolu' });
    events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    return { ticketId, events };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: PREDICTIVE IT (anticipate failures)
// ══════════════════════════════════════════════════════════════════════════════
exports.predictiveITTool = genkit_config_1.ai.defineTool({
    name: 'it_predictiveAnalysis',
    description: 'Predict IT issues — aging assets needing replacement, services at risk, recurring problems.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        predictions: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), severity: zod_1.z.string(), title: zod_1.z.string(), description: zod_1.z.string(), suggestedAction: zod_1.z.string() })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [assetsSnap, ticketsSnap, servicesSnap, licensesSnap] = await Promise.all([
        db.collection(`companies/${companyId}/itAssets`).limit(200).get(),
        db.collection(`companies/${companyId}/itTickets`).limit(300).get(),
        db.collection(`companies/${companyId}/itServices`).limit(50).get(),
        db.collection(`companies/${companyId}/itLicenses`).limit(50).get(),
    ]);
    const predictions = [];
    const now = Date.now();
    // 1. Aging assets + frequent incidents → replacement alert
    const assetTicketCount = new Map();
    ticketsSnap.docs.forEach(d => {
        const assetId = d.data()['assetId'] ?? d.data()['asset'] ?? '';
        if (assetId)
            assetTicketCount.set(assetId, (assetTicketCount.get(assetId) ?? 0) + 1);
    });
    assetsSnap.docs.forEach(d => {
        const a = d.data();
        const purchased = a['purchasedAt']?.toDate?.()?.getTime() ?? a['createdAt']?.toDate?.()?.getTime() ?? now;
        const ageMonths = Math.round((now - purchased) / (30 * 86400000));
        const incidents = assetTicketCount.get(d.id) ?? 0;
        const name = a['name'] ?? a['type'] ?? d.id;
        if (ageMonths > 36 && incidents >= 2) {
            predictions.push({ type: 'asset_replacement', severity: 'high', title: `Remplacement recommande: ${name}`, description: `${ageMonths} mois d'age, ${incidents} incidents. Risque de panne elevee.`, suggestedAction: 'Planifier remplacement et budget' });
        }
        else if (ageMonths > 48) {
            predictions.push({ type: 'asset_aging', severity: 'medium', title: `Asset vieillissant: ${name}`, description: `${ageMonths} mois — depasse la duree de vie recommandee.`, suggestedAction: 'Evaluer etat et prevoir remplacement' });
        }
    });
    // 2. Services with low uptime or degraded → scaling/fix recommendation
    servicesSnap.docs.forEach(d => {
        const s = d.data();
        const uptime = s['uptime'] ?? 99.9;
        const name = s['name'] ?? '';
        const status = s['status'] ?? 'operational';
        if (uptime < 99) {
            predictions.push({ type: 'service_risk', severity: 'high', title: `Service instable: ${name}`, description: `Uptime ${uptime}% — sous le seuil de 99%. Degradation probable.`, suggestedAction: 'Investiguer cause, considerer scaling ou migration' });
        }
        else if (status === 'degraded') {
            predictions.push({ type: 'service_degraded', severity: 'medium', title: `Service degrade: ${name}`, description: `Performance reduite detectee.`, suggestedAction: 'Monitorer et preparer plan de contingence' });
        }
    });
    // 3. Recurring ticket categories → systemic issue
    const catCount = new Map();
    ticketsSnap.docs.forEach(d => { const c = d.data()['category'] ?? ''; if (c)
        catCount.set(c, (catCount.get(c) ?? 0) + 1); });
    catCount.forEach((count, cat) => {
        if (count >= 10) {
            predictions.push({ type: 'recurring_issue', severity: 'medium', title: `Probleme recurrent: ${cat}`, description: `${count} tickets dans cette categorie. Probleme systemique probable.`, suggestedAction: 'Creer une procedure KB, ou corriger la cause racine' });
        }
    });
    // 4. Licenses expiring soon
    const thirtyDays = 30 * 86400000;
    licensesSnap.docs.forEach(d => {
        const l = d.data();
        const exp = l['expiresAt']?.toDate?.()?.getTime() ?? 0;
        if (exp > now && exp - now < thirtyDays) {
            predictions.push({ type: 'license_expiry', severity: 'medium', title: `Licence expire bientot: ${l['name'] ?? l['software'] ?? ''}`, description: `Expiration dans ${Math.round((exp - now) / 86400000)} jours.`, suggestedAction: 'Renouveler ou trouver alternative' });
        }
    });
    predictions.sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));
    return { predictions, message: `${predictions.length} prediction(s) generee(s).` };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CLONE → IT AUTO-TICKET (detect client IT issues from clone)
// ══════════════════════════════════════════════════════════════════════════════
exports.cloneToITTool = genkit_config_1.ai.defineTool({
    name: 'it_createFromClone',
    description: 'Auto-create IT ticket from clone conversation when customer reports a technical issue.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), issue: zod_1.z.string(), customerEmail: zod_1.z.string().optional(), customerName: zod_1.z.string().optional(), channel: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ ticketId: zod_1.z.string(), ticketNumber: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, issue, customerEmail, customerName, channel }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
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
        await db.collection(`companies/${companyId}/itTickets`).doc(id).update({ description: `${issue}${monitoringCorrelation}`, monitoringCorrelation: servicesSnap.docs.map(d => d.data()['name'] ?? '') });
    }
    return { ticketId: id, ticketNumber: number, message: `Ticket IT ${number} cree.${monitoringCorrelation ? ' Services potentiellement impactes detectes.' : ''}` };
});
const ALL_TOOLS = [
    exports.createTicketTool, exports.getTicketsTool, exports.updateTicketTool, exports.escalateTicketTool,
    exports.getAssetsTool, exports.getLicensesTool, exports.getServicesTool,
    exports.searchKBTool, exports.suggestResolutionTool, exports.getStatsTool,
    // PRO
    exports.cmdbOverviewTool, exports.monitoringDashboardTool, exports.techPerformanceTool, exports.licenseOptimizationTool, exports.itAutomationTool,
    exports.itIncidentTimelineTool, exports.predictiveITTool, exports.cloneToITTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({ response: zod_1.z.string(), ticketId: zod_1.z.string().optional(), escalate: zod_1.z.boolean() });
exports.itAgentFlow = genkit_config_1.ai.defineFlow({ name: 'itAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    try {
        logger_1.logger.info(`[ITAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
        const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
        const dateAnchors = (() => {
            const now = new Date();
            const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
        })();
        const executors = new Map();
        for (const tool of ALL_TOOLS) {
            const name = tool.__action?.name ?? '';
            if (name)
                executors.set(name, (i) => tool({ ...i, companyId, userId }));
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
            const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
                const { name, input, ref } = p.toolRequest;
                const exec = executors.get(name);
                const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
                return { name, ref, output };
            }));
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
                tools: ALL_TOOLS, config: { temperature: 0.3 },
            });
        }
        const text = response.text;
        const ticketMatch = text.match(/IT-\d{4}-\d{4}/);
        const escalate = /escalat|human|technicien|cyberattack|vendor/i.test(text);
        return { response: text, ticketId: ticketMatch?.[0], escalate };
    }
    catch (err) {
        logger_1.logger.error('[ITAgent] Flow error:', err);
        return { response: 'Erreur dans l\'agent IT. Veuillez reessayer.', escalate: false };
    }
});
exports.itAgentTool = genkit_config_1.ai.defineTool({
    name: 'callITAgent',
    description: 'IT PRO: helpdesk SLA, CMDB, service monitoring, tech performance, license optimization, cross-agent (security/HR/accounting), KB, AI resolution.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, async (input) => {
    try {
        return await (0, exports.itAgentFlow)(input);
    }
    catch (err) {
        logger_1.logger.error('[callITAgent] Error:', err);
        return { response: 'Erreur agent IT.', escalate: false };
    }
});
//# sourceMappingURL=it.agent.js.map