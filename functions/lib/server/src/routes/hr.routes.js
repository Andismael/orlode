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
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const notificationService_1 = require("../services/notificationService");
const agentRbac_middleware_1 = require("../middleware/agentRbac.middleware");
/** Shorthand: require HR admin (owner, legacy admin, or agentRoles.hr === 'admin') */
const hrAdmin = (0, agentRbac_middleware_1.requireAgentRole)('hr', 'admin');
const router = (0, express_1.Router)();
// ─── PDF DOWNLOADS (public — signed token in URL for browser clicks) ────────
// GET /api/hr/contracts/:id/pdf?t=TOKEN — download contract PDF
// This route is mounted BEFORE authMiddleware so a browser click works without auth header.
// Security: only someone who knows the contract's unique access token can download.
router.get('/contracts/:id/pdf', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const token = req.query['t'] ?? '';
    const db = (0, firebase_config_1.getFirestore)();
    // Find contract by scanning companies — collectionGroup query would need a composite index
    // Since doc ID == contract.id, we just try to fetch directly on each company.
    let contractDoc = null;
    try {
        const companies = await db.collection('companies').select().get();
        for (const c of companies.docs) {
            const doc = await db.collection(`companies/${c.id}/contracts`).doc(id).get();
            if (doc.exists) {
                contractDoc = doc;
                break;
            }
        }
    }
    catch { /* ignore */ }
    if (!contractDoc)
        throw new error_middleware_1.AppError('Contract not found', 404);
    const contract = contractDoc.data() ?? {};
    const companyId = contractDoc.ref.parent.parent.id;
    // Validate access token
    const expectedToken = contract['accessToken'];
    if (!expectedToken || token !== expectedToken) {
        throw new error_middleware_1.AppError('Invalid or missing access token', 403);
    }
    // Load employee data
    const employeeId = contract['employeeId'];
    const [empHR, empUser] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).doc(employeeId).get(),
        db.collection('users').doc(employeeId).get(),
    ]);
    const emp = { ...(empUser.data() ?? {}), ...(empHR.data() ?? {}) };
    const { loadCompany, renderContractPdf } = await Promise.resolve().then(() => __importStar(require('../services/hr/contractPdfService')));
    const company = await loadCompany(companyId);
    const pdfBuffer = await renderContractPdf(company, {
        name: emp['displayName'] ?? 'Employé',
        email: emp['email'],
        phone: emp['phone'],
        jobTitle: contract['jobTitle'],
        department: contract['department'],
        baseSalary: contract['baseSalary'],
        currency: contract['currency'],
        startDate: contract['startDate'],
        contractType: contract['contractType'],
        endDate: contract['endDate'],
        trialPeriodMonths: contract['trialPeriodMonths'],
        workHours: contract['workHours'],
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Contrat-${emp['displayName'] ?? 'employe'}.pdf"`);
    res.send(pdfBuffer);
}));
// ─── Auth required from here on ─────────────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
const safe = async (fn, fallback) => {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
};
async function getUserRole(uid) {
    const doc = await (0, firebase_config_1.getFirestore)().collection('users').doc(uid).get();
    return doc.data()?.['role'];
}
// ─── MY PROFILE ──────────────────────────────────────────────────────────────
// GET /api/hr/me — current user HR profile + leave balance
router.get('/me', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const profile = await safe(async () => {
        const doc = await db.collection('hrProfiles').doc(uid).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }, null);
    // Default leave balance
    const balance = profile?.['leaveBalance'] ?? { annual: 25, sick: 10, rtt: 5, special: 3 };
    // Count used days this year
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const used = await safe(async () => {
        const snap = await db.collection('leaveRequests')
            .where('userId', '==', uid)
            .where('status', '==', 'approved')
            .where('from', '>=', yearStart)
            .limit(100).get();
        const totals = {};
        snap.docs.forEach(d => {
            const data = d.data();
            const type = data['type'] ?? 'annual';
            totals[type] = (totals[type] ?? 0) + (data['days'] ?? 0);
        });
        return totals;
    }, {});
    res.json({
        success: true,
        data: {
            ...profile,
            leaveBalance: balance,
            leaveUsed: used,
            leaveRemaining: {
                annual: (balance['annual'] ?? 25) - (used['annual'] ?? 0),
                sick: (balance['sick'] ?? 10) - (used['sick'] ?? 0),
                rtt: (balance['rtt'] ?? 5) - (used['rtt'] ?? 0),
                special: (balance['special'] ?? 3) - (used['special'] ?? 0),
            },
        },
    });
}));
// ─── LEAVE REQUESTS ──────────────────────────────────────────────────────────
// GET /api/hr/leave/history — my leave requests
router.get('/leave/history', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection('leaveRequests')
            .where('userId', '==', uid)
            .limit(50).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    res.json({ success: true, data });
}));
// GET /api/hr/leave/pending — all pending requests (admin/manager)
router.get('/leave/pending', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const role = req.user?.role ?? (req.user?.uid ? await getUserRole(req.user.uid) : undefined);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin/Manager only', 403);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection('leaveRequests')
            .where('companyId', '==', companyId)
            .where('status', '==', 'pending')
            .limit(100).get();
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Enrich with employee names
        const db = (0, firebase_config_1.getFirestore)();
        for (const req of requests) {
            const userId = req['userId'];
            if (userId) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    req['employeeName'] = userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? '';
                    req['employeeEmail'] = userDoc.data()?.['email'] ?? '';
                }
            }
        }
        return requests;
    }, []);
    res.json({ success: true, data });
}));
// GET /api/hr/leave/all — all company leave requests (admin)
router.get('/leave/all', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        let query = db.collection('leaveRequests').where('companyId', '==', companyId);
        if (req.query['status']) {
            query = query.where('status', '==', req.query['status']);
        }
        const snap = await query.limit(200).get();
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Enrich with employee names
        for (const r of requests) {
            const userId = r['userId'];
            if (userId) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    r['employeeName'] = userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? '';
                }
            }
        }
        return requests;
    }, []);
    res.json({ success: true, data });
}));
// POST /api/hr/leave/request — submit leave request
router.post('/leave/request', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const body = req.body;
    const from = new Date(body['from']);
    const to = new Date(body['to']);
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
    const id = (0, helpers_1.generateId)();
    const request = {
        userId: uid,
        companyId: companyId ?? '',
        employeeName: body['employeeName'] ?? req.user?.['displayName'] ?? '',
        type: body['type'] ?? 'annual',
        from: body['from'],
        to: body['to'],
        days,
        reason: body['reason'] ?? '',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
    };
    // Also write to 'leaves' collection for reception compatibility
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('leaveRequests').doc(id).set(request);
    await safe(async () => {
        await db.collection('leaves').doc(id).set({
            companyId: companyId ?? '',
            employeeId: uid,
            employeeName: request.employeeName,
            type: request.type,
            startDate: body['from'],
            endDate: body['to'],
            reason: request.reason,
            status: 'pending',
            createdAt: new Date(),
            reviewedBy: null,
            reviewedAt: null,
        });
    }, undefined);
    // Notify admins of new leave request
    (0, notificationService_1.notifyLeaveRequested)(companyId ?? '', request.employeeName, request.type, days).catch(() => { });
    res.status(201).json({ success: true, data: { id, ...request } });
}));
// PATCH /api/hr/leave/:id — approve/reject (admin/manager)
router.patch('/leave/:id', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const role = req.user?.role ?? (req.user?.uid ? await getUserRole(req.user.uid) : undefined);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin/Manager only', 403);
    const { status } = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    await safe(async () => {
        await db.collection('leaveRequests').doc(req.params.id).update({
            status,
            updatedAt: new Date(),
            reviewedBy: req.user?.uid,
            reviewedAt: new Date(),
        });
    }, undefined);
    // Also update in 'leaves' collection for reception
    await safe(async () => {
        await db.collection('leaves').doc(req.params.id).update({
            status,
            reviewedBy: req.user?.uid,
            reviewedAt: new Date(),
        });
    }, undefined);
    // Notify the employee
    const leaveDoc = await safe(async () => {
        const d = await db.collection('leaveRequests').doc(req.params.id).get();
        return d.exists ? d.data() : null;
    }, null);
    if (leaveDoc) {
        const companyId = req.user?.companyId ?? '';
        (0, notificationService_1.notifyLeaveReviewed)(companyId, leaveDoc['userId'] ?? '', leaveDoc['employeeName'] ?? '', status).catch(() => { });
    }
    res.json({ success: true });
}));
// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
// GET /api/hr/employees — all employees in company (multi-source: employees + users + members)
router.get('/employees', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const data = await safe(async () => {
        const [empSnap, userSnap, memberSnap] = await Promise.all([
            db.collection(`companies/${companyId}/employees`).limit(500).get().catch(() => null),
            db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null),
            db.collection(`companies/${companyId}/members`).limit(500).get().catch(() => null),
        ]);
        const byEmail = new Map();
        const upsert = (id, d, source) => {
            const email = (d['email'] ?? '').toLowerCase();
            const key = email || `id:${id}`;
            const existing = byEmail.get(key) ?? {};
            byEmail.set(key, {
                id: existing['id'] ?? id,
                name: existing['name'] ?? d['displayName'] ?? d['name'] ?? d['email'] ?? '',
                email: existing['email'] ?? d['email'] ?? '',
                role: existing['role'] ?? d['role'] ?? '',
                department: existing['department'] ?? d['department'] ?? '',
                phone: existing['phone'] ?? d['phone'] ?? '',
                photo: existing['photo'] ?? d['photoURL'] ?? d['photo'] ?? null,
                title: existing['title'] ?? d['jobTitle'] ?? '',
                startDate: existing['startDate'] ?? d['startDate'] ?? null,
                status: existing['status'] ?? d['status'] ?? 'active',
                source: existing['source'] ?? source,
            });
        };
        empSnap?.docs.forEach(d => upsert(d.id, d.data(), 'employees'));
        userSnap?.docs.forEach(d => upsert(d.id, d.data(), 'users'));
        memberSnap?.docs.forEach(d => upsert(d.id, d.data(), 'members'));
        return Array.from(byEmail.values());
    }, []);
    res.json({ success: true, data });
}));
// ─── ONBOARDING ──────────────────────────────────────────────────────────────
// GET /api/hr/onboarding/:userId
router.get('/onboarding/:userId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const callerCompanyId = req.user?.companyId;
    if (!callerCompanyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // Get user name + SECURITY: cross-tenant guard
    const userDoc = await safe(async () => {
        const doc = await db.collection('users').doc(req.params.userId).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        if (data?.['companyId'] !== callerCompanyId)
            return null; // refuse cross-tenant read
        return data;
    }, null);
    if (!userDoc)
        throw new error_middleware_1.AppError('User not found', 404);
    const employeeName = userDoc?.['displayName'] ?? userDoc?.['email'] ?? '';
    // Get onboarding items
    const items = await safe(async () => {
        const doc = await db.collection('hrOnboarding').doc(req.params.userId).get();
        if (doc.exists && doc.data()?.['items'])
            return doc.data()['items'];
        // Default onboarding checklist
        return [
            { id: '1', label: 'Creer un compte email', category: 'IT & Acces', completed: false },
            { id: '2', label: 'Configurer le poste de travail', category: 'IT & Acces', completed: false },
            { id: '3', label: 'Obtenir les badges d\'acces', category: 'IT & Acces', completed: false },
            { id: '4', label: 'Signer le contrat de travail', category: 'Administratif', completed: false },
            { id: '5', label: 'Fournir les documents d\'identite', category: 'Administratif', completed: false },
            { id: '6', label: 'Remplir les informations bancaires', category: 'Administratif', completed: false },
            { id: '7', label: 'Visite des locaux', category: 'Integration', completed: false },
            { id: '8', label: 'Rencontre avec l\'equipe', category: 'Integration', completed: false },
            { id: '9', label: 'Formation outils internes', category: 'Integration', completed: false },
            { id: '10', label: 'Entretien de suivi (1 semaine)', category: 'Suivi', completed: false },
        ];
    }, []);
    res.json({ success: true, data: { employeeName, items } });
}));
// PATCH /api/hr/onboarding/:userId/item/:itemId — toggle item
router.patch('/onboarding/:userId/item/:itemId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const body = req.body;
    // Get current items
    const doc = await db.collection('hrOnboarding').doc(req.params.userId).get();
    let items = [];
    if (doc.exists && doc.data()?.['items']) {
        items = doc.data()['items'];
    }
    else {
        // Create with defaults then update
        items = [
            { id: '1', label: 'Creer un compte email', category: 'IT & Acces', completed: false },
            { id: '2', label: 'Configurer le poste de travail', category: 'IT & Acces', completed: false },
            { id: '3', label: 'Obtenir les badges d\'acces', category: 'IT & Acces', completed: false },
            { id: '4', label: 'Signer le contrat de travail', category: 'Administratif', completed: false },
            { id: '5', label: 'Fournir les documents d\'identite', category: 'Administratif', completed: false },
            { id: '6', label: 'Remplir les informations bancaires', category: 'Administratif', completed: false },
            { id: '7', label: 'Visite des locaux', category: 'Integration', completed: false },
            { id: '8', label: 'Rencontre avec l\'equipe', category: 'Integration', completed: false },
            { id: '9', label: 'Formation outils internes', category: 'Integration', completed: false },
            { id: '10', label: 'Entretien de suivi (1 semaine)', category: 'Suivi', completed: false },
        ];
    }
    // Toggle item
    items = items.map(i => i['id'] === req.params.itemId ? { ...i, completed: body['completed'] ?? !i['completed'] } : i);
    await db.collection('hrOnboarding').doc(req.params.userId).set({ items, updatedAt: new Date() }, { merge: true });
    res.json({ success: true });
}));
// ─── STATS ───────────────────────────────────────────────────────────────────
// GET /api/hr/stats
router.get('/stats', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    let totalEmployees = 0;
    try {
        totalEmployees = (await db.collection('users').where('companyId', '==', companyId).get()).size;
    }
    catch { }
    let pendingLeaves = 0;
    try {
        pendingLeaves = (await db.collection('leaveRequests').where('companyId', '==', companyId).where('status', '==', 'pending').get()).size;
    }
    catch { }
    let approvedLeaves = 0;
    try {
        approvedLeaves = (await db.collection('leaveRequests').where('companyId', '==', companyId).where('status', '==', 'approved').get()).size;
    }
    catch { }
    let departments = [];
    try {
        const snap = await db.collection('users').where('companyId', '==', companyId).limit(500).get();
        departments = [...new Set(snap.docs.map(d => d.data()['department']).filter(Boolean))];
    }
    catch { }
    res.json({
        success: true,
        data: { totalEmployees, pendingLeaves, approvedLeaves, departments: departments.length },
    });
}));
// ─── RECRUITMENT ────────────────────────────────────────────────────────────
// GET /api/hr/jobs — list job postings
router.get('/jobs', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const status = req.query['status'] ?? 'open';
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/jobPostings`);
    if (status !== 'all')
        q = q.where('status', '==', status);
    const snap = await q.limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// POST /api/hr/jobs — create job posting
router.post('/jobs', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/jobPostings`).doc(id).set({
        id, title: body['title'] ?? '', department: body['department'] ?? '',
        description: body['description'] ?? '', requirements: body['requirements'] ?? '',
        employmentType: body['employmentType'] ?? 'full-time',
        location: body['location'] ?? '', salary: body['salary'] ?? '',
        status: 'open', applicantCount: 0,
        createdAt: new Date(), updatedAt: new Date(),
    });
    res.status(201).json({ success: true, data: { id } });
}));
// PATCH /api/hr/jobs/:id — update job posting
router.patch('/jobs/:id', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/jobPostings`).doc(req.params.id).update({ ...body, updatedAt: new Date() });
    res.json({ success: true });
}));
// GET /api/hr/candidates?jobId=xxx — list candidates
router.get('/candidates', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const jobId = req.query['jobId'];
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/candidates`);
    if (jobId)
        q = q.where('jobId', '==', jobId);
    const snap = await q.limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// POST /api/hr/candidates — add candidate
router.post('/candidates', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/candidates`).doc(id).set({
        id, jobId: body['jobId'] ?? '', name: body['name'] ?? '', email: body['email'] ?? '',
        phone: body['phone'] ?? '', cvSummary: body['cvSummary'] ?? '', notes: body['notes'] ?? '',
        score: body['score'] ?? null, status: 'new', createdAt: new Date(),
    });
    res.status(201).json({ success: true, data: { id } });
}));
// PATCH /api/hr/candidates/:id — update candidate status
router.patch('/candidates/:id', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/candidates`).doc(req.params.id).update({ ...body, updatedAt: new Date() });
    res.json({ success: true });
}));
// POST /api/hr/interviews — schedule interview
router.post('/interviews', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/interviews`).doc(id).set({
        id, candidateId: body['candidateId'] ?? '', date: body['date'] ?? '', time: body['time'] ?? '',
        interviewer: body['interviewer'] ?? '', type: body['type'] ?? 'video',
        notes: body['notes'] ?? '', status: 'scheduled', createdAt: new Date(),
    });
    res.status(201).json({ success: true, data: { id } });
}));
// ─── EMPLOYEE PROFILE ───────────────────────────────────────────────────────
// GET /api/hr/employees/:id — detailed employee profile
router.get('/employees/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const callerCompanyId = req.user?.companyId;
    if (!callerCompanyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    const data = doc.data();
    // SECURITY: cross-tenant guard — refuse if the target user belongs to another company
    if (data['companyId'] !== callerCompanyId) {
        throw new error_middleware_1.AppError('Employee not found', 404);
    }
    res.json({ success: true, data: { id: doc.id, ...data } });
}));
// ─── HR DOCUMENTS ───────────────────────────────────────────────────────────
// GET /api/hr/employees/:id/documents
router.get('/employees/:id/documents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/hrDocuments`)
        .where('userId', '==', req.params.id).limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// PATCH /api/hr/employees/:id — update editable fields on the employee profile
router.patch('/employees/:id', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const allowed = [
        'displayName', 'firstName', 'lastName', 'email', 'phone', 'whatsappPhone',
        'address', 'birthDate', 'jobTitle', 'department', 'manager', 'startDate',
        'baseSalary', 'currency', 'employmentType', 'workHours', 'emergencyContact',
        'nationalId', 'photoUrl',
    ];
    const body = req.body;
    const updates = { updatedAt: new Date() };
    for (const key of allowed) {
        if (key in body)
            updates[key] = body[key];
    }
    if (Object.keys(updates).length === 1)
        throw new error_middleware_1.AppError('Aucune mise à jour valide.', 400);
    const db = (0, firebase_config_1.getFirestore)();
    // Cross-tenant guard via the user doc
    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists || userDoc.data()?.['companyId'] !== companyId) {
        throw new error_middleware_1.AppError('Employee not found', 404);
    }
    await db.collection('users').doc(req.params.id).set(updates, { merge: true });
    // Mirror to companies/{cid}/employees/{id} so dashboard queries stay coherent
    await db.collection(`companies/${companyId}/employees`).doc(req.params.id)
        .set(updates, { merge: true }).catch(() => null);
    res.json({ success: true });
}));
// GET /api/hr/employees/:id/contracts — all contracts attached to this employee
router.get('/employees/:id/contracts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // Resolve email to also catch contracts linked via signatoryEmail
    const userDoc = await db.collection('users').doc(req.params.id).get();
    const email = userDoc.exists ? userDoc.data()?.['email'] : undefined;
    const colRef = db.collection(`companies/${companyId}/contracts`);
    const [byEmployeeId, byEmail] = await Promise.all([
        colRef.where('employeeId', '==', req.params.id).limit(100).get().catch(() => null),
        email ? colRef.where('signatoryEmail', '==', email).limit(100).get().catch(() => null) : Promise.resolve(null),
    ]);
    const seen = new Set();
    const contracts = [];
    for (const snap of [byEmployeeId, byEmail]) {
        if (!snap)
            continue;
        for (const doc of snap.docs) {
            if (seen.has(doc.id))
                continue;
            seen.add(doc.id);
            contracts.push({ id: doc.id, ...doc.data() });
        }
    }
    // Sort by createdAt desc (string ISO comparison works for ISO format)
    contracts.sort((a, b) => String(b['createdAt'] ?? '').localeCompare(String(a['createdAt'] ?? '')));
    res.json({ success: true, data: contracts });
}));
// POST /api/hr/documents/certificate — generate certificate
router.post('/documents/certificate', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const { generateCertificateTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await generateCertificateTool({ companyId, userId: body['userId'] ?? '', certificateType: body['type'] ?? 'employment' });
    res.json({ success: true, data: result });
}));
// GET /api/hr/notification-channels — current user's notification channel preferences
router.get('/notification-channels', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('users').doc(uid).get();
    const channels = doc.data()?.['notificationChannels'] ?? {
        email: true, dashboard: true,
        whatsapp: { enabled: false, phone: '' },
        telegram: { enabled: false, chatId: '' },
    };
    res.json({ success: true, data: channels });
}));
// PUT /api/hr/notification-channels — save current user's preferences
router.put('/notification-channels', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    // Write on both users and companies/{id}/employees so the clone's resolveHostByName finds it
    await db.collection('users').doc(uid).set({ notificationChannels: body }, { merge: true });
    if (companyId) {
        await db.collection(`companies/${companyId}/employees`).doc(uid)
            .set({ notificationChannels: body }, { merge: true }).catch(() => { });
    }
    res.json({ success: true });
}));
// GET /api/hr/host-notifications — visitor notifications for the current user
router.get('/host-notifications', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const uid = req.user?.uid;
    if (!companyId || !uid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/hostNotifications`)
        .where('hostId', '==', uid)
        .limit(50).get()
        .catch(() => null);
    const data = snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
    res.json({ success: true, data });
}));
// PATCH /api/hr/host-notifications/:id — mark notification as handled (with replyAction for kiosk polling)
router.patch('/host-notifications/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const update = {
        status: body['status'] ?? 'handled',
        handledAt: new Date(),
        repliedAt: new Date(),
    };
    if (body['replyAction'])
        update['replyAction'] = body['replyAction'];
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/hostNotifications`).doc(req.params.id).update(update);
    res.json({ success: true });
}));
// POST /api/hr/upload-link/create — generate a magic link for an employee to upload their docs
router.post('/upload-link/create', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const employeeEmail = body['employeeEmail'];
    const employeeName = body['employeeName'] ?? '';
    if (!employeeEmail)
        throw new error_middleware_1.AppError('employeeEmail required', 400);
    const { generateEmployeeUploadLinkTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await generateEmployeeUploadLinkTool({
        companyId,
        employeeEmail,
        employeeName,
        requestedDocs: body['requestedDocs'] ?? ['id_card', 'rib', 'photo'],
        expiresInDays: body['expiresInDays'] ?? 7,
    });
    res.json({ success: true, data: result, uploadUrl: result.uploadUrl });
}));
// ─── TEAM CALENDAR ──────────────────────────────────────────────────────────
// GET /api/hr/team-calendar?department=xxx&date=2024-01-15
router.get('/team-calendar', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { teamCalendarTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await teamCalendarTool({
        companyId, department: req.query['department'],
        date: req.query['date'],
    });
    res.json({ success: true, data: result });
}));
// ─── HR TICKETS ─────────────────────────────────────────────────────────────
// GET /api/hr/tickets
router.get('/tickets', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/hrTickets`).limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// POST /api/hr/tickets
router.post('/tickets', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/hrTickets`).doc(id).set({
        id, userId: req.user?.uid ?? '', subject: body['subject'] ?? '', description: body['description'] ?? '',
        category: body['category'] ?? 'question', priority: body['priority'] ?? 'medium',
        status: 'open', createdAt: new Date(),
    });
    res.status(201).json({ success: true, data: { id } });
}));
// ─── POLICIES ───────────────────────────────────────────────────────────────
// GET /api/hr/policies
router.get('/policies', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/hrPolicies`).limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// POST /api/hr/policies — create/update policy
router.post('/policies', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = body['id'] || (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/hrPolicies`).doc(id).set({
        id, title: body['title'] ?? '', content: body['content'] ?? '',
        category: body['category'] ?? 'general', updatedAt: new Date(),
    }, { merge: true });
    res.json({ success: true, data: { id } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PRO: ORG CHART, PERFORMANCE, OFFBOARDING, ANALYTICS, SURVEYS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/org-chart', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { getOrgChartTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await getOrgChartTool({ companyId: cid });
    res.json({ success: true, data: result });
}));
router.get('/performance-reviews', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { createPerformanceReviewTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await createPerformanceReviewTool({ companyId: cid, action: 'list' });
    res.json({ success: true, data: result });
}));
router.post('/performance-reviews', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { createPerformanceReviewTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await createPerformanceReviewTool({ companyId: cid, action: 'create', ...req.body });
    res.json({ success: true, data: result });
}));
router.get('/offboarding/:employeeId', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { offboardingTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await offboardingTool({ companyId: cid, action: 'get', employeeId: req.params.employeeId });
    res.json({ success: true, data: result });
}));
router.post('/offboarding/:employeeId/start', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { offboardingTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await offboardingTool({ companyId: cid, action: 'start', employeeId: req.params.employeeId });
    res.json({ success: true, data: result });
}));
router.patch('/offboarding/:employeeId/item/:itemId', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { offboardingTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await offboardingTool({ companyId: cid, action: 'update_item', employeeId: req.params.employeeId, itemId: req.params.itemId, completed: req.body['completed'] ?? true });
    res.json({ success: true, data: result });
}));
router.get('/analytics', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { employeeAnalyticsTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await employeeAnalyticsTool({ companyId: cid });
    res.json({ success: true, data: result });
}));
router.get('/surveys', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { employeeSurveyTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await employeeSurveyTool({ companyId: cid, action: 'list' });
    res.json({ success: true, data: result });
}));
router.post('/surveys', hrAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { employeeSurveyTool } = await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')));
    const result = await employeeSurveyTool({ companyId: cid, action: 'create', ...req.body });
    res.json({ success: true, data: result });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// COACH PRO
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/coach/career-plan', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { careerPlanTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await careerPlanTool({ companyId: cid, userId: req.query['userId'] ?? req.user.uid, action: 'get' }) });
}));
router.post('/coach/career-plan', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { careerPlanTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await careerPlanTool({ companyId: cid, userId: req.body['userId'] ?? req.user.uid, action: 'create' }) });
}));
router.post('/coach/mood', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { moodTrackingTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await moodTrackingTool({ companyId: cid, userId: req.user.uid, action: 'submit', ...req.body }) });
}));
router.get('/coach/mood/history', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { moodTrackingTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await moodTrackingTool({ companyId: cid, userId: req.query['userId'] ?? req.user.uid, action: 'history' }) });
}));
router.get('/coach/one-on-one/:userId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { oneOnOneTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await oneOnOneTool({ companyId: cid, userId: req.params.userId }) });
}));
router.get('/coach/burnout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { burnoutDetectionTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await burnoutDetectionTool({ companyId: cid }) });
}));
router.get('/coach/insights', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { coachingInsightsTool } = await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')));
    res.json({ success: true, data: await coachingInsightsTool({ companyId: cid, scope: req.query['scope'] ?? 'team' }) });
}));
exports.default = router;
//# sourceMappingURL=hr.routes.js.map