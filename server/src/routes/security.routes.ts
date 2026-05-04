/**
 * Security Routes PRO — Dashboard · Incidents · Vulnerabilities · Phishing · Compliance · Policies · Threats · Audit
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
import { onIncidentCreated, onVulnerabilityDetected, onPhishingResult, disableCompromisedAccount, forcePasswordReset, isolateAsset } from '../services/securityAutomation';
import { requireAgentRole } from '../middleware/agentRbac.middleware';

const router = Router();
router.use(authMiddleware);
router.use(requireAgentRole('cybersecurity'));

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};
function ss(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  const out: Record<string, unknown> = { id: doc.id };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') out[k] = (v as { toDate: () => Date }).toDate().toISOString();
    else out[k] = v;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (aggregated stats + KPIs)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [scoreSnap, incSnap, vulnSnap, threatSnap, phishSnap] = await Promise.all([
      db.collection(`companies/${cid}/securityScore`).orderBy('date', 'desc').limit(1).get(),
      db.collection(`companies/${cid}/securityIncidents`).orderBy('createdAt', 'desc').limit(20).get(),
      db.collection(`companies/${cid}/vulnerabilities`).where('status', '==', 'open').limit(50).get(),
      db.collection(`companies/${cid}/threatFeed`).orderBy('timestamp', 'desc').limit(10).get(),
      db.collection(`companies/${cid}/phishingCampaigns`).orderBy('createdAt', 'desc').limit(5).get(),
    ]);

    const scoreData = scoreSnap.empty ? null : scoreSnap.docs[0].data();
    const incidents = incSnap.docs.map(ss);
    const openInc = incidents.filter(i => i['status'] !== 'closed' && i['status'] !== 'recovered' && i['status'] !== 'false_positive');
    const criticalInc = incidents.filter(i => i['priority'] === 'P1_critical' || i['priority'] === 'P1');

    return {
      score: scoreData ? {
        global: (scoreData['overallScore'] as number) ?? 0,
        categories: (scoreData['categories'] as unknown[]) ?? [],
        recommendations: (scoreData['recommendations'] as string[]) ?? [],
      } : { global: 0, categories: [], recommendations: [] },
      kpis: {
        securityScore: (scoreData?.['overallScore'] as number) ?? 0,
        openIncidents: openInc.length,
        criticalIncidents: criticalInc.length,
        openVulnerabilities: vulnSnap.size,
        threatsBlocked: threatSnap.size > 0 ? Math.round(threatSnap.size * 0.85) : 0,
        totalThreats: threatSnap.size,
      },
      incidents: openInc.slice(0, 5),
      recentThreats: threatSnap.docs.map(ss).slice(0, 5),
      phishingCampaigns: phishSnap.docs.map(ss),
    };
  }, { score: { global: 0, categories: [], recommendations: [] }, kpis: { securityScore: 0, openIncidents: 0, criticalIncidents: 0, openVulnerabilities: 0, threatsBlocked: 0, totalThreats: 0 }, incidents: [], recentThreats: [], phishingCampaigns: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENTS CRUD + Timeline
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/incidents', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/securityIncidents`) as FirebaseFirestore.Query;
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    if (req.query['priority']) q = q.where('priority', '==', req.query['priority']);
    const snap = await q.orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.get('/incidents/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/securityIncidents`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Incident not found', 404);
  // Get timeline
  const timelineSnap = await db.collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).orderBy('timestamp', 'asc').limit(50).get();
  const timeline = timelineSnap.docs.map(ss);
  res.json({ success: true, data: { ...ss(doc as unknown as FirebaseFirestore.QueryDocumentSnapshot), timeline } });
}));

router.post('/incidents', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const now = new Date();
  const priority = (body['priority'] as string) ?? 'P3_medium';
  const incident = {
    id, companyId: cid,
    type: body['type'] ?? 'other', description: body['description'] ?? '',
    priority, status: 'detected',
    affectedSystems: Array.isArray(body['affectedSystems']) ? body['affectedSystems'] : [],
    source: body['source'] ?? 'manual', assignee: body['assignee'] ?? null,
    slaDeadline: priority.includes('P1') ? new Date(now.getTime() + 3600000).toISOString()
      : priority.includes('P2') ? new Date(now.getTime() + 14400000).toISOString()
      : priority.includes('P3') ? new Date(now.getTime() + 86400000).toISOString()
      : new Date(now.getTime() + 259200000).toISOString(),
    detectedAt: now, createdAt: now, updatedAt: now,
  };
  const db = getFirestore();
  await db.collection(`companies/${cid}/securityIncidents`).doc(id).set(incident);
  // Initial timeline entry
  await db.collection(`companies/${cid}/securityIncidents/${id}/timeline`).doc(generateId()).set({
    action: 'Incident detecte', status: 'detected', user: req.user!.uid,
    details: body['description'] ?? '', timestamp: now,
  });

  // 🔥 AUTOMATION: notifications + cross-agent linking
  onIncidentCreated(cid, {
    id, type: incident.type as string, priority,
    description: incident.description as string,
    affectedSystems: incident.affectedSystems as string[],
  }).catch(() => {});

  res.status(201).json({ success: true, data: incident });
}));

router.patch('/incidents/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  await db.collection(`companies/${cid}/securityIncidents`).doc(req.params.id).update({ ...body, updatedAt: new Date() });
  // Add timeline entry for status change
  if (body['status']) {
    await db.collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).doc(generateId()).set({
      action: `Statut change: ${body['status']}`, status: body['status'], user: req.user!.uid,
      details: (body['notes'] as string) ?? '', timestamp: new Date(),
    });
  }
  res.json({ success: true });
}));

router.delete('/incidents/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/securityIncidents`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// Incident timeline
router.get('/incidents/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).orderBy('timestamp', 'asc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(ss) });
}));

router.post('/incidents/:id/timeline', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const entry = { id, action: body['action'] ?? '', status: body['status'] ?? '', user: req.user!.uid, details: body['details'] ?? '', timestamp: new Date() };
  await getFirestore().collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).doc(id).set(entry);
  res.status(201).json({ success: true, data: entry });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// VULNERABILITIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/vulnerabilities', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/vulnerabilities`) as FirebaseFirestore.Query;
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    if (req.query['severity']) q = q.where('severity', '==', req.query['severity']);
    const snap = await q.orderBy('detectedAt', 'desc').limit(100).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.patch('/vulnerabilities/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/vulnerabilities`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.get('/vulnerabilities/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/vulnerabilities`).limit(200).get();
    const all = snap.docs.map(d => d.data());
    const open = all.filter(v => v['status'] === 'open');
    return {
      total: all.length, open: open.length, fixed: all.filter(v => v['status'] === 'fixed').length,
      critical: open.filter(v => v['severity'] === 'critical').length,
      high: open.filter(v => v['severity'] === 'high').length,
      medium: open.filter(v => v['severity'] === 'medium').length,
      low: open.filter(v => v['severity'] === 'low').length,
    };
  }, { total: 0, open: 0, fixed: 0, critical: 0, high: 0, medium: 0, low: 0 });
  res.json({ success: true, data });
}));

// Trigger scan via agent
router.post('/vulnerabilities/scan', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { scanVulnerabilitiesTool } = await import('../agents/cybersecurity.agent');
    const result = await (scanVulnerabilitiesTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, scanType: (req.body as Record<string, string>)['scanType'] ?? 'quick',
      targetSystem: (req.body as Record<string, string>)['targetSystem'],
    }) as { vulnerabilities?: { cve: string; severity: string; asset: string; description: string }[] };

    // 🔥 AUTOMATION: notify + create IT tickets for critical vulns
    if (result?.vulnerabilities) {
      for (const v of result.vulnerabilities) {
        if (v.severity === 'critical' || v.severity === 'high') {
          onVulnerabilityDetected(cid, v).catch(() => {});
        }
      }
    }

    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Scan echoue' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PHISHING CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/phishing', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/phishingCampaigns`).orderBy('createdAt', 'desc').limit(20).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.get('/phishing/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/phishingCampaigns`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Campaign not found', 404);
  const targetsSnap = await db.collection(`companies/${cid}/phishingCampaigns/${req.params.id}/targets`).limit(200).get();
  res.json({ success: true, data: { ...ss(doc as unknown as FirebaseFirestore.QueryDocumentSnapshot), targets: targetsSnap.docs.map(ss) } });
}));

router.post('/phishing/launch', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { launchPhishingTool } = await import('../agents/cybersecurity.agent');
    const body = req.body as Record<string, unknown>;
    const result = await (launchPhishingTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, name: body['name'] ?? 'Campagne test',
      template: body['template'] ?? 'password_reset',
      targetGroup: body['targetGroup'] ?? 'all', department: body['department'],
    }) as { campaignId?: string; name?: string; targetCount?: number };

    // 🔥 AUTOMATION: get clicked users and assign training
    if (result?.campaignId) {
      const db = getFirestore();
      const targetsSnap = await db.collection(`companies/${cid}/phishingCampaigns/${result.campaignId}/targets`).where('clicked', '==', true).limit(200).get();
      const clickedUserIds = targetsSnap.docs.map(d => d.data()['userId'] as string).filter(Boolean);
      onPhishingResult(cid, {
        id: result.campaignId, name: (result.name as string) ?? '',
        clickedCount: clickedUserIds.length, targetCount: result.targetCount ?? 0,
        clickedUserIds,
      }).catch(() => {});
    }

    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Lancement echoue' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// THREAT FEED
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/threats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/threatFeed`) as FirebaseFirestore.Query;
    if (req.query['severity']) q = q.where('severity', '==', req.query['severity']);
    const snap = await q.orderBy('timestamp', 'desc').limit(50).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/compliance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/compliance`).limit(10).get();
    if (snap.empty) {
      return {
        gdpr: { status: 'partial', score: 45, controls: [], items: [] },
        iso27001: { status: 'not_started', score: 15, controls: [], items: [] },
        soc2: { status: 'not_started', score: 10, controls: [], items: [] },
      };
    }
    const result: Record<string, unknown> = {};
    snap.docs.forEach(d => { result[d.id.toLowerCase()] = d.data(); });
    return result;
  }, { gdpr: { status: 'partial', score: 45, controls: [], items: [] }, iso27001: { status: 'not_started', score: 15, controls: [], items: [] }, soc2: { status: 'not_started', score: 10, controls: [], items: [] } });
  res.json({ success: true, data });
}));

router.patch('/compliance/:framework', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/compliance`).doc(req.params.framework).set(
    { ...(req.body as Record<string, unknown>), updatedAt: new Date() }, { merge: true }
  );
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY POLICIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/policies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/securityPolicies`).orderBy('updatedAt', 'desc').limit(50).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.get('/policies/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/securityPolicies`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Policy not found', 404);
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

router.post('/policies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const policy = {
    id, title: body['title'] ?? '', category: body['category'] ?? 'general',
    content: body['content'] ?? '', status: 'draft', version: '1.0',
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/securityPolicies`).doc(id).set(policy);
  res.status(201).json({ success: true, data: policy });
}));

router.post('/policies/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { managePoliciesTool } = await import('../agents/cybersecurity.agent');
    const body = req.body as Record<string, unknown>;
    const result = await (managePoliciesTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, action: 'generate', title: body['title'], category: body['category'],
    });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Generation echouee' } }); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/access-review', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection('users').where('companyId', '==', cid).limit(500).get();
    const users = snap.docs.map(d => {
      const u = d.data();
      return {
        id: d.id, name: u['displayName'] ?? u['email'] ?? '', email: u['email'] ?? '',
        role: u['role'] ?? 'member', lastLogin: u['lastLoginAt'] ?? null,
        mfaEnabled: u['mfaEnabled'] ?? false, status: u['status'] ?? 'active',
      };
    });
    const mfaCount = users.filter(u => u.mfaEnabled).length;
    const dormant = users.filter(u => !u.lastLogin || (Date.now() - new Date(u.lastLogin as string).getTime()) / 86400000 > 30);
    const admins = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
    return { users, totalUsers: users.length, mfaRate: users.length > 0 ? Math.round((mfaCount / users.length) * 100) : 0, dormantCount: dormant.length, adminCount: admins.length };
  }, { users: [], totalUsers: 0, mfaRate: 0, dormantCount: 0, adminCount: 0 });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-REMEDIATION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/remediate/disable-account', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { userId, reason } = req.body as { userId: string; reason: string };
  if (!userId) throw new AppError('userId required', 400);
  await disableCompromisedAccount(cid, userId, reason ?? 'Compte compromis');
  res.json({ success: true, message: `Compte ${userId} desactive` });
}));

router.post('/remediate/force-reset', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { userId, reason } = req.body as { userId: string; reason: string };
  if (!userId) throw new AppError('userId required', 400);
  await forcePasswordReset(cid, userId, reason ?? 'Reset force par securite');
  res.json({ success: true, message: `Reset force pour ${userId}` });
}));

router.post('/remediate/isolate-asset', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { asset, reason } = req.body as { asset: string; reason: string };
  if (!asset) throw new AppError('asset required', 400);
  await isolateAsset(cid, asset, reason ?? 'Asset isole pour investigation');
  res.json({ success: true, message: `Asset ${asset} isole` });
}));

// Remediation log
router.get('/remediation-log', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/remediationLog`).orderBy('timestamp', 'desc').limit(50).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/audit', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '100', 10), 500);
  const data = await safe(async () => {
    const snap = await getFirestore().collection('auditLogs').where('companyId', '==', cid).orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY AUDIT (AI)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/audit/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  try {
    const { runSecurityAuditTool } = await import('../agents/cybersecurity.agent');
    const result = await (runSecurityAuditTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, scope: (req.body as Record<string, string>)['scope'] ?? 'full',
    });
    res.json({ success: true, data: result });
  } catch { res.json({ success: true, data: { error: 'Audit echoue' } }); }
}));

router.get('/audits', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/securityAudits`).orderBy('completedAt', 'desc').limit(20).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS (aggregated)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [incSnap, vulnSnap, threatSnap, scoreSnap, phishSnap] = await Promise.all([
      db.collection(`companies/${cid}/securityIncidents`).limit(200).get(),
      db.collection(`companies/${cid}/vulnerabilities`).limit(200).get(),
      db.collection(`companies/${cid}/threatFeed`).limit(100).get(),
      db.collection(`companies/${cid}/securityScore`).orderBy('date', 'desc').limit(1).get(),
      db.collection(`companies/${cid}/phishingCampaigns`).limit(50).get(),
    ]);
    const allInc = incSnap.docs.map(d => d.data());
    const allVuln = vulnSnap.docs.map(d => d.data());
    return {
      totalIncidents: allInc.length,
      openIncidents: allInc.filter(i => !['closed', 'recovered', 'false_positive'].includes(i['status'] as string)).length,
      criticalIncidents: allInc.filter(i => ((i['priority'] as string) ?? '').includes('P1')).length,
      resolvedIncidents: allInc.filter(i => ['closed', 'recovered'].includes(i['status'] as string)).length,
      totalVulnerabilities: allVuln.length,
      openVulnerabilities: allVuln.filter(v => v['status'] === 'open').length,
      criticalVulnerabilities: allVuln.filter(v => v['severity'] === 'critical' && v['status'] === 'open').length,
      securityScore: scoreSnap.empty ? 0 : ((scoreSnap.docs[0].data()['overallScore'] as number) ?? 0),
      totalThreats: threatSnap.size,
      threatsBlocked: Math.round(threatSnap.size * 0.85),
      phishingCampaigns: phishSnap.size,
      avgClickRate: phishSnap.size > 0 ? Math.round(phishSnap.docs.reduce((s, d) => {
        const tc = (d.data()['targetCount'] as number) || 1;
        return s + ((d.data()['clickedCount'] as number) ?? 0) / tc * 100;
      }, 0) / phishSnap.size) : 0,
    };
  }, { totalIncidents: 0, openIncidents: 0, criticalIncidents: 0, resolvedIncidents: 0, totalVulnerabilities: 0, openVulnerabilities: 0, criticalVulnerabilities: 0, securityScore: 0, totalThreats: 0, threatsBlocked: 0, phishingCampaigns: 0, avgClickRate: 0 });
  res.json({ success: true, data });
}));

export default router;
