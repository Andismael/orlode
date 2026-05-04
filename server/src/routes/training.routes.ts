/**
 * Training Routes PRO — Courses · Quizzes · Assignments · Progress · Certificates · Leaderboard · Stats
 * 2 views: ADMIN (create, assign, team stats) + EMPLOYEE (my courses, progress, certificates)
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
import { createNotification } from '../services/notificationService';

const router = Router();
router.use(authMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};
function serializeDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && '_seconds' in (val as Record<string, unknown>)) out[key] = new Date((val as { _seconds: number })._seconds * 1000).toISOString();
    else if (val && typeof val === 'object' && 'toDate' in (val as Record<string, unknown>) && typeof (val as { toDate: unknown }).toDate === 'function') out[key] = ((val as { toDate: () => Date }).toDate()).toISOString();
    else if (Array.isArray(val)) out[key] = val.map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? serializeDoc(item as Record<string, unknown>) : item);
    else out[key] = val;
  }
  return out;
}
function ss(doc: FirebaseFirestore.QueryDocumentSnapshot) { return { id: doc.id, ...serializeDoc(doc.data()) }; }

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES (Admin CRUD + Employee list)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/courses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${cid}/trainingCourses`) as FirebaseFirestore.Query;
    if (req.query['category']) q = q.where('category', '==', req.query['category']);
    if (req.query['status']) q = q.where('status', '==', req.query['status']);
    return (await q.limit(100).get()).docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.get('/courses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/trainingCourses`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Course not found', 404);
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()!) } });
}));

router.post('/courses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const id = generateId();
  const course = {
    id, title: body['title'] ?? '', topic: body['topic'] ?? '', description: body['description'] ?? '',
    category: body['category'] ?? 'other', difficulty: body['difficulty'] ?? 'intermediate',
    duration: body['duration'] ?? '1h', targetRole: body['targetRole'] ?? null,
    modules: Array.isArray(body['modules']) ? body['modules'] : [],
    status: body['status'] ?? 'published', enrolledCount: 0, completedCount: 0, avgScore: 0,
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/trainingCourses`).doc(id).set(course);
  res.status(201).json({ success: true, data: course });
}));

router.patch('/courses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/trainingCourses`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/courses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/trainingCourses`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// AI generate course
router.post('/courses/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { topic, title, difficulty, duration } = req.body as Record<string, string>;
  if (!topic) throw new AppError('topic required', 400);
  try {
    const { trainingAgentFlow } = await import('../agents/training.agent');
    const result = await trainingAgentFlow({ request: `Create a course about "${topic}" titled "${title ?? topic}"`, companyId: cid, language: 'fr' });
    res.json({ success: true, data: { text: result.response, courseId: result.courseId } });
  } catch { res.json({ success: true, data: { text: 'Generation echouee.' } }); }
}));

// AI generate multimedia VIDEO course
router.post('/courses/generate-video', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const topic = body['topic'] as string; const title = (body['title'] as string) ?? topic;
  if (!topic) throw new AppError('topic required', 400);
  try {
    const { generateVideoCourseTool } = await import('../agents/training.agent');
    const result = await (generateVideoCourseTool as (args: unknown) => Promise<unknown>)({
      companyId: cid, title, topic,
      category: body['category'] ?? 'other',
      difficulty: body['difficulty'] ?? 'intermediate',
      moduleCount: body['moduleCount'] ?? 4,
      language: body['language'] ?? 'fr',
      youtubeUrls: Array.isArray(body['youtubeUrls']) ? body['youtubeUrls'] : [],
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.json({ success: true, data: { text: 'Generation video echouee.' } });
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZZES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/quizzes', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${cid}/trainingQuizzes`).limit(100).get()).docs.map(ss), []);
  res.json({ success: true, data });
}));

router.get('/quizzes/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const doc = await getFirestore().collection(`companies/${cid}/trainingQuizzes`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Quiz not found', 404);
  res.json({ success: true, data: { id: doc.id, ...serializeDoc(doc.data()!) } });
}));

router.post('/quizzes', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const id = generateId();
  const quiz = {
    id, topic: body['topic'] ?? '', courseId: body['courseId'] ?? null,
    difficulty: body['difficulty'] ?? 'intermediate',
    questions: Array.isArray(body['questions']) ? body['questions'] : [],
    passScore: body['passScore'] ?? 70, status: 'active',
    createdBy: req.user!.uid, createdAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/trainingQuizzes`).doc(id).set(quiz);
  res.status(201).json({ success: true, data: quiz });
}));

router.delete('/quizzes/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/trainingQuizzes`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// Submit quiz answers
router.post('/quizzes/:id/submit', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/trainingQuizzes`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Quiz not found', 404);
  const quizData = doc.data()!;
  const answers = (req.body as { answers: number[] }).answers ?? [];
  const questions = (quizData['questions'] as { correct: number }[]) ?? [];
  let correct = 0;
  answers.forEach((a, i) => { if (questions[i] && a === questions[i].correct) correct++; });
  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const passed = score >= ((quizData['passScore'] as number) ?? 70);

  const submissionId = generateId();
  await db.collection(`companies/${cid}/trainingSubmissions`).doc(submissionId).set({
    id: submissionId, quizId: req.params.id, userId: req.user!.uid, answers, score, passed,
    correct, total: questions.length, submittedAt: new Date(),
  });

  // Award certificate if passed
  if (passed && quizData['courseId']) {
    await db.collection(`companies/${cid}/trainingCertificates`).doc(generateId()).set({
      userId: req.user!.uid, courseId: quizData['courseId'], quizId: req.params.id,
      score, awardedAt: new Date(),
    });
    createNotification({ companyId: cid, userId: req.user!.uid, type: 'system', title: 'Certificat obtenu !', message: `Vous avez reussi le quiz "${quizData['topic']}" avec ${score}%.`, actionUrl: '/training', icon: 'Award', severity: 'success' }).catch(() => {});
  }

  res.json({ success: true, data: { score, passed, correct, total: questions.length } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/assign', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const courseId = body['courseId'] as string; const userId = body['userId'] as string;
  if (!courseId || !userId) throw new AppError('courseId and userId required', 400);
  const db = getFirestore(); const id = generateId();
  await db.collection(`companies/${cid}/trainingProgress`).doc(id).set({
    id, courseId, userId, status: 'assigned', completionPct: 0, score: 0,
    dueDate: body['dueDate'] ? new Date(body['dueDate'] as string) : null,
    assignedBy: req.user!.uid, assignedAt: new Date(),
  });
  await db.collection(`companies/${cid}/trainingCourses`).doc(courseId).update({ enrolledCount: FieldValue.increment(1) }).catch(() => {});
  createNotification({ companyId: cid, userId, type: 'system', title: 'Cours assigne', message: `Un nouveau cours vous a ete assigne.`, actionUrl: '/training', icon: 'GraduationCap', severity: 'info' }).catch(() => {});
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS (Employee view)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/training/my-progress — current user's progress
router.get('/my-progress', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const uid = req.user!.uid;
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${cid}/trainingProgress`).where('userId', '==', uid).limit(50).get();
    const courses = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      let title = '', category = '';
      try { const cDoc = await db.collection(`companies/${cid}/trainingCourses`).doc(data['courseId'] as string).get(); title = (cDoc.data()?.['title'] as string) ?? ''; category = (cDoc.data()?.['category'] as string) ?? ''; } catch {}
      return { id: d.id, courseId: (data['courseId'] as string) ?? '', title, category, completionPct: (data['completionPct'] as number) ?? 0, status: (data['status'] as string) ?? 'assigned', score: (data['score'] as number) ?? 0 };
    }));
    const overallPct = courses.length > 0 ? Math.round(courses.reduce((s, c) => s + c.completionPct, 0) / courses.length) : 0;
    return { courses, overallPct, totalPoints: courses.reduce((s, c) => s + c.score, 0), badges: courses.filter(c => c.completionPct === 100).length };
  }, { courses: [], overallPct: 0, totalPoints: 0, badges: 0 });
  res.json({ success: true, data });
}));

// PATCH /api/training/progress/:id — update progress (employee completes a module)
router.patch('/progress/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if ((body['completionPct'] as number) === 100) { updates['status'] = 'completed'; updates['completedAt'] = new Date(); }
  else if ((body['completionPct'] as number) > 0) updates['status'] = 'in_progress';
  await getFirestore().collection(`companies/${cid}/trainingProgress`).doc(req.params.id).update(updates);
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/certificates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const uid = req.query['userId'] as string ?? req.user!.uid;
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${cid}/trainingCertificates`).where('userId', '==', uid).limit(50).get();
    return snap.docs.map(ss);
  }, []);
  res.json({ success: true, data });
}));

router.post('/certificates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const id = generateId();
  const cert = { id, userId: body['userId'] ?? req.user!.uid, courseId: body['courseId'] ?? '', score: body['score'] ?? 100, awardedAt: new Date(), awardedBy: req.user!.uid };
  await getFirestore().collection(`companies/${cid}/trainingCertificates`).doc(id).set(cert);
  res.status(201).json({ success: true, data: cert });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/leaderboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${cid}/trainingProgress`).limit(500).get();
    const userScores: Record<string, { userId: string; points: number; completed: number }> = {};
    for (const d of snap.docs) {
      const uid = (d.data()['userId'] as string) ?? '';
      if (!userScores[uid]) userScores[uid] = { userId: uid, points: 0, completed: 0 };
      userScores[uid].points += (d.data()['score'] as number) ?? 0;
      if ((d.data()['completionPct'] as number) === 100) userScores[uid].completed++;
    }
    // Get user names
    const entries = Object.values(userScores).sort((a, b) => b.points - a.points).slice(0, 10);
    const enriched = await Promise.all(entries.map(async (e, i) => {
      let name = e.userId;
      try { const u = await db.collection('users').doc(e.userId).get(); name = (u.data()?.['displayName'] as string) ?? (u.data()?.['email'] as string) ?? e.userId; } catch {}
      return { rank: i + 1, userId: e.userId, name, points: e.points, completed: e.completed };
    }));
    return enriched;
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/recommended', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const uid = req.user!.uid;
  const data = await safe(async () => {
    const db = getFirestore();
    const progressSnap = await db.collection(`companies/${cid}/trainingProgress`).where('userId', '==', uid).limit(50).get();
    const assignedCourseIds = new Set(progressSnap.docs.map(d => d.data()['courseId']));
    const coursesSnap = await db.collection(`companies/${cid}/trainingCourses`).where('status', '==', 'published').limit(50).get();
    return coursesSnap.docs.filter(d => !assignedCourseIds.has(d.id)).map(ss).slice(0, 10);
  }, []);
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const [cSnap, qSnap, pSnap, certSnap] = await Promise.all([
      db.collection(`companies/${cid}/trainingCourses`).limit(200).get(),
      db.collection(`companies/${cid}/trainingQuizzes`).limit(200).get(),
      db.collection(`companies/${cid}/trainingProgress`).limit(500).get(),
      db.collection(`companies/${cid}/trainingCertificates`).limit(500).get(),
    ]);
    const progress = pSnap.docs.map(d => d.data());
    const completed = progress.filter(p => (p['completionPct'] as number) === 100).length;
    const avgPct = progress.length > 0 ? Math.round(progress.reduce((s, p) => s + ((p['completionPct'] as number) ?? 0), 0) / progress.length) : 0;
    const byCat: Record<string, number> = {};
    cSnap.docs.forEach(d => { const c = (d.data()['category'] as string) ?? 'other'; byCat[c] = (byCat[c] ?? 0) + 1; });
    return {
      totalCourses: cSnap.size, totalQuizzes: qSnap.size,
      totalEnrolled: progress.length, totalCompleted: completed,
      avgCompletionPct: avgPct, totalCertificates: certSnap.size,
      byCategory: Object.entries(byCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
  }, { totalCourses: 0, totalQuizzes: 0, totalEnrolled: 0, totalCompleted: 0, avgCompletionPct: 0, totalCertificates: 0, byCategory: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING PATHS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/paths', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => (await getFirestore().collection(`companies/${cid}/learningPaths`).limit(50).get()).docs.map(ss), []);
  res.json({ success: true, data });
}));

router.post('/paths', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>; const id = generateId();
  const path = { id, title: body['title'] ?? '', description: body['description'] ?? '', category: body['category'] ?? 'other', courseIds: Array.isArray(body['courseIds']) ? body['courseIds'] : [], totalCourses: Array.isArray(body['courseIds']) ? (body['courseIds'] as string[]).length : 0, status: 'active', createdBy: req.user!.uid, createdAt: new Date() };
  await getFirestore().collection(`companies/${cid}/learningPaths`).doc(id).set(path);
  res.status(201).json({ success: true, data: path });
}));

router.delete('/paths/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/learningPaths`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// Assign learning path (assigns all courses in order with prerequisites)
router.post('/paths/:id/assign', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const userId = body['userId'] as string; if (!userId) throw new AppError('userId required', 400);
  const db = getFirestore();
  const pathDoc = await db.collection(`companies/${cid}/learningPaths`).doc(req.params.id).get();
  if (!pathDoc.exists) throw new AppError('Path not found', 404);
  const courseIds = (pathDoc.data()!['courseIds'] as string[]) ?? [];
  for (let i = 0; i < courseIds.length; i++) {
    const id = generateId();
    await db.collection(`companies/${cid}/trainingProgress`).doc(id).set({
      id, courseId: courseIds[i], userId, pathId: req.params.id, orderIndex: i,
      status: i === 0 ? 'assigned' : 'locked', completionPct: 0, score: 0,
      prerequisiteCourseId: i > 0 ? courseIds[i - 1] : null,
      dueDate: body['dueDate'] ? new Date(body['dueDate'] as string) : null,
      assignedBy: req.user!.uid, assignedAt: new Date(),
    });
    await db.collection(`companies/${cid}/trainingCourses`).doc(courseIds[i]).update({ enrolledCount: FieldValue.increment(1) }).catch(() => {});
  }
  createNotification({ companyId: cid, userId, type: 'system', title: 'Parcours assigne', message: `Le parcours "${pathDoc.data()!['title']}" (${courseIds.length} cours) vous a ete assigne.`, actionUrl: '/training', icon: 'GraduationCap', severity: 'info' }).catch(() => {});
  res.json({ success: true, data: { coursesAssigned: courseIds.length } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PREREQUISITE UNLOCK — when course completed, unlock next in path
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/unlock-next', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { courseId, userId } = req.body as { courseId: string; userId: string };
  if (!courseId || !userId) throw new AppError('courseId and userId required', 400);
  const db = getFirestore();
  // Find locked courses that have this courseId as prerequisite
  const snap = await db.collection(`companies/${cid}/trainingProgress`).where('userId', '==', userId).where('prerequisiteCourseId', '==', courseId).where('status', '==', 'locked').limit(5).get();
  let unlocked = 0;
  for (const doc of snap.docs) {
    await doc.ref.update({ status: 'assigned', unlockedAt: new Date() });
    unlocked++;
    createNotification({ companyId: cid, userId, type: 'system', title: 'Cours debloque !', message: `Un nouveau cours est disponible dans votre parcours.`, actionUrl: '/training', icon: 'Unlock', severity: 'info' }).catch(() => {});
  }
  res.json({ success: true, data: { unlocked } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/courses/:id/feedback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  await getFirestore().collection(`companies/${cid}/trainingFeedback`).doc(generateId()).set({
    courseId: req.params.id, userId: req.user!.uid,
    rating: body['rating'] ?? 3, useful: body['useful'] ?? true,
    difficulty: body['difficulty'] ?? 'just_right', comment: body['comment'] ?? '',
    submittedAt: new Date(),
  });
  res.json({ success: true });
}));

router.get('/courses/:id/feedback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${cid}/trainingFeedback`).where('courseId', '==', req.params.id).limit(50).get();
    const feedbacks = snap.docs.map(d => d.data());
    const avgRating = feedbacks.length > 0 ? Math.round(feedbacks.reduce((s, f) => s + ((f['rating'] as number) ?? 0), 0) / feedbacks.length * 10) / 10 : 0;
    const usefulPct = feedbacks.length > 0 ? Math.round(feedbacks.filter(f => f['useful']).length / feedbacks.length * 100) : 0;
    return { feedbacks: feedbacks.length, avgRating, usefulPct, comments: feedbacks.filter(f => f['comment']).map(f => ({ rating: f['rating'], comment: f['comment'], difficulty: f['difficulty'] })) };
  }, { feedbacks: 0, avgRating: 0, usefulPct: 0, comments: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/quiz-analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${cid}/trainingSubmissions`).limit(500).get();
    const subs = snap.docs.map(d => d.data());
    const totalScore = subs.reduce((s, d) => s + ((d['score'] as number) ?? 0), 0);
    const passed = subs.filter(d => d['passed']).length;
    const byQuiz: Record<string, { scores: number[]; passed: number }> = {};
    for (const s of subs) { const qid = (s['quizId'] as string) ?? ''; if (!byQuiz[qid]) byQuiz[qid] = { scores: [], passed: 0 }; byQuiz[qid].scores.push((s['score'] as number) ?? 0); if (s['passed']) byQuiz[qid].passed++; }
    return {
      totalSubmissions: subs.length, avgScore: subs.length > 0 ? Math.round(totalScore / subs.length) : 0,
      passRate: subs.length > 0 ? Math.round((passed / subs.length) * 100) : 0,
      byQuiz: Object.entries(byQuiz).map(([quizId, d]) => ({
        quizId, submissions: d.scores.length,
        avgScore: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
        passRate: d.scores.length > 0 ? Math.round((d.passed / d.scores.length) * 100) : 0,
      })),
    };
  }, { totalSubmissions: 0, avgScore: 0, passRate: 0, byQuiz: [] });
  res.json({ success: true, data });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// DEADLINE CHECK — notify overdue training
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/deadline-check', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const now = new Date();
  const snap = await db.collection(`companies/${cid}/trainingProgress`).where('status', 'in', ['assigned', 'in_progress', 'locked']).limit(500).get();
  let notified = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const due = d['dueDate']?.toDate?.() ?? (d['dueDate'] ? new Date(d['dueDate'] as string) : null);
    if (!due) continue;
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    const uid = d['userId'] as string;
    if (daysLeft < 0 && !d['overdueNotified']) {
      createNotification({ companyId: cid, userId: uid, type: 'system', title: 'Formation en retard', message: `Votre formation est en retard de ${Math.abs(daysLeft)} jour(s).`, actionUrl: '/training', icon: 'AlertTriangle', severity: 'error' }).catch(() => {});
      await doc.ref.update({ overdueNotified: true, status: 'overdue' }); notified++;
    } else if (daysLeft >= 0 && daysLeft <= 3 && !d['deadlineWarned']) {
      createNotification({ companyId: cid, userId: uid, type: 'system', title: 'Formation bientot due', message: `Il vous reste ${daysLeft} jour(s) pour terminer votre formation.`, actionUrl: '/training', icon: 'Clock', severity: 'warning' }).catch(() => {});
      await doc.ref.update({ deadlineWarned: true }); notified++;
    }
  }
  res.json({ success: true, data: { notified } });
}));

export default router;
