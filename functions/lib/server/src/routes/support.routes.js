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
/**
 * Support Routes PRO — Complete Customer Support API
 * Tickets · KB · Canned Responses · Stats · Analytics · SLA · Notifications
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const notificationService_1 = require("../services/notificationService");
const agentRbac_middleware_1 = require("../middleware/agentRbac.middleware");
const router = (0, express_1.Router)();
const safe = async (fn, fallback) => {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
};
function serializeDoc(data) {
    const out = {};
    for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object' && '_seconds' in val) {
            out[key] = new Date(val._seconds * 1000).toISOString();
        }
        else if (val && typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
            out[key] = (val.toDate()).toISOString();
        }
        else if (Array.isArray(val)) {
            out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item) : item);
        }
        else {
            out[key] = val;
        }
    }
    return out;
}
function serializeSnap(doc) {
    return { id: doc.id, ...serializeDoc(doc.data()) };
}
const SLA_TARGETS = {
    urgent: { firstResponse: 15, resolution: 120 },
    high: { firstResponse: 60, resolution: 480 },
    normal: { firstResponse: 240, resolution: 1440 },
    low: { firstResponse: 480, resolution: 2880 },
};
// ── Public widget (no auth) ──────────────────────────────────────────────────
router.post('/widget/chat', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { message, companyId } = req.body;
    if (!message || !companyId)
        throw new error_middleware_1.AppError('message and companyId required', 400);
    try {
        const { supportAgentFlow } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
        const result = await supportAgentFlow({ request: message, companyId: companyId, language: 'fr' });
        res.json({ success: true, data: { reply: result.response, ticketId: result.ticketId } });
    }
    catch {
        res.json({ success: true, data: { reply: 'Merci pour votre message. Notre equipe vous repondra rapidement.' } });
    }
}));
// ── Protected routes ─────────────────────────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
router.use((0, agentRbac_middleware_1.requireAgentRole)('support'));
// POST /api/support/chat — protected version of widget chat for the in-app agent panel
router.post('/chat', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { message } = req.body;
    if (!message || typeof message !== 'string')
        throw new error_middleware_1.AppError('message (string) required', 400);
    try {
        const { supportAgentFlow } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
        const result = await supportAgentFlow({ request: message, companyId, language: 'fr' });
        res.json({ success: true, data: { response: result.response, ticketId: result.ticketId } });
    }
    catch (err) {
        res.json({ success: true, data: { response: 'Désolé, l\'agent IA est temporairement indisponible. Réessaie dans un instant.' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/tickets', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        let q = db.collection(`companies/${companyId}/supportTickets`);
        if (req.query['status'] && req.query['status'] !== 'all')
            q = q.where('status', '==', req.query['status']);
        if (req.query['priority'])
            q = q.where('priority', '==', req.query['priority']);
        if (req.query['category'])
            q = q.where('category', '==', req.query['category']);
        if (req.query['assignedTo'])
            q = q.where('assignedTo', '==', req.query['assignedTo']);
        const snap = await q.limit(200).get();
        return snap.docs.map(serializeSnap);
    }, []);
    res.json({ success: true, data });
}));
router.get('/tickets/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/supportTickets`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Ticket not found', 404);
    res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()) } });
}));
router.post('/tickets', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const countSnap = await db.collection(`companies/${companyId}/supportTickets`).count().get();
    const count = countSnap.data().count + 1;
    const ticketNumber = `SUP-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const prio = body['priority'] ?? 'normal';
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
        createdBy: req.user.uid, createdAt: now, updatedAt: now,
    };
    await db.collection(`companies/${companyId}/supportTickets`).doc(id).set(ticket);
    (0, notificationService_1.createNotification)({
        companyId, type: 'system', title: `Nouveau ticket — ${ticketNumber}`,
        message: `${ticket.customerName}: ${ticket.title || ticket.description.toString().slice(0, 80)}`,
        actionUrl: `/support/${id}`, icon: 'Ticket', severity: prio === 'urgent' ? 'error' : prio === 'high' ? 'warning' : 'info',
    }).catch(() => { });
    res.status(201).json({ success: true, data: ticket });
}));
router.patch('/tickets/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const updates = { ...body, updatedAt: new Date(), updatedBy: req.user.uid };
    if (body['status'] === 'resolved')
        updates['resolvedAt'] = new Date();
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/supportTickets`).doc(req.params.id).update(updates);
    if (body['status'] === 'escalated') {
        (0, notificationService_1.createNotification)({ companyId, type: 'system', title: 'Ticket escalade', message: `Ticket escalade${body['escalationReason'] ? `: ${body['escalationReason']}` : ''}.`, actionUrl: `/support/${req.params.id}`, icon: 'AlertTriangle', severity: 'warning' }).catch(() => { });
    }
    res.json({ success: true });
}));
router.delete('/tickets/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/supportTickets`).doc(req.params.id).delete();
    res.json({ success: true });
}));
router.post('/tickets/:id/messages', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const content = body['content'];
    if (!content)
        throw new error_middleware_1.AppError('content required', 400);
    const role = body['role'] ?? 'agent';
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id);
    const msg = { id: (0, helpers_1.generateId)(), content, role, authorId: req.user.uid, authorName: req.user.email, createdAt: new Date().toISOString() };
    const updates = { messages: firestore_1.FieldValue.arrayUnion(msg), updatedAt: new Date() };
    if (role === 'agent' || role === 'ai') {
        const doc = await ref.get();
        const data = doc.data();
        if (data && !data['firstResponseAt']) {
            updates['firstResponseAt'] = new Date();
            const deadline = data['slaFirstResponseDeadline']?.toDate?.();
            updates['slaFirstResponseMet'] = deadline ? new Date() <= deadline : null;
        }
        if (data?.['status'] === 'open')
            updates['status'] = 'in_progress';
    }
    await ref.update(updates);
    res.status(201).json({ success: true, data: msg });
}));
router.patch('/tickets/:id/satisfaction', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/supportTickets`).doc(req.params.id)
        .update({ satisfaction: req.body.score, updatedAt: new Date() });
    res.json({ success: true });
}));
router.post('/tickets/:id/auto-assign', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const agentsSnap = await db.collection('users').where('companyId', '==', companyId).where('role', 'in', ['admin', 'manager']).limit(20).get();
    if (agentsSnap.empty) {
        res.json({ success: true, data: { assignedTo: null } });
        return;
    }
    const agents = agentsSnap.docs.map(d => ({ uid: d.id, name: d.data()['displayName'] ?? d.data()['email'] ?? d.id }));
    const counts = await Promise.all(agents.map(async (a) => {
        const s = await db.collection(`companies/${companyId}/supportTickets`).where('assignedTo', '==', a.uid).where('status', 'in', ['open', 'assigned', 'in_progress']).limit(100).get();
        return { ...a, count: s.size };
    }));
    counts.sort((a, b) => a.count - b.count);
    const best = counts[0];
    await db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id).update({ assignedTo: best.uid, assignedToName: best.name, status: 'assigned', updatedAt: new Date() });
    res.json({ success: true, data: { assignedTo: best.uid, assignedName: best.name } });
}));
router.post('/tickets/:id/suggest', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Ticket not found', 404);
    const data = doc.data();
    const query = `${data['title'] ?? data['subject'] ?? ''} ${data['description'] ?? ''}`;
    const kbSnap = await db.collection(`companies/${companyId}/knowledgeBase`).limit(30).get();
    const keywords = query.toString().toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const relevant = kbSnap.docs.map(d => ({ title: d.data()['title'] ?? '', content: d.data()['content'] ?? '' }))
        .filter(a => keywords.some(kw => `${a.title} ${a.content}`.toLowerCase().includes(kw))).slice(0, 3);
    if (relevant.length === 0) {
        res.json({ success: true, data: { suggestion: 'Aucun article pertinent. Reponse manuelle recommandee.', sources: [], confidence: 20 } });
        return;
    }
    const { ai, GEMINI_FLASH } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
    const result = await ai.generate({ model: GEMINI_FLASH, system: 'You are a support agent. Generate a helpful, empathetic response. Be concise. Reply in French.', prompt: `Issue: ${query}\n\nKB:\n${relevant.map(a => `## ${a.title}\n${a.content}`).join('\n\n')}`, config: { temperature: 0.3 } });
    res.json({ success: true, data: { suggestion: result.text, sources: relevant.map(a => a.title), confidence: Math.min(90, 40 + relevant.length * 20) } });
}));
router.get('/tickets/:id/client-history', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/supportTickets`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Ticket not found', 404);
    const email = doc.data()['customerEmail'];
    if (!email) {
        res.json({ success: true, data: { tickets: [], total: 0 } });
        return;
    }
    const snap = await db.collection(`companies/${companyId}/supportTickets`).where('customerEmail', '==', email).limit(50).get();
    res.json({ success: true, data: { tickets: snap.docs.filter(d => d.id !== req.params.id).map(serializeSnap), total: snap.size - 1 } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${companyId}/supportTickets`).limit(500).get();
        const now = new Date();
        const tickets = snap.docs.map(d => d.data());
        const byStatus = {};
        const byCat = {};
        const byPrio = {};
        let tSat = 0, nSat = 0, tFR = 0, nFR = 0, tRes = 0, nRes = 0, slaBreach = 0;
        for (const t of tickets) {
            const s = t['status'] ?? 'open';
            byStatus[s] = (byStatus[s] ?? 0) + 1;
            byCat[t['category'] ?? 'general'] = (byCat[t['category'] ?? 'general'] ?? 0) + 1;
            byPrio[t['priority'] ?? 'normal'] = (byPrio[t['priority'] ?? 'normal'] ?? 0) + 1;
            if (t['satisfaction'] != null) {
                tSat += t['satisfaction'];
                nSat++;
            }
            const ca = t['createdAt']?.toDate?.();
            const fr = t['firstResponseAt']?.toDate?.();
            const ra = t['resolvedAt']?.toDate?.();
            if (ca && fr) {
                tFR += (fr.getTime() - ca.getTime()) / 60000;
                nFR++;
            }
            if (ca && ra) {
                tRes += (ra.getTime() - ca.getTime()) / 60000;
                nRes++;
            }
            const rd = t['slaResolutionDeadline']?.toDate?.();
            if (rd && s !== 'resolved' && s !== 'closed' && rd < now)
                slaBreach++;
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
router.get('/kb', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/knowledgeBase`);
        if (req.query['category'])
            q = q.where('category', '==', req.query['category']);
        return (await q.limit(200).get()).docs.map(serializeSnap);
    }, []);
    res.json({ success: true, data });
}));
router.post('/kb', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const article = {
        id, companyId, title: body['title'] ?? '', content: body['content'] ?? '',
        category: body['category'] ?? 'general',
        tags: Array.isArray(body['tags']) ? body['tags'] : (typeof body['tags'] === 'string' ? body['tags'].split(',').map(t => t.trim()).filter(Boolean) : []),
        createdBy: req.user.uid, createdAt: new Date(), updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/knowledgeBase`).doc(id).set(article);
    res.status(201).json({ success: true, data: article });
}));
router.patch('/kb/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/knowledgeBase`).doc(req.params.id)
        .update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
}));
router.delete('/kb/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/knowledgeBase`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CANNED RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/canned', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => (await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cannedResponses`).limit(100).get()).docs.map(serializeSnap), []);
    res.json({ success: true, data });
}));
router.post('/canned', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const tmpl = { id, companyId, title: body['title'] ?? '', content: body['content'] ?? '', category: body['category'] ?? 'general', createdBy: req.user.uid, createdAt: new Date() };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cannedResponses`).doc(id).set(tmpl);
    res.status(201).json({ success: true, data: tmpl });
}));
router.delete('/canned/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cannedResponses`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PRO: AGENT PERFORMANCE, SLA DASHBOARD, NPS, SENTIMENT, AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/agent-performance', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { agentPerformanceTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await agentPerformanceTool({ companyId: cid }) });
}));
router.get('/sla-dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { slaDashboardTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await slaDashboardTool({ companyId: cid }) });
}));
router.get('/nps', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { npsSurveyTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await npsSurveyTool({ companyId: cid, action: 'analytics' }) });
}));
router.post('/nps', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { npsSurveyTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await npsSurveyTool({ companyId: cid, action: 'send', ...req.body }) });
}));
router.post('/tickets/:id/sentiment', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { sentimentDetectionTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await sentimentDetectionTool({ companyId: cid, ticketId: req.params.id, message: req.body['message'] ?? '' }) });
}));
router.post('/tickets/:id/smart-priority', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { smartPriorityTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await smartPriorityTool({ companyId: cid, ticketId: req.params.id }) });
}));
router.get('/tickets/:id/timeline', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { ticketTimelineTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await ticketTimelineTool({ companyId: cid, ticketId: req.params.id }) });
}));
router.post('/automation/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { supportAutomationTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await supportAutomationTool({ companyId: cid, type: req.body['type'] ?? 'sla_alerts' }) });
}));
// PRO: Predictive support
router.get('/predictive', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { predictiveSupportTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    res.json({ success: true, data: await predictiveSupportTool({ companyId: cid }) });
}));
// PRO: Auto-resolve (public — used by clone/widget)
router.post('/auto-resolve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { autoResolveTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
    const body = req.body;
    res.json({ success: true, data: await autoResolveTool({ companyId: cid, issue: body['issue'] ?? '', customerEmail: body['customerEmail'] }) });
}));
exports.default = router;
//# sourceMappingURL=support.routes.js.map