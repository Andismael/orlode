"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENSITIVE_ACTIONS = exports.DEFAULT_ENGINE_CONFIG = exports.ACTION_TYPES = void 0;
exports.getEngineConfig = getEngineConfig;
exports.isAutoExecutable = isAutoExecutable;
exports.detectActionsFromTranscript = detectActionsFromTranscript;
exports.executeAction = executeAction;
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
const genkit_config_1 = require("../../config/genkit.config");
const zod_1 = require("zod");
const firebase_config_1 = require("../../config/firebase.config");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
exports.ACTION_TYPES = [
    'create_appointment',
    'create_reservation',
    'add_client',
    'create_lead',
    'create_quote_request',
    'send_email',
    'create_support_ticket',
    'reminder', // manual follow-up — no tool, just a note
];
exports.DEFAULT_ENGINE_CONFIG = {
    mode: 'semi_auto',
    autoExecuteThreshold: 0.9,
};
/** Action types that should NEVER auto-execute — always require human validation */
exports.SENSITIVE_ACTIONS = [
    'send_email', // outgoing communication to clients
    'create_quote_request', // contractual / financial
];
/** Read engine config from company settings. Returns default if missing. */
async function getEngineConfig(companyId) {
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).get();
        const settings = doc.data()?.['settings'] ?? {};
        const mode = settings['actionEngineMode'] ?? exports.DEFAULT_ENGINE_CONFIG.mode;
        const raw = settings['autoExecuteThreshold'];
        const threshold = typeof raw === 'number' ? raw : exports.DEFAULT_ENGINE_CONFIG.autoExecuteThreshold;
        return { mode, autoExecuteThreshold: Math.max(0, Math.min(1, threshold)) };
    }
    catch {
        return exports.DEFAULT_ENGINE_CONFIG;
    }
}
/** Decide whether an action is eligible for auto-execution given the config. */
function isAutoExecutable(action, cfg) {
    if (cfg.mode !== 'auto')
        return false;
    if (exports.SENSITIVE_ACTIONS.includes(action.type))
        return false;
    return action.confidence >= cfg.autoExecuteThreshold;
}
const ActionJsonSchema = zod_1.z.object({
    actions: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(exports.ACTION_TYPES),
        confidence: zod_1.z.number().min(0).max(1),
        params: zod_1.z.object({
            // Shared
            clientName: zod_1.z.string().optional(),
            clientPhone: zod_1.z.string().optional(),
            clientEmail: zod_1.z.string().optional(),
            // Appointments / reservations
            date: zod_1.z.string().optional().describe('YYYY-MM-DD'),
            time: zod_1.z.string().optional().describe('HH:MM'),
            service: zod_1.z.string().optional(),
            resourceType: zod_1.z.string().optional(),
            // Sales
            interest: zod_1.z.string().optional(),
            estimatedValue: zod_1.z.number().optional(),
            items: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string(), quantity: zod_1.z.number().optional(),
            })).optional(),
            // Email
            to: zod_1.z.string().optional(),
            subject: zod_1.z.string().optional(),
            body: zod_1.z.string().optional(),
            // Support / reminder
            description: zod_1.z.string().optional(),
            priority: zod_1.z.string().optional(),
            note: zod_1.z.string().optional(),
        }).passthrough(),
        sourceQuote: zod_1.z.string().optional().describe('The sentence from the transcript that triggered this action'),
    })),
});
async function detectActionsFromTranscript(transcript, contextHint) {
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
        const response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            system: systemPrompt + `\n\nContexte: Aujourd'hui = ${today}.${contextHint ? ` ${contextHint}` : ''}`,
            prompt: `Analyse ce transcript et extrais toutes les actions:\n\n${transcript}`,
            output: { schema: ActionJsonSchema },
        });
        const output = response.output;
        if (!output?.actions)
            return [];
        return output.actions.map(a => ({
            id: (0, helpers_1.generateId)(),
            type: a.type,
            confidence: a.confidence,
            status: 'pending',
            params: a.params,
            sourceQuote: a.sourceQuote,
            createdAt: new Date(),
        }));
    }
    catch (err) {
        logger_1.logger.error('[ActionEngine] detectActionsFromTranscript failed', { err: String(err) });
        return [];
    }
}
/** Execute an action via the Clone-safe tools. Returns the tool's result. */
async function executeAction(companyId, action) {
    try {
        const input = { ...action.params, companyId };
        switch (action.type) {
            case 'create_appointment': {
                const { cloneCreateAppointmentTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/cloneTools')));
                const result = await cloneCreateAppointmentTool(input);
                return { ...result, data: result };
            }
            case 'create_reservation': {
                const { cloneCreateReservationTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/reservationTools')));
                const result = await cloneCreateReservationTool(input);
                return { ...result, data: result };
            }
            case 'add_client': {
                const { cloneAddClientTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/cloneTools')));
                const result = await cloneAddClientTool(input);
                return { ...result, data: result };
            }
            case 'create_lead': {
                const { cloneCreateLeadTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/salesTools')));
                const result = await cloneCreateLeadTool({
                    ...input,
                    name: input.clientName ?? action.params['name'],
                    phone: input.clientPhone ?? action.params['phone'],
                    email: input.clientEmail ?? action.params['email'],
                    interest: action.params['interest'],
                });
                return { ...result, data: result };
            }
            case 'create_quote_request': {
                const { cloneCreateQuoteRequestTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/salesTools')));
                const result = await cloneCreateQuoteRequestTool(input);
                return { ...result, data: result };
            }
            case 'send_email': {
                const { cloneSendEmailTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/cloneTools')));
                const result = await cloneSendEmailTool({
                    ...input,
                    to: input.to ?? input.clientEmail,
                });
                return { ...result, data: result };
            }
            case 'create_support_ticket': {
                const { cloneCreateSupportTicketTool } = await Promise.resolve().then(() => __importStar(require('../../agents/tools/cloneTools')));
                const result = await cloneCreateSupportTicketTool({
                    ...input,
                    subject: input.subject ?? 'Tâche réunion',
                    description: action.params['description'] ?? action.sourceQuote ?? '',
                });
                return { ...result, data: result };
            }
            case 'reminder':
                // No tool — just a note. Return success so UI marks as done.
                return { success: true, message: 'Rappel enregistré (aucune exécution automatique).' };
            default:
                return { success: false, message: `Type inconnu: ${action.type}` };
        }
    }
    catch (err) {
        logger_1.logger.error('[ActionEngine] executeAction failed', { type: action.type, err: String(err) });
        return { success: false, message: `Erreur: ${String(err)}` };
    }
}
//# sourceMappingURL=actionEngineService.js.map