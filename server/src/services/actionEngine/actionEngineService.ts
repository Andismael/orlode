/**
 * Action Engine — transforme un transcript de réunion en actions exécutables.
 *
 * Pipeline:
 *   1. Transcript → LLM (Gemini) avec prompt structuré
 *   2. LLM → JSON actions avec confidence score
 *   3. UI valide
 *   4. Exécution via tools existants (Clone-safe: createAppointment, addClient, sendEmail, createLead, createQuoteRequest, createReservation)
 *
 * Storage: companies/{id}/meetings/{meetingId}/actions/{actionId}
 */
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { z } from 'zod';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

export const ACTION_TYPES = [
  'create_appointment',
  'create_reservation',
  'add_client',
  'create_lead',
  'create_quote_request',
  'send_email',
  'create_support_ticket',
  'reminder',     // manual follow-up — no tool, just a note
] as const;
export type ActionType = typeof ACTION_TYPES[number];

export type ActionStatus = 'pending' | 'validated' | 'executing' | 'executed' | 'rejected' | 'modified' | 'failed';

export type ActionEngineMode = 'manual' | 'semi_auto' | 'auto';

export interface ActionEngineConfig {
  mode: ActionEngineMode;
  autoExecuteThreshold: number; // 0-1
}

export const DEFAULT_ENGINE_CONFIG: ActionEngineConfig = {
  mode: 'semi_auto',
  autoExecuteThreshold: 0.9,
};

/** Action types that should NEVER auto-execute — always require human validation */
export const SENSITIVE_ACTIONS: ActionType[] = [
  'send_email',           // outgoing communication to clients
  'create_quote_request', // contractual / financial
];

/** Read engine config from company settings. Returns default if missing. */
export async function getEngineConfig(companyId: string): Promise<ActionEngineConfig> {
  try {
    const doc = await getFirestore().collection('companies').doc(companyId).get();
    const settings = (doc.data()?.['settings'] as Record<string, unknown>) ?? {};
    const mode = (settings['actionEngineMode'] as ActionEngineMode) ?? DEFAULT_ENGINE_CONFIG.mode;
    const raw = settings['autoExecuteThreshold'];
    const threshold = typeof raw === 'number' ? raw : DEFAULT_ENGINE_CONFIG.autoExecuteThreshold;
    return { mode, autoExecuteThreshold: Math.max(0, Math.min(1, threshold)) };
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

/** Decide whether an action is eligible for auto-execution given the config. */
export function isAutoExecutable(action: { type: ActionType; confidence: number }, cfg: ActionEngineConfig): boolean {
  if (cfg.mode !== 'auto') return false;
  if (SENSITIVE_ACTIONS.includes(action.type)) return false;
  return action.confidence >= cfg.autoExecuteThreshold;
}

export interface DetectedAction {
  id: string;
  type: ActionType;
  confidence: number; // 0-1
  status: ActionStatus;
  params: Record<string, unknown>;
  sourceQuote?: string;  // the phrase from transcript that triggered it
  executedAt?: Date;
  executeResult?: Record<string, unknown>;
  createdAt: Date;
}

const ActionJsonSchema = z.object({
  actions: z.array(z.object({
    type: z.enum(ACTION_TYPES),
    confidence: z.number().min(0).max(1),
    params: z.object({
      // Shared
      clientName: z.string().optional(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      // Appointments / reservations
      date: z.string().optional().describe('YYYY-MM-DD'),
      time: z.string().optional().describe('HH:MM'),
      service: z.string().optional(),
      resourceType: z.string().optional(),
      // Sales
      interest: z.string().optional(),
      estimatedValue: z.number().optional(),
      items: z.array(z.object({
        name: z.string(), quantity: z.number().optional(),
      })).optional(),
      // Email
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      // Support / reminder
      description: z.string().optional(),
      priority: z.string().optional(),
      note: z.string().optional(),
    }).passthrough(),
    sourceQuote: z.string().optional().describe('The sentence from the transcript that triggered this action'),
  })),
});

export async function detectActionsFromTranscript(
  transcript: string,
  contextHint?: string,
): Promise<DetectedAction[]> {
  const systemPrompt = `Tu es un moteur d'extraction d'actions business. On te donne la transcription d'une réunion.
Ta mission: identifier toutes les DECISIONS, TACHES, RDV, INTENTIONS COMMERCIALES, DEMANDES qui doivent devenir des actions concrètes.

Types d'actions possibles:
- create_appointment (prendre RDV pour un client/prospect)
- create_reservation (réserver table/chambre/salle)
- add_client (enregistrer nouveau contact CRM)
- create_lead (prospect avec intérêt commercial)
- create_quote_request (demande de devis avec items)
- send_email (email à envoyer)
- create_support_ticket (problème à traiter)
- reminder (simple rappel pour suivi humain)

Pour chaque action, retourne un JSON avec:
- type (un des types ci-dessus)
- confidence (0-1, ta certitude que c'est vraiment une action à exécuter)
- params (nom du client, date YYYY-MM-DD, heure HH:MM, service, email, body, items, etc.)
- sourceQuote (phrase exacte du transcript qui a déclenché l'action)

IMPORTANT:
- Si la phrase est vague ("il faudrait voir ça"), confidence < 0.5
- Si les infos sont précises ("RDV mardi 20 avril 14h pour Paul +22507..."), confidence > 0.85
- Ne JAMAIS inventer des infos manquantes — laisse le champ vide
- Pour "on se voit mardi" sans date complète, essaie de déduire avec la date d'aujourd'hui (contexte)
- Ignore les discussions sans action concrète`;

  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await ai.generate({
      model: GEMINI_FLASH,
      system: systemPrompt + `\n\nContexte: Aujourd'hui = ${today}.${contextHint ? ` ${contextHint}` : ''}`,
      prompt: `Analyse ce transcript et extrais toutes les actions:\n\n${transcript}`,
      output: { schema: ActionJsonSchema },
    });

    const output = response.output as { actions: Array<{ type: ActionType; confidence: number; params: Record<string, unknown>; sourceQuote?: string }> } | null;
    if (!output?.actions) return [];

    return output.actions.map(a => ({
      id: generateId(),
      type: a.type,
      confidence: a.confidence,
      status: 'pending' as ActionStatus,
      params: a.params,
      sourceQuote: a.sourceQuote,
      createdAt: new Date(),
    }));
  } catch (err) {
    logger.error('[ActionEngine] detectActionsFromTranscript failed', { err: String(err) });
    return [];
  }
}

/** Execute an action via the Clone-safe tools. Returns the tool's result. */
export async function executeAction(companyId: string, action: DetectedAction): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const input = { ...action.params, companyId } as Record<string, unknown>;

    switch (action.type) {
      case 'create_appointment': {
        const { cloneCreateAppointmentTool } = await import('../../agents/tools/cloneTools');
        const result = await (cloneCreateAppointmentTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)(input);
        return { ...result, data: result };
      }
      case 'create_reservation': {
        const { cloneCreateReservationTool } = await import('../../agents/tools/reservationTools');
        const result = await (cloneCreateReservationTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)(input);
        return { ...result, data: result };
      }
      case 'add_client': {
        const { cloneAddClientTool } = await import('../../agents/tools/cloneTools');
        const result = await (cloneAddClientTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)(input);
        return { ...result, data: result };
      }
      case 'create_lead': {
        const { cloneCreateLeadTool } = await import('../../agents/tools/salesTools');
        const result = await (cloneCreateLeadTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)({
          ...input,
          name: input.clientName ?? (action.params['name'] as string),
          phone: input.clientPhone ?? (action.params['phone'] as string),
          email: input.clientEmail ?? (action.params['email'] as string),
          interest: action.params['interest'] as string,
        });
        return { ...result, data: result };
      }
      case 'create_quote_request': {
        const { cloneCreateQuoteRequestTool } = await import('../../agents/tools/salesTools');
        const result = await (cloneCreateQuoteRequestTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)(input);
        return { ...result, data: result };
      }
      case 'send_email': {
        const { cloneSendEmailTool } = await import('../../agents/tools/cloneTools');
        const result = await (cloneSendEmailTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)({
          ...input,
          to: input.to ?? input.clientEmail,
        });
        return { ...result, data: result };
      }
      case 'create_support_ticket': {
        const { cloneCreateSupportTicketTool } = await import('../../agents/tools/cloneTools');
        const result = await (cloneCreateSupportTicketTool as unknown as (i: unknown) => Promise<{ success: boolean; message: string }>)({
          ...input,
          subject: input.subject ?? 'Tâche réunion',
          description: (action.params['description'] as string) ?? action.sourceQuote ?? '',
        });
        return { ...result, data: result };
      }
      case 'reminder':
        // No tool — just a note. Return success so UI marks as done.
        return { success: true, message: 'Rappel enregistré (aucune exécution automatique).' };
      default:
        return { success: false, message: `Type inconnu: ${action.type}` };
    }
  } catch (err) {
    logger.error('[ActionEngine] executeAction failed', { type: action.type, err: String(err) });
    return { success: false, message: `Erreur: ${String(err)}` };
  }
}
