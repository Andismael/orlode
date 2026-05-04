/**
 * Orchestrator Policy Layer
 *
 * 1. Role-based agent access — which agents each role can use
 * 2. Action confirmation — which actions require explicit user approval
 * 3. Sensitive data guards — block or redact sensitive outputs
 * 4. Priority planner — rank agents by cost/latency/criticality
 * 5. Human handoff — when to escalate to a human
 */
import { logger } from '../../utils/logger';
import type { ClassifiedIntent } from './orchestratorIntelligence';
import { getAgentHealth } from './orchestratorIntelligence';

// ══════════════════════════════════════════════════════════════════════════════
// 1. ROLE-BASED AGENT ACCESS
// ══════════════════════════════════════════════════════════════════════════════

/** Which agents each role is allowed to call */
const ROLE_POLICIES: Record<string, { allowed: string[]; blocked: string[] }> = {
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

export interface PolicyCheck {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  redactFields?: string[];
}

/** Check if a user role is allowed to call a specific agent/tool */
export function checkAgentAccess(role: string, toolName: string): PolicyCheck {
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
const CONFIRMATION_REQUIRED: Record<string, string> = {
  sendEmail:            'Voulez-vous vraiment envoyer cet email ?',
  sendWhatsAppMessage:  'Confirmer l\'envoi du message WhatsApp ?',
  sendAlert:            'Confirmer l\'envoi de cette alerte a tous les destinataires ?',
  deleteAppointment:    'Supprimer definitivement ce rendez-vous ?',
  deleteWorkItem:       'Supprimer cet element de l\'espace de travail ?',
  updateStock:          'Mettre a jour les niveaux de stock ?',
  createQuote:          'Creer et enregistrer ce devis ?',
};

/** Actions considered destructive (delete, send externally) */
const DESTRUCTIVE_ACTIONS = new Set([
  'deleteAppointment', 'deleteWorkItem', 'sendAlert',
]);

export function checkActionConfirmation(toolName: string): PolicyCheck {
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

export function isDestructiveAction(toolName: string): boolean {
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
export function redactSensitiveData(text: string): { text: string; redacted: string[] } {
  const redacted: string[] = [];
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

// ══════════════════════════════════════════════════════════════════════════════
// 4. PRIORITY PLANNER
// ══════════════════════════════════════════════════════════════════════════════

interface AgentPriority {
  name: string;
  score: number;       // higher = better choice
  reason: string;
}

const AGENT_COSTS: Record<string, number> = {
  askQAAgent: 1, callKnowledgeAgent: 2, callWildcardAgent: 1,
  callHRAgent: 2, callSalesAgent: 2, callAccountingAgent: 2,
  callSupportAgent: 2, callITAgent: 2, callReceptionAgent: 2,
  callMarketingAgent: 3, callLegalAgent: 3, callTrainingAgent: 2,
  callCybersecurityAgent: 3, callNewsAgent: 2, callCoachAgent: 2,
  callDataScientistAgent: 4, generateInsights: 4,
  draftCommunication: 2, analyzeMeeting: 3, analyzeImage: 3,
};

const AGENT_CRITICALITY: Record<string, number> = {
  callCybersecurityAgent: 10, callLegalAgent: 8, callAccountingAgent: 7,
  callSalesAgent: 6, callHRAgent: 6, callSupportAgent: 5,
  callITAgent: 5, callReceptionAgent: 4, callTrainingAgent: 3,
  callMarketingAgent: 3, callNewsAgent: 2, callCoachAgent: 2,
  askQAAgent: 4, callKnowledgeAgent: 5, callWildcardAgent: 1,
};

/** Rank agents by priority when multiple are candidates */
export function rankAgents(candidates: string[]): AgentPriority[] {
  return candidates.map(name => {
    const health = getAgentHealth(name);
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

// ══════════════════════════════════════════════════════════════════════════════
// 5. HUMAN HANDOFF
// ══════════════════════════════════════════════════════════════════════════════

export interface HandoffDecision {
  shouldHandoff: boolean;
  reason?: string;
  suggestion?: string;
}

const CONFIDENCE_THRESHOLD_LOW = 0.4;
const CONFIDENCE_THRESHOLD_CLARIFY = 0.55;
const MAX_CONSECUTIVE_FAILURES = 2;

/** Decide if we should hand off to a human or ask for clarification */
export function checkHandoff(
  intent: ClassifiedIntent,
  consecutiveFailures: number,
  userMessage: string,
): HandoffDecision {
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
export function buildHandoffResponse(decision: HandoffDecision): string {
  if (decision.suggestion) return decision.suggestion;
  return `Je ne suis pas en mesure de traiter cette demande pour le moment. Contactez votre administrateur ou envoyez un email a support@corpmind.ai.`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. EXPLAINABILITY
// ══════════════════════════════════════════════════════════════════════════════

export interface ExplainBlock {
  type: 'routing' | 'policy' | 'handoff' | 'budget' | 'simulation';
  message: string;
  details?: string;
}

/** Build human-readable explanation of orchestrator decisions */
export function buildExplanation(
  intent: ClassifiedIntent,
  policyCheck?: PolicyCheck,
  handoff?: HandoffDecision,
  budgetResult?: BudgetCheck,
  simulationMode?: boolean,
): ExplainBlock[] {
  const blocks: ExplainBlock[] = [];

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
export function formatExplanationFooter(blocks: ExplainBlock[]): string {
  if (blocks.length === 0) return '';
  const icons: Record<string, string> = { routing: '🧠', policy: '🔒', handoff: '🤝', budget: '💰', simulation: '🔬' };
  return '\n\n---\n' + blocks.map(b => `${icons[b.type] ?? '📌'} ${b.message}${b.details ? ` _(${b.details})_` : ''}`).join('\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. BUDGET GUARDRAILS
// ══════════════════════════════════════════════════════════════════════════════

export interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
}

/** In-memory usage counters (reset daily via TTL or cron) */
const usageCounters = new Map<string, { count: number; resetAt: number }>();

const DAILY_LIMITS: Record<string, number> = {
  free: 20,
  starter: 100,
  business: 500,
  enterprise: 2000,
};

const EXPENSIVE_AGENTS = new Set([
  'callDataScientistAgent', 'generateInsights', 'analyzeMeeting', 'analyzeImage',
  'callCybersecurityAgent', 'callLegalAgent',
]);

function getUsageKey(companyId: string, userId: string): string {
  return `${companyId}_${userId}_${new Date().toISOString().split('T')[0]}`;
}

export function checkBudget(companyId: string, userId: string, plan: string, toolName: string): BudgetCheck {
  const key = getUsageKey(companyId, userId);
  const now = Date.now();
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  if (!usageCounters.has(key) || usageCounters.get(key)!.resetAt < now) {
    usageCounters.set(key, { count: 0, resetAt: endOfDay.getTime() });
  }

  const counter = usageCounters.get(key)!;
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

export function recordBudgetUsage(companyId: string, userId: string, toolName: string) {
  const key = getUsageKey(companyId, userId);
  const counter = usageCounters.get(key);
  if (counter) {
    counter.count += EXPENSIVE_AGENTS.has(toolName) ? 3 : 1;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. SIMULATION MODE
// ══════════════════════════════════════════════════════════════════════════════

export interface SimulationResult {
  intent: ClassifiedIntent;
  wouldCall: string[];
  policyChecks: { tool: string; allowed: boolean; reason?: string }[];
  budgetCheck: BudgetCheck;
  estimatedLatencyMs: number;
  explanation: ExplainBlock[];
}

/** Simulate what would happen without executing anything */
export function simulateRequest(
  message: string,
  intent: ClassifiedIntent,
  role: string,
  companyId: string,
  userId: string,
  plan: string,
): SimulationResult {
  const wouldCall = [intent.primaryAgent, ...intent.secondaryAgents];
  const policyChecks = wouldCall.map(tool => {
    const check = checkAgentAccess(role, tool);
    return { tool, allowed: check.allowed, reason: check.reason };
  });
  const budgetCheck = checkBudget(companyId, userId, plan, intent.primaryAgent);

  const { getAgentHealth } = require('./orchestratorIntelligence');
  const estimatedLatencyMs = wouldCall.reduce((sum: number, tool: string) => {
    const h = getAgentHealth(tool);
    return sum + (h.avgLatencyMs || 1500);
  }, 0);

  const explanation = buildExplanation(intent, policyChecks[0] ? { allowed: policyChecks[0].allowed, reason: policyChecks[0].reason } : undefined, undefined, budgetCheck, true);

  return { intent, wouldCall, policyChecks, budgetCheck, estimatedLatencyMs, explanation };
}
