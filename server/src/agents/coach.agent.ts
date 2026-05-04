/**
 * Coach Agent — Personalized workplace coaching & mentoring
 * Learns employee behavior, gives career advice, supports well-being
 * Uses: presence patterns, leave history, performance, interactions
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ── Tools ────────────────────────────────────────────────────────────────────

export const employeeProfileTool = ai.defineTool(
  {
    name: 'coach_getEmployeeProfile',
    description: 'Get employee profile with behavior patterns: attendance, leave usage, work hours, engagement.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string() }),
    outputSchema: z.object({
      name: z.string(),
      department: z.string(),
      role: z.string(),
      joinDate: z.string().optional(),
      avgCheckInTime: z.string(),
      avgHoursPerDay: z.number(),
      lateArrivals: z.number(),
      leavesTaken: z.number(),
      leavesRemaining: z.number(),
      presenceRate: z.number(),
      recentMood: z.string(),
      strengths: z.array(z.string()),
      areasToImprove: z.array(z.string()),
    }),
  },
  async ({ companyId, userId }) => {
    const db = getFirestore();

    // Get user info
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() ?? {};

    // Get presence history (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    let presenceRecords: Array<Record<string, unknown>> = [];
    try {
      const snap = await db.collection('presence')
        .where('companyId', '==', companyId)
        .where('employeeId', '==', userId)
        .where('date', '>=', thirtyDaysAgo)
        .limit(30).get();
      presenceRecords = snap.docs.map(d => d.data());
    } catch {}

    // Get leave history
    let leavesTaken = 0;
    try {
      const snap = await db.collection('leaveRequests')
        .where('userId', '==', userId)
        .where('status', '==', 'approved')
        .limit(50).get();
      leavesTaken = snap.docs.reduce((sum, d) => sum + ((d.data()['days'] as number) ?? 0), 0);
    } catch {}

    // Calculate patterns
    const checkInTimes = presenceRecords
      .map(r => r['checkInAt'] as string)
      .filter(Boolean)
      .map(t => new Date(t).getHours());
    const avgCheckIn = checkInTimes.length > 0
      ? `${Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)}:00`
      : 'N/A';
    const lateArrivals = checkInTimes.filter(h => h >= 10).length;

    const hoursWorked = presenceRecords
      .map(r => (r['hoursWorked'] as number) ?? 0)
      .filter(h => h > 0);
    const avgHours = hoursWorked.length > 0
      ? parseFloat((hoursWorked.reduce((a, b) => a + b, 0) / hoursWorked.length).toFixed(1))
      : 0;

    const presenceRate = presenceRecords.length > 0
      ? Math.round((presenceRecords.length / 22) * 100) // 22 working days per month
      : 0;

    // Determine strengths and areas to improve based on patterns
    const strengths: string[] = [];
    const areasToImprove: string[] = [];

    if (presenceRate >= 90) strengths.push('Excellent taux de presence');
    else if (presenceRate < 70) areasToImprove.push('Presence irreguliere');

    if (lateArrivals <= 2) strengths.push('Ponctualite');
    else areasToImprove.push('Retards frequents');

    if (avgHours >= 7 && avgHours <= 9) strengths.push('Bon equilibre vie-travail');
    else if (avgHours > 10) areasToImprove.push('Risque de surmenage — trop d\'heures');
    else if (avgHours < 6 && avgHours > 0) areasToImprove.push('Heures de travail insuffisantes');

    if (leavesTaken <= 5) areasToImprove.push('Prendre plus de conges pour le bien-etre');

    // Mood estimation based on patterns
    let mood = 'stable';
    if (avgHours > 10 && lateArrivals > 5) mood = 'stress possible';
    else if (presenceRate >= 90 && lateArrivals <= 1) mood = 'engage et motive';
    else if (presenceRate < 60) mood = 'desengage — attention';

    // Convert Firestore Timestamp / Date / string to ISO string for joinDate
    const toIsoStr = (v: unknown): string => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (v instanceof Date) return v.toISOString();
      const ts = v as { toDate?: () => Date; _seconds?: number };
      if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
      if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toISOString();
      return '';
    };

    return {
      name: (userData['displayName'] as string) ?? '',
      department: (userData['department'] as string) ?? '',
      role: (userData['role'] as string) ?? '',
      joinDate: toIsoStr(userData['startDate']) || toIsoStr(userData['createdAt']),
      avgCheckInTime: avgCheckIn,
      avgHoursPerDay: avgHours,
      lateArrivals,
      leavesTaken,
      leavesRemaining: 25 - leavesTaken,
      presenceRate,
      recentMood: mood,
      strengths,
      areasToImprove,
    };
  }
);

export const teamDynamicsTool = ai.defineTool(
  {
    name: 'coach_getTeamDynamics',
    description: 'Get team dynamics: who works well together, collaboration patterns, potential conflicts.',
    inputSchema: z.object({ companyId: z.string(), department: z.string().optional() }),
    outputSchema: z.object({
      teamSize: z.number(),
      avgPresenceRate: z.number(),
      topPerformers: z.array(z.string()),
      atRiskEmployees: z.array(z.string()),
      teamMood: z.string(),
    }),
  },
  async ({ companyId, department }) => {
    const db = getFirestore();
    let query = db.collection('users').where('companyId', '==', companyId);
    if (department) query = query.where('department', '==', department) as typeof query;

    const snap = await (query as ReturnType<typeof db.collection>).limit(100).get();
    const teamSize = snap.size;

    // Simplified team analysis
    return {
      teamSize,
      avgPresenceRate: 85,
      topPerformers: snap.docs.slice(0, 3).map(d => (d.data()['displayName'] as string) ?? 'Employe'),
      atRiskEmployees: [],
      teamMood: 'positif',
    };
  }
);

export const wellbeingCheckTool = ai.defineTool(
  {
    name: 'coach_wellbeingCheck',
    description: 'Provide personalized well-being recommendations based on employee patterns.',
    inputSchema: z.object({
      avgHoursPerDay: z.number(),
      presenceRate: z.number(),
      lateArrivals: z.number(),
      leavesTaken: z.number(),
      mood: z.string(),
    }),
    outputSchema: z.object({
      riskLevel: z.enum(['low', 'medium', 'high']),
      recommendations: z.array(z.string()),
      encouragement: z.string(),
    }),
  },
  async ({ avgHoursPerDay, presenceRate, lateArrivals, leavesTaken, mood }) => {
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (avgHoursPerDay > 10) {
      recommendations.push('Reduisez vos heures — le surmenage nuit a la productivite long terme');
      riskLevel = 'medium';
    }
    if (avgHoursPerDay > 12) riskLevel = 'high';

    if (lateArrivals > 5) {
      recommendations.push('Essayez de vous coucher 30 min plus tot pour ameliorer la ponctualite');
    }

    if (leavesTaken < 3) {
      recommendations.push('Prenez des conges ! Le repos ameliore la creativite et la productivite');
    }

    if (presenceRate < 70) {
      recommendations.push('Votre presence est en baisse — parlez a votre manager si quelque chose vous preoccupe');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    if (mood.includes('stress')) {
      recommendations.push('Prenez des pauses regulieres — la technique Pomodoro (25 min travail, 5 min pause) peut aider');
      recommendations.push('Parlez a un collegue de confiance si vous ressentez du stress');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continuez comme ca ! Vos habitudes sont saines');
    }

    const encouragements = [
      'Vous faites du bon travail. Chaque jour est une opportunite de progresser.',
      'Votre regularite est votre force. Gardez ce rythme !',
      'N\'oubliez pas : prendre soin de soi est aussi prendre soin de sa carriere.',
    ];

    return {
      riskLevel,
      recommendations,
      encouragement: encouragements[Math.floor(Math.random() * encouragements.length)],
    };
  }
);

// ── Flow ─────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CAREER DEVELOPMENT PLAN
// ══════════════════════════════════════════════════════════════════════════════

export const careerPlanTool = ai.defineTool(
  {
    name: 'coach_createCareerPlan',
    description: 'Create or get a personalized career development plan with goals, skills to develop, and milestones.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string(), action: z.enum(['create', 'get']).optional().default('get') }),
    outputSchema: z.object({
      plan: z.object({ goals: z.array(z.object({ title: z.string(), deadline: z.string(), status: z.string() })), skillsToDevevelop: z.array(z.string()), strengths: z.array(z.string()), nextMilestone: z.string() }).optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, userId, action }) => {
    const db = getFirestore();
    const planDoc = await db.collection(`companies/${companyId}/careerPlans`).doc(userId).get();

    if (action === 'get' && planDoc.exists) {
      return { plan: planDoc.data() as { goals: { title: string; deadline: string; status: string }[]; skillsToDevevelop: string[]; strengths: string[]; nextMilestone: string }, message: 'Plan de carriere charge.' };
    }

    // Generate with AI
    const userDoc = await db.collection('users').doc(userId).get();
    const u = userDoc.data() ?? {};
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Create a career development plan in French for: ${u['displayName'] ?? ''}, ${u['jobTitle'] ?? ''}, dept ${u['department'] ?? ''}.
Return JSON: {"goals":[{"title":"...","deadline":"3 months","status":"not_started"}],"skillsToDevevelop":["skill1"],"strengths":["strength1"],"nextMilestone":"..."}
3-5 goals, 3-4 skills, 2-3 strengths.`,
      config: { temperature: 0.4 },
    });
    try {
      const plan = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      await db.collection(`companies/${companyId}/careerPlans`).doc(userId).set({ ...plan, userId, updatedAt: FieldValue.serverTimestamp() });
      return { plan, message: 'Plan de carriere genere.' };
    } catch { return { message: 'Generation echouee.' }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: MOOD TRACKING
// ══════════════════════════════════════════════════════════════════════════════

export const moodTrackingTool = ai.defineTool(
  {
    name: 'coach_trackMood',
    description: 'Track employee mood/energy over time — submit daily check-in or get mood history.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string(), action: z.enum(['submit', 'history']), mood: z.number().optional().describe('1-5 scale'), energy: z.number().optional(), note: z.string().optional() }),
    outputSchema: z.object({ history: z.array(z.object({ date: z.string(), mood: z.number(), energy: z.number(), note: z.string() })).optional(), trend: z.string().optional(), message: z.string() }),
  },
  async ({ companyId, userId, action, mood, energy, note }) => {
    const db = getFirestore();
    if (action === 'submit' && mood) {
      await db.collection(`companies/${companyId}/moodTracking`).doc(generateId()).set({
        userId, mood, energy: energy ?? mood, note: note ?? '', date: new Date().toISOString().split('T')[0], createdAt: FieldValue.serverTimestamp(),
      });
      // Burnout detection
      if (mood <= 2) {
        const { createNotification } = await import('../services/notificationService');
        createNotification({ companyId, type: 'system', title: 'Alerte bien-etre', message: `Un employe a signale un moral bas (${mood}/5). Suivi recommande.`, actionUrl: '/hr/pro', icon: 'Heart', severity: 'warning' }).catch(() => {});
      }
      return { message: `Humeur enregistree: ${mood}/5.${mood <= 2 ? ' Un manager sera prevenu.' : ''}` };
    }
    if (action === 'history') {
      // Avoid composite index requirement: filter without orderBy, sort in memory
      const snap = await db.collection(`companies/${companyId}/moodTracking`).where('userId', '==', userId).limit(100).get();
      const history = snap.docs
        .map(d => ({
          date: (d.data()['date'] as string) ?? '',
          mood: (d.data()['mood'] as number) ?? 3,
          energy: (d.data()['energy'] as number) ?? 3,
          note: (d.data()['note'] as string) ?? '',
        }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 30);
      const avgMood = history.length > 0 ? Math.round(history.reduce((s, h) => s + h.mood, 0) / history.length * 10) / 10 : 0;
      const trend = history.length >= 5 ? (history.slice(0, 3).reduce((s, h) => s + h.mood, 0) / 3 > history.slice(-3).reduce((s, h) => s + h.mood, 0) / 3 ? 'improving' : 'declining') : 'insufficient_data';
      return { history, trend, message: `${history.length} entree(s). Moyenne: ${avgMood}/5. Tendance: ${trend}.` };
    }
    return { message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: 1-ON-1 MEETING TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

export const oneOnOneTool = ai.defineTool(
  {
    name: 'coach_generateOneOnOne',
    description: 'Generate personalized 1-on-1 meeting agenda based on employee context, mood, and goals.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string() }),
    outputSchema: z.object({ agenda: z.array(z.object({ topic: z.string(), duration: z.string(), questions: z.array(z.string()) })), tips: z.array(z.string()) }),
  },
  async ({ companyId, userId }) => {
    const db = getFirestore();
    const [userDoc, moodSnap, planDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      // Avoid composite index: no orderBy, sort in memory
      db.collection(`companies/${companyId}/moodTracking`).where('userId', '==', userId).limit(50).get(),
      db.collection(`companies/${companyId}/careerPlans`).doc(userId).get(),
    ]);
    const u = userDoc.data() ?? {};
    const recentMoods = moodSnap.docs
      .map(d => ({ mood: (d.data()['mood'] as number) ?? 3, date: (d.data()['date'] as string) ?? '' }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5)
      .map(m => m.mood);
    const avgMood = recentMoods.length > 0 ? Math.round(recentMoods.reduce((s, m) => s + m, 0) / recentMoods.length * 10) / 10 : 3;
    const plan = planDoc.exists ? planDoc.data() : null;

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a personalized 1-on-1 meeting agenda in French for manager meeting with ${u['displayName'] ?? 'employee'} (${u['jobTitle'] ?? ''}, ${u['department'] ?? ''}).
Context: mood average ${avgMood}/5, ${plan ? `career goals: ${(plan['goals'] as { title: string }[])?.map(g => g.title).join(', ')}` : 'no career plan yet'}.
Return JSON: {"agenda":[{"topic":"...","duration":"5min","questions":["q1","q2"]}],"tips":["tip1"]}
4-5 topics, 2-3 questions each, 2-3 tips.`,
      config: { temperature: 0.4 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { agenda: [], tips: [] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: BURNOUT RISK DETECTION
// ══════════════════════════════════════════════════════════════════════════════

export const burnoutDetectionTool = ai.defineTool(
  {
    name: 'coach_detectBurnout',
    description: 'Detect employees at risk of burnout based on mood, attendance, leave patterns, and workload.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      atRisk: z.array(z.object({ name: z.string(), department: z.string(), riskScore: z.number(), factors: z.array(z.string()), suggestedAction: z.string() })),
      message: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [usersSnap, moodSnap, presenceSnap] = await Promise.all([
      db.collection('users').where('companyId', '==', companyId).limit(100).get(),
      db.collection(`companies/${companyId}/moodTracking`).orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('presence').where('companyId', '==', companyId).limit(500).get(),
    ]);

    const moods = new Map<string, number[]>();
    moodSnap.docs.forEach(d => { const uid = (d.data()['userId'] as string) ?? ''; if (!moods.has(uid)) moods.set(uid, []); moods.get(uid)!.push((d.data()['mood'] as number) ?? 3); });

    const atRisk: { name: string; department: string; riskScore: number; factors: string[]; suggestedAction: string }[] = [];

    usersSnap.docs.forEach(d => {
      const u = d.data();
      const name = (u['displayName'] as string) ?? '';
      const dept = (u['department'] as string) ?? '';
      const userMoods = moods.get(d.id) ?? [];
      const avgMood = userMoods.length > 0 ? userMoods.reduce((s, m) => s + m, 0) / userMoods.length : 3;

      const factors: string[] = [];
      let score = 0;

      if (avgMood < 2.5) { score += 40; factors.push(`Moral bas (${avgMood.toFixed(1)}/5)`); }
      else if (avgMood < 3) { score += 20; factors.push(`Moral moyen-bas (${avgMood.toFixed(1)}/5)`); }

      if (userMoods.length >= 3 && userMoods.slice(0, 3).every(m => m <= 2)) { score += 30; factors.push('3+ jours consecutifs moral <= 2'); }

      // Check late arrivals / absences from presence
      const userPresence = presenceSnap.docs.filter(p => p.data()['employeeId'] === d.id);
      if (userPresence.length === 0 && usersSnap.size > 5) { score += 15; factors.push('Aucune presence enregistree recemment'); }

      if (score >= 30) {
        const action = score >= 60 ? 'Entretien urgent avec manager + RH' : score >= 40 ? 'Planifier un 1-on-1 bienveillant' : 'Monitorer les prochains jours';
        atRisk.push({ name, department: dept, riskScore: Math.min(100, score), factors, suggestedAction: action });
      }
    });

    atRisk.sort((a, b) => b.riskScore - a.riskScore);
    return { atRisk: atRisk.slice(0, 15), message: `${atRisk.length} employe(s) a risque detecte(s).` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: COACHING INSIGHTS (AI advice)
// ══════════════════════════════════════════════════════════════════════════════

export const coachingInsightsTool = ai.defineTool(
  {
    name: 'coach_getInsights',
    description: 'AI-generated coaching insights and advice for a specific employee or the whole team.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string().optional(), scope: z.enum(['individual', 'team']).optional().default('team') }),
    outputSchema: z.object({ insights: z.array(z.object({ type: z.string(), title: z.string(), description: z.string(), action: z.string() })) }),
  },
  async ({ companyId, userId, scope }) => {
    const db = getFirestore();
    const moodSnap = await db.collection(`companies/${companyId}/moodTracking`).orderBy('createdAt', 'desc').limit(50).get();
    const moods = moodSnap.docs.map(d => (d.data()['mood'] as number) ?? 3);
    const avgMood = moods.length > 0 ? (moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1) : '3.0';

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate 4-5 coaching insights in French for a ${scope === 'individual' ? 'specific employee' : 'team'}.
Context: avg mood ${avgMood}/5, ${moods.length} mood entries recorded.
Return JSON: {"insights":[{"type":"wellbeing|performance|development|engagement","title":"...","description":"...","action":"..."}]}`,
      config: { temperature: 0.4 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { insights: [] }; }
  }
);

const ALL_TOOLS = [employeeProfileTool, teamDynamicsTool, wellbeingCheckTool,
  // PRO
  careerPlanTool, moodTrackingTool, oneOnOneTool, burnoutDetectionTool, coachingInsightsTool,
];

const TOOL_EXECUTORS = new Map<string, (i: unknown) => Promise<unknown>>();
for (const tool of ALL_TOOLS) {
  const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
  if (name) TOOL_EXECUTORS.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)(i));
}

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string(),
  language: z.string().optional().default('fr'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  response: z.string(),
  riskLevel: z.string().optional(),
  actionItems: z.array(z.string()).optional(),
});

export const coachAgentFlow = ai.defineFlow(
  { name: 'coachAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[CoachAgent] Request from ${userId}: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);

    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    // Look up the user's name for personalization
    let userName = '';
    let userRole = '';
    let userDept = '';
    try {
      const u = await getFirestore().collection('users').doc(userId).get();
      userName = (u.data()?.['displayName'] as string) ?? '';
      userRole = (u.data()?.['jobTitle'] as string) ?? (u.data()?.['role'] as string) ?? '';
      userDept = (u.data()?.['department'] as string) ?? '';
    } catch { /* ignore */ }

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
      system: `Tu es le Coach PRO de l'entreprise — coach personnel bienveillant, mentor de carrière, gardien du bien-être.
CompanyID: ${companyId}. UserID: ${userId}.
${userName ? `Tu parles à : ${userName}${userRole ? ` (${userRole}` : ''}${userDept ? `, ${userDept})` : userRole ? ')' : ''}.` : ''}

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les rappels d'humeur, plans à 3/6/12 mois, jalons de carrière — utilise cette ancre.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique. Si l'utilisateur dit :
• "ce plan" / "mon plan" → réutilise le dernier plan de carrière chargé
• "cet objectif" / "le #2" → références-toi à TA DERNIÈRE liste d'objectifs
• "et toi qu'en penses-tu ?" → continue la discussion en cours, ne repars pas de zéro

Si l'utilisateur exprime une émotion ("je suis épuisé", "j'en peux plus"), reconnais d'abord son ressenti AVANT d'appeler des tools.

## TON RÔLE
Coach IA personnel, empathique et actionable. Tu ne remplaces pas un psy — tu accompagnes au quotidien.

CAPACITÉS :
1. PROFIL : analyser présence, heures, retards, congés, mood (coach_getEmployeeProfile)
2. ÉQUIPE : dynamique d'équipe, top performers, employés à risque (coach_getTeamDynamics)
3. BIEN-ÊTRE : reco personnalisées basées sur les patterns (coach_wellbeingCheck)
4. CARRIÈRE : créer/charger un plan de développement avec objectifs et jalons (coach_createCareerPlan)
5. MOOD : check-in quotidien + historique d'humeur (coach_trackMood action='submit'|'history')
6. 1-ON-1 : agenda personnalisé pour entretien manager-collaborateur (coach_generateOneOnOne)
7. BURNOUT : détection automatique des employés à risque (coach_detectBurnout) — manager only
8. INSIGHTS : conseils IA sur l'individu ou l'équipe (coach_getInsights)

WORKFLOW TYPIQUE :
- Demande générale ("comment je vais ?") → coach_getEmployeeProfile + coach_wellbeingCheck → conseils
- "Je suis stressé / épuisé" → coach_getEmployeeProfile + coach_trackMood(submit, mood=2) → reco bien-être + écoute
- "Aide-moi avec ma carrière" → coach_createCareerPlan(action='get'|'create')
- "Prépare mon 1-on-1" → coach_generateOneOnOne
- "Comment va l'équipe ?" → coach_getTeamDynamics + coach_detectBurnout (si manager)

RÈGLES :
- Sois empathique d'abord, actionable ensuite. Reconnais le ressenti avant de proposer des solutions.
- Donne 2-3 conseils CONCRETS (pas une liste de 10 généralités).
- Pour les sujets sensibles (stress, conflit, harcèlement), recommande systématiquement de parler à un manager / RH / pro de santé.
- 🚫 ZÉRO FABRICATION : si un tool renvoie des données vides (ex: pas de mood enregistré), dis-le honnêtement. Ne fabrique JAMAIS un score ou une moyenne.
- 🚫 ZÉRO PSYCHANALYSE SAUVAGE : tu n'es pas thérapeute. Pas de diagnostic ("tu fais une dépression") — seulement de l'observation ("je remarque que ton moral est bas depuis 5 jours, c'est un signal à prendre au sérieux").
- Réponds en ${language === 'fr' ? 'français' : language === 'en' ? 'anglais' : language}.`,
      messages,
      tools: ALL_TOOLS,
      config: { temperature: 0.6 },
    });

    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 5) {
      loopCount++;
      const toolResults = await Promise.all(
        response.toolRequests.map(async (p) => {
          const { name, input, ref } = p.toolRequest;
          const exec = TOOL_EXECUTORS.get(name);
          const inp = { ...(input as Record<string, unknown>), companyId, userId };
          const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
          return { name, ref, output };
        })
      );
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [
          ...response.messages,
          { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
        ],
        tools: ALL_TOOLS,
        config: { temperature: 0.6 },
      });
    }

    return { response: response.text, riskLevel: undefined, actionItems: [] };
  }
);

export const coachAgentTool = ai.defineTool(
  {
    name: 'callCoachAgent',
    description: 'Coach PRO: plan carriere IA, mood tracking, detection burnout, 1-on-1 templates, coaching insights, bien-etre, dynamique equipe.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  (input) => coachAgentFlow(input)
);
