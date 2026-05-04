"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAgentAccess = checkAgentAccess;
exports.checkActionConfirmation = checkActionConfirmation;
exports.isDestructiveAction = isDestructiveAction;
exports.redactSensitiveData = redactSensitiveData;
exports.rankAgents = rankAgents;
exports.checkHandoff = checkHandoff;
exports.buildHandoffResponse = buildHandoffResponse;
exports.buildExplanation = buildExplanation;
exports.formatExplanationFooter = formatExplanationFooter;
exports.checkBudget = checkBudget;
exports.recordBudgetUsage = recordBudgetUsage;
exports.simulateRequest = simulateRequest;
const orchestratorIntelligence_1 = require("./orchestratorIntelligence");
// ══════════════════════════════════════════════════════════════════════════════
// 1. ROLE-BASED AGENT ACCESS
// ══════════════════════════════════════════════════════════════════════════════
/** Which agents each role is allowed to call */
const ROLE_POLICIES = {
    superadmin: { allowed: ['*'], blocked: [] },
    admin: { allowed: ['*'], blocked: [] },
    manager: {
        allowed: ['*'],
        blocked: ['callDataScientistAgent'], // data scientist = admin only
    },
    employee: {
        allowed: [
            'askQAAgent', 'callKnowledgeAgent', 'draftCommunication', 'callReceptionAgent',
            'callHRAgent', 'callSupportAgent', 'callTrainingAgent', 'callCoachAgent',
            'callWildcardAgent', 'callNewsAgent',
            // Action tools
            'createAppointment', 'listAppointments', 'deleteAppointment',
            'sendEmail', 'searchClients', 'checkStock',
        ],
        blocked: [
            'callCybersecurityAgent', 'callAccountingAgent', 'callLegalAgent',
            'callDataScientistAgent', 'generateInsights',
            'addClient', 'createQuote', 'updateStock', 'sendAlert',
        ],
    },
    receptionist: {
        allowed: [
            'callReceptionAgent', 'askQAAgent', 'callKnowledgeAgent', 'draftCommunication',
            'createAppointment', 'listAppointments', 'deleteAppointment',
            'callWildcardAgent',
        ],
        blocked: ['*_except_allowed'],
    },
};
/** Check if a user role is allowed to call a specific agent/tool */
function checkAgentAccess(role, toolName) {
    const policy = ROLE_POLICIES[role] ?? ROLE_POLICIES['employee'];
    // Superadmin/admin → always allowed
    if (policy.allowed.includes('*') && policy.blocked.length === 0) {
        return { allowed: true };
    }
    // Explicitly blocked
    if (policy.blocked.includes(toolName)) {
        return {
            allowed: false,
            reason: `L'agent "${toolName}" n'est pas accessible avec votre role (${role}). Contactez un administrateur.`,
        };
    }
    // Check if allowed list is restrictive
    if (!policy.allowed.includes('*') && !policy.allowed.includes(toolName)) {
        return {
            allowed: false,
            reason: `Acces refuse: votre role (${role}) ne permet pas d'utiliser cet agent.`,
        };
    }
    return { allowed: true };
}
// ══════════════════════════════════════════════════════════════════════════════
// 2. ACTION CONFIRMATION
// ══════════════════════════════════════════════════════════════════════════════
/** Actions that require user confirmation before execution */
const CONFIRMATION_REQUIRED = {
    sendEmail: 'Voulez-vous vraiment envoyer cet email ?',
    sendWhatsAppMessage: 'Confirmer l\'envoi du message WhatsApp ?',
    sendAlert: 'Confirmer l\'envoi de cette alerte a tous les destinataires ?',
    deleteAppointment: 'Supprimer definitivement ce rendez-vous ?',
    deleteWorkItem: 'Supprimer cet element de l\'espace de travail ?',
    updateStock: 'Mettre a jour les niveaux de stock ?',
    createQuote: 'Creer et enregistrer ce devis ?',
};
/** Actions considered destructive (delete, send externally) */
const DESTRUCTIVE_ACTIONS = new Set([
    'deleteAppointment', 'deleteWorkItem', 'sendAlert',
]);
function checkActionConfirmation(toolName) {
    const msg = CONFIRMATION_REQUIRED[toolName];
    if (msg) {
        return {
            allowed: true,
            requiresConfirmation: true,
            confirmationMessage: msg,
        };
    }
    return { allowed: true };
}
function isDestructiveAction(toolName) {
    return DESTRUCTIVE_ACTIONS.has(toolName);
}
// ══════════════════════════════════════════════════════════════════════════════
// 3. SENSITIVE DATA GUARDS
// ══════════════════════════════════════════════════════════════════════════════
const SENSITIVE_PATTERNS = [
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, label: 'credit_card', mask: '****-****-****-####' },
    { pattern: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}\b/g, label: 'iban', mask: '****####' },
    { pattern: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, label: 'ssn', mask: '***-**-####' },
];
/** Redact sensitive data from agent output */
function redactSensitiveData(text) {
    const redacted = [];
    let result = text;
    for (const s of SENSITIVE_PATTERNS) {
        const matches = result.match(s.pattern);
        if (matches) {
            redacted.push(...matches.map(() => s.label));
            result = result.replace(s.pattern, `[${s.label.toUpperCase()} REDACTED]`);
        }
    }
    return { text: result, redacted };
}
const AGENT_COSTS = {
    askQAAgent: 1, callKnowledgeAgent: 2, callWildcardAgent: 1,
    callHRAgent: 2, callSalesAgent: 2, callAccountingAgent: 2,
    callSupportAgent: 2, callITAgent: 2, callReceptionAgent: 2,
    callMarketingAgent: 3, callLegalAgent: 3, callTrainingAgent: 2,
    callCybersecurityAgent: 3, callNewsAgent: 2, callCoachAgent: 2,
    callDataScientistAgent: 4, generateInsights: 4,
    draftCommunication: 2, analyzeMeeting: 3, analyzeImage: 3,
};
const AGENT_CRITICALITY = {
    callCybersecurityAgent: 10, callLegalAgent: 8, callAccountingAgent: 7,
    callSalesAgent: 6, callHRAgent: 6, callSupportAgent: 5,
    callITAgent: 5, callReceptionAgent: 4, callTrainingAgent: 3,
    callMarketingAgent: 3, callNewsAgent: 2, callCoachAgent: 2,
    askQAAgent: 4, callKnowledgeAgent: 5, callWildcardAgent: 1,
};
/** Rank agents by priority when multiple are candidates */
function rankAgents(candidates) {
    return candidates.map(name => {
        const health = (0, orchestratorIntelligence_1.getAgentHealth)(name);
        const cost = AGENT_COSTS[name] ?? 2;
        const criticality = AGENT_CRITICALITY[name] ?? 3;
        const latencyPenalty = health.avgLatencyMs > 5000 ? -2 : health.avgLatencyMs > 2000 ? -1 : 0;
        const failurePenalty = health.failures > 0 ? -health.failures : 0;
        const score = criticality - cost + latencyPenalty + failurePenalty;
        return {
            name, score,
            reason: `criticality=${criticality} cost=${cost} latency=${health.avgLatencyMs}ms failures=${health.failures}`,
        };
    }).sort((a, b) => b.score - a.score);
}
const CONFIDENCE_THRESHOLD_LOW = 0.4;
const CONFIDENCE_THRESHOLD_CLARIFY = 0.55;
const MAX_CONSECUTIVE_FAILURES = 2;
/** Decide if we should hand off to a human or ask for clarification */
function checkHandoff(intent, consecutiveFailures, userMessage) {
    // Very low confidence → ask clarification
    if (intent.confidence < CONFIDENCE_THRESHOLD_LOW) {
        return {
            shouldHandoff: false,
            suggestion: `Je ne suis pas sur de comprendre votre demande. Pouvez-vous preciser ?\n\nExemples:\n- "Montre-moi les factures du mois"\n- "Cree un devis pour TechCorp"\n- "Quel est le score de securite ?"\n- "Qui est en conge cette semaine ?"`,
        };
    }
    // Medium confidence → proceed but warn
    if (intent.confidence < CONFIDENCE_THRESHOLD_CLARIFY) {
        return {
            shouldHandoff: false,
            suggestion: `Je pense que vous parlez de **${intent.category}**. C'est bien ca ? Si non, precisez votre demande.`,
        };
    }
    // Too many consecutive failures → suggest human
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        return {
            shouldHandoff: true,
            reason: `${consecutiveFailures} echecs consecutifs — les agents ne parviennent pas a traiter cette demande.`,
            suggestion: `Je rencontre des difficultes avec cette demande. Voulez-vous que je vous mette en contact avec un collegue qui pourra vous aider ?\n\nVous pouvez aussi essayer:\n- Reformuler votre question\n- Etre plus specifique\n- Contacter le support: support@corpmind.ai`,
        };
    }
    return { shouldHandoff: false };
}
/** Build a graceful error response when handoff is needed */
function buildHandoffResponse(decision) {
    if (decision.suggestion)
        return decision.suggestion;
    return `Je ne suis pas en mesure de traiter cette demande pour le moment. Contactez votre administrateur ou envoyez un email a support@corpmind.ai.`;
}
/** Build human-readable explanation of orchestrator decisions */
function buildExplanation(intent, policyCheck, handoff, budgetResult, simulationMode) {
    const blocks = [];
    // Routing explanation
    blocks.push({
        type: 'routing',
        message: `Agent selectionne: **${intent.primaryAgent}** (confiance: ${(intent.confidence * 100).toFixed(0)}%)`,
        details: intent.reasoning,
    });
    if (intent.isMultiAgent) {
        blocks.push({
            type: 'routing',
            message: `Agents secondaires: ${intent.secondaryAgents.join(', ')}`,
        });
    }
    if (policyCheck && !policyCheck.allowed) {
        blocks.push({ type: 'policy', message: `Acces refuse: ${policyCheck.reason}` });
    }
    if (policyCheck?.requiresConfirmation) {
        blocks.push({ type: 'policy', message: `Confirmation requise: ${policyCheck.confirmationMessage}` });
    }
    if (handoff?.shouldHandoff) {
        blocks.push({ type: 'handoff', message: `Escalade humaine: ${handoff.reason}` });
    }
    if (budgetResult && !budgetResult.allowed) {
        blocks.push({ type: 'budget', message: budgetResult.reason ?? 'Budget depasse' });
    }
    if (simulationMode) {
        blocks.push({ type: 'simulation', message: 'Mode simulation — aucune action executee' });
    }
    return blocks;
}
/** Format explanation blocks as markdown footer */
function formatExplanationFooter(blocks) {
    if (blocks.length === 0)
        return '';
    const icons = { routing: '🧠', policy: '🔒', handoff: '🤝', budget: '💰', simulation: '🔬' };
    return '\n\n---\n' + blocks.map(b => `${icons[b.type] ?? '📌'} ${b.message}${b.details ? ` _(${b.details})_` : ''}`).join('\n');
}
/** In-memory usage counters (reset daily via TTL or cron) */
const usageCounters = new Map();
const DAILY_LIMITS = {
    free: 20,
    starter: 100,
    business: 500,
    enterprise: 2000,
};
const EXPENSIVE_AGENTS = new Set([
    'callDataScientistAgent', 'generateInsights', 'analyzeMeeting', 'analyzeImage',
    'callCybersecurityAgent', 'callLegalAgent',
]);
function getUsageKey(companyId, userId) {
    return `${companyId}_${userId}_${new Date().toISOString().split('T')[0]}`;
}
function checkBudget(companyId, userId, plan, toolName) {
    const key = getUsageKey(companyId, userId);
    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    if (!usageCounters.has(key) || usageCounters.get(key).resetAt < now) {
        usageCounters.set(key, { count: 0, resetAt: endOfDay.getTime() });
    }
    const counter = usageCounters.get(key);
    const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS['starter'];
    // Expensive agents cost 3x
    const cost = EXPENSIVE_AGENTS.has(toolName) ? 3 : 1;
    if (counter.count + cost > limit) {
        return {
            allowed: false,
            reason: `Limite quotidienne atteinte (${counter.count}/${limit}). Upgrade votre plan pour plus d'appels.`,
            remaining: Math.max(0, limit - counter.count), limit,
        };
    }
    return { allowed: true, remaining: limit - counter.count - cost, limit };
}
function recordBudgetUsage(companyId, userId, toolName) {
    const key = getUsageKey(companyId, userId);
    const counter = usageCounters.get(key);
    if (counter) {
        counter.count += EXPENSIVE_AGENTS.has(toolName) ? 3 : 1;
    }
}
/** Simulate what would happen without executing anything */
function simulateRequest(message, intent, role, companyId, userId, plan) {
    const wouldCall = [intent.primaryAgent, ...intent.secondaryAgents];
    const policyChecks = wouldCall.map(tool => {
        const check = checkAgentAccess(role, tool);
        return { tool, allowed: check.allowed, reason: check.reason };
    });
    const budgetCheck = checkBudget(companyId, userId, plan, intent.primaryAgent);
    const { getAgentHealth } = require('./orchestratorIntelligence');
    const estimatedLatencyMs = wouldCall.reduce((sum, tool) => {
        const h = getAgentHealth(tool);
        return sum + (h.avgLatencyMs || 1500);
    }, 0);
    const explanation = buildExplanation(intent, policyChecks[0] ? { allowed: policyChecks[0].allowed, reason: policyChecks[0].reason } : undefined, undefined, budgetCheck, true);
    return { intent, wouldCall, policyChecks, budgetCheck, estimatedLatencyMs, explanation };
}
//# sourceMappingURL=orchestratorPolicy.js.map