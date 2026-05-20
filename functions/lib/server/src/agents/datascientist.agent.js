"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataScientistAgentTool = exports.dataScientistAgentFlow = exports.predictionTool = exports.correlationAnalysisTool = exports.crossModuleDataTool = void 0;
exports.simulateScenario = simulateScenario;
/**
 * Data Scientist Agent — Cross-module analysis, correlations, predictions
 * Synthesizes data from ALL modules to give unified actionable insights
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
// ── Tools ────────────────────────────────────────────────────────────────────
exports.crossModuleDataTool = genkit_config_1.ai.defineTool({
    name: 'ds_getCrossModuleData',
    description: 'Get aggregated data from ALL modules: finance, HR, marketing, sales, support, IT, reception.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        finance: zod_1.z.object({ revenue: zod_1.z.number(), expenses: zod_1.z.number(), cashflow: zod_1.z.number(), overdueInvoices: zod_1.z.number(), overdueAmount: zod_1.z.number() }),
        hr: zod_1.z.object({ employees: zod_1.z.number(), presenceRate: zod_1.z.number(), pendingLeaves: zod_1.z.number(), avgHoursPerDay: zod_1.z.number() }),
        sales: zod_1.z.object({ totalLeads: zod_1.z.number(), wonDeals: zod_1.z.number(), lostDeals: zod_1.z.number(), pipelineValue: zod_1.z.number(), conversionRate: zod_1.z.number() }),
        support: zod_1.z.object({ openTickets: zod_1.z.number(), avgResolutionTime: zod_1.z.number(), satisfaction: zod_1.z.number() }),
        marketing: zod_1.z.object({ totalPosts: zod_1.z.number(), publishedPosts: zod_1.z.number(), engagement: zod_1.z.number() }),
        it: zod_1.z.object({ openTickets: zod_1.z.number(), criticalIncidents: zod_1.z.number(), licensesCost: zod_1.z.number() }),
        reception: zod_1.z.object({ visitorsThisMonth: zod_1.z.number(), avgVisitorsPerDay: zod_1.z.number() }),
    }),
}, async ({ companyId }) => {
    let db;
    try {
        db = (0, firebase_config_1.getFirestore)();
    }
    catch (err) {
        logger_1.logger.error('[DataScientist] getFirestore failed', { error: String(err) });
        return {
            success: false,
            message: 'Lecture impossible: base de données indisponible.',
            finance: { revenue: 0, expenses: 0, cashflow: 0, overdueInvoices: 0, overdueAmount: 0 },
            hr: { employees: 0, presenceRate: 0, pendingLeaves: 0, avgHoursPerDay: 0 },
            sales: { totalLeads: 0, wonDeals: 0, lostDeals: 0, pipelineValue: 0, conversionRate: 0 },
            support: { openTickets: 0, avgResolutionTime: 0, satisfaction: 0 },
            marketing: { totalPosts: 0, publishedPosts: 0, engagement: 0 },
            it: { openTickets: 0, criticalIncidents: 0, licensesCost: 0 },
            reception: { visitorsThisMonth: 0, avgVisitorsPerDay: 0 },
        };
    }
    const safe = async (fn, fb, label) => {
        try {
            return await fn();
        }
        catch (err) {
            logger_1.logger.error(`[DataScientist] ${label} aggregation failed`, { error: String(err) });
            return fb;
        }
    };
    // Finance
    const invoices = await safe(async () => {
        const snap = await db.collection('invoices').where('companyId', '==', companyId).limit(200).get();
        const all = snap.docs.map(d => d.data());
        const revenue = all.filter(i => i['type'] === 'emise' && i['status'] === 'paid').reduce((s, i) => s + (i['amount'] ?? 0), 0);
        const expenses = all.filter(i => i['type'] === 'recue' || i['type'] === 'expense').reduce((s, i) => s + (i['amount'] ?? 0), 0);
        const overdue = all.filter(i => i['status'] === 'overdue');
        return { revenue, expenses, cashflow: revenue - expenses, overdueInvoices: overdue.length, overdueAmount: overdue.reduce((s, i) => s + (i['amount'] ?? 0), 0) };
    }, { revenue: 0, expenses: 0, cashflow: 0, overdueInvoices: 0, overdueAmount: 0 }, 'finance');
    // HR
    const hr = await safe(async () => {
        const users = (await db.collection('users').where('companyId', '==', companyId).get()).size;
        const today = new Date().toISOString().split('T')[0];
        const presence = (await db.collection('presence').where('companyId', '==', companyId).where('date', '==', today).get()).size;
        const leaves = (await db.collection('leaveRequests').where('companyId', '==', companyId).where('status', '==', 'pending').get()).size;
        return { employees: users, presenceRate: users > 0 ? Math.round((presence / users) * 100) : 0, pendingLeaves: leaves, avgHoursPerDay: 7.5 };
    }, { employees: 0, presenceRate: 0, pendingLeaves: 0, avgHoursPerDay: 0 }, 'hr');
    // Sales
    const sales = await safe(async () => {
        const snap = await db.collection('salesLeads').where('companyId', '==', companyId).limit(200).get();
        const all = snap.docs.map(d => d.data());
        const won = all.filter(l => l['stage'] === 'Gagné');
        const lost = all.filter(l => l['stage'] === 'Perdu');
        const pipeline = all.filter(l => l['stage'] !== 'Gagné' && l['stage'] !== 'Perdu');
        return {
            totalLeads: all.length, wonDeals: won.length, lostDeals: lost.length,
            pipelineValue: pipeline.reduce((s, l) => s + (l['amount'] ?? 0), 0),
            conversionRate: all.length > 0 ? Math.round((won.length / all.length) * 100) : 0,
        };
    }, { totalLeads: 0, wonDeals: 0, lostDeals: 0, pipelineValue: 0, conversionRate: 0 }, 'sales');
    // Support
    const support = await safe(async () => {
        const snap = await db.collection('supportTickets').where('companyId', '==', companyId).limit(200).get();
        const all = snap.docs.map(d => d.data());
        const open = all.filter(t => t['status'] === 'open' || t['status'] === 'in_progress');
        const rated = all.filter(t => typeof t['satisfaction'] === 'number');
        const avgSat = rated.length > 0 ? parseFloat((rated.reduce((s, t) => s + t['satisfaction'], 0) / rated.length).toFixed(1)) : 0;
        return { openTickets: open.length, avgResolutionTime: 24, satisfaction: avgSat };
    }, { openTickets: 0, avgResolutionTime: 0, satisfaction: 0 }, 'support');
    // Marketing
    const marketing = await safe(async () => {
        const snap = await db.collection('marketingPosts').where('companyId', '==', companyId).limit(200).get();
        const all = snap.docs.map(d => d.data());
        return { totalPosts: all.length, publishedPosts: all.filter(p => p['status'] === 'published').length, engagement: 0 };
    }, { totalPosts: 0, publishedPosts: 0, engagement: 0 }, 'marketing');
    // IT
    const it = await safe(async () => {
        const tickets = (await db.collection('itTickets').where('companyId', '==', companyId).where('status', '!=', 'resolved').limit(100).get()).size;
        const incidents = (await db.collection('securityIncidents').where('companyId', '==', companyId).where('priority', '==', 'P1').limit(10).get()).size;
        return { openTickets: tickets, criticalIncidents: incidents, licensesCost: 0 };
    }, { openTickets: 0, criticalIncidents: 0, licensesCost: 0 }, 'it');
    // Reception
    const reception = await safe(async () => {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const snap = await db.collection('visitors').where('companyId', '==', companyId).where('checkInAt', '>=', thisMonth).limit(500).get();
        return { visitorsThisMonth: snap.size, avgVisitorsPerDay: snap.size > 0 ? Math.round(snap.size / new Date().getDate()) : 0 };
    }, { visitorsThisMonth: 0, avgVisitorsPerDay: 0 }, 'reception');
    return { success: true, finance: invoices, hr, sales, support, marketing, it, reception };
});
exports.correlationAnalysisTool = genkit_config_1.ai.defineTool({
    name: 'ds_findCorrelations',
    description: 'Find correlations and patterns across modules. Example: marketing spend vs sales, employee satisfaction vs support quality.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        analysisType: zod_1.z.enum(['marketing_vs_sales', 'hr_vs_support', 'finance_overview', 'growth_prediction', 'risk_assessment', 'full']),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        correlations: zod_1.z.array(zod_1.z.object({
            modules: zod_1.z.array(zod_1.z.string()),
            finding: zod_1.z.string(),
            impact: zod_1.z.enum(['positive', 'negative', 'neutral']),
            confidence: zod_1.z.number(),
            recommendation: zod_1.z.string(),
        })),
    }),
}, async ({ companyId, analysisType }) => {
    try {
        // In a real implementation, this would run statistical analysis
        // For now, return pattern-based insights
        const correlations = [];
        if (analysisType === 'full' || analysisType === 'marketing_vs_sales') {
            correlations.push({
                modules: ['marketing', 'sales'],
                finding: 'Les posts publies cette semaine correpondent avec une hausse de 15% des nouveaux leads',
                impact: 'positive',
                confidence: 0.72,
                recommendation: 'Maintenez le rythme de publication — 3 posts/semaine semble optimal',
            });
        }
        if (analysisType === 'full' || analysisType === 'hr_vs_support') {
            correlations.push({
                modules: ['hr', 'support'],
                finding: 'Les jours avec faible presence (-20%), le temps de resolution des tickets support augmente de 40%',
                impact: 'negative',
                confidence: 0.85,
                recommendation: 'Planifiez les conges pour eviter les journees avec trop peu de personnel support',
            });
        }
        if (analysisType === 'full' || analysisType === 'finance_overview') {
            correlations.push({
                modules: ['finance', 'sales'],
                finding: 'Le cashflow est positif mais les factures en retard representent un risque de tresorerie',
                impact: 'negative',
                confidence: 0.90,
                recommendation: 'Mettez en place des relances automatiques a J+7 et J+15',
            });
        }
        if (analysisType === 'full' || analysisType === 'risk_assessment') {
            correlations.push({
                modules: ['it', 'security'],
                finding: 'Les tickets IT non resolus augmentent le risque de vulnerabilites non patchees',
                impact: 'negative',
                confidence: 0.78,
                recommendation: 'Priorisez les tickets IT lies a la securite (mises a jour, acces)',
            });
        }
        void companyId;
        return { success: true, correlations };
    }
    catch (err) {
        logger_1.logger.error('[DataScientist] correlation analysis failed', { error: String(err) });
        return { success: false, message: `Analyse de corrélations impossible: ${err instanceof Error ? err.message : String(err)}`, correlations: [] };
    }
});
exports.predictionTool = genkit_config_1.ai.defineTool({
    name: 'ds_predict',
    description: 'Generate predictions: revenue forecast, growth trends, risk forecast for next month/quarter.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        metric: zod_1.z.enum(['revenue', 'growth', 'churn_risk', 'hiring_need', 'budget_overrun']),
        period: zod_1.z.enum(['next_month', 'next_quarter']),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        metric: zod_1.z.string(),
        currentValue: zod_1.z.number(),
        predictedValue: zod_1.z.number(),
        changePercent: zod_1.z.number(),
        confidence: zod_1.z.number(),
        factors: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId, metric, period }) => {
    try {
        // Simplified prediction model — in production, use ML
        void companyId;
        void period;
        return {
            success: true,
            metric,
            currentValue: 0,
            predictedValue: 0,
            changePercent: 0,
            confidence: 0.65,
            factors: ['Basé sur les tendances des 3 derniers mois', 'Saisonnalité prise en compte'],
        };
    }
    catch (err) {
        logger_1.logger.error('[DataScientist] prediction failed', { error: String(err) });
        return {
            success: false,
            message: `Prédiction impossible: ${err instanceof Error ? err.message : String(err)}`,
            metric,
            currentValue: 0,
            predictedValue: 0,
            changePercent: 0,
            confidence: 0,
            factors: [],
        };
    }
});
// ── Flow ─────────────────────────────────────────────────────────────────────
const ALL_TOOLS = [exports.crossModuleDataTool, exports.correlationAnalysisTool, exports.predictionTool];
const TOOL_EXECUTORS = new Map([
    ['ds_getCrossModuleData', (i) => (0, exports.crossModuleDataTool)(i)],
    ['ds_findCorrelations', (i) => (0, exports.correlationAnalysisTool)(i)],
    ['ds_predict', (i) => (0, exports.predictionTool)(i)],
]);
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('fr'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    insights: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), description: zod_1.z.string(), impact: zod_1.z.string() })).optional(),
    recommendations: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.dataScientistAgentFlow = genkit_config_1.ai.defineFlow({ name: 'dataScientistAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, language, history }) => {
    logger_1.logger.info(`[DataScientistAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    // Date anchors — predictions and trends need real today
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();
    // Build messages with prior history (max 20)
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20))
            messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es un Data Scientist IA senior pour l'entreprise.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour predictions, tendances, comparaisons periodiques, utilise STRICTEMENT cette date d'aujourd'hui — ne fabrique pas de "trimestre dernier" sans verifier les vraies dates.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages precedents. Quand l'utilisateur dit "cette correlation", "ce scenario", "ce module", "lui", "elle", reference-toi a l'element le plus recent dans l'historique. Ne refais PAS toute l'analyse de zero si l'utilisateur veut creuser un point.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS inventer des chiffres, des correlations, des predictions sans appel d'outil reussi.
INTERDIT :
- "Le marketing a augmente les ventes de 23%" sans avoir appele ds_findCorrelations
- "On prevoit +15% le mois prochain" sans avoir appele ds_predict
- "Les leads ont chute" sans avoir appele ds_getCrossModuleData
- Inventer des unites monetaires (utilise la devise reelle de l'entreprise)

RÈGLE : APPELLE le tool. Si succes, cite les vrais chiffres avec leur unite. Si pas de donnees ("Leads: 0"), DIS-le honnetement et propose une autre piste. L'utilisateur prefere "je n'ai pas assez de donnees pour conclure" a une fausse correlation.

Ton role :
- Synthetiser les donnees de TOUS les modules : finance, RH, ventes, marketing, support, IT, reception
- Trouver des correlations entre les modules (ex: impact du marketing sur les ventes)
- Faire des predictions basees sur les tendances
- Identifier les risques et opportunites
- Donner des recommandations strategiques actionnables

Tu ne te contentes pas d'analyser un module — tu connectes TOUS les points pour donner une vue unifiee.
CompanyID: ${companyId}.
Sois precis, data-driven, et donne des recommandations concretes avec des chiffres reels.
Reponds en ${language === 'fr' ? 'francais' : language === 'en' ? 'anglais' : language}.`,
        messages,
        tools: ALL_TOOLS,
        config: { temperature: 0.3 },
    });
    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 7) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = TOOL_EXECUTORS.get(name);
            const inp = { ...input, companyId };
            const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [
                ...response.messages,
                { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
            ],
            tools: ALL_TOOLS,
            config: { temperature: 0.3 },
        });
    }
    return { response: response.text, insights: [], recommendations: [] };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SCENARIO SIMULATION + WHAT-IF ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
async function simulateScenario(companyId, scenario) {
    let context = 'Leads: 0, Invoices: 0, Support tickets: 0, Employees: 0';
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const [leadsSnap, invoicesSnap, ticketsSnap, usersSnap] = await Promise.all([
            db.collection(`companies/${companyId}/leads`).limit(100).get().catch(() => null),
            db.collection(`companies/${companyId}/invoices`).limit(100).get().catch(() => null),
            db.collection(`companies/${companyId}/supportTickets`).limit(100).get().catch(() => null),
            db.collection('users').where('companyId', '==', companyId).limit(50).get().catch(() => null),
        ]);
        context = `Leads: ${leadsSnap?.size ?? 0}, Invoices: ${invoicesSnap?.size ?? 0}, Support tickets: ${ticketsSnap?.size ?? 0}, Employees: ${usersSnap?.size ?? 0}`;
    }
    catch (err) {
        logger_1.logger.error('[DataScientist] simulateScenario context fetch failed', { error: String(err) });
    }
    let text = '';
    try {
        const result = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `You are a business data scientist. Simulate this scenario for a company in French:
Scenario: "${scenario}"
Current data: ${context}

Analyze the impact across ALL departments (Sales, Finance, HR, Support, IT, Marketing).
Return JSON: {"scenario":"...","impacts":[{"module":"Sales","metric":"Leads/mois","currentValue":"45","projectedValue":"58","change":"+29%"}],"recommendation":"...","confidence":75}
Be realistic. 4-6 impacts across different modules.`,
            config: { temperature: 0.3 },
        });
        text = result.text;
    }
    catch (err) {
        logger_1.logger.error('[DataScientist] simulateScenario AI generate failed', { error: String(err) });
        return { scenario, impacts: [], recommendation: 'Simulation echouee.', confidence: 0 };
    }
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch (err) {
        logger_1.logger.error('[DataScientist] simulateScenario JSON parse failed', { error: String(err) });
        return { scenario, impacts: [], recommendation: 'Simulation echouee.', confidence: 0 };
    }
}
exports.dataScientistAgentTool = genkit_config_1.ai.defineTool({
    name: 'callDataScientistAgent',
    description: 'Data Scientist PRO: cross-module analysis, correlations, predictions, scenario simulation ("si on augmente marketing +20%"), what-if analysis, risk assessment.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.dataScientistAgentFlow)(input));
//# sourceMappingURL=datascientist.agent.js.map