/**
 * Tenant configuration types.
 * Each BYOE company has its own Firebase project, API keys, and settings.
 * Starter plan companies share the Orlode "host" Firebase.
 */

export type TenantPlan = 'trial' | 'starter' | 'business' | 'enterprise';

export interface TenantFirebaseConfig {
  projectId: string;
  serviceAccountKey: string;  // AES-256-GCM encrypted JSON
  storageBucket: string;
  region: string;
}

export interface TenantAIConfig {
  gemini: {
    apiKey: string;          // Encrypted
    preferredModel: string;  // 'gemini-2.0-flash' | 'gemini-2.5-pro'
  };
  claude?: {
    apiKey: string;          // Encrypted
    preferredModel: string;  // 'claude-sonnet-4-20250514'
  };
  openai?: {
    apiKey: string;          // Encrypted
    preferredModel: string;  // 'gpt-4o'
  };
}

export interface TenantMCPConfig {
  googleWorkspace?: { enabled: boolean; oauthToken: string };
  slack?: { enabled: boolean; botToken: string };
  bigquery?: { enabled: boolean; projectId: string };
  notion?: { enabled: boolean; apiKey: string };
  hubspot?: { enabled: boolean; apiKey: string };
}

export interface TenantConfig {
  companyId: string;
  plan: TenantPlan;

  // BYOE: their Firebase. Null for Starter (uses host Firebase)
  firebase?: TenantFirebaseConfig;

  // Their AI keys. Null for Starter (uses host env vars)
  ai?: TenantAIConfig;

  // MCP integrations
  mcp?: TenantMCPConfig;

  // Feature flags per plan
  agents: {
    enabled: string[];
    maxAgents: number;
  };

  limits: {
    maxUsers: number;
    maxDocuments: number;
    maxStorageGB: number;
  };

  // Whether this company uses BYOE (Business/Enterprise) or hosted (Starter)
  byoeEnabled: boolean;

  // Setup completion state
  setupCompleted: boolean;
  setupStep: number;  // 0-10
}

/** Plan-level defaults */
export const PLAN_DEFAULTS: Record<TenantPlan, Omit<TenantConfig, 'companyId' | 'firebase' | 'ai' | 'mcp'>> = {
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
    setupCompleted: true,  // Starter uses simple onboarding, not BYOE setup
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
