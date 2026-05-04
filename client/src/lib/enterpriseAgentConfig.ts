/**
 * enterpriseAgentConfig — Gemini Live voice agent wired to the Clone engine.
 * One tool, one backend. The Clone already has company data + all agents.
 */
import type { LiveConfig, LiveToolDecl, LiveToolExecutor } from '@/hooks/useGeminiLive';
import api from '@/services/api';

export interface EnterpriseContext {
  companyName: string;
  companyId: string;
  userName: string;
  userRole?: string;
  userEmail?: string;
  language?: string;
  /** 'enterprise' = logged-in employee; 'kiosk' = reception visitor */
  mode?: 'enterprise' | 'kiosk';
}

const LANG_LABEL: Record<string, string> = {
  fr: 'français', en: 'anglais', es: 'espagnol', ar: 'arabe', de: 'allemand', pt: 'portugais',
};

// Session ID persists for the tab — lets the Clone engine keep conversation context
let cloneSessionId: string | null = null;
function getSessionId(): string {
  if (!cloneSessionId) cloneSessionId = `voice-${crypto.randomUUID()}`;
  return cloneSessionId;
}

export function buildEnterpriseSystemPrompt(ctx: EnterpriseContext): string {
  const lang = LANG_LABEL[ctx.language ?? 'fr'] ?? 'français';
  const sharedRules = `
━━━ PROTOCOLE OBLIGATOIRE — SUIS-LE À LA LETTRE ━━━
1. Quand tu reçois une demande, APPELLE "ask" IMMÉDIATEMENT.
2. RESTE TOTALEMENT SILENCIEUX pendant que "ask" s'exécute. Ne dis RIEN, pas même "un instant".
3. Quand "ask" répond, lis UNIQUEMENT la réponse du tool — reformulée naturellement.
4. N'émets JAMAIS deux messages pour une même demande. Un tour = une seule réponse.
5. N'invente JAMAIS d'info (étage, disponibilité, horaires, noms). Tout passe par "ask".

INTERDICTIONS ABSOLUES :
✗ Parler avant d'avoir appelé "ask"
✗ Parler pendant que "ask" s'exécute
✗ Parler sans attendre la réponse du tool
✗ Donner deux réponses différentes sur la même question
✗ Improviser une réponse "en attendant" le tool

EXCEPTION (seule autorisée) :
Salutations courtes ("Bonjour", "Merci") — réponse brève sans tool, puis attendre la vraie demande.
`;

  if (ctx.mode === 'kiosk') {
    return `Tu es la VOIX de la RÉCEPTION de ${ctx.companyName}. Visiteurs à l'accueil — pas des employés.
${sharedRules}

FLOW VISITEUR :
1. Accueil : "Bonjour ! Bienvenue chez ${ctx.companyName}."
2. Tu écoutes sa demande.
3. Tu appelles "ask" AVEC le contexte visiteur. Exemples :
   • "Je viens voir Sara" → ask("Un visiteur à l'accueil demande à voir Sara. Vérifie si elle existe et donne son département/poste.")
   • "Je veux prendre RDV avec Marc" → ask("Un visiteur à l'accueil veut un rendez-vous avec Marc. Quelles sont ses disponibilités ?")
   • "Où est Marketing ?" → ask("Où se trouve le département Marketing dans l'entreprise ?")
   • "Quels sont vos horaires ?" → ask("Horaires d'ouverture de l'entreprise ?")
4. Tu attends EN SILENCE la réponse.
5. Tu lis la réponse en 1-2 phrases courtes, chaleureux.
6. Si tool dit "personne introuvable" → "Je n'ai pas trouvé [Nom], pouvez-vous épeler ?"

Langue : ${lang}. Ton : chaleureux, bref, professionnel.
Tu représentes ${ctx.companyName}.`;
  }

  // Default: enterprise employee mode
  return `Tu es la VOIX de ${ctx.companyName}. Tu parles à ${ctx.userName}${ctx.userRole ? ` (${ctx.userRole})` : ''}.
${sharedRules}

FLOW EMPLOYÉ :
1. Tu écoutes la demande.
2. Tu appelles "ask" avec la question telle quelle.
3. Tu attends EN SILENCE la réponse.
4. Tu lis la réponse, reformulée en phrases courtes pour l'oral.

HORS-SUJET (météo, actualités, trivia) :
"Je suis l'assistant de ${ctx.companyName}. Pose-moi une question sur ton entreprise : employés, congés, factures, ventes, réception, support."

Langue : ${lang}. Bref et précis. Pas de bavardage.`;
}

// ──────────────────────────────────────────────────────────────────────────
// Single tool — routes everything to the Clone engine
// ──────────────────────────────────────────────────────────────────────────

export const ENTERPRISE_TOOLS: LiveToolDecl[] = [
  {
    functionDeclarations: [
      {
        name: 'ask',
        description: "Pose une question au cerveau de l'entreprise. Il a accès à : employés, congés, fiches de paie, contrats, factures, budget, dépenses, clients, leads, devis, tickets support, visiteurs, rendez-vous, documents, base de connaissances. Appelle ce tool pour TOUTE question factuelle.",
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: "La question de l'utilisateur, en langage naturel, telle quelle",
            },
          },
          required: ['question'],
        },
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Executor — calls /api/clone/:companyId/chat (same endpoint as messaging clone)
// ──────────────────────────────────────────────────────────────────────────

export function makeEnterpriseToolExecutor(ctx: EnterpriseContext): LiveToolExecutor {
  return async (name, args) => {
    if (name !== 'ask') return { error: `Tool inconnu: ${name}` };
    const question = (args['question'] as string) ?? '';
    if (!question.trim()) return { reply: "Reformule ta question." };

    try {
      // Both kiosk and enterprise route to the SAME Clone engine
      // (same brain used by WhatsApp + widget — has full company data + agent dispatch)
      const isKiosk = ctx.mode === 'kiosk';
      const r = await api.post(`/clone/${ctx.companyId}/chat`, {
        message: question,
        sessionId: getSessionId(),
        channel: 'voice',
        visitorName: ctx.userName,
        visitorEmail: ctx.userEmail,
        context: isKiosk ? 'reception-kiosk' : 'enterprise-employee',
        userRole: ctx.userRole,
      });
      const d = r.data as Record<string, unknown> | undefined;
      const reply = (d?.['reply'] ?? d?.['message'] ?? d?.['text']) as string | undefined;

      // Kiosk: expose hostNotificationId for polling
      if (isKiosk) {
        const hostNotificationId = d?.['hostNotificationId'] as string | undefined;
        if (hostNotificationId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kiosk:host-notification', { detail: { id: hostNotificationId } }));
        }
      }
      return { reply: reply ?? "Je n'ai pas trouvé d'info sur ça." };
    } catch (err) {
      const msg = (err as Error).message ?? 'Erreur';
      return { reply: `Problème de connexion au cerveau : ${msg}` };
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────
// One-call helper
// ──────────────────────────────────────────────────────────────────────────

export function buildEnterpriseLiveConfig(ctx: EnterpriseContext, opts?: { voiceName?: string }): LiveConfig {
  return {
    language: ctx.language ?? 'fr',
    voiceName: opts?.voiceName ?? 'Kore',
    systemInstruction: buildEnterpriseSystemPrompt(ctx),
    tools: ENTERPRISE_TOOLS,
    onToolCall: makeEnterpriseToolExecutor(ctx),
  };
}
