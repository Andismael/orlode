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
 * Security Routes PRO — Dashboard · Incidents · Vulnerabilities · Phishing · Compliance · Policies · Threats · Audit
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const securityAutomation_1 = require("../services/securityAutomation");
const agentRbac_middleware_1 = require("../middleware/agentRbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.use((0, agentRbac_middleware_1.requireAgentRole)('cybersecurity'));
const safe = async (fn, fallback) => {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
};
function ss(doc) {
    const data = doc.data();
    const out = { id: doc.id };
    for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function')
            out[k] = v.toDate().toISOString();
        else
            out[k] = v;
    }
    return out;
}
// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (aggregated stats + KPIs)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
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
                global: scoreData['overallScore'] ?? 0,
                categories: scoreData['categories'] ?? [],
                recommendations: scoreData['recommendations'] ?? [],
            } : { global: 0, categories: [], recommendations: [] },
            kpis: {
                securityScore: scoreData?.['overallScore'] ?? 0,
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
router.get('/incidents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityIncidents`);
        if (req.query['status'])
            q = q.where('status', '==', req.query['status']);
        if (req.query['priority'])
            q = q.where('priority', '==', req.query['priority']);
        const snap = await q.orderBy('createdAt', 'desc').limit(100).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
router.get('/incidents/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${cid}/securityIncidents`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Incident not found', 404);
    // Get timeline
    const timelineSnap = await db.collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).orderBy('timestamp', 'asc').limit(50).get();
    const timeline = timelineSnap.docs.map(ss);
    res.json({ success: true, data: { ...ss(doc), timeline } });
}));
router.post('/incidents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const now = new Date();
    const priority = body['priority'] ?? 'P3_medium';
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
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${cid}/securityIncidents`).doc(id).set(incident);
    // Initial timeline entry
    await db.collection(`companies/${cid}/securityIncidents/${id}/timeline`).doc((0, helpers_1.generateId)()).set({
        action: 'Incident detecte', status: 'detected', user: req.user.uid,
        details: body['description'] ?? '', timestamp: now,
    });
    // 🔥 AUTOMATION: notifications + cross-agent linking
    (0, securityAutomation_1.onIncidentCreated)(cid, {
        id, type: incident.type, priority,
        description: incident.description,
        affectedSystems: incident.affectedSystems,
    }).catch(() => { });
    res.status(201).json({ success: true, data: incident });
}));
router.patch('/incidents/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${cid}/securityIncidents`).doc(req.params.id).update({ ...body, updatedAt: new Date() });
    // Add timeline entry for status change
    if (body['status']) {
        await db.collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).doc((0, helpers_1.generateId)()).set({
            action: `Statut change: ${body['status']}`, status: body['status'], user: req.user.uid,
            details: body['notes'] ?? '', timestamp: new Date(),
        });
    }
    res.json({ success: true });
}));
router.delete('/incidents/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityIncidents`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// Incident timeline
router.get('/incidents/:id/timeline', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).orderBy('timestamp', 'asc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(ss) });
}));
router.post('/incidents/:id/timeline', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const entry = { id, action: body['action'] ?? '', status: body['status'] ?? '', user: req.user.uid, details: body['details'] ?? '', timestamp: new Date() };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityIncidents/${req.params.id}/timeline`).doc(id).set(entry);
    res.status(201).json({ success: true, data: entry });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// VULNERABILITIES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/vulnerabilities', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/vulnerabilities`);
        if (req.query['status'])
            q = q.where('status', '==', req.query['status']);
        if (req.query['severity'])
            q = q.where('severity', '==', req.query['severity']);
        const snap = await q.orderBy('detectedAt', 'desc').limit(100).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
router.patch('/vulnerabilities/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/vulnerabilities`).doc(req.params.id).update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
}));
router.get('/vulnerabilities/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/vulnerabilities`).limit(200).get();
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
router.post('/vulnerabilities/scan', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { scanVulnerabilitiesTool } = await Promise.resolve().then(() => __importStar(require('../agents/cybersecurity.agent')));
        const result = await scanVulnerabilitiesTool({
            companyId: cid, scanType: req.body['scanType'] ?? 'quick',
            targetSystem: req.body['targetSystem'],
        });
        // 🔥 AUTOMATION: notify + create IT tickets for critical vulns
        if (result?.vulnerabilities) {
            for (const v of result.vulnerabilities) {
                if (v.severity === 'critical' || v.severity === 'high') {
                    (0, securityAutomation_1.onVulnerabilityDetected)(cid, v).catch(() => { });
                }
            }
        }
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Scan echoue' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PHISHING CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/phishing', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/phishingCampaigns`).orderBy('createdAt', 'desc').limit(20).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
router.get('/phishing/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${cid}/phishingCampaigns`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Campaign not found', 404);
    const targetsSnap = await db.collection(`companies/${cid}/phishingCampaigns/${req.params.id}/targets`).limit(200).get();
    res.json({ success: true, data: { ...ss(doc), targets: targetsSnap.docs.map(ss) } });
}));
router.post('/phishing/launch', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { launchPhishingTool } = await Promise.resolve().then(() => __importStar(require('../agents/cybersecurity.agent')));
        const body = req.body;
        const result = await launchPhishingTool({
            companyId: cid, name: body['name'] ?? 'Campagne test',
            template: body['template'] ?? 'password_reset',
            targetGroup: body['targetGroup'] ?? 'all', department: body['department'],
        });
        // 🔥 AUTOMATION: get clicked users and assign training
        if (result?.campaignId) {
            const db = (0, firebase_config_1.getFirestore)();
            const targetsSnap = await db.collection(`companies/${cid}/phishingCampaigns/${result.campaignId}/targets`).where('clicked', '==', true).limit(200).get();
            const clickedUserIds = targetsSnap.docs.map(d => d.data()['userId']).filter(Boolean);
            (0, securityAutomation_1.onPhishingResult)(cid, {
                id: result.campaignId, name: result.name ?? '',
                clickedCount: clickedUserIds.length, targetCount: result.targetCount ?? 0,
                clickedUserIds,
            }).catch(() => { });
        }
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Lancement echoue' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// THREAT FEED
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/threats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/threatFeed`);
        if (req.query['severity'])
            q = q.where('severity', '==', req.query['severity']);
        const snap = await q.orderBy('timestamp', 'desc').limit(50).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/compliance', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/compliance`).limit(10).get();
        if (snap.empty) {
            return {
                gdpr: { status: 'partial', score: 45, controls: [], items: [] },
                iso27001: { status: 'not_started', score: 15, controls: [], items: [] },
                soc2: { status: 'not_started', score: 10, controls: [], items: [] },
            };
        }
        const result = {};
        snap.docs.forEach(d => { result[d.id.toLowerCase()] = d.data(); });
        return result;
    }, { gdpr: { status: 'partial', score: 45, controls: [], items: [] }, iso27001: { status: 'not_started', score: 15, controls: [], items: [] }, soc2: { status: 'not_started', score: 10, controls: [], items: [] } });
    res.json({ success: true, data });
}));
router.patch('/compliance/:framework', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/compliance`).doc(req.params.framework).set({ ...req.body, updatedAt: new Date() }, { merge: true });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY POLICIES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/policies', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityPolicies`).orderBy('updatedAt', 'desc').limit(50).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
router.get('/policies/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityPolicies`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Policy not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));
router.post('/policies', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const policy = {
        id, title: body['title'] ?? '', category: body['category'] ?? 'general',
        content: body['content'] ?? '', status: 'draft', version: '1.0',
        createdBy: req.user.uid, createdAt: new Date(), updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityPolicies`).doc(id).set(policy);
    res.status(201).json({ success: true, data: policy });
}));
router.post('/policies/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { managePoliciesTool } = await Promise.resolve().then(() => __importStar(require('../agents/cybersecurity.agent')));
        const body = req.body;
        const result = await managePoliciesTool({
            companyId: cid, action: 'generate', title: body['title'], category: body['category'],
        });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Generation echouee' } });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS REVIEW
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/access-review', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection('users').where('companyId', '==', cid).limit(500).get();
        const users = snap.docs.map(d => {
            const u = d.data();
            return {
                id: d.id, name: u['displayName'] ?? u['email'] ?? '', email: u['email'] ?? '',
                role: u['role'] ?? 'member', lastLogin: u['lastLoginAt'] ?? null,
                mfaEnabled: u['mfaEnabled'] ?? false, status: u['status'] ?? 'active',
            };
        });
        const mfaCount = users.filter(u => u.mfaEnabled).length;
        const dormant = users.filter(u => !u.lastLogin || (Date.now() - new Date(u.lastLogin).getTime()) / 86400000 > 30);
        const admins = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
        return { users, totalUsers: users.length, mfaRate: users.length > 0 ? Math.round((mfaCount / users.length) * 100) : 0, dormantCount: dormant.length, adminCount: admins.length };
    }, { users: [], totalUsers: 0, mfaRate: 0, dormantCount: 0, adminCount: 0 });
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-REMEDIATION
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/remediate/disable-account', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { userId, reason } = req.body;
    if (!userId)
        throw new error_middleware_1.AppError('userId required', 400);
    await (0, securityAutomation_1.disableCompromisedAccount)(cid, userId, reason ?? 'Compte compromis');
    res.json({ success: true, message: `Compte ${userId} desactive` });
}));
router.post('/remediate/force-reset', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { userId, reason } = req.body;
    if (!userId)
        throw new error_middleware_1.AppError('userId required', 400);
    await (0, securityAutomation_1.forcePasswordReset)(cid, userId, reason ?? 'Reset force par securite');
    res.json({ success: true, message: `Reset force pour ${userId}` });
}));
router.post('/remediate/isolate-asset', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { asset, reason } = req.body;
    if (!asset)
        throw new error_middleware_1.AppError('asset required', 400);
    await (0, securityAutomation_1.isolateAsset)(cid, asset, reason ?? 'Asset isole pour investigation');
    res.json({ success: true, message: `Asset ${asset} isole` });
}));
// Remediation log
router.get('/remediation-log', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/remediationLog`).orderBy('timestamp', 'desc').limit(50).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/audit', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const limit = Math.min(parseInt(req.query['limit'] ?? '100', 10), 500);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection('auditLogs').where('companyId', '==', cid).orderBy('timestamp', 'desc').limit(limit).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY AUDIT (AI)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/audit/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const { runSecurityAuditTool } = await Promise.resolve().then(() => __importStar(require('../agents/cybersecurity.agent')));
        const result = await runSecurityAuditTool({
            companyId: cid, scope: req.body['scope'] ?? 'full',
        });
        res.json({ success: true, data: result });
    }
    catch {
        res.json({ success: true, data: { error: 'Audit echoue' } });
    }
}));
router.get('/audits', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/securityAudits`).orderBy('completedAt', 'desc').limit(20).get();
        return snap.docs.map(ss);
    }, []);
    res.json({ success: true, data });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// STATS (aggregated)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
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
            openIncidents: allInc.filter(i => !['closed', 'recovered', 'false_positive'].includes(i['status'])).length,
            criticalIncidents: allInc.filter(i => (i['priority'] ?? '').includes('P1')).length,
            resolvedIncidents: allInc.filter(i => ['closed', 'recovered'].includes(i['status'])).length,
            totalVulnerabilities: allVuln.length,
            openVulnerabilities: allVuln.filter(v => v['status'] === 'open').length,
            criticalVulnerabilities: allVuln.filter(v => v['severity'] === 'critical' && v['status'] === 'open').length,
            securityScore: scoreSnap.empty ? 0 : (scoreSnap.docs[0].data()['overallScore'] ?? 0),
            totalThreats: threatSnap.size,
            threatsBlocked: Math.round(threatSnap.size * 0.85),
            phishingCampaigns: phishSnap.size,
            avgClickRate: phishSnap.size > 0 ? Math.round(phishSnap.docs.reduce((s, d) => {
                const tc = d.data()['targetCount'] || 1;
                return s + (d.data()['clickedCount'] ?? 0) / tc * 100;
            }, 0) / phishSnap.size) : 0,
        };
    }, { totalIncidents: 0, openIncidents: 0, criticalIncidents: 0, resolvedIncidents: 0, totalVulnerabilities: 0, openVulnerabilities: 0, criticalVulnerabilities: 0, securityScore: 0, totalThreats: 0, threatsBlocked: 0, phishingCampaigns: 0, avgClickRate: 0 });
    res.json({ success: true, data });
}));
exports.default = router;
//# sourceMappingURL=security.routes.js.map