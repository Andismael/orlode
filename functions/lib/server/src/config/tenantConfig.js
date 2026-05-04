"use strict";
/**
 * Tenant configuration types.
 * Each BYOE company has its own Firebase project, API keys, and settings.
 * Starter plan companies share the Orlode "host" Firebase.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_DEFAULTS = void 0;
/** Plan-level defaults */
exports.PLAN_DEFAULTS = {
    trial: {
        plan: 'trial',
        byoeEnabled: true,
        setupCompleted: false,
        setupStep: 0,
        agents: {
            enabled: [
                'orchestrator', 'qa', 'documents', 'meeting', 'vision',
                'insights', 'comms', 'it', 'cybersecurity', 'marketing',
                'reception', 'hr', 'accounting', 'sales', 'support',
                'legal', 'training', 'news', 'wildcard',
            ],
            maxAgents: 19,
        },
        limits: { maxUsers: 10, maxDocuments: 500, maxStorageGB: 5 },
    },
    starter: {
        plan: 'starter',
        byoeEnabled: false,
        setupCompleted: true, // Starter uses simple onboarding, not BYOE setup
        setupStep: 10,
        agents: { enabled: ['orchestrator', 'qa', 'documents', 'wildcard'], maxAgents: 3 },
        limits: { maxUsers: 5, maxDocuments: 100, maxStorageGB: 2 },
    },
    business: {
        plan: 'business',
        byoeEnabled: true,
        setupCompleted: false,
        setupStep: 0,
        agents: {
            enabled: [
                'orchestrator', 'qa', 'documents', 'meeting', 'vision',
                'insights', 'comms', 'it', 'cybersecurity', 'marketing',
                'reception', 'hr', 'wildcard',
            ],
            maxAgents: 13,
        },
        limits: { maxUsers: 25, maxDocuments: -1, maxStorageGB: -1 },
    },
    enterprise: {
        plan: 'enterprise',
        byoeEnabled: true,
        setupCompleted: false,
        setupStep: 0,
        agents: {
            enabled: [
                'orchestrator', 'qa', 'documents', 'meeting', 'vision',
                'insights', 'comms', 'it', 'cybersecurity', 'marketing',
                'reception', 'hr', 'accounting', 'sales', 'support',
                'legal', 'training', 'news', 'wildcard',
            ],
            maxAgents: 19,
        },
        limits: { maxUsers: -1, maxDocuments: -1, maxStorageGB: -1 },
    },
};
//# sourceMappingURL=tenantConfig.js.map