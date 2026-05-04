"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContext = void 0;
exports.classifyIntentFast = classifyIntentFast;
exports.classifyIntentAI = classifyIntentAI;
exports.decomposeRequest = decomposeRequest;
exports.executeParallel = executeParallel;
exports.getAgentHealth = getAgentHealth;
exports.recordAgentCall = recordAgentCall;
exports.isAgentAvailable = isAgentAvailable;
exports.getAllAgentHealth = getAllAgentHealth;
exports.createTrace = createTrace;
exports.addTraceStep = addTraceStep;
exports.getRecentTraces = getRecentTraces;
exports.persistTrace = persistTrace;
exports.sortByAgentPriority = sortByAgentPriority;
exports.getAgentPriority = getAgentPriority;
exports.getAllAgentPriorities = getAllAgentPriorities;
exports.checkConflict = checkConflict;
exports.recordAction = recordAction;
exports.getRecentConflicts = getRecentConflicts;
exports.recordFeedback = recordFeedback;
exports.getAgentFeedbackStats = getAgentFeedbackStats;
exports.persistFeedbackStats = persistFeedbackStats;
/**
 * Orchestrator Intelligence Layer
 *
 * 1. Intent Classification — classify user intent with confidence + routing
 * 2. Request Decomposition — break complex queries into sub-tasks
 * 3. Parallel Execution — run independent agents concurrently
 * 4. Agent Health Monitor — track latency, errors, circuit breaker
 * 5. Execution Tracing — log every step for observability
 * 6. Cross-Agent Context — share data between agents in same request
 */
const genkit_config_1 = require("../../config/genkit.config");
const logger_1 = require("../../utils/logger");
const firebase_config_1 = require("../../config/firebase.config");
const helpers_1 = require("../../utils/helpers");
const AGENT_MAP = {
    hr: { keywords: ['conge', 'leave', 'absence', 'recrutement', 'onboarding', 'employe', 'rh', 'effectif', 'paie'], tool: 'callHRAgent' },
    sales: { keywords: ['lead', 'prospect', 'pipeline', 'devis', 'quote', 'client', 'vente', 'commercial', 'deal', 'crm', 'relance'], tool: 'callSalesAgent' },
    accounting: { keywords: ['facture', 'invoice', 'budget', 'tresorerie', 'depense', 'comptabilite', 'finance', 'frais'], tool: 'callAccountingAgent' },
    support: { keywords: ['ticket', 'support', 'client mecontent', 'reclamation', 'sla', 'escalade'], tool: 'callSupportAgent' },
    it: { keywords: ['serveur', 'reseau', 'panne', 'bug', 'logiciel', 'licence', 'asset', 'helpdesk', 'it'], tool: 'callITAgent' },
    security: { keywords: ['securite', 'incident', 'phishing', 'vulnerabilite', 'compliance', 'rgpd', 'menace', 'audit securite'], tool: 'callCybersecurityAgent' },
    reception: { keywords: ['visiteur', 'reception', 'presence', 'pointage', 'badge', 'livraison', 'parking', 'evacuation'], tool: 'callReceptionAgent' },
    marketing: { keywords: ['marketing', 'post', 'social', 'campagne', 'linkedin', 'instagram', 'seo', 'contenu', 'blog'], tool: 'callMarketingAgent' },
    legal: { keywords: ['contrat', 'juridique', 'legal', 'nda', 'clause', 'dossier juridique', 'conformite'], tool: 'callLegalAgent' },
    training: { keywords: ['formation', 'cours', 'quiz', 'training', 'apprentissage', 'parcours', 'certificat'], tool: 'callTrainingAgent' },
    comms: { keywords: ['email', 'notification', 'annonce', 'telegram', 'whatsapp', 'slack', 'message'], tool: 'draftCommunication' },
    knowledge: { keywords: ['document', 'recherche', 'resume', 'lire', 'analyser', 'comparer'], tool: 'callKnowledgeAgent' },
    insights: { keywords: ['tendance', 'analyse', 'kpi', 'performance', 'dashboard', 'rapport global'], tool: 'generateInsights' },
    news: { keywords: ['actualite', 'news', 'veille', 'secteur'], tool: 'callNewsAgent' },
    coach: { keywords: ['coaching', 'carriere', 'bien-etre', 'mentorat', 'developpement personnel'], tool: 'callCoachAgent' },
    datascientist: { keywords: ['correlation', 'prediction', 'cross-module', 'strategique'], tool: 'callDataScientistAgent' },
    qa: { keywords: ['question', 'cherche dans', 'trouve dans'], tool: 'askQAAgent' },
};
const ACTION_MAP = {
    'cree un devis': 'createQuote', 'creer un devis': 'createQuote', 'faire un devis': 'createQuote',
    'ajoute un client': 'addClient', 'nouveau client': 'addClient',
    'cree un rdv': 'createAppointment', 'prendre rdv': 'createAppointment', 'rendez-vous': 'createAppointment',
    'supprime': 'deleteWorkItem', 'annule': 'deleteAppointment',
    'envoie un whatsapp': 'sendWhatsAppMessage', 'envoie un email': 'sendEmail',
    'verifie le stock': 'checkStock', 'met a jour le stock': 'updateStock',
    'envoie une alerte': 'sendAlert', 'genere un rapport': 'generateReport',
};
/** Fast keyword-based intent classification (no LLM call needed) */
function classifyIntentFast(message) {
    const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const scores = [];
    // Check action tools first
    for (const [phrase, tool] of Object.entries(ACTION_MAP)) {
        if (lower.includes(phrase)) {
            return {
                primaryAgent: tool, secondaryAgents: [], confidence: 0.95,
                category: 'action', isMultiAgent: false, isActionRequest: true, actionTool: tool,
                reasoning: `Action directe detectee: "${phrase}" → ${tool}`,
            };
        }
    }
    // Score each agent by keyword matches
    for (const [cat, config] of Object.entries(AGENT_MAP)) {
        let score = 0;
        for (const kw of config.keywords) {
            if (lower.includes(kw))
                score += kw.length; // longer keywords = higher score
        }
        if (score > 0)
            scores.push({ agent: cat, score, tool: config.tool });
    }
    scores.sort((a, b) => b.score - a.score);
    if (scores.length === 0) {
        return {
            primaryAgent: 'callWildcardAgent', secondaryAgents: [], confidence: 0.3,
            category: 'unknown', isMultiAgent: false, isActionRequest: false,
            reasoning: 'Aucun agent specialise detecte — fallback Wildcard',
        };
    }
    const primary = scores[0];
    const isMulti = scores.length >= 2 && scores[1].score > primary.score * 0.5;
    const secondaryAgents = isMulti ? scores.slice(1, 3).map(s => s.tool) : [];
    return {
        primaryAgent: primary.tool,
        secondaryAgents,
        confidence: Math.min(0.95, 0.5 + (primary.score / 30)),
        category: primary.agent,
        isMultiAgent: isMulti,
        isActionRequest: false,
        reasoning: `Keyword match: ${primary.agent} (score=${primary.score})${isMulti ? ` + ${scores.slice(1, 3).map(s => s.agent).join(', ')}` : ''}`,
    };
}
/** AI-powered intent classification for ambiguous requests */
async function classifyIntentAI(message, history) {
    try {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Classify this user request for a multi-agent enterprise system.

Request: "${message}"
Recent context: ${history.slice(0, 500)}

Available agents: hr, sales, accounting, support, it, security, reception, marketing, legal, training, comms, knowledge, insights, news, coach, datascientist, qa, wildcard

Action tools: createQuote, addClient, createAppointment, deleteAppointment, sendWhatsAppMessage, sendEmail, checkStock, updateStock, sendAlert, generateReport

Return JSON ONLY:
{"primaryAgent":"callXXXAgent","secondaryAgents":[],"confidence":0.9,"category":"xxx","isMultiAgent":false,"isActionRequest":false,"actionTool":null,"subTasks":null,"reasoning":"why"}`,
            config: { temperature: 0.1 },
        });
        const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return { ...parsed, confidence: parsed.confidence ?? 0.7, secondaryAgents: parsed.secondaryAgents ?? [], isMultiAgent: (parsed.secondaryAgents ?? []).length > 0, isActionRequest: !!parsed.actionTool };
    }
    catch {
        return classifyIntentFast(message);
    }
}
async function decomposeRequest(message) {
    try {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Decompose this complex request into sub-tasks for a multi-agent system.

Request: "${message}"

Available agents: askQAAgent, callKnowledgeAgent, callHRAgent, callSalesAgent, callAccountingAgent, callSupportAgent, callITAgent, callCybersecurityAgent, callReceptionAgent, callMarketingAgent, callLegalAgent, callTrainingAgent, draftCommunication, generateInsights, callDataScientistAgent

Rules:
- If the request is simple (1 agent), return just 1 task
- If complex, break into 2-4 sub-tasks with dependencies
- dependsOn=[] means can run in parallel
- dependsOn=["task-1"] means must wait for task-1

Return JSON array ONLY: [{"id":"task-1","description":"...","agent":"callXXXAgent","dependsOn":[]}]`,
            config: { temperature: 0.1 },
        });
        const tasks = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return tasks.map(t => ({ ...t, status: 'pending' }));
    }
    catch {
        return [{ id: 'task-1', description: message, agent: 'callWildcardAgent', dependsOn: [], status: 'pending' }];
    }
}
/** Execute multiple tools in parallel (for independent tasks) */
async function executeParallel(tasks) {
    const results = await Promise.allSettled(tasks.map(async (task) => {
        const start = Date.now();
        try {
            const result = await task.executor(task.input);
            return { toolName: task.name, result, latencyMs: Date.now() - start, success: true };
        }
        catch (err) {
            return { toolName: task.name, result: null, latencyMs: Date.now() - start, success: false, error: String(err) };
        }
    }));
    return results.map(r => r.status === 'fulfilled' ? r.value : { toolName: 'unknown', result: null, latencyMs: 0, success: false, error: 'Promise rejected' });
}
const agentHealthMap = new Map();
const CIRCUIT_THRESHOLD = 3; // failures before opening circuit
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 min before retry
function getAgentHealth(name) {
    if (!agentHealthMap.has(name)) {
        agentHealthMap.set(name, { name, totalCalls: 0, failures: 0, avgLatencyMs: 0, lastFailure: null, circuitOpen: false, lastCallAt: null });
    }
    return agentHealthMap.get(name);
}
function recordAgentCall(name, latencyMs, success) {
    const h = getAgentHealth(name);
    h.totalCalls++;
    h.lastCallAt = new Date();
    h.avgLatencyMs = Math.round((h.avgLatencyMs * (h.totalCalls - 1) + latencyMs) / h.totalCalls);
    if (!success) {
        h.failures++;
        h.lastFailure = new Date();
        if (h.failures >= CIRCUIT_THRESHOLD) {
            h.circuitOpen = true;
            logger_1.logger.warn(`[AgentHealth] Circuit OPEN for ${name} — ${h.failures} failures`);
        }
    }
    else {
        // Reset failures on success
        h.failures = Math.max(0, h.failures - 1);
    }
}
function isAgentAvailable(name) {
    const h = getAgentHealth(name);
    if (!h.circuitOpen)
        return true;
    // Check if circuit reset period passed
    if (h.lastFailure && Date.now() - h.lastFailure.getTime() > CIRCUIT_RESET_MS) {
        h.circuitOpen = false;
        h.failures = 0;
        logger_1.logger.info(`[AgentHealth] Circuit RESET for ${name}`);
        return true;
    }
    return false;
}
function getAllAgentHealth() {
    return Array.from(agentHealthMap.values()).sort((a, b) => b.totalCalls - a.totalCalls);
}
const recentTraces = [];
const MAX_TRACES = 100;
function createTrace(userId, companyId, message, intent) {
    const trace = {
        id: (0, helpers_1.generateId)(), timestamp: new Date(), userId, companyId, message, intent,
        steps: [], totalLatencyMs: 0, agentsUsed: [], toolsCalled: [],
    };
    recentTraces.unshift(trace);
    if (recentTraces.length > MAX_TRACES)
        recentTraces.pop();
    return trace;
}
function addTraceStep(trace, tool, latencyMs, success, error) {
    trace.steps.push({ tool, latencyMs, success, error });
    trace.totalLatencyMs += latencyMs;
    if (!trace.toolsCalled.includes(tool))
        trace.toolsCalled.push(tool);
}
function getRecentTraces() {
    return recentTraces;
}
/** Save trace to Firestore for long-term analytics */
async function persistTrace(trace) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${trace.companyId}/orchestratorTraces`).doc(trace.id).set({
            ...trace, intent: { ...trace.intent }, // flatten
        });
    }
    catch { }
}
// ══════════════════════════════════════════════════════════════════════════════
// 6. CROSS-AGENT CONTEXT
// ══════════════════════════════════════════════════════════════════════════════
/** Shared context for a single request — agents can read/write data here */
class RequestContext {
    constructor() {
        this.data = {};
        this.agentOutputs = {};
    }
    set(key, value) { this.data[key] = value; }
    get(key) { return this.data[key]; }
    setAgentOutput(agentName, output) { this.agentOutputs[agentName] = output; }
    getAgentOutput(agentName) { return this.agentOutputs[agentName]; }
    getAllAgentOutputs() { return { ...this.agentOutputs }; }
    /** Build a summary of what previous agents found — passed to next agent */
    buildCrossAgentSummary() {
        const entries = Object.entries(this.agentOutputs);
        if (entries.length === 0)
            return '';
        return `\n\nContext from other agents:\n${entries.map(([agent, output]) => {
            const text = typeof output === 'string' ? output : JSON.stringify(output).slice(0, 300);
            return `- ${agent}: ${text}`;
        }).join('\n')}`;
    }
}
exports.RequestContext = RequestContext;
// ══════════════════════════════════════════════════════════════════════════════
// 7. AGENT PRIORITY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
const AGENT_PRIORITIES = {
    // Critical (execute first) — 10
    callCybersecurityAgent: 10, callITAgent: 9,
    // High — 8
    callSalesAgent: 8, callAccountingAgent: 8, callSupportAgent: 8, callLegalAgent: 8,
    // Medium — 6
    callHRAgent: 6, callReceptionAgent: 6, callTrainingAgent: 6, callMarketingAgent: 6,
    // Low — 4
    callNewsAgent: 4, callCoachAgent: 4, callDataScientistAgent: 4,
    // Utility — 3
    askQAAgent: 3, callKnowledgeAgent: 3, draftCommunication: 3,
    generateInsights: 3, analyzeMeeting: 3, analyzeImage: 3,
    // Fallback — 1
    callWildcardAgent: 1,
};
/** Sort tool calls by priority (highest first) */
function sortByAgentPriority(toolNames) {
    return [...toolNames].sort((a, b) => (AGENT_PRIORITIES[b] ?? 5) - (AGENT_PRIORITIES[a] ?? 5));
}
/** Get priority for display */
function getAgentPriority(name) {
    const p = AGENT_PRIORITIES[name] ?? 5;
    return { priority: p, level: p >= 9 ? 'critical' : p >= 7 ? 'high' : p >= 5 ? 'medium' : 'low' };
}
/** Get all priorities for dashboard */
function getAllAgentPriorities() {
    return Object.entries(AGENT_PRIORITIES).map(([name, priority]) => ({
        name, priority, level: priority >= 9 ? 'critical' : priority >= 7 ? 'high' : priority >= 5 ? 'medium' : 'low',
    })).sort((a, b) => b.priority - a.priority);
}
// ══════════════════════════════════════════════════════════════════════════════
// 8. CONFLICT RESOLUTION (prevent duplicate actions)
// ══════════════════════════════════════════════════════════════════════════════
const recentActions = new Map();
const DEDUP_WINDOW_MS = 30000; // 30 seconds
/** Check if this action was already taken (dedup) */
function checkConflict(companyId, action, agent) {
    const key = `${companyId}_${action}`;
    const existing = recentActions.get(key);
    if (existing && Date.now() - existing.timestamp < DEDUP_WINDOW_MS) {
        logger_1.logger.warn(`[ConflictResolution] Duplicate action detected: "${action}" — already done by ${existing.agent}, blocked from ${agent}`);
        return { isDuplicate: true, existingAgent: existing.agent };
    }
    recentActions.set(key, { action, agent, timestamp: Date.now() });
    return { isDuplicate: false };
}
/** Record an action for dedup tracking */
function recordAction(companyId, action, agent) {
    recentActions.set(`${companyId}_${action}`, { action, agent, timestamp: Date.now() });
}
/** Get recent conflicts for dashboard */
function getRecentConflicts() {
    const now = Date.now();
    const conflicts = [];
    recentActions.forEach((v) => { if (now - v.timestamp < 300000)
        conflicts.push(v); }); // last 5 min
    return conflicts.sort((a, b) => b.timestamp - a.timestamp);
}
// Cleanup old entries every 5 min
setInterval(() => { const now = Date.now(); recentActions.forEach((v, k) => { if (now - v.timestamp > 300000)
    recentActions.delete(k); }); }, 300000);
const feedbackHistory = [];
const MAX_FEEDBACK = 500;
/** Record feedback after agent execution */
function recordFeedback(feedback) {
    feedbackHistory.unshift(feedback);
    if (feedbackHistory.length > MAX_FEEDBACK)
        feedbackHistory.pop();
}
/** Get agent performance from feedback */
function getAgentFeedbackStats() {
    const stats = new Map();
    feedbackHistory.forEach(f => {
        if (!stats.has(f.agentName))
            stats.set(f.agentName, { success: 0, total: 0, latencies: [], confidences: [] });
        const s = stats.get(f.agentName);
        s.total++;
        if (f.success)
            s.success++;
        s.latencies.push(f.latencyMs);
        s.confidences.push(f.confidence);
    });
    return Array.from(stats.entries()).map(([agent, s]) => ({
        agent,
        successRate: s.total > 0 ? Math.round(s.success / s.total * 100) : 0,
        avgLatency: s.latencies.length > 0 ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length) : 0,
        avgConfidence: s.confidences.length > 0 ? Math.round(s.confidences.reduce((a, b) => a + b, 0) / s.confidences.length) : 0,
        totalCalls: s.total,
    })).sort((a, b) => b.totalCalls - a.totalCalls);
}
/** Persist feedback to Firestore (periodic) */
async function persistFeedbackStats(companyId) {
    try {
        const stats = getAgentFeedbackStats();
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/agentFeedback`).doc('latest').set({
            stats, updatedAt: new Date(), feedbackCount: feedbackHistory.length,
        });
    }
    catch { }
}
//# sourceMappingURL=orchestratorIntelligence.js.map