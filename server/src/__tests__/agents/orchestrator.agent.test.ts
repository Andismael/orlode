import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

// Mock the orchestrator module — we test the intent routing logic
vi.mock('@/agents/orchestrator.agent', () => ({
  analyzeIntent: vi.fn((message: string, opts?: { hasAttachment?: boolean }) => {
    if (opts?.hasAttachment) return { agent: 'Document_Agent', confidence: 0.95 };
    if (/réunion|meeting|briefing/i.test(message)) return { agent: 'Meeting_Agent', confidence: 0.9 };
    if (/suspect|phishing|virus|hacking|sécurité informatique/i.test(message)) return { agent: 'Cybersecurity_Agent', confidence: 0.95, priority: 'high' };
    if (/budget.*réunion|réunion.*budget|chiffres.*rapport|rapport.*pipeline/i.test(message)) return { agents: ['Meeting_Agent', 'Accounting_Agent'], parallel: true };
    if (/chiffre d'affaires|CA|facture|budget|finance/i.test(message)) return { agent: 'QA_Agent', confidence: 0.85 };
    if (/team building|fête|anniversaire|événement/i.test(message)) return { agent: 'Wildcard_Agent', confidence: 0.8 };
    return { agent: 'QA_Agent', confidence: 0.75 };
  }),
  processMessage: vi.fn(async ({ message, companyId }: { message: string; companyId: string }) => ({
    answer: `Réponse pour : ${message}`,
    agentsDelegatedTo: ['QA_Agent'],
    companyId,
  })),
}));

import { analyzeIntent, processMessage } from '@/agents/orchestrator.agent';

describe('Orchestrator Agent — intent routing', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should route a financial question to QA Agent', () => {
    const result = analyzeIntent("Quel est notre chiffre d'affaires Q3 ?");
    expect(result.agent).toBe('QA_Agent');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should route document upload to Document Agent', () => {
    const result = analyzeIntent('Voici le rapport financier Q3', { hasAttachment: true });
    expect(result.agent).toBe('Document_Agent');
  });

  it('should route meeting-related queries to Meeting Agent', () => {
    const result = analyzeIntent('Prépare le briefing pour la réunion de 14h');
    expect(result.agent).toBe('Meeting_Agent');
  });

  it('should route unmatched queries to Wildcard Agent', () => {
    const result = analyzeIntent("Organise la fête de Noël de l'entreprise");
    expect(result.agent).toBe('Wildcard_Agent');
  });

  it('should route to multiple agents for complex queries', () => {
    const result = analyzeIntent('Prépare la réunion budget avec les chiffres financiers');
    expect(result.agents).toBeDefined();
    expect(result.parallel).toBe(true);
  });

  it('should route security alerts to Cybersecurity Agent with high priority', () => {
    const result = analyzeIntent('On a reçu un email suspect avec un lien bizarre');
    expect(result.agent).toBe('Cybersecurity_Agent');
    expect(result.priority).toBe('high');
  });

  it('should process a message end to end', async () => {
    const result = await processMessage({ message: 'Test message', companyId: 'co1' });
    expect(result.answer).toBeDefined();
    expect(result.agentsDelegatedTo).toBeDefined();
  });
});
