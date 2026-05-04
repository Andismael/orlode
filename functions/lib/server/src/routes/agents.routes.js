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
 * /api/agents  — agent monitoring & management endpoints
 * Note: distinct from /api/agent (orchestrator/chat routes)
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/agents/status  — live status of selected agents
router.get('/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Get company's selected agents
        const companyDoc = await db.collection('companies').doc(companyId).get();
        const rawIds = companyDoc.data()?.['selectedAgents'] ?? [];
        // Legacy normalization: qa/documents were merged into knowledge
        const LEGACY_ALIASES = { qa: 'knowledge', documents: 'knowledge' };
        const normalized = Array.from(new Set(rawIds.map(id => LEGACY_ALIASES[id] ?? id)));
        // Self-heal: if the stored list had legacy ids, persist the cleaned one
        const changed = normalized.length !== rawIds.length
            || normalized.some((id, i) => id !== rawIds[i]);
        if (changed) {
            await db.collection('companies').doc(companyId).update({ selectedAgents: normalized, updatedAt: new Date() }).catch(() => { });
        }
        const selectedAgentIds = normalized;
        if (selectedAgentIds.length === 0) {
            return res.json({ success: true, data: [] });
        }
        // Get agent catalog for display names
        const { AGENT_CATALOG } = await Promise.resolve().then(() => __importStar(require('../config/agentCatalog')));
        const catalogMap = new Map(AGENT_CATALOG.map(a => [a.id, a]));
        // Get any existing status/logs data
        const statusSnap = await db.collection('agentStatus').where('companyId', '==', companyId).get();
        const statusMap = new Map(statusSnap.docs.map(d => [d.data()['agentId'], d.data()]));
        // Build status for each selected agent
        const agents = selectedAgentIds.map(id => {
            const catalog = catalogMap.get(id);
            const status = statusMap.get(id);
            return {
                name: id,
                displayName: catalog?.name ?? id,
                model: 'gemini-flash',
                status: (status?.['enabled'] === false) ? 'idle' : 'active',
                callsToday: status?.['callsToday'] ?? 0,
                tokensToday: status?.['tokensToday'] ?? 0,
                avgLatencyMs: status?.['avgLatencyMs'] ?? 0,
                enabled: status?.['enabled'] !== false,
                icon: catalog?.icon ?? '🤖',
                category: catalog?.category ?? 'core',
                skills: catalog?.skills?.length ?? 0,
            };
        });
        res.json({ success: true, data: agents });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/agents/logs  — recent agent execution logs
router.get('/logs', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const limit = Math.min(parseInt(req.query['limit'] ?? '20', 10), 100);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection('agentLogs')
            .where('companyId', '==', companyId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/agents/:agentId/stats
router.get('/:agentId/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('agentLogs')
        .where('companyId', '==', companyId)
        .where('agentId', '==', req.params.agentId)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
    const logs = snap.docs.map(d => d.data());
    const successCount = logs.filter(l => l['status'] === 'success').length;
    const totalTokens = logs.reduce((sum, l) => sum + (l['tokens'] ?? 0), 0);
    const avgDuration = logs.length
        ? logs.reduce((sum, l) => sum + (l['durationMs'] ?? 0), 0) / logs.length
        : 0;
    res.json({
        success: true,
        data: {
            agentId: req.params.agentId,
            totalRuns: logs.length,
            successRate: logs.length ? Math.round((successCount / logs.length) * 100) : 100,
            totalTokens,
            avgDurationMs: Math.round(avgDuration),
        },
    });
}));
// POST /api/agents/:agentId/toggle  — enable or disable an agent
router.post('/:agentId/toggle', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { enabled } = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('agentStatus').doc(`${companyId}_${req.params.agentId}`).set({ companyId, agentId: req.params.agentId, enabled, updatedAt: new Date() }, { merge: true });
    res.json({ success: true, data: { agentId: req.params.agentId, enabled } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR INTELLIGENCE — Health + Traces
// ═══════════════════════════════════════════════════════════════════════════════
const orchestratorIntelligence_1 = require("../services/ai/orchestratorIntelligence");
// GET /api/agents/health — agent health monitoring (latency, failures, circuit breaker)
router.get('/health', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({ success: true, data: (0, orchestratorIntelligence_1.getAllAgentHealth)() });
}));
// GET /api/agents/traces — recent orchestrator execution traces
router.get('/traces', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const traces = (0, orchestratorIntelligence_1.getRecentTraces)().map(t => ({
        id: t.id, timestamp: t.timestamp, message: t.message.slice(0, 100),
        intent: { agent: t.intent.primaryAgent, confidence: t.intent.confidence, category: t.intent.category, isMultiAgent: t.intent.isMultiAgent },
        totalLatencyMs: t.totalLatencyMs, agentsUsed: t.agentsUsed, toolsCalled: t.toolsCalled,
        steps: t.steps.length, errors: t.steps.filter(s => !s.success).length,
    }));
    res.json({ success: true, data: traces });
}));
// GET /api/agents/traces/:id — full trace detail
router.get('/traces/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const trace = (0, orchestratorIntelligence_1.getRecentTraces)().find(t => t.id === req.params.id);
    if (!trace)
        throw new error_middleware_1.AppError('Trace not found', 404);
    res.json({ success: true, data: trace });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// AGENT INTELLIGENCE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
// Agent priorities
router.get('/priorities', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({ success: true, data: (0, orchestratorIntelligence_1.getAllAgentPriorities)() });
}));
// Recent conflict resolutions
router.get('/conflicts', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({ success: true, data: (0, orchestratorIntelligence_1.getRecentConflicts)() });
}));
// Feedback stats (success rate, latency, confidence per agent)
router.get('/feedback', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({ success: true, data: (0, orchestratorIntelligence_1.getAgentFeedbackStats)() });
}));
// Full intelligence dashboard (combined)
router.get('/intelligence', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({ success: true, data: {
            health: (0, orchestratorIntelligence_1.getAllAgentHealth)(),
            priorities: (0, orchestratorIntelligence_1.getAllAgentPriorities)(),
            conflicts: (0, orchestratorIntelligence_1.getRecentConflicts)(),
            feedback: (0, orchestratorIntelligence_1.getAgentFeedbackStats)(),
            traces: (0, orchestratorIntelligence_1.getRecentTraces)().slice(0, 20).map(t => ({
                id: t.id, timestamp: t.timestamp, message: t.message.slice(0, 80),
                intent: t.intent.primaryAgent, confidence: t.intent.confidence,
                latency: t.totalLatencyMs, agents: t.agentsUsed.length, errors: t.steps.filter(s => !s.success).length,
            })),
        } });
}));
exports.default = router;
//# sourceMappingURL=agents.routes.js.map