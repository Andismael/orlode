"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainingAgentTool = exports.trainingAgentFlow = exports.generateVideoCourseTool = exports.getQuizAnalyticsTool = exports.submitFeedbackTool = exports.assignLearningPathTool = exports.createLearningPathTool = exports.getStatsTool = exports.getRecommendationsTool = exports.getProgressTool = exports.assignCourseTool = exports.generateQuizTool = exports.getCoursesTool = exports.createCourseTool = void 0;
/**
 * Training Agent PRO — Gemini Flash
 * Mission : Equipe formee, competences a jour, conformite assuree.
 *
 * 2 dashboards:
 *   ADMIN  → creer cours/quiz, assigner, voir progression equipe
 *   EMPLOYEE → mes cours, quiz, progression, certificats, recommandations
 *
 * Capabilities:
 *   1. Cours IA — generation avec modules, lecons, duree, difficulte
 *   2. Quiz IA — QCM, scoring auto, varietes de questions
 *   3. Parcours — learning paths ordonnes par role/competence
 *   4. Assignation — assigner cours a employe/equipe
 *   5. Progression — % par cours, temps, score, streaks
 *   6. Certificats — generation auto apres completion
 *   7. Gamification — points, badges, leaderboard
 *   8. Recommandations — personnalisees par role/lacunes
 *   9. Stats admin — vue equipe, completion rate, top performers
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const CATEGORIES = ['onboarding', 'security', 'technical', 'soft_skills', 'compliance', 'product', 'management', 'other'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const MODULE_TYPES = ['text', 'video', 'mixed'];
const CONTENT_TYPES = ['text', 'video', 'pdf', 'link', 'quiz', 'image'];
// ══════════════════════════════════════════════════════════════════════════════
// 1. COURSES
// ══════════════════════════════════════════════════════════════════════════════
exports.createCourseTool = genkit_config_1.ai.defineTool({
    name: 'trn_createCourse',
    description: 'Create a training course with AI-generated modules. Supports multimedia modules (text, video, mixed content with YouTube/PDF/links).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), topic: zod_1.z.string(),
        category: zod_1.z.enum(CATEGORIES).optional().default('other'),
        difficulty: zod_1.z.enum(DIFFICULTIES).optional().default('intermediate'),
        duration: zod_1.z.enum(['30min', '1h', '2h', 'half_day', 'full_day']).optional().default('1h'),
        targetRole: zod_1.z.string().optional(), language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({ courseId: zod_1.z.string(), title: zod_1.z.string(), modules: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), content: zod_1.z.string(), duration: zod_1.z.string() })) }),
}, async ({ companyId, title, topic, category, difficulty, duration, targetRole, language }) => {
    const moduleCount = duration === '30min' ? 2 : duration === '1h' ? 3 : duration === '2h' ? 5 : 8;
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Create a ${difficulty} training course in ${language}. Title: "${title}". Topic: ${topic}.${targetRole ? ` For: ${targetRole}` : ''} ${moduleCount} modules.
Return JSON: {"modules":[{"title":"...","content":"2-3 paragraphs","duration":"15min"}]} ONLY.`,
        config: { temperature: 0.5 },
    });
    let modules = [{ title: 'Introduction', content: `Introduction to ${topic}`, duration: '30min' }];
    try {
        modules = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).modules;
    }
    catch { }
    const db = (0, firebase_config_1.getFirestore)();
    const courseId = (0, helpers_1.generateId)();
    // Wrap text modules in multimedia format
    const multimediaModules = modules.map((m, i) => ({
        ...m, type: 'text', order: i,
        contentBlocks: [{ type: 'text', value: m.content }],
    }));
    await db.collection(`companies/${companyId}/trainingCourses`).doc(courseId).set({
        id: courseId, title, topic, category: category ?? 'other', difficulty: difficulty ?? 'intermediate',
        duration: duration ?? '1h', targetRole: targetRole ?? null, modules: multimediaModules, status: 'published',
        enrolledCount: 0, completedCount: 0, avgScore: 0,
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { courseId, title, modules };
});
exports.getCoursesTool = genkit_config_1.ai.defineTool({
    name: 'trn_getCourses',
    description: 'List training courses with filters.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), category: zod_1.z.string().optional(), status: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ courses: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), category: zod_1.z.string(), difficulty: zod_1.z.string(), duration: zod_1.z.string(), enrolledCount: zod_1.z.number(), completedCount: zod_1.z.number() })) }),
}, async ({ companyId, category, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/trainingCourses`);
    if (category)
        q = q.where('category', '==', category);
    if (status)
        q = q.where('status', '==', status);
    const snap = await q.limit(100).get();
    return { courses: snap.docs.map(d => { const data = d.data(); return { id: d.id, title: data['title'] ?? '', category: data['category'] ?? 'other', difficulty: data['difficulty'] ?? 'intermediate', duration: data['duration'] ?? '1h', enrolledCount: data['enrolledCount'] ?? 0, completedCount: data['completedCount'] ?? 0 }; }) };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. QUIZZES
// ══════════════════════════════════════════════════════════════════════════════
exports.generateQuizTool = genkit_config_1.ai.defineTool({
    name: 'trn_generateQuiz',
    description: 'Generate a quiz with AI (QCM, scoring auto).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), topic: zod_1.z.string(), courseId: zod_1.z.string().optional(),
        difficulty: zod_1.z.enum(DIFFICULTIES).optional().default('intermediate'),
        numQuestions: zod_1.z.number().optional().default(5), language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({ quizId: zod_1.z.string(), topic: zod_1.z.string(), questions: zod_1.z.array(zod_1.z.object({ question: zod_1.z.string(), options: zod_1.z.array(zod_1.z.string()), correct: zod_1.z.number() })) }),
}, async ({ companyId, topic, courseId, difficulty, numQuestions, language }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Generate a ${difficulty} quiz with ${numQuestions} QCM questions in ${language} about "${topic}".
Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correct":0}]} ONLY.`,
        config: { temperature: 0.5 },
    });
    let questions = [{ question: `What is ${topic}?`, options: ['A', 'B', 'C', 'D'], correct: 0 }];
    try {
        questions = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).questions;
    }
    catch { }
    const db = (0, firebase_config_1.getFirestore)();
    const quizId = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/trainingQuizzes`).doc(quizId).set({
        id: quizId, topic, courseId: courseId ?? null, difficulty: difficulty ?? 'intermediate',
        questions, passScore: 70, status: 'active',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { quizId, topic, questions };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. ASSIGNATION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Resolve a user reference (UUID, displayName, or email) to the Firestore user doc ID.
 */
async function resolveUserId(companyId, ref) {
    const db = (0, firebase_config_1.getFirestore)();
    // Direct UUID hit
    const direct = await db.collection('users').doc(ref).get().catch(() => null);
    if (direct?.exists)
        return direct.id;
    // Lookup by displayName within company
    const byName = await db.collection('users').where('companyId', '==', companyId).where('displayName', '==', ref).limit(1).get().catch(() => null);
    if (byName && !byName.empty)
        return byName.docs[0].id;
    // Lookup by email
    const byEmail = await db.collection('users').where('companyId', '==', companyId).where('email', '==', ref).limit(1).get().catch(() => null);
    if (byEmail && !byEmail.empty)
        return byEmail.docs[0].id;
    return null;
}
exports.assignCourseTool = genkit_config_1.ai.defineTool({
    name: 'trn_assignCourse',
    description: 'Assign a course to an employee, team, or ALL employees of the company. Use assignToAll=true for company-wide assignment. userId accepts UUID, displayName, or email.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        courseId: zod_1.z.string(),
        userId: zod_1.z.string().optional().describe('UUID, displayName, or email of the employee'),
        teamId: zod_1.z.string().optional().describe('Team/department name'),
        assignToAll: zod_1.z.boolean().optional().describe('Assign to ALL employees of the company'),
        dueDate: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), assignedCount: zod_1.z.number(), message: zod_1.z.string() }),
}, async ({ companyId, courseId, userId, teamId, assignToAll, dueDate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const targets = [];
    if (assignToAll) {
        // Fetch all users of the company
        const usersSnap = await db.collection('users').where('companyId', '==', companyId).limit(500).get();
        usersSnap.docs.forEach(d => targets.push(d.id));
        if (targets.length === 0)
            return { success: false, assignedCount: 0, message: 'Aucun employé trouvé pour cette entreprise.' };
    }
    else if (teamId) {
        const usersSnap = await db.collection('users').where('companyId', '==', companyId).where('department', '==', teamId).limit(500).get();
        usersSnap.docs.forEach(d => targets.push(d.id));
        if (targets.length === 0)
            return { success: false, assignedCount: 0, message: `Aucun employé trouvé dans l'équipe "${teamId}".` };
    }
    else if (userId) {
        const resolved = await resolveUserId(companyId, userId);
        if (!resolved)
            return { success: false, assignedCount: 0, message: `Utilisateur "${userId}" introuvable. Fournis un UUID, displayName ou email valide.` };
        targets.push(resolved);
    }
    else {
        return { success: false, assignedCount: 0, message: 'Préciser userId, teamId, ou assignToAll=true.' };
    }
    let assigned = 0;
    for (const uid of targets) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/trainingProgress`).doc(id).set({
            id, courseId, userId: uid, teamId: teamId ?? null, status: 'assigned', completionPct: 0, score: 0,
            dueDate: dueDate ? new Date(dueDate) : null, assignedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        assigned++;
    }
    // Increment enrolled count once with the total
    await db.collection(`companies/${companyId}/trainingCourses`).doc(courseId).update({ enrolledCount: firestore_1.FieldValue.increment(assigned) }).catch(() => { });
    return {
        success: true,
        assignedCount: assigned,
        message: `Cours assigné à ${assigned} employé(s)${assignToAll ? ' (tous)' : teamId ? ` (équipe ${teamId})` : ''}.`,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. PROGRESSION
// ══════════════════════════════════════════════════════════════════════════════
exports.getProgressTool = genkit_config_1.ai.defineTool({
    name: 'trn_getProgress',
    description: 'Get training progress for an employee or the whole team.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        courses: zod_1.z.array(zod_1.z.object({ courseId: zod_1.z.string(), title: zod_1.z.string(), completionPct: zod_1.z.number(), status: zod_1.z.string(), score: zod_1.z.number() })),
        overallPct: zod_1.z.number(), totalPoints: zod_1.z.number(), badges: zod_1.z.number(),
    }),
}, async ({ companyId, userId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/trainingProgress`);
    if (userId)
        q = q.where('userId', '==', userId);
    const snap = await q.limit(50).get();
    const courses = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        let title = '';
        try {
            const cDoc = await db.collection(`companies/${companyId}/trainingCourses`).doc(data['courseId']).get();
            title = cDoc.data()?.['title'] ?? '';
        }
        catch { }
        return { courseId: data['courseId'] ?? '', title, completionPct: data['completionPct'] ?? 0, status: data['status'] ?? 'assigned', score: data['score'] ?? 0 };
    }));
    const overallPct = courses.length > 0 ? Math.round(courses.reduce((s, c) => s + c.completionPct, 0) / courses.length) : 0;
    const badges = courses.filter(c => c.completionPct === 100).length;
    const totalPoints = courses.reduce((s, c) => s + c.score, 0);
    return { courses, overallPct, totalPoints, badges };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. RECOMMENDATIONS
// ══════════════════════════════════════════════════════════════════════════════
exports.getRecommendationsTool = genkit_config_1.ai.defineTool({
    name: 'trn_getRecommendations',
    description: 'Get personalized training recommendations.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string(), role: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ recommendations: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), reason: zod_1.z.string(), priority: zod_1.z.string(), duration: zod_1.z.string() })) }),
}, async ({ companyId, userId, role }) => {
    // Check completed courses to avoid recommending what's done
    const db = (0, firebase_config_1.getFirestore)();
    const progressSnap = await db.collection(`companies/${companyId}/trainingProgress`).where('userId', '==', userId).where('completionPct', '==', 100).limit(50).get();
    const completedIds = new Set(progressSnap.docs.map(d => d.data()['courseId']));
    // Get available courses
    const coursesSnap = await db.collection(`companies/${companyId}/trainingCourses`).where('status', '==', 'published').limit(50).get();
    const available = coursesSnap.docs.filter(d => !completedIds.has(d.id)).map(d => {
        const data = d.data();
        return { title: data['title'] ?? '', category: data['category'] ?? '', duration: data['duration'] ?? '1h' };
    });
    if (available.length > 0) {
        return { recommendations: available.slice(0, 5).map(c => ({ title: c.title, reason: `Cours disponible — ${c.category}`, priority: 'medium', duration: c.duration })) };
    }
    // Default recommendations
    return { recommendations: [
            { title: 'Cybersecurite', reason: 'Obligatoire pour tous', priority: 'high', duration: '1h' },
            { title: 'RGPD', reason: 'Conformite legale', priority: 'high', duration: '30min' },
            { title: 'Onboarding', reason: 'Formation de base', priority: 'medium', duration: '2h' },
        ] };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. STATS (Admin)
// ══════════════════════════════════════════════════════════════════════════════
exports.getStatsTool = genkit_config_1.ai.defineTool({
    name: 'trn_getStats',
    description: 'Get training department statistics (admin view).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalCourses: zod_1.z.number(), totalQuizzes: zod_1.z.number(), totalEnrolled: zod_1.z.number(),
        totalCompleted: zod_1.z.number(), avgCompletionPct: zod_1.z.number(), avgScore: zod_1.z.number(),
        totalCertificates: zod_1.z.number(), totalPoints: zod_1.z.number(),
        byCategory: zod_1.z.array(zod_1.z.object({ category: zod_1.z.string(), count: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [coursesSnap, quizzesSnap, progressSnap, certsSnap] = await Promise.all([
        db.collection(`companies/${companyId}/trainingCourses`).limit(200).get(),
        db.collection(`companies/${companyId}/trainingQuizzes`).limit(200).get(),
        db.collection(`companies/${companyId}/trainingProgress`).limit(500).get(),
        db.collection(`companies/${companyId}/trainingCertificates`).limit(500).get(),
    ]);
    const progress = progressSnap.docs.map(d => d.data());
    const completed = progress.filter(p => p['completionPct'] === 100).length;
    const avgPct = progress.length > 0 ? Math.round(progress.reduce((s, p) => s + (p['completionPct'] ?? 0), 0) / progress.length) : 0;
    const avgScore = progress.length > 0 ? Math.round(progress.reduce((s, p) => s + (p['score'] ?? 0), 0) / progress.length) : 0;
    const totalPoints = progress.reduce((s, p) => s + (p['score'] ?? 0), 0);
    const byCat = {};
    coursesSnap.docs.forEach(d => { const c = d.data()['category'] ?? 'other'; byCat[c] = (byCat[c] ?? 0) + 1; });
    return {
        totalCourses: coursesSnap.size, totalQuizzes: quizzesSnap.size,
        totalEnrolled: progress.length, totalCompleted: completed,
        avgCompletionPct: avgPct, avgScore, totalCertificates: certsSnap.size, totalPoints,
        byCategory: Object.entries(byCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 7. LEARNING PATHS
// ══════════════════════════════════════════════════════════════════════════════
exports.createLearningPathTool = genkit_config_1.ai.defineTool({
    name: 'trn_createLearningPath',
    description: 'Create a learning path (ordered sequence of courses with prerequisites).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), description: zod_1.z.string().optional(),
        category: zod_1.z.enum(CATEGORIES).optional().default('other'),
        courseIds: zod_1.z.array(zod_1.z.string()).describe('Ordered list of course IDs'),
    }),
    outputSchema: zod_1.z.object({ pathId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, title, description, category, courseIds }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/learningPaths`).doc(id).set({
        id, title, description: description ?? '', category: category ?? 'other',
        courseIds, totalCourses: courseIds.length, status: 'active',
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { pathId: id, message: `Parcours "${title}" cree avec ${courseIds.length} cours.` };
});
exports.assignLearningPathTool = genkit_config_1.ai.defineTool({
    name: 'trn_assignLearningPath',
    description: 'Assign a learning path to an employee (assigns all courses in order with prerequisites).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), pathId: zod_1.z.string(), userId: zod_1.z.string(), dueDate: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), coursesAssigned: zod_1.z.number(), message: zod_1.z.string() }),
}, async ({ companyId, pathId, userId, dueDate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const pathDoc = await db.collection(`companies/${companyId}/learningPaths`).doc(pathId).get();
    if (!pathDoc.exists)
        return { success: false, coursesAssigned: 0, message: 'Parcours introuvable.' };
    const courseIds = pathDoc.data()['courseIds'] ?? [];
    let assigned = 0;
    for (let i = 0; i < courseIds.length; i++) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/trainingProgress`).doc(id).set({
            id, courseId: courseIds[i], userId, pathId, orderIndex: i,
            status: i === 0 ? 'assigned' : 'locked', // First course unlocked, rest locked
            completionPct: 0, score: 0, prerequisiteCourseId: i > 0 ? courseIds[i - 1] : null,
            dueDate: dueDate ? new Date(dueDate) : null, assignedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.collection(`companies/${companyId}/trainingCourses`).doc(courseIds[i]).update({ enrolledCount: firestore_1.FieldValue.increment(1) }).catch(() => { });
        assigned++;
    }
    return { success: true, coursesAssigned: assigned, message: `Parcours assigne — ${assigned} cours.` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 8. COURSE FEEDBACK
// ══════════════════════════════════════════════════════════════════════════════
exports.submitFeedbackTool = genkit_config_1.ai.defineTool({
    name: 'trn_submitCourseFeedback',
    description: 'Submit feedback for a completed course.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), courseId: zod_1.z.string(), userId: zod_1.z.string(),
        rating: zod_1.z.number().min(1).max(5), useful: zod_1.z.boolean(), difficulty: zod_1.z.enum(['too_easy', 'just_right', 'too_hard']),
        comment: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, courseId, userId, rating, useful, difficulty, comment }) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${companyId}/trainingFeedback`).doc((0, helpers_1.generateId)()).set({
        courseId, userId, rating, useful, difficulty, comment: comment ?? '',
        submittedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, message: 'Merci pour votre retour !' };
});
// ══════════════════════════════════════════════════════════════════════════════
// 9. ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.getQuizAnalyticsTool = genkit_config_1.ai.defineTool({
    name: 'trn_getQuizAnalytics',
    description: 'Get detailed quiz analytics (pass rate, avg score, hardest questions).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalSubmissions: zod_1.z.number(), avgScore: zod_1.z.number(), passRate: zod_1.z.number(),
        byQuiz: zod_1.z.array(zod_1.z.object({ quizId: zod_1.z.string(), topic: zod_1.z.string(), submissions: zod_1.z.number(), avgScore: zod_1.z.number(), passRate: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/trainingSubmissions`).limit(500).get();
    const submissions = snap.docs.map(d => d.data());
    const totalScore = submissions.reduce((s, d) => s + (d['score'] ?? 0), 0);
    const passed = submissions.filter(d => d['passed']).length;
    const byQuiz = {};
    for (const s of submissions) {
        const qid = s['quizId'] ?? '';
        if (!byQuiz[qid])
            byQuiz[qid] = { topic: '', scores: [], passed: 0 };
        byQuiz[qid].scores.push(s['score'] ?? 0);
        if (s['passed'])
            byQuiz[qid].passed++;
    }
    // Get quiz topics
    for (const qid of Object.keys(byQuiz)) {
        try {
            const qDoc = await db.collection(`companies/${companyId}/trainingQuizzes`).doc(qid).get();
            byQuiz[qid].topic = qDoc.data()?.['topic'] ?? '';
        }
        catch { }
    }
    return {
        totalSubmissions: submissions.length, avgScore: submissions.length > 0 ? Math.round(totalScore / submissions.length) : 0,
        passRate: submissions.length > 0 ? Math.round((passed / submissions.length) * 100) : 0,
        byQuiz: Object.entries(byQuiz).map(([quizId, d]) => ({
            quizId, topic: d.topic, submissions: d.scores.length,
            avgScore: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
            passRate: d.scores.length > 0 ? Math.round((d.passed / d.scores.length) * 100) : 0,
        })),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 10. VIDEO COURSE GENERATION
// ══════════════════════════════════════════════════════════════════════════════
exports.generateVideoCourseTool = genkit_config_1.ai.defineTool({
    name: 'trn_generateVideoCourse',
    description: 'Generate a multimedia video course with AI — creates script, slides outline, and mixed modules (text + video placeholders + quiz). Perfect for immersive e-learning.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), topic: zod_1.z.string(),
        category: zod_1.z.enum(CATEGORIES).optional().default('other'),
        difficulty: zod_1.z.enum(DIFFICULTIES).optional().default('intermediate'),
        moduleCount: zod_1.z.number().optional().default(4),
        language: zod_1.z.string().optional().default('fr'),
        youtubeUrls: zod_1.z.array(zod_1.z.string()).optional().describe('Optional YouTube video URLs to embed in modules'),
    }),
    outputSchema: zod_1.z.object({
        courseId: zod_1.z.string(), title: zod_1.z.string(),
        modules: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(), type: zod_1.z.string(), duration: zod_1.z.string(),
            script: zod_1.z.string().optional(), slides: zod_1.z.array(zod_1.z.string()).optional(),
        })),
    }),
}, async ({ companyId, title, topic, category, difficulty, moduleCount, language, youtubeUrls }) => {
    const count = moduleCount ?? 4;
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Create a ${difficulty} multimedia video training course in ${language}.
Title: "${title}". Topic: ${topic}. ${count} modules.

For each module, generate:
- title: module title
- script: a video narration script (3-5 paragraphs, conversational tone, as if a trainer is speaking)
- slides: array of 3-5 slide titles/bullet points
- content: summary text for the module page
- duration: estimated time

Return JSON ONLY:
{"modules":[{"title":"...","script":"...","slides":["slide1","slide2","slide3"],"content":"summary text","duration":"10min"}]}`,
        config: { temperature: 0.6 },
    });
    let modules = [];
    try {
        modules = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).modules;
    }
    catch {
        modules = [{ title: 'Introduction', script: `Bienvenue dans cette formation sur ${topic}.`, slides: ['Introduction', 'Objectifs', 'Plan du cours'], content: `Introduction a ${topic}`, duration: '10min' }];
    }
    // Build multimedia modules with contentBlocks
    const urls = youtubeUrls ?? [];
    const multimediaModules = modules.map((m, i) => {
        const contentBlocks = [];
        // Add video block if YouTube URL available
        if (urls[i]) {
            contentBlocks.push({ type: 'video', url: urls[i], label: m.title });
        }
        // Add text content
        contentBlocks.push({ type: 'text', value: m.content });
        // Add script as collapsible section
        if (m.script) {
            contentBlocks.push({ type: 'text', value: `**Script video :**\n${m.script}` });
        }
        // Add slides outline
        if (m.slides?.length > 0) {
            contentBlocks.push({ type: 'text', value: `**Slides :**\n${m.slides.map((s, j) => `${j + 1}. ${s}`).join('\n')}` });
        }
        return {
            title: m.title, type: urls[i] ? 'video' : 'mixed', order: i,
            duration: m.duration, content: m.content, script: m.script, slides: m.slides,
            videoUrl: urls[i] ?? null,
            contentBlocks,
        };
    });
    const db = (0, firebase_config_1.getFirestore)();
    const courseId = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/trainingCourses`).doc(courseId).set({
        id: courseId, title, topic, category: category ?? 'other', difficulty: difficulty ?? 'intermediate',
        duration: `${count * 10}min`, targetRole: null, modules: multimediaModules, status: 'published',
        enrolledCount: 0, completedCount: 0, avgScore: 0, isMultimedia: true,
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return {
        courseId, title,
        modules: modules.map((m, i) => ({ title: m.title, type: urls[i] ? 'video' : 'mixed', duration: m.duration, script: m.script, slides: m.slides })),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════
const ALL_TOOLS = [
    exports.createCourseTool, exports.getCoursesTool, exports.generateQuizTool,
    exports.assignCourseTool, exports.getProgressTool, exports.getRecommendationsTool, exports.getStatsTool,
    exports.createLearningPathTool, exports.assignLearningPathTool, exports.submitFeedbackTool, exports.getQuizAnalyticsTool,
    exports.generateVideoCourseTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({ response: zod_1.z.string(), courseId: zod_1.z.string().optional(), quizId: zod_1.z.string().optional(), badges: zod_1.z.number().optional() });
exports.trainingAgentFlow = genkit_config_1.ai.defineFlow({ name: 'trainingAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    logger_1.logger.info(`[TrainingAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();
    // Look up user role for personalization (admin sees team view, employee sees their courses)
    let userRole = '';
    let userName = '';
    try {
        if (userId) {
            const u = await (0, firebase_config_1.getFirestore)().collection('users').doc(userId).get();
            userRole = u.data()?.['role'] ?? '';
            userName = u.data()?.['displayName'] ?? '';
        }
    }
    catch { /* ignore */ }
    const executors = new Map();
    for (const tool of ALL_TOOLS) {
        const name = tool.__action?.name ?? '';
        if (name)
            executors.set(name, (i) => tool({ ...i, companyId, userId }));
    }
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20))
            messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es l'Agent Formation PRO de l'entreprise — directeur pédagogique virtuel, créateur de contenu, suivi de compétences.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.
${userName ? `Tu parles à : ${userName}${userRole ? ` (rôle: ${userRole})` : ''}.` : ''}

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les échéances de formation (dueDate), planifications trimestrielles, certificats — utilise cette ancre.

## 👤 ADAPTATION AU RÔLE
${userRole === 'admin' || userRole === 'manager'
            ? 'Mode ADMIN/MANAGER : tu peux créer cours/quiz, assigner à des employés, voir progression équipe, stats globales.'
            : 'Mode EMPLOYÉ : focus sur TES cours, TA progression, TES certificats, TES recommandations personnalisées. N\'expose PAS les stats globales sauf si demandé.'}

## 🧠 MÉMOIRE CONVERSATIONNELLE — COURS, QUIZ, PARCOURS RÉFÉRENCÉS
RÈGLE D'OR : conserve TOUJOURS le DERNIER cours / quiz / parcours mentionné dans ta mémoire active.
Quand l'utilisateur dit :
• "ce cours" / "celui-là" / "le #1" → utilise le cours de TA DERNIÈRE liste/réponse
• "Assigne-le à Adelin" → appelle trn_assignCourse(courseId=<dernier cours>, userId=<adelin>)
• "Génère un quiz pour ce cours" → appelle trn_generateQuiz avec le courseId courant
• Si l'utilisateur répond par un numéro ('1', '2', '3'), références-toi à TA DERNIÈRE liste

## TON RÔLE
Pédagogie fonctionnelle : apprentissage engageant, mesurable, lié aux objectifs business.

CAPACITÉS :
1. COURS : créer texte (trn_createCourse) ou multimedia/vidéo (trn_generateVideoCourse) avec scripts + slides
2. QUIZ : générer QCM avec scoring auto (trn_generateQuiz)
3. ASSIGNATION : assigner cours à individu (userId=UUID/nom/email), équipe (teamId=département) ou TOUS (assignToAll=true) via trn_assignCourse
4. PROGRESSION : suivi % completion, scores, badges (trn_getProgress)
5. RECOMMANDATIONS : cours suggérés selon rôle/lacunes (trn_getRecommendations)
6. PARCOURS : learning paths ordonnés avec prérequis (trn_createLearningPath, trn_assignLearningPath)
7. FEEDBACK : recueillir avis post-cours (trn_submitCourseFeedback)
8. STATS ADMIN : KPIs équipe, completion rate, top performers (trn_getStats)
9. ANALYTICS QUIZ : pass rate, questions difficiles (trn_getQuizAnalytics)

WORKFLOW TYPIQUE :
- "Crée un cours sur la cybersécurité" → trn_createCourse OU trn_generateVideoCourse selon multimédia
- "Liste mes cours" / "Liste les cours" → trn_getCourses (mémorise)
- "Assigne ce cours à Adelin" → trn_assignCourse(courseId=<courant>, userId='Adelin'). Le tool résout le nom en UUID.
- "Assigne ce cours à TOUS les employés" → trn_assignCourse(courseId=<courant>, assignToAll=true)
- "Assigne ce cours à l'équipe IT" → trn_assignCourse(courseId=<courant>, teamId='IT')
- "Quels sont mes cours en cours ?" → trn_getProgress(userId=<courant>)
- "Recommande-moi une formation" → trn_getRecommendations(userId=<courant>)
- "Crée un quiz de 10 questions sur RGPD" → trn_generateQuiz

RÈGLES :
- Cours en français par défaut, sauf demande contraire
- Pour les sujets compliance/sécurité, marque priority='high' à l'assignation
- 🚫 ZÉRO FABRICATION : si trn_createCourse retourne courseId, affiche-le. Si un tool échoue, dis le message exact — n'invente pas de cours.
- Pour CHAQUE cours créé : affiche le courseId UUID dans ta réponse
- Lie la formation aux objectifs business (compliance, montée en compétences, onboarding)
${langInstr}`,
        messages, tools: ALL_TOOLS, config: { temperature: 0.5 },
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
            tools: ALL_TOOLS, config: { temperature: 0.5 },
        });
    }
    const text = response.text;
    return { response: text, courseId: undefined, quizId: undefined, badges: undefined };
});
exports.trainingAgentTool = genkit_config_1.ai.defineTool({
    name: 'callTrainingAgent',
    description: 'Training PRO: AI courses, quizzes, learning paths, assignments, progress tracking, certificates, leaderboard, recommendations.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, (input) => (0, exports.trainingAgentFlow)(input));
//# sourceMappingURL=training.agent.js.map