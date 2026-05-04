import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { notifyLeaveRequested, notifyLeaveReviewed } from '../services/notificationService';
import { requireAgentRole } from '../middleware/agentRbac.middleware';

/** Shorthand: require HR admin (owner, legacy admin, or agentRoles.hr === 'admin') */
const hrAdmin = requireAgentRole('hr', 'admin');

const router = Router();

// ─── PDF DOWNLOADS (public — signed token in URL for browser clicks) ────────
// GET /api/hr/contracts/:id/pdf?t=TOKEN — download contract PDF
// This route is mounted BEFORE authMiddleware so a browser click works without auth header.
// Security: only someone who knows the contract's unique access token can download.
router.get('/contracts/:id/pdf', asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  const token = (req.query['t'] as string) ?? '';
  const db = getFirestore();

  // Find contract by scanning companies — collectionGroup query would need a composite index
  // Since doc ID == contract.id, we just try to fetch directly on each company.
  let contractDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  try {
    const companies = await db.collection('companies').select().get();
    for (const c of companies.docs) {
      const doc = await db.collection(`companies/${c.id}/contracts`).doc(id).get();
      if (doc.exists) { contractDoc = doc; break; }
    }
  } catch { /* ignore */ }
  if (!contractDoc) throw new AppError('Contract not found', 404);
  const contract = contractDoc.data() ?? {};
  const companyId = contractDoc.ref.parent.parent!.id;

  // Validate access token
  const expectedToken = contract['accessToken'] as string | undefined;
  if (!expectedToken || token !== expectedToken) {
    throw new AppError('Invalid or missing access token', 403);
  }

  // Load employee data
  const employeeId = contract['employeeId'] as string;
  const [empHR, empUser] = await Promise.all([
    db.collection(`companies/${companyId}/employees`).doc(employeeId).get(),
    db.collection('users').doc(employeeId).get(),
  ]);
  const emp = { ...(empUser.data() ?? {}), ...(empHR.data() ?? {}) } as Record<string, unknown>;

  const { loadCompany, renderContractPdf } = await import('../services/hr/contractPdfService');
  const company = await loadCompany(companyId);

  const pdfBuffer = await renderContractPdf(company, {
    name: (emp['displayName'] as string) ?? 'Employé',
    email: emp['email'] as string | undefined,
    phone: emp['phone'] as string | undefined,
    jobTitle: contract['jobTitle'] as string | undefined,
    department: contract['department'] as string | undefined,
    baseSalary: contract['baseSalary'] as number | undefined,
    currency: contract['currency'] as string | undefined,
    startDate: contract['startDate'] as string | undefined,
    contractType: contract['contractType'] as 'CDI' | 'CDD' | 'Stage' | 'Freelance' | undefined,
    endDate: contract['endDate'] as string | undefined,
    trialPeriodMonths: contract['trialPeriodMonths'] as number | undefined,
    workHours: contract['workHours'] as string | undefined,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Contrat-${(emp['displayName'] as string) ?? 'employe'}.pdf"`);
  res.send(pdfBuffer);
}));

// ─── Auth required from here on ─────────────────────────────────────────────
router.use(authMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

async function getUserRole(uid: string): Promise<string | undefined> {
  const doc = await getFirestore().collection('users').doc(uid).get();
  return doc.data()?.['role'] as string | undefined;
}

// ─── MY PROFILE ──────────────────────────────────────────────────────────────

// GET /api/hr/me — current user HR profile + leave balance
router.get('/me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Not authenticated', 401);
  const db = getFirestore();

  const profile = await safe(async () => {
    const doc = await db.collection('hrProfiles').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }, null);

  // Default leave balance
  const balance = (profile as Record<string, unknown> | null)?.['leaveBalance'] as Record<string, number> | undefined ?? { annual: 25, sick: 10, rtt: 5, special: 3 };

  // Count used days this year
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const used = await safe(async () => {
    const snap = await db.collection('leaveRequests')
      .where('userId', '==', uid)
      .where('status', '==', 'approved')
      .where('from', '>=', yearStart)
      .limit(100).get();
    const totals: Record<string, number> = {};
    snap.docs.forEach(d => {
      const data = d.data();
      const type = (data['type'] as string) ?? 'annual';
      totals[type] = (totals[type] ?? 0) + ((data['days'] as number) ?? 0);
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
router.get('/leave/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Not authenticated', 401);

  const data = await safe(async () => {
    const snap = await getFirestore().collection('leaveRequests')
      .where('userId', '==', uid)
      .limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);
  res.json({ success: true, data });
}));

// GET /api/hr/leave/pending — all pending requests (admin/manager)
router.get('/leave/pending', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const role = req.user?.role ?? (req.user?.uid ? await getUserRole(req.user.uid) : undefined);
  if (role !== 'admin' && role !== 'manager') throw new AppError('Admin/Manager only', 403);

  const data = await safe(async () => {
    const snap = await getFirestore().collection('leaveRequests')
      .where('companyId', '==', companyId)
      .where('status', '==', 'pending')
      .limit(100).get();

    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Enrich with employee names
    const db = getFirestore();
    for (const req of requests) {
      const userId = (req as Record<string, unknown>)['userId'] as string;
      if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          (req as Record<string, unknown>)['employeeName'] = userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? '';
          (req as Record<string, unknown>)['employeeEmail'] = userDoc.data()?.['email'] ?? '';
        }
      }
    }
    return requests;
  }, []);
  res.json({ success: true, data });
}));

// GET /api/hr/leave/all — all company leave requests (admin)
router.get('/leave/all', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const data = await safe(async () => {
    const db = getFirestore();
    let query = db.collection('leaveRequests').where('companyId', '==', companyId);

    if (req.query['status']) {
      query = query.where('status', '==', req.query['status']) as typeof query;
    }

    const snap = await (query as ReturnType<typeof db.collection>).limit(200).get();
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Enrich with employee names
    for (const r of requests) {
      const userId = (r as Record<string, unknown>)['userId'] as string;
      if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          (r as Record<string, unknown>)['employeeName'] = userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? '';
        }
      }
    }
    return requests;
  }, []);
  res.json({ success: true, data });
}));

// POST /api/hr/leave/request — submit leave request
router.post('/leave/request', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!uid) throw new AppError('Not authenticated', 401);

  const body = req.body as Record<string, unknown>;
  const from = new Date(body['from'] as string);
  const to = new Date(body['to'] as string);
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);

  const id = generateId();
  const request = {
    userId: uid,
    companyId: companyId ?? '',
    employeeName: body['employeeName'] ?? (req.user as Record<string, unknown>)?.['displayName'] ?? '',
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
  const db = getFirestore();
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
  notifyLeaveRequested(companyId ?? '', request.employeeName as string, request.type as string, days).catch(() => {});

  res.status(201).json({ success: true, data: { id, ...request } });
}));

// PATCH /api/hr/leave/:id — approve/reject (admin/manager)
router.patch('/leave/:id', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role ?? (req.user?.uid ? await getUserRole(req.user.uid) : undefined);
  if (role !== 'admin' && role !== 'manager') throw new AppError('Admin/Manager only', 403);

  const { status } = req.body as { status: string };
  const db = getFirestore();

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
    notifyLeaveReviewed(
      companyId,
      (leaveDoc['userId'] as string) ?? '',
      (leaveDoc['employeeName'] as string) ?? '',
      status as 'approved' | 'rejected',
    ).catch(() => {});
  }

  res.json({ success: true });
}));

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────

// GET /api/hr/employees — all employees in company (multi-source: employees + users + members)
router.get('/employees', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();

  const data = await safe(async () => {
    const [empSnap, userSnap, memberSnap] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).limit(500).get().catch(() => null),
      db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null),
      db.collection(`companies/${companyId}/members`).limit(500).get().catch(() => null),
    ]);

    const byEmail = new Map<string, Record<string, unknown>>();
    const upsert = (id: string, d: Record<string, unknown>, source: string) => {
      const email = ((d['email'] as string) ?? '').toLowerCase();
      const key = email || `id:${id}`;
      const existing = byEmail.get(key) ?? {};
      byEmail.set(key, {
        id: (existing['id'] as string) ?? id,
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
router.get('/onboarding/:userId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();

  // Get user name
  const userDoc = await safe(async () => {
    const doc = await db.collection('users').doc(req.params.userId).get();
    return doc.exists ? doc.data() : null;
  }, null);
  const employeeName = userDoc?.['displayName'] ?? userDoc?.['email'] ?? '';

  // Get onboarding items
  const items = await safe(async () => {
    const doc = await db.collection('hrOnboarding').doc(req.params.userId).get();
    if (doc.exists && doc.data()?.['items']) return doc.data()!['items'] as Array<Record<string, unknown>>;

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
router.patch('/onboarding/:userId/item/:itemId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const body = req.body as Record<string, unknown>;

  // Get current items
  const doc = await db.collection('hrOnboarding').doc(req.params.userId).get();
  let items: Array<Record<string, unknown>> = [];

  if (doc.exists && doc.data()?.['items']) {
    items = doc.data()!['items'] as Array<Record<string, unknown>>;
  } else {
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
router.get('/stats', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();

  let totalEmployees = 0;
  try { totalEmployees = (await db.collection('users').where('companyId', '==', companyId).get()).size; } catch {}

  let pendingLeaves = 0;
  try { pendingLeaves = (await db.collection('leaveRequests').where('companyId', '==', companyId).where('status', '==', 'pending').get()).size; } catch {}

  let approvedLeaves = 0;
  try { approvedLeaves = (await db.collection('leaveRequests').where('companyId', '==', companyId).where('status', '==', 'approved').get()).size; } catch {}

  let departments: string[] = [];
  try {
    const snap = await db.collection('users').where('companyId', '==', companyId).limit(500).get();
    departments = [...new Set(snap.docs.map(d => d.data()['department'] as string).filter(Boolean))];
  } catch {}

  res.json({
    success: true,
    data: { totalEmployees, pendingLeaves, approvedLeaves, departments: departments.length },
  });
}));

// ─── RECRUITMENT ────────────────────────────────────────────────────────────

// GET /api/hr/jobs — list job postings
router.get('/jobs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const status = (req.query['status'] as string) ?? 'open';
  const db = getFirestore();
  let q = db.collection(`companies/${companyId}/jobPostings`) as FirebaseFirestore.Query;
  if (status !== 'all') q = q.where('status', '==', status);
  const snap = await q.limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/hr/jobs — create job posting
router.post('/jobs', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
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
router.patch('/jobs/:id', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  await getFirestore().collection(`companies/${companyId}/jobPostings`).doc(req.params.id).update({ ...body, updatedAt: new Date() });
  res.json({ success: true });
}));

// GET /api/hr/candidates?jobId=xxx — list candidates
router.get('/candidates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const jobId = req.query['jobId'] as string;
  const db = getFirestore();
  let q = db.collection(`companies/${companyId}/candidates`) as FirebaseFirestore.Query;
  if (jobId) q = q.where('jobId', '==', jobId);
  const snap = await q.limit(100).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/hr/candidates — add candidate
router.post('/candidates', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
  await db.collection(`companies/${companyId}/candidates`).doc(id).set({
    id, jobId: body['jobId'] ?? '', name: body['name'] ?? '', email: body['email'] ?? '',
    phone: body['phone'] ?? '', cvSummary: body['cvSummary'] ?? '', notes: body['notes'] ?? '',
    score: body['score'] ?? null, status: 'new', createdAt: new Date(),
  });
  res.status(201).json({ success: true, data: { id } });
}));

// PATCH /api/hr/candidates/:id — update candidate status
router.patch('/candidates/:id', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  await getFirestore().collection(`companies/${companyId}/candidates`).doc(req.params.id).update({ ...body, updatedAt: new Date() });
  res.json({ success: true });
}));

// POST /api/hr/interviews — schedule interview
router.post('/interviews', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
  await db.collection(`companies/${companyId}/interviews`).doc(id).set({
    id, candidateId: body['candidateId'] ?? '', date: body['date'] ?? '', time: body['time'] ?? '',
    interviewer: body['interviewer'] ?? '', type: body['type'] ?? 'video',
    notes: body['notes'] ?? '', status: 'scheduled', createdAt: new Date(),
  });
  res.status(201).json({ success: true, data: { id } });
}));

// ─── EMPLOYEE PROFILE ───────────────────────────────────────────────────────

// GET /api/hr/employees/:id — detailed employee profile
router.get('/employees/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const doc = await db.collection('users').doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Employee not found', 404);
  const data = doc.data()!;
  res.json({ success: true, data: { id: doc.id, ...data } });
}));

// ─── HR DOCUMENTS ───────────────────────────────────────────────────────────

// GET /api/hr/employees/:id/documents
router.get('/employees/:id/documents', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/hrDocuments`)
    .where('userId', '==', req.params.id).limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/hr/documents/certificate — generate certificate
router.post('/documents/certificate', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const { generateCertificateTool } = await import('../agents/hr.agent');
  const result = await generateCertificateTool({ companyId, userId: (body['userId'] as string) ?? '', certificateType: (body['type'] as any) ?? 'employment' });
  res.json({ success: true, data: result });
}));

// GET /api/hr/notification-channels — current user's notification channel preferences
router.get('/notification-channels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Auth required', 401);
  const db = getFirestore();
  const doc = await db.collection('users').doc(uid).get();
  const channels = (doc.data()?.['notificationChannels'] as Record<string, unknown>) ?? {
    email: true, dashboard: true,
    whatsapp: { enabled: false, phone: '' },
    telegram: { enabled: false, chatId: '' },
  };
  res.json({ success: true, data: channels });
}));

// PUT /api/hr/notification-channels — save current user's preferences
router.put('/notification-channels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!uid) throw new AppError('Auth required', 401);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  // Write on both users and companies/{id}/employees so the clone's resolveHostByName finds it
  await db.collection('users').doc(uid).set({ notificationChannels: body }, { merge: true });
  if (companyId) {
    await db.collection(`companies/${companyId}/employees`).doc(uid)
      .set({ notificationChannels: body }, { merge: true }).catch(() => {});
  }
  res.json({ success: true });
}));

// GET /api/hr/host-notifications — visitor notifications for the current user
router.get('/host-notifications', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Auth required', 401);
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/hostNotifications`)
    .where('hostId', '==', uid)
    .limit(50).get()
    .catch(() => null);
  const data = snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];
  res.json({ success: true, data });
}));

// PATCH /api/hr/host-notifications/:id — mark notification as handled (with replyAction for kiosk polling)
router.patch('/host-notifications/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {
    status: (body['status'] as string) ?? 'handled',
    handledAt: new Date(),
    repliedAt: new Date(),
  };
  if (body['replyAction']) update['replyAction'] = body['replyAction'];
  await getFirestore().collection(`companies/${companyId}/hostNotifications`).doc(req.params.id).update(update);
  res.json({ success: true });
}));

// POST /api/hr/upload-link/create — generate a magic link for an employee to upload their docs
router.post('/upload-link/create', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const employeeEmail = body['employeeEmail'] as string;
  const employeeName = (body['employeeName'] as string) ?? '';
  if (!employeeEmail) throw new AppError('employeeEmail required', 400);

  const { generateEmployeeUploadLinkTool } = await import('../agents/hr.agent');
  const result = await (generateEmployeeUploadLinkTool as (args: unknown) => Promise<{ uploadUrl: string; expiresAt: string; message: string }>)({
    companyId,
    employeeEmail,
    employeeName,
    requestedDocs: (body['requestedDocs'] as string[] | undefined) ?? ['id_card', 'rib', 'photo'],
    expiresInDays: (body['expiresInDays'] as number | undefined) ?? 7,
  });
  res.json({ success: true, data: result, uploadUrl: result.uploadUrl });
}));

// ─── TEAM CALENDAR ──────────────────────────────────────────────────────────

// GET /api/hr/team-calendar?department=xxx&date=2024-01-15
router.get('/team-calendar', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { teamCalendarTool } = await import('../agents/hr.agent');
  const result = await teamCalendarTool({
    companyId, department: req.query['department'] as string | undefined,
    date: req.query['date'] as string | undefined,
  });
  res.json({ success: true, data: result });
}));

// ─── HR TICKETS ─────────────────────────────────────────────────────────────

// GET /api/hr/tickets
router.get('/tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/hrTickets`).limit(100).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/hr/tickets
router.post('/tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = generateId();
  await db.collection(`companies/${companyId}/hrTickets`).doc(id).set({
    id, userId: req.user?.uid ?? '', subject: body['subject'] ?? '', description: body['description'] ?? '',
    category: body['category'] ?? 'question', priority: body['priority'] ?? 'medium',
    status: 'open', createdAt: new Date(),
  });
  res.status(201).json({ success: true, data: { id } });
}));

// ─── POLICIES ───────────────────────────────────────────────────────────────

// GET /api/hr/policies
router.get('/policies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/hrPolicies`).limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/hr/policies — create/update policy
router.post('/policies', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const role = req.user?.role;
  if (!companyId) throw new AppError('Company ID required', 400);
  if (role !== 'admin' && role !== 'manager') throw new AppError('Admin only', 403);
  const body = req.body as Record<string, unknown>;
  const db = getFirestore();
  const id = (body['id'] as string) || generateId();
  await db.collection(`companies/${companyId}/hrPolicies`).doc(id).set({
    id, title: body['title'] ?? '', content: body['content'] ?? '',
    category: body['category'] ?? 'general', updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, data: { id } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: ORG CHART, PERFORMANCE, OFFBOARDING, ANALYTICS, SURVEYS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/org-chart', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { getOrgChartTool } = await import('../agents/hr.agent');
  const result = await (getOrgChartTool as (args: unknown) => Promise<unknown>)({ companyId: cid });
  res.json({ success: true, data: result });
}));

router.get('/performance-reviews', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { createPerformanceReviewTool } = await import('../agents/hr.agent');
  const result = await (createPerformanceReviewTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'list' });
  res.json({ success: true, data: result });
}));

router.post('/performance-reviews', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { createPerformanceReviewTool } = await import('../agents/hr.agent');
  const result = await (createPerformanceReviewTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'create', ...(req.body as Record<string, unknown>) });
  res.json({ success: true, data: result });
}));

router.get('/offboarding/:employeeId', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { offboardingTool } = await import('../agents/hr.agent');
  const result = await (offboardingTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'get', employeeId: req.params.employeeId });
  res.json({ success: true, data: result });
}));

router.post('/offboarding/:employeeId/start', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { offboardingTool } = await import('../agents/hr.agent');
  const result = await (offboardingTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'start', employeeId: req.params.employeeId });
  res.json({ success: true, data: result });
}));

router.patch('/offboarding/:employeeId/item/:itemId', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { offboardingTool } = await import('../agents/hr.agent');
  const result = await (offboardingTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'update_item', employeeId: req.params.employeeId, itemId: req.params.itemId, completed: (req.body as Record<string, unknown>)['completed'] ?? true });
  res.json({ success: true, data: result });
}));

router.get('/analytics', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { employeeAnalyticsTool } = await import('../agents/hr.agent');
  const result = await (employeeAnalyticsTool as (args: unknown) => Promise<unknown>)({ companyId: cid });
  res.json({ success: true, data: result });
}));

router.get('/surveys', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { employeeSurveyTool } = await import('../agents/hr.agent');
  const result = await (employeeSurveyTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'list' });
  res.json({ success: true, data: result });
}));

router.post('/surveys', hrAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { employeeSurveyTool } = await import('../agents/hr.agent');
  const result = await (employeeSurveyTool as (args: unknown) => Promise<unknown>)({ companyId: cid, action: 'create', ...(req.body as Record<string, unknown>) });
  res.json({ success: true, data: result });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// COACH PRO
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/coach/career-plan', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { careerPlanTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (careerPlanTool as (a: unknown) => Promise<unknown>)({ companyId: cid, userId: (req.query['userId'] as string) ?? req.user!.uid, action: 'get' }) });
}));

router.post('/coach/career-plan', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { careerPlanTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (careerPlanTool as (a: unknown) => Promise<unknown>)({ companyId: cid, userId: (req.body as Record<string, string>)['userId'] ?? req.user!.uid, action: 'create' }) });
}));

router.post('/coach/mood', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { moodTrackingTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (moodTrackingTool as (a: unknown) => Promise<unknown>)({ companyId: cid, userId: req.user!.uid, action: 'submit', ...(req.body as Record<string, unknown>) }) });
}));

router.get('/coach/mood/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { moodTrackingTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (moodTrackingTool as (a: unknown) => Promise<unknown>)({ companyId: cid, userId: (req.query['userId'] as string) ?? req.user!.uid, action: 'history' }) });
}));

router.get('/coach/one-on-one/:userId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { oneOnOneTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (oneOnOneTool as (a: unknown) => Promise<unknown>)({ companyId: cid, userId: req.params.userId }) });
}));

router.get('/coach/burnout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { burnoutDetectionTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (burnoutDetectionTool as (a: unknown) => Promise<unknown>)({ companyId: cid }) });
}));

router.get('/coach/insights', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { coachingInsightsTool } = await import('../agents/coach.agent');
  res.json({ success: true, data: await (coachingInsightsTool as (a: unknown) => Promise<unknown>)({ companyId: cid, scope: (req.query['scope'] as string) ?? 'team' }) });
}));

export default router;
