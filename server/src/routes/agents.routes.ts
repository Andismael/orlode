/**
 * /api/agents  — agent monitoring & management endpoints
 * Note: distinct from /api/agent (orchestrator/chat routes)
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();
router.use(authMiddleware);

// GET /api/agents/status  — live status of selected agents
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  try {
    const db = getFirestore();

    // Get company's selected agents
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const rawIds = (companyDoc.data()?.['selectedAgents'] as string[]) ?? [];

    // Legacy normalization: qa/documents were merged into knowledge
    const LEGACY_ALIASES: Record<string, string> = { qa: 'knowledge', documents: 'knowledge' };
    const normalized = Array.from(new Set(rawIds.map(id => LEGACY_ALIASES[id] ?? id)));

    // Self-heal: if the stored list had legacy ids, persist the cleaned one
    const changed = normalized.length !== rawIds.length
      || normalized.some((id, i) => id !== rawIds[i]);
    if (changed) {
      await db.collection('companies').doc(companyId).update({ selectedAgents: normalized, updatedAt: new Date() }).catch(() => {});
    }

    // Core agents are always-on for every tenant — surface them in the agent
    // monitor / picker even if the company hasn't explicitly selected them.
    const ALWAYS_ON_CORE = ['orchestrator', 'knowledge', 'wildcard', 'kora'];
    const selectedAgentIds = Array.from(new Set([...normalized, ...ALWAYS_ON_CORE]));

    // Get agent catalog for display names
    const { AGENT_CATALOG } = await import('../config/agentCatalog');
    const catalogMap = new Map(AGENT_CATALOG.map(a => [a.id, a]));

    // Get any existing status/logs data
    const statusSnap = await db.collection('agentStatus').where('companyId', '==', companyId).get();
    const statusMap = new Map(statusSnap.docs.map(d => [d.data()['agentId'] as string, d.data()]));

    // Build status for each selected agent
    const agents = selectedAgentIds.map(id => {
      const catalog = catalogMap.get(id);
      const status = statusMap.get(id);
      return {
        name: id,
        displayName: catalog?.name ?? id,
        model: 'gemini-flash',
        status: (status?.['enabled'] === false) ? 'idle' : 'active',
        callsToday: (status?.['callsToday'] as number) ?? 0,
        tokensToday: (status?.['tokensToday'] as number) ?? 0,
        avgLatencyMs: (status?.['avgLatencyMs'] as number) ?? 0,
        enabled: status?.['enabled'] !== false,
        icon: catalog?.icon ?? '🤖',
        category: catalog?.category ?? 'core',
        skills: catalog?.skills?.length ?? 0,
      };
    });

    res.json({ success: true, data: agents });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// GET /api/agents/logs  — recent agent execution logs
router.get('/logs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '20', 10), 100);

  try {
    const db = getFirestore();
    const snap = await db.collection('agentLogs')
      .where('companyId', '==', companyId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// GET /api/agents/:agentId/stats
router.get('/:agentId/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const snap = await db.collection('agentLogs')
    .where('companyId', '==', companyId)
    .where('agentId', '==', req.params.agentId)
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  const logs = snap.docs.map(d => d.data());
  const successCount = logs.filter(l => l['status'] === 'success').length;
  const totalTokens = logs.reduce((sum, l) => sum + ((l['tokens'] as number) ?? 0), 0);
  const avgDuration = logs.length
    ? logs.reduce((sum, l) => sum + ((l['durationMs'] as number) ?? 0), 0) / logs.length
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
router.post('/:agentId/toggle', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { enabled } = req.body as { enabled: boolean };
  const db = getFirestore();
  await db.collection('agentStatus').doc(`${companyId}_${req.params.agentId}`).set(
    { companyId, agentId: req.params.agentId, enabled, updatedAt: new Date() },
    { merge: true }
  );

  res.json({ success: true, data: { agentId: req.params.agentId, enabled } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR INTELLIGENCE — Health + Traces
// ═══════════════════════════════════════════════════════════════════════════════

import { getAllAgentHealth, getRecentTraces, getAllAgentPriorities, getRecentConflicts, getAgentFeedbackStats } from '../services/ai/orchestratorIntelligence';

// GET /api/agents/health — agent health monitoring (latency, failures, circuit breaker)
router.get('/health', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: getAllAgentHealth() });
}));

// GET /api/agents/traces — recent orchestrator execution traces
router.get('/traces', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const traces = getRecentTraces().map(t => ({
    id: t.id, timestamp: t.timestamp, message: t.message.slice(0, 100),
    intent: { agent: t.intent.primaryAgent, confidence: t.intent.confidence, category: t.intent.category, isMultiAgent: t.intent.isMultiAgent },
    totalLatencyMs: t.totalLatencyMs, agentsUsed: t.agentsUsed, toolsCalled: t.toolsCalled,
    steps: t.steps.length, errors: t.steps.filter(s => !s.success).length,
  }));
  res.json({ success: true, data: traces });
}));

// GET /api/agents/traces/:id — full trace detail
router.get('/traces/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const trace = getRecentTraces().find(t => t.id === req.params.id);
  if (!trace) throw new AppError('Trace not found', 404);
  res.json({ success: true, data: trace });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT INTELLIGENCE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// Agent priorities
router.get('/priorities', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: getAllAgentPriorities() });
}));

// Recent conflict resolutions
router.get('/conflicts', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: getRecentConflicts() });
}));

// Feedback stats (success rate, latency, confidence per agent)
router.get('/feedback', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: getAgentFeedbackStats() });
}));

// Full intelligence dashboard (combined)
router.get('/intelligence', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: {
    health: getAllAgentHealth(),
    priorities: getAllAgentPriorities(),
    conflicts: getRecentConflicts(),
    feedback: getAgentFeedbackStats(),
    traces: getRecentTraces().slice(0, 20).map(t => ({
      id: t.id, timestamp: t.timestamp, message: t.message.slice(0, 80),
      intent: t.intent.primaryAgent, confidence: t.intent.confidence,
      latency: t.totalLatencyMs, agents: t.agentsUsed.length, errors: t.steps.filter(s => !s.success).length,
    })),
  }});
}));

export default router;
